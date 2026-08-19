import Bootcamp from "../models/Bootcamp.js";
import BootcampRegistration from "../models/BootcampRegistration.js";
import Course from "../models/Course.js";
import Category from "../models/Category.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import generateSlug from "../utils/generateSlug.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";
import { publishCourseEnrollmentEvents } from "../services/courseNotification.service.js";
import { deleteCourseWithRelationsByFilter } from "../services/courseCascadeDelete.service.js";
import { removeBootcampCoverIfLocal, saveBootcampCoverFromBuffer } from "../utils/bootcampCover.js";
import { BOOTCAMP_TIME_ZONE } from "../utils/bootcampTimeMigration.js";

const courseSelect = "title slug thumbnail status isPublished isFree price teacher createdBy meetingType schedule startDate endDate classStartedAt classEndedAt classCancelledAt";

const populateCourse = (query) => query.populate({
  path: "courseId",
  select: courseSelect,
  populate: [
    { path: "teacher", select: "name avatar" },
    { path: "createdBy", select: "name avatar" },
  ],
});

const getOpenState = (bootcamp, now = new Date()) => {
  const opensAt = bootcamp.registrationOpensAt ? new Date(bootcamp.registrationOpensAt) : null;
  const closesAt = bootcamp.registrationClosesAt ? new Date(bootcamp.registrationClosesAt) : null;
  if (String(bootcamp.status) !== "registration_open") return false;
  if (opensAt && now < opensAt) return false;
  if (closesAt && now >= closesAt) return false;
  return Number(bootcamp.registeredCount || 0) < Number(bootcamp.maximumStudents || 0);
};

const publicBootcamp = (document) => {
  const value = typeof document?.toObject === "function" ? document.toObject() : document || {};
  const registeredCount = Math.max(0, Number(value.registeredCount || 0));
  const minimumStudents = Math.max(1, Number(value.minimumStudents || 1));
  const maximumStudents = Math.max(minimumStudents, Number(value.maximumStudents || minimumStudents));
  const course = value.courseId && typeof value.courseId === "object" ? value.courseId : null;
  const teacher = course?.teacher || course?.createdBy || null;
  return {
    _id: value._id,
    teacherId: value.teacherId,
    title: value.title,
    description: value.description,
    slug: value.slug,
    coverImage: value.coverImage || course?.thumbnail || "",
    status: value.status,
    minimumStudents,
    maximumStudents,
    registeredCount,
    remainingToMinimum: Math.max(0, minimumStudents - registeredCount),
    minimumReached: registeredCount >= minimumStudents,
    registrationOpen: getOpenState(value),
    registrationOpensAt: value.registrationOpensAt || null,
    registrationClosesAt: value.registrationClosesAt || null,
    plannedStartAt: value.plannedStartAt || null,
    course: course ? {
      _id: course._id,
      title: course.title,
      slug: course.slug,
      thumbnail: course.thumbnail || "",
      startDate: course.startDate || null,
      endDate: course.endDate || null,
      schedule: course.schedule || [],
      meetingType: course.meetingType || "google_meet",
      teacher: teacher ? { _id: teacher._id, name: teacher.name, avatar: teacher.avatar || "" } : null,
    } : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const ensureFreePublishedCourse = async (courseId) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(400, "Selected course does not exist");
  if (!course.isPublished || String(course.status) !== "published") {
    throw new ApiError(400, "Bootcamp course must be published");
  }
  if (!course.isFree && Number(course.price || 0) > 0) {
    throw new ApiError(400, "Bootcamp course must be free");
  }
  if (course.classEndedAt || course.classCancelledAt) {
    throw new ApiError(400, "Completed or cancelled courses cannot be used for a bootcamp");
  }
  return course;
};

const buildUniqueSlug = async (title, excludedId = null) => {
  const base = (generateSlug(title?.en || title?.fa || "") || `bootcamp-${Date.now()}`).slice(0, 150);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const exists = await Bootcamp.exists({ slug, ...(excludedId ? { _id: { $ne: excludedId } } : {}) });
    if (!exists) return slug;
  }
  throw new ApiError(409, "Could not generate a unique bootcamp URL");
};

const localizedBootcampTitle = (title = {}) => String(title.en || title.fa || "EduTech Bootcamp").trim();

const internalCourseDescription = (description = {}, title = {}) => {
  const source = String(description.en || description.fa || "").trim();
  let value = source || `Free live bootcamp for ${localizedBootcampTitle(title)}.`;
  while (value.length < 120) {
    value += " Students learn in instructor-led live sessions and receive session access through their EduTech dashboard.";
  }
  return value.slice(0, 2000);
};

const ensureAssignedTeacher = async (teacherId) => {
  const teacher = await User.findOne({ _id: teacherId, role: "teacher", status: "active" }).select("_id");
  if (!teacher) throw new ApiError(400, "Selected teacher does not exist or is not active");
  return teacher;
};

const createInternalBootcampCourse = async ({ payload, adminId }) => {
  await ensureAssignedTeacher(payload.teacherId);
  const category = await Category.findOneAndUpdate(
    { slug: "edutech-bootcamps" },
    {
      $setOnInsert: {
        name: "EduTech Bootcamps",
        slug: "edutech-bootcamps",
        description: "Internal delivery records for EduTech bootcamps",
        isActive: false,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return Course.create({
    title: `Bootcamp · ${localizedBootcampTitle(payload.title)}`.slice(0, 120),
    description: internalCourseDescription(payload.description, payload.title),
    category: category._id,
    teacher: payload.teacherId,
    teacherId: payload.teacherId,
    createdBy: adminId,
    thumbnail: payload.coverImage || "",
    isFree: true,
    isBootcampInternal: true,
    price: 0,
    discountPrice: 0,
    status: "published",
    isPublished: true,
    lifecycleStatus: "enrollment_open",
    certificate: { enabled: false, fullPaymentRequired: false },
    maxStudents: payload.maximumStudents,
    minimumStudentsToStart: payload.minimumStudents,
    startDate: payload.plannedStartAt || undefined,
    meetingType: "google_meet",
  });
};

const syncInternalCourse = async (bootcamp) => {
  await Course.updateOne(
    { _id: bootcamp.courseId },
    {
      $set: {
        title: `Bootcamp · ${localizedBootcampTitle(bootcamp.title)}`.slice(0, 120),
        description: internalCourseDescription(bootcamp.description, bootcamp.title),
        teacher: bootcamp.teacherId,
        teacherId: bootcamp.teacherId,
        thumbnail: bootcamp.coverImage || "",
        minimumStudentsToStart: bootcamp.minimumStudents,
        maxStudents: bootcamp.maximumStudents,
        startDate: bootcamp.plannedStartAt || null,
      },
    },
    { runValidators: true },
  );
};

export const getPublicBootcamps = asyncHandler(async (_req, res) => {
  const rows = await populateCourse(
    Bootcamp.find({ status: { $nin: ["draft", "cancelled"] } }).sort({ createdAt: -1 }),
  );
  res.set("Cache-Control", "no-cache, must-revalidate");
  return res.json(new ApiResponse({ message: "Bootcamps fetched successfully", data: rows.map(publicBootcamp) }));
});

export const getPublicBootcampBySlug = asyncHandler(async (req, res) => {
  const row = await populateCourse(Bootcamp.findOne({ slug: req.params.slug, status: { $ne: "draft" } }));
  if (!row || String(row.status) === "cancelled") throw new ApiError(404, "Bootcamp not found");
  res.set("Cache-Control", "no-cache, must-revalidate");
  return res.json(new ApiResponse({ message: "Bootcamp fetched successfully", data: publicBootcamp(row) }));
});

export const getAdminBootcamps = asyncHandler(async (_req, res) => {
  const rows = await populateCourse(Bootcamp.find().sort({ updatedAt: -1 }));
  return res.json(new ApiResponse({ message: "Bootcamps fetched successfully", data: rows.map(publicBootcamp) }));
});

export const uploadBootcampCover = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, "Please select a bootcamp cover image");
  const coverImage = await saveBootcampCoverFromBuffer(req.user._id, req.file.buffer);
  return res.status(201).json(new ApiResponse({
    message: "Bootcamp cover uploaded successfully",
    data: { coverImage },
  }));
});

export const createBootcamp = asyncHandler(async (req, res) => {
  const internalCourse = await createInternalBootcampCourse({ payload: req.body, adminId: req.user._id });
  let row;
  try {
    row = await Bootcamp.create({
      ...req.body,
      courseId: internalCourse._id,
      slug: await buildUniqueSlug(req.body.title),
      createdBy: req.user._id,
      scheduleTimeZone: BOOTCAMP_TIME_ZONE,
    });
  } catch (error) {
    await Course.deleteOne({ _id: internalCourse._id });
    throw error;
  }
  return res.status(201).json(new ApiResponse({ message: "Bootcamp created successfully", data: row }));
});

export const updateBootcamp = asyncHandler(async (req, res) => {
  const row = await Bootcamp.findById(req.params.id);
  if (!row) throw new ApiError(404, "Bootcamp not found");
  if (req.body.teacherId) await ensureAssignedTeacher(req.body.teacherId);
  const previousCoverImage = row.coverImage;
  Object.assign(row, req.body);
  if (Number(row.minimumStudents) > Number(row.maximumStudents)) {
    throw new ApiError(400, "Minimum students cannot exceed maximum students");
  }
  await row.save();
  if (
    Object.prototype.hasOwnProperty.call(req.body, "coverImage")
    && req.body.coverImage !== previousCoverImage
  ) {
    await removeBootcampCoverIfLocal(previousCoverImage);
  }
  await syncInternalCourse(row);
  return res.json(new ApiResponse({ message: "Bootcamp updated successfully", data: row }));
});

export const deleteBootcamp = asyncHandler(async (req, res) => {
  const row = await Bootcamp.findById(req.params.id);
  if (!row) throw new ApiError(404, "Bootcamp not found");

  // Close registration before removing related records so a concurrent public
  // registration cannot be accepted while the deletion is in progress.
  await Bootcamp.updateOne(
    { _id: row._id },
    { $set: { status: "cancelled" } },
  );

  const registrationResult = await BootcampRegistration.deleteMany({
    bootcampId: row._id,
  });
  const courseResult = await deleteCourseWithRelationsByFilter({
    _id: row.courseId,
    isBootcampInternal: true,
  });
  await Bootcamp.deleteOne({ _id: row._id });
  await removeBootcampCoverIfLocal(row.coverImage);
  return res.json(new ApiResponse({
    message: "Bootcamp and its registrations were deleted successfully",
    data: {
      id: row._id,
      removedRegistrations: Number(registrationResult?.deletedCount || 0),
      removedCourseRelations: courseResult?.removed || null,
    },
  }));
});

export const getAdminBootcampRegistrations = asyncHandler(async (req, res) => {
  const bootcamp = await Bootcamp.findById(req.params.id).select("_id");
  if (!bootcamp) throw new ApiError(404, "Bootcamp not found");
  const rows = await BootcampRegistration.find({ bootcampId: bootcamp._id })
    .populate("studentId", "name email phone country avatar")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(new ApiResponse({ message: "Bootcamp registrations fetched successfully", data: rows }));
});

export const registerForBootcamp = asyncHandler(async (req, res) => {
  const now = new Date();
  const bootcamp = await Bootcamp.findOne({ slug: req.params.slug });
  if (!bootcamp) throw new ApiError(404, "Bootcamp not found");

  const existing = await BootcampRegistration.findOne({
    bootcampId: bootcamp._id,
    studentId: req.user._id,
  });
  if (existing && !["cancelled", "rejected"].includes(String(existing.status))) {
    const data = { ...existing.toObject(), alreadyRegistered: true };
    return res.json(new ApiResponse({ message: "You are already registered for this bootcamp", data }));
  }
  if (!getOpenState(bootcamp, now)) {
    throw new ApiError(409, "Bootcamp registration is not currently open");
  }

  const course = await ensureFreePublishedCourse(bootcamp.courseId);
  const claimed = await Bootcamp.findOneAndUpdate(
    {
      _id: bootcamp._id,
      status: "registration_open",
      registeredCount: Number(bootcamp.registeredCount || 0),
    },
    { $inc: { registeredCount: 1 } },
    { returnDocument: "after" },
  );
  if (!claimed || Number(claimed.registeredCount) > Number(claimed.maximumStudents)) {
    if (claimed) await Bootcamp.updateOne({ _id: claimed._id }, { $inc: { registeredCount: -1 } });
    throw new ApiError(409, "Bootcamp capacity changed. Please try again");
  }

  let registration;
  let enrollment;
  let enrollmentWasCreated = false;
  try {
    registration = existing || await BootcampRegistration.create({
      bootcampId: claimed._id,
      studentId: req.user._id,
      phone: req.body.phone,
      country: req.body.country,
      experienceLevel: req.body.experienceLevel,
      motivation: req.body.motivation,
      preferredSchedule: req.body.preferredSchedule,
      source: req.body.source,
      status: "registered",
    });
    if (existing) {
      Object.assign(registration, req.body, { status: "registered" });
      await registration.save();
    }

    const enrollmentResult = await Enrollment.updateOne(
      { studentId: req.user._id, courseId: course._id },
      {
        $set: {
          enrollmentStatus: "active",
          accessStatus: "allowed",
          status: "active",
        },
        $unset: { accessStartsAt: 1, accessExpiresAt: 1 },
        $setOnInsert: { enrolledAt: now, paymentPlan: "whole_period" },
      },
      { upsert: true },
    );
    enrollmentWasCreated = enrollmentResult.upsertedCount > 0;
    enrollment = await Enrollment.findOne({ studentId: req.user._id, courseId: course._id });
    if (!enrollment) throw new ApiError(500, "Bootcamp enrollment could not be created");
    registration.enrollmentId = enrollment._id;
    await registration.save();
  } catch (error) {
    if (!existing && registration?._id) await BootcampRegistration.deleteOne({ _id: registration._id });
    if (enrollmentWasCreated && enrollment?._id) await Enrollment.deleteOne({ _id: enrollment._id });
    await Bootcamp.updateOne({ _id: claimed._id, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
    if (error?.code === 11000) {
      const duplicate = await BootcampRegistration.findOne({ bootcampId: claimed._id, studentId: req.user._id });
      if (duplicate) {
        const data = { ...duplicate.toObject(), alreadyRegistered: true };
        return res.json(new ApiResponse({ message: "You are already registered for this bootcamp", data }));
      }
    }
    throw error;
  }

  try {
    const activeEnrollmentCount = await Enrollment.countDocuments({
      courseId: course._id,
      enrollmentStatus: { $in: ["active", "completed"] },
      accessStatus: "allowed",
    });
    await Course.updateOne({ _id: course._id }, { $set: { enrolledStudentsCount: activeEnrollmentCount } });
    course.enrolledStudentsCount = activeEnrollmentCount;
    await ensureCourseAutoStarted(course, { activeStudentsCount: activeEnrollmentCount });
    if (enrollmentWasCreated) {
      await publishCourseEnrollmentEvents({
        courseId: course._id,
        enrollmentId: enrollment._id,
        studentId: req.user._id,
      });
    }
    if (Number(claimed.registeredCount) >= Number(claimed.minimumStudents) && !claimed.minimumReachedAt) {
      await Bootcamp.updateOne({ _id: claimed._id, minimumReachedAt: null }, { $set: { minimumReachedAt: now } });
    }
  } catch (sideEffectError) {
    console.error("Bootcamp registration post-processing error:", sideEffectError?.message || sideEffectError);
  }

  return res.status(existing ? 200 : 201).json(new ApiResponse({
    message: "Bootcamp registration completed successfully",
    data: { ...registration.toObject(), alreadyRegistered: false },
  }));
});

export const getStudentBootcampRegistrations = asyncHandler(async (req, res) => {
  const rows = await BootcampRegistration.find({ studentId: req.user._id, status: { $ne: "rejected" } })
    .populate({ path: "bootcampId", populate: { path: "courseId", select: courseSelect, populate: { path: "teacher", select: "name avatar" } } })
    .sort({ createdAt: -1 });
  return res.json(new ApiResponse({
    message: "Student bootcamp registrations fetched successfully",
    data: rows.filter((row) => row.bootcampId).map((row) => ({
      _id: row._id,
      status: row.status,
      phone: row.phone,
      country: row.country,
      registeredAt: row.createdAt,
      bootcamp: publicBootcamp(row.bootcampId),
    })),
  }));
});
