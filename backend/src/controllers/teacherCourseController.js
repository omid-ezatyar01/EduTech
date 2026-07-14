import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import AdminNotification from "../models/AdminNotification.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  removeOldCourseThumbnailIfLocal,
  saveCourseThumbnailFromBuffer,
} from "../utils/courseImage.js";
import { deleteCourseWithRelationsByFilter } from "../services/courseCascadeDelete.service.js";
import {
  getPlatformPricingSettings,
  normalizeTeacherCourseDiscountPercentage,
} from "../utils/platformSettings.js";
import { buildCertificateId, normalizeCertificateId } from "../utils/certificate.js";
import {
  buildCourseCategoryFilter,
  resolveCourseCategoryAssignment,
} from "../utils/courseCategory.js";
import { notifyAdminCourseReview } from "../services/webPush.service.js";
import {
  deriveCourseSchedule,
  getUniqueTeachingDays,
} from "../utils/courseSchedule.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";

const buildSort = ({ sortBy = "newest", sortOrder = "desc" }) => {
  if (sortBy === "price") return { price: sortOrder === "asc" ? 1 : -1 };
  if (sortBy === "startDate") return { startDate: sortOrder === "asc" ? 1 : -1 };
  return { createdAt: -1 };
};

const ownCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});
const DUPLICATE_COURSE_STATUSES = ["draft", "pending", "approved", "published", "rejected"];

const normalizeDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const sameDateTime = (left, right) => normalizeDateTime(left) === normalizeDateTime(right);

const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameLocalDate = (left, right) =>
  Boolean(localDateKey(left)) && localDateKey(left) === localDateKey(right);

const normalizeScheduleRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || "").trim(),
      startTime: String(row?.startTime || "").trim(),
      endTime: String(row?.endTime || "").trim(),
    }))
    .sort((left, right) =>
      `${left.day}|${left.startTime}|${left.endTime}`.localeCompare(
        `${right.day}|${right.startTime}|${right.endTime}`,
      ),
    );

const sameSchedule = (left, right) =>
  JSON.stringify(normalizeScheduleRows(left)) === JSON.stringify(normalizeScheduleRows(right));

const resolveCourseTotalSessions = (course) => {
  const storedTotal = Number(course?.totalSessions);
  if (Number.isInteger(storedTotal) && storedTotal > 0) return storedTotal;
  return Number(course?.durationWeeks || 0) * getUniqueTeachingDays(course?.schedule).size;
};

const applyTeacherSessionSchedule = (payload, fallbackCourse = null) => {
  const schedule = payload.schedule ?? fallbackCourse?.schedule ?? [];
  const totalSessions = Number(
    payload.totalSessions ?? resolveCourseTotalSessions(fallbackCourse),
  );
  const startDate = payload.startDate ?? fallbackCourse?.startDate;

  if (!Number.isInteger(totalSessions) || totalSessions < 8) {
    throw new ApiError(400, "A course must have at least 8 sessions");
  }
  if (getUniqueTeachingDays(schedule).size < 2) {
    throw new ApiError(400, "Select at least two teaching days per week");
  }

  const derived = deriveCourseSchedule({ startDate, schedule, totalSessions });
  if (!derived) {
    throw new ApiError(400, "The course session schedule is invalid or exceeds 104 weeks");
  }

  payload.totalSessions = totalSessions;
  payload.durationWeeks = derived.durationWeeks;
  payload.endDate = derived.endDate;
};

const normalizePreviewVideoUrls = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeCourseDuplicateText = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const hasSameCourseIdentity = (existingCourse, payload) => {
  const existingTitle = normalizeCourseDuplicateText(existingCourse?.title);
  const nextTitle = normalizeCourseDuplicateText(payload?.title);
  if (!existingTitle || !nextTitle || existingTitle !== nextTitle) return false;

  const existingCategory = String(existingCourse?.category?._id || existingCourse?.category || "");
  const nextCategory = String(payload?.category || "");
  if (existingCategory && nextCategory && existingCategory !== nextCategory) return false;

  const existingLanguage = normalizeCourseDuplicateText(existingCourse?.language);
  const nextLanguage = normalizeCourseDuplicateText(payload?.language);
  if (existingLanguage && nextLanguage && existingLanguage !== nextLanguage) return false;

  const existingCourseType = String(existingCourse?.courseType || "").trim().toLowerCase();
  const nextCourseType = String(payload?.courseType || "").trim().toLowerCase();
  if (existingCourseType && nextCourseType && existingCourseType !== nextCourseType) return false;

  return true;
};

const roundCurrencyAmount = (value, decimalPlaces = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round(numeric * factor) / factor;
};

const normalizeCoursePriceInput = (value) =>
  roundCurrencyAmount(Math.max(0, Number(value || 0)), 1);

const getApprovedTeacherLanguages = (user) => {
  const seen = new Set();
  const rows = Array.isArray(user?.teacherApplication?.languages)
    ? user.teacherApplication.languages
    : [];
  return rows
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const ensureTeacherCanTeachCourseLanguage = (user, language) => {
  const requestedLanguage = String(language || "").trim();
  const teacherLanguages = getApprovedTeacherLanguages(user);
  const matchedLanguage = teacherLanguages.find(
    (item) => item.toLowerCase() === requestedLanguage.toLowerCase(),
  );

  if (!requestedLanguage || !matchedLanguage) {
    throw new ApiError(
      400,
      "Course language must be one of the teaching languages selected in your teacher profile",
    );
  }

  return matchedLanguage;
};

const isPaidCourse = (course = null) =>
  !Boolean(course?.isFree) && Number(course?.price || 0) > 0;

const ensureEnrollmentCertificate = (enrollment, fallbackDate, course = null) => {
  if (!isPaidCourse(course)) {
    return {
      issuedAt: null,
      certificateId: null,
    };
  }

  const issuedAt = enrollment?.certificateIssuedAt || fallbackDate || new Date();
  const certificateId = normalizeCertificateId(
    enrollment?.certificateId || buildCertificateId(enrollment?._id, issuedAt),
  );

  return {
    issuedAt,
    certificateId,
  };
};

export const getTeacherCoursePricingSettings = asyncHandler(async (_req, res) => {
  const pricing = await getPlatformPricingSettings();
  return res.json(
    new ApiResponse({
      message: "Teacher course pricing settings fetched successfully",
      data: pricing,
    }),
  );
});

export const createTeacherCourse = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  delete payload.shortDescription;
  const pricing = await getPlatformPricingSettings();

  const categoryAssignment = await resolveCourseCategoryAssignment(
    payload.category,
    payload.subcategory,
  );
  payload.category = categoryAssignment.categoryId;
  payload.subcategory = categoryAssignment.subcategoryId;
  payload.language = ensureTeacherCanTeachCourseLanguage(req.user, payload.language);

  if (!req.file?.buffer) {
    throw new ApiError(400, "Course image is required");
  }

  if (req.file?.buffer) {
    payload.thumbnail = await saveCourseThumbnailFromBuffer(req.user._id, req.file.buffer);
  }

  payload.teacher = req.user._id;
  payload.teacherId = req.user._id;
  payload.createdBy = req.user._id;
  payload.status = "pending";
  payload.isPublished = false;
  payload.currency = "USD";
  payload.isFree = Boolean(payload.isFree);
  payload.price = normalizeCoursePriceInput(payload.price);
  payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
  payload.promoVideo = payload.previewVideoUrls[0] || "";
  applyTeacherSessionSchedule(payload);

  const existingTeacherCourses = await Course.find({
    ...ownCourseFilter(req.user._id),
    status: { $in: DUPLICATE_COURSE_STATUSES },
    title: new RegExp(`^${String(payload.title || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  })
    .select("title category language courseType status")
    .populate("category", "_id");

  const duplicateCourse = existingTeacherCourses.find((course) => hasSameCourseIdentity(course, payload));
  if (duplicateCourse) {
    throw new ApiError(
      409,
      "You have already submitted this course. Please edit the existing course instead of creating it again.",
    );
  }

  if (payload.isFree) {
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else {
    payload.teacherDiscountPercentage = normalizeTeacherCourseDiscountPercentage(
      payload.teacherDiscountPercentage,
    );
    payload.discountPrice = Math.max(
      0,
      roundCurrencyAmount(
        Number(payload.price || 0) -
          ((Number(payload.price || 0) * Number(payload.teacherDiscountPercentage || 0)) / 100),
      ),
    );

    if (Number(payload.price || 0) < Number(pricing.minTeacherCoursePrice || 0)) {
      throw new ApiError(
        400,
        `Course price must be at least ${Number(pricing.minTeacherCoursePrice || 0)} USD`,
      );
    }
  }

  delete payload.enrolledStudentsCount;
  delete payload.rejectionReason;

  const course = await Course.create(payload);

  try {
    const teacherName = String(req.user?.name || "A teacher").trim();
    await AdminNotification.create({
      type: "course_review",
      dedupeKey: `course_review:${course._id}`,
      title: "New course awaiting review",
      message: `${teacherName} submitted “${course.title}” for admin review.`,
      course: course._id,
      submittedBy: req.user._id,
    });
  } catch (notificationError) {
    if (notificationError?.code !== 11000) {
      console.warn(
        `Failed to create admin course review notification: ${notificationError.message}`,
      );
    }
  }

  notifyAdminCourseReview(course, req.user).catch((notificationError) => {
    console.warn(
      `Failed to send admin course review push notification: ${notificationError.message}`,
    );
  });

  return res.status(201).json(
    new ApiResponse({
      message: "Course created and submitted for approval",
      data: course,
    }),
  );
});

export const getTeacherCourses = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = ownCourseFilter(req.user._id);
  if (req.query.search) filter.$text = { $search: req.query.search };
  if (req.query.category) Object.assign(filter, await buildCourseCategoryFilter(req.query.category));
  if (req.query.level) filter.level = req.query.level;
  if (req.query.language) filter.language = req.query.language;
  if (req.query.status === "class_started") {
    filter.classStartedAt = { $ne: null };
    filter.classEndedAt = null;
    filter.classCancelledAt = null;
    filter["cancellationRequest.status"] = { $ne: "pending" };
  } else if (req.query.status === "class_ended") {
    filter.classEndedAt = { $ne: null };
  } else if (req.query.status === "cancellation_pending") {
    filter["cancellationRequest.status"] = "pending";
    filter.classCancelledAt = null;
  } else if (req.query.status === "cancelled") {
    filter.$and = [
      {
        $or: [
          { status: "cancelled" },
          { classCancelledAt: { $ne: null } },
        ],
      },
    ];
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const sort = buildSort(req.query);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("category", "name slug parent")
      .populate("subcategory", "name slug parent")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Course.countDocuments(filter),
  ]);
  await Promise.all(courses.map((course) => ensureCourseAutoStarted(course)));
  const pricing = await getPlatformPricingSettings();

  return res.json(
    new ApiResponse({
      message: "Teacher courses fetched successfully",
      data: courses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      extra: pricing,
    }),
  );
});

export const getTeacherCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  })
    .populate("category", "name slug parent")
    .populate("subcategory", "name slug parent");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  await ensureCourseAutoStarted(course);

  return res.json(
    new ApiResponse({
      message: "Course fetched successfully",
      data: course,
    }),
  );
});

export const updateTeacherCourse = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  const pricing = await getPlatformPricingSettings();

  const existingCourse = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!existingCourse) {
    throw new ApiError(404, "Course not found");
  }

  const nextMaxStudents = Object.prototype.hasOwnProperty.call(payload, "maxStudents")
    ? Number(payload.maxStudents || 0)
    : Number(existingCourse.maxStudents || 0);
  const nextMinimumStudentsToStart = Object.prototype.hasOwnProperty.call(payload, "minimumStudentsToStart")
    ? Number(payload.minimumStudentsToStart || 0)
    : Number(existingCourse.minimumStudentsToStart || 1);
  if (nextMinimumStudentsToStart > nextMaxStudents) {
    throw new ApiError(400, "minimumStudentsToStart cannot be greater than maxStudents");
  }

  if (payload.category || Object.prototype.hasOwnProperty.call(payload, "subcategory")) {
    const categoryAssignment = await resolveCourseCategoryAssignment(
      payload.category || existingCourse.category,
      Object.prototype.hasOwnProperty.call(payload, "subcategory")
        ? payload.subcategory
        : existingCourse.subcategory,
    );
    payload.category = categoryAssignment.categoryId;
    payload.subcategory = categoryAssignment.subcategoryId;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "language")) {
    payload.language = ensureTeacherCanTeachCourseLanguage(req.user, payload.language);
  }

  // Teachers cannot directly publish, approve, reject, or mutate system counters.
  delete payload.status;
  delete payload.isPublished;
  delete payload.enrolledStudentsCount;
  delete payload.createdBy;
  delete payload.teacher;
  delete payload.teacherId;
  delete payload.rejectionReason;
  delete payload.classStartedAt;
  delete payload.classEndedAt;

  if (Object.prototype.hasOwnProperty.call(payload, "isFree")) {
    payload.isFree = Boolean(payload.isFree);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "price")) {
    payload.price = normalizeCoursePriceInput(payload.price);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "paymentPlan") &&
    payload.paymentPlan !==
      (existingCourse.paymentPlan === "whole_period"
        ? "whole_period"
        : "monthly") &&
    (existingCourse.classStartedAt ||
      Number(existingCourse.enrolledStudentsCount || 0) > 0)
  ) {
    throw new ApiError(
      400,
      "Payment plan cannot be changed after students enroll or the class starts",
    );
  }

  const nextIsFreeForLock = Object.prototype.hasOwnProperty.call(payload, "isFree")
    ? Boolean(payload.isFree)
    : Boolean(existingCourse.isFree);
  const nextPriceForLock = Object.prototype.hasOwnProperty.call(payload, "price")
    ? normalizeCoursePriceInput(payload.price)
    : normalizeCoursePriceInput(existingCourse.price);
  const nextTeacherDiscountForLock = Object.prototype.hasOwnProperty.call(
    payload,
    "teacherDiscountPercentage",
  )
    ? normalizeTeacherCourseDiscountPercentage(payload.teacherDiscountPercentage)
    : normalizeTeacherCourseDiscountPercentage(existingCourse.teacherDiscountPercentage);

  if (Object.prototype.hasOwnProperty.call(payload, "previewVideoUrls")) {
    payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
    payload.promoVideo = payload.previewVideoUrls[0] || "";
  }

  if (payload.isFree === true) {
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else if (Object.prototype.hasOwnProperty.call(payload, "teacherDiscountPercentage")) {
    payload.teacherDiscountPercentage = normalizeTeacherCourseDiscountPercentage(
      payload.teacherDiscountPercentage,
    );
  }

  if (existingCourse.classEndedAt) {
    const lockedChanges = [];
    if (
      Object.prototype.hasOwnProperty.call(payload, "totalSessions") &&
      Number(payload.totalSessions || 0) !== resolveCourseTotalSessions(existingCourse)
    ) {
      lockedChanges.push("total sessions");
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "startDate") &&
      !sameDateTime(payload.startDate, existingCourse.startDate)
    ) {
      lockedChanges.push("start date");
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "endDate") &&
      !sameDateTime(payload.endDate, existingCourse.endDate)
    ) {
      lockedChanges.push("end date");
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "durationWeeks") &&
      Number(payload.durationWeeks || 0) !== Number(existingCourse.durationWeeks || 0)
    ) {
      lockedChanges.push("duration");
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "schedule") &&
      !sameSchedule(payload.schedule, existingCourse.schedule)
    ) {
      lockedChanges.push("schedule time");
    }

    if (lockedChanges.length) {
      throw new ApiError(
        400,
        "Class has already ended. Schedule and course timing can no longer be changed.",
      );
    }
  }

  if (existingCourse.classStartedAt) {
    const pricingChanges = [];

    if (nextIsFreeForLock !== Boolean(existingCourse.isFree)) {
      pricingChanges.push("pricing type");
    }
    if (nextPriceForLock !== normalizeCoursePriceInput(existingCourse.price)) {
      pricingChanges.push("price");
    }
    if (
      nextTeacherDiscountForLock !==
      normalizeTeacherCourseDiscountPercentage(existingCourse.teacherDiscountPercentage)
    ) {
      pricingChanges.push("teacher discount");
    }

    if (pricingChanges.length) {
      throw new ApiError(
        400,
        "Course price settings cannot be changed after the class starts",
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "schedule") ||
    Object.prototype.hasOwnProperty.call(payload, "startDate") ||
    Object.prototype.hasOwnProperty.call(payload, "totalSessions")
  ) {
    applyTeacherSessionSchedule(payload, existingCourse);
  }

  if (!existingCourse.thumbnail && !req.file?.buffer) {
    throw new ApiError(400, "Course image is required");
  }

  if (!Boolean(payload.isFree)) {
    const priceForDiscountCalc = Object.prototype.hasOwnProperty.call(payload, "price")
      ? Number(payload.price || 0)
      : Number(existingCourse.price || 0);
    const teacherDiscountPercentageForCalc = Object.prototype.hasOwnProperty.call(
      payload,
      "teacherDiscountPercentage",
    )
      ? Number(payload.teacherDiscountPercentage || 0)
      : Number(existingCourse.teacherDiscountPercentage || 0);

    payload.discountPrice = Math.max(
      0,
      roundCurrencyAmount(
        priceForDiscountCalc -
          ((priceForDiscountCalc * Number(teacherDiscountPercentageForCalc || 0)) / 100),
      ),
    );
  }

  const nextIsFree = Object.prototype.hasOwnProperty.call(payload, "isFree")
    ? Boolean(payload.isFree)
    : Boolean(existingCourse.isFree);
  const nextPrice = Object.prototype.hasOwnProperty.call(payload, "price")
    ? Number(payload.price)
    : Number(existingCourse.price || 0);

  if (!nextIsFree && nextPrice < Number(pricing.minTeacherCoursePrice || 0)) {
    throw new ApiError(
      400,
      `Course price must be at least ${Number(pricing.minTeacherCoursePrice || 0)} USD`,
    );
  }

  payload.currency = "USD";

  if (req.file?.buffer) {
    payload.thumbnail = await saveCourseThumbnailFromBuffer(req.user._id, req.file.buffer);
  }

  const previousThumbnail = existingCourse.thumbnail || "";

  const course = await Course.findOneAndUpdate(
    {
      _id: req.params.id,
      ...ownCourseFilter(req.user._id),
    },
    payload,
    {
      returnDocument: "after",
      runValidators: true,
    },
  )
    .populate("category", "name slug parent")
    .populate("subcategory", "name slug parent");

  if (req.file?.buffer && payload.thumbnail && previousThumbnail !== payload.thumbnail) {
    await removeOldCourseThumbnailIfLocal(previousThumbnail);
  }

  return res.json(
    new ApiResponse({
      message: "Course updated successfully",
      data: course,
    }),
  );
});

export const startTeacherCourseClass = asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.classEndedAt) {
    throw new ApiError(400, "Class has already ended");
  }

  if (course.status !== "published" || !course.isPublished) {
    throw new ApiError(400, "Only published courses can be started");
  }

  if (course.classStartedAt) {
    return res.json(
      new ApiResponse({
        message: "Class already started",
        data: course,
      }),
    );
  }

  if (!course.startDate || !isSameLocalDate(course.startDate, new Date())) {
    throw new ApiError(400, "Class can only be started on the scheduled start date");
  }

  course.classStartedAt = new Date();
  await course.save();

  return res.json(
    new ApiResponse({
      message: "Class started successfully. Start date and class time are now locked.",
      data: course,
    }),
  );
});

export const deleteTeacherCourse = asyncHandler(async (req, res) => {
  const deleted = await deleteCourseWithRelationsByFilter({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!deleted) {
    throw new ApiError(404, "Course not found");
  }

  return res.json(
    new ApiResponse({
      message: "Course deleted successfully",
      data: deleted,
    }),
  );
});

export const endTeacherCourseClass = asyncHandler(async (req, res) => {
  const course = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (!course.classStartedAt && !course.classEndedAt) {
    throw new ApiError(400, "Class must be started before it can be ended");
  }

  const scheduledEndAt = course.endDate ? new Date(course.endDate) : null;
  if (
    !course.classEndedAt &&
    (!scheduledEndAt || Number.isNaN(scheduledEndAt.getTime()) || scheduledEndAt > new Date())
  ) {
    throw new ApiError(400, "Class can only be ended after the scheduled end date and time");
  }

  const endedAt = course.classEndedAt ? new Date(course.classEndedAt) : new Date();
  const shouldUpdateCourse = !course.classEndedAt;

  if (shouldUpdateCourse) {
    course.classEndedAt = endedAt;
    if (!course.endDate || new Date(course.endDate).getTime() > endedAt.getTime()) {
      course.endDate = endedAt;
    }
    await course.save();
  }

  const enrollments = await Enrollment.find({
    courseId: course._id,
    enrollmentStatus: { $in: ["active", "completed"] },
    accessStatus: "allowed",
  }).select("_id enrollmentStatus accessStatus certificateId certificateIssuedAt");

  if (!enrollments.length) {
    return res.json(
      new ApiResponse({
        message: "Class ended successfully",
        data: {
          courseId: String(course._id),
          classEndedAt: course.classEndedAt || endedAt,
          completedStudents: 0,
          newlyCompletedStudents: 0,
          certificatesIssued: 0,
        },
      }),
    );
  }

  let newlyCompletedStudents = 0;
  let certificatesIssued = 0;

  const ops = enrollments.map((enrollment) => {
    if (enrollment.enrollmentStatus !== "completed") {
      newlyCompletedStudents += 1;
    }

    const { issuedAt, certificateId } = ensureEnrollmentCertificate(
      enrollment,
      endedAt,
      course,
    );
    if (certificateId) {
      certificatesIssued += 1;
    }

    return {
      updateOne: {
        filter: { _id: enrollment._id },
        update: {
          $set: {
            enrollmentStatus: "completed",
            accessStatus: "allowed",
            certificateIssuedAt: issuedAt,
            certificateId,
          },
        },
      },
    };
  });

  if (ops.length) {
    try {
      await Enrollment.bulkWrite(ops, { ordered: false });
    } catch (error) {
      throw new ApiError(500, error?.message || "Failed to finalize class enrollments");
    }
  }

  return res.json(
    new ApiResponse({
      message: "Class ended successfully",
      data: {
        courseId: String(course._id),
        classEndedAt: course.classEndedAt || endedAt,
        completedStudents: enrollments.length,
        newlyCompletedStudents,
        certificatesIssued,
      },
    }),
  );
});

export const requestTeacherCourseCancellation = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  const course = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.status === "cancelled" || course.classCancelledAt) {
    throw new ApiError(400, "This class is already cancelled");
  }

  if (course.classEndedAt) {
    throw new ApiError(400, "Ended classes cannot be cancelled");
  }

  if (course.cancellationRequest?.status === "pending") {
    throw new ApiError(400, "A cancellation request is already pending for this class");
  }

  course.cancellationRequest = {
    status: "pending",
    reason,
    requestedAt: new Date(),
    reviewedAt: undefined,
    reviewedBy: undefined,
    adminResponse: "",
  };
  await course.save();

  return res.json(
    new ApiResponse({
      message: "Cancellation request sent to admin",
      data: course,
    }),
  );
});
