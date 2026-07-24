import Course from "../models/Course.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  removeOldCourseThumbnailIfLocal,
  saveCourseThumbnailFromBuffer,
} from "../utils/courseImage.js";
import { deleteCourseWithRelationsByFilter } from "../services/courseCascadeDelete.service.js";
import { notifyPublishedCourse } from "../services/webPush.service.js";
import {
  hydrateCourseForTelegram,
  sendTelegramCourseAnnouncementByAdmin,
  triggerTelegramPostRemoval,
} from "../services/telegramAnnouncement.service.js";
import {
  buildCourseCategoryFilter,
  resolveCourseCategoryAssignment,
} from "../utils/courseCategory.js";
import { normalizeTeacherCourseDiscountPercentage } from "../utils/platformSettings.js";
import { finalizeCourseEnd } from "../services/courseCompletion.service.js";
import { publishTeacherActivity } from "../services/teacherActivity.service.js";
import { getCoursePublicState } from "../utils/coursePublicState.js";

const buildSort = ({ sortBy = "newest", sortOrder = "desc" }) => {
  if (sortBy === "price") return { price: sortOrder === "asc" ? 1 : -1 };
  if (sortBy === "startDate") return { startDate: sortOrder === "asc" ? 1 : -1 };
  return { createdAt: -1 };
};

const buildFilter = async (query = {}) => {
  const filter = {};
  if (query.search) {
    filter.$text = { $search: query.search };
  }
  if (query.category) Object.assign(filter, await buildCourseCategoryFilter(query.category));
  if (query.level) filter.level = query.level;
  if (query.language) filter.language = query.language;
  if (query.status) filter.status = query.status;
  if (query.pricing === "free") filter.isFree = true;
  if (query.pricing === "paid") filter.isFree = false;
  if (query.meetingType) filter.meetingType = query.meetingType;
  if (query.teacher) filter.$or = [{ teacher: query.teacher }, { teacherId: query.teacher }];
  if (query.cancellationRequestStatus) {
    filter["cancellationRequest.status"] = query.cancellationRequestStatus;
  }
  if (query.endRequestStatus) {
    filter["endRequest.status"] = query.endRequestStatus;
  }
  return filter;
};

const ensureTeacherExists = async (teacherId) => {
  if (!teacherId) return;
  const teacher = await User.findOne({ _id: teacherId, role: "teacher" });
  if (!teacher) {
    throw new ApiError(400, "Teacher not found");
  }
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

const roundCurrencyAmount = (value, decimalPlaces = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round(numeric * factor) / factor;
};

const notifyPublishedCourseByAdminChoice = async ({
  course,
  notificationAudience = "all",
  notificationChannels = {},
} = {}) => {
  const sendPush = Boolean(notificationChannels?.push);
  const sendTelegram = Boolean(notificationChannels?.telegram);

  const tasks = [];
  if (sendPush) {
    tasks.push(
      notifyPublishedCourse(course, {
        audience: notificationAudience || "all",
      }).catch((error) => {
        console.warn(`Failed to send new course push notification: ${error.message}`);
      }),
    );
  }
  if (sendTelegram) {
    tasks.push(
      hydrateCourseForTelegram(course?._id)
        .then((fullCourse) => (
          fullCourse ? sendTelegramCourseAnnouncementByAdmin(fullCourse) : null
        ))
        .catch((error) => {
          console.warn(`Failed to send course Telegram announcement: ${error.message}`);
        }),
    );
  }

  await Promise.all(tasks);
};

export const createAdminCourse = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (payload.status && !["draft", "published"].includes(payload.status)) {
    throw new ApiError(400, "Admin can create course only with draft or published status");
  }

  if (!payload.teacher) {
    throw new ApiError(400, "Teacher is required");
  }

  const categoryAssignment = await resolveCourseCategoryAssignment(
    payload.category,
    payload.subcategory,
  );
  payload.category = categoryAssignment.categoryId;
  payload.subcategory = categoryAssignment.subcategoryId;
  await ensureTeacherExists(payload.teacher);

  if (req.file?.buffer) {
    payload.thumbnail = await saveCourseThumbnailFromBuffer(req.user._id, req.file.buffer);
  }

  payload.createdBy = req.user._id;
  payload.teacherId = payload.teacher || undefined;
  payload.status = payload.status || "draft";
  payload.isPublished = payload.status === "published";
  payload.lifecycleStatus =
    payload.status === "published" ? "enrollment_open" : "draft";
  payload.currency = "USD";
  payload.isFree = Boolean(payload.isFree);
  payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
  payload.promoVideo = payload.previewVideoUrls[0] || payload.promoVideo || "";

  if (payload.isFree) {
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else if (Number(payload.price) <= 0) {
    throw new ApiError(400, "Paid course price must be greater than 0");
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
  }
  payload.certificate = {
    ...(payload.certificate || {}),
    enabled: !payload.isFree,
    fullPaymentRequired: !payload.isFree,
  };

  const course = await Course.create(payload);

  return res.status(201).json(
    new ApiResponse({
      message: "Course created successfully",
      data: course,
    }),
  );
});

export const getAdminCourses = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = await buildFilter(req.query);
  const sort = buildSort(req.query);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("teacher", "name email")
      .populate("category", "name slug parent")
      .populate("subcategory", "name slug parent")
      .populate("createdBy", "name email role")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Course.countDocuments(filter),
  ]);

  return res.json(
    new ApiResponse({
      message: "Courses fetched successfully",
      data: courses.map((course) => {
        const row = course.toObject();
        return {
          ...row,
          publicState: getCoursePublicState({ course: row }),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }),
  );
});

export const getAdminCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate("teacher", "name email")
    .populate("category", "name slug parent")
    .populate("subcategory", "name slug parent")
    .populate("createdBy", "name email role");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  return res.json(
    new ApiResponse({
      message: "Course fetched successfully",
      data: {
        ...course.toObject(),
        publicState: getCoursePublicState({ course }),
      },
    }),
  );
});

export const updateAdminCourse = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  const existingCourse = await Course.findById(req.params.id);
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
  if (payload.teacher) await ensureTeacherExists(payload.teacher);
  if (payload.teacher) payload.teacherId = payload.teacher;
  payload.currency = "USD";
  if (Object.prototype.hasOwnProperty.call(payload, "enrolledStudentsCount")) {
    delete payload.enrolledStudentsCount;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "isFree")) {
    payload.isFree = Boolean(payload.isFree);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "previewVideoUrls")) {
    payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
    payload.promoVideo = payload.previewVideoUrls[0] || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    payload.isPublished = payload.status === "published";
    const lifecycleByPublicationStatus = {
      draft: "draft",
      pending: "pending_review",
      approved: "approved",
      rejected: "changes_requested",
      published: existingCourse.classStartedAt
        ? "in_progress"
        : "enrollment_open",
      cancelled: "canceled",
    };
    payload.lifecycleStatus =
      lifecycleByPublicationStatus[payload.status] ||
      existingCourse.lifecycleStatus;
    if (payload.status === "cancelled") {
      payload.classCancelledAt = new Date();
    }
  }
  if (payload.isFree === true) {
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else if (
    Object.prototype.hasOwnProperty.call(payload, "price") &&
    Number(payload.price) <= 0
  ) {
    throw new ApiError(400, "Paid course price must be greater than 0");
  } else if (Object.prototype.hasOwnProperty.call(payload, "teacherDiscountPercentage")) {
    payload.teacherDiscountPercentage = normalizeTeacherCourseDiscountPercentage(
      payload.teacherDiscountPercentage,
    );
  }

  const nextIsFree = Object.prototype.hasOwnProperty.call(payload, "isFree")
    ? Boolean(payload.isFree)
    : Boolean(existingCourse.isFree);
  if (payload.certificate || Object.prototype.hasOwnProperty.call(payload, "isFree")) {
    payload.certificate = {
      ...(existingCourse.certificate?.toObject?.() || existingCourse.certificate || {}),
      ...(payload.certificate || {}),
      enabled: !nextIsFree,
      fullPaymentRequired: !nextIsFree,
    };
  }
  if (!nextIsFree) {
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

  if (req.file?.buffer) {
    payload.thumbnail = await saveCourseThumbnailFromBuffer(req.user._id, req.file.buffer);
  }

  const previousThumbnail = existingCourse.thumbnail || "";
  const wasPublished = existingCourse.status === "published" && existingCourse.isPublished === true;

  const course = await Course.findByIdAndUpdate(req.params.id, payload, {
    returnDocument: "after",
    runValidators: true,
  })
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

export const deleteAdminCourse = asyncHandler(async (req, res) => {
  const existingCourse = await Course.findById(req.params.id).select("_id socialPosts").lean();
  const deleted = await deleteCourseWithRelationsByFilter({ _id: req.params.id });

  if (!deleted) {
    throw new ApiError(404, "Course not found");
  }

  triggerTelegramPostRemoval("course", deleted.id);

  return res.json(
    new ApiResponse({
      message: "Course deleted successfully",
      data: deleted,
    }),
  );
});

export const approveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      status: "approved",
      lifecycleStatus: "approved",
      isPublished: false,
      rejectionReason: "",
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  return res.json(
    new ApiResponse({
      message: "Course approved successfully",
      data: course,
    }),
  );
});

export const rejectCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      status: "rejected",
      lifecycleStatus: "changes_requested",
      isPublished: false,
      rejectionReason: req.body.rejectionReason,
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  return res.json(
    new ApiResponse({
      message: "Course rejected successfully",
      data: course,
    }),
  );
});

export const publishCourse = asyncHandler(async (req, res) => {
  const existingCourse = await Course.findById(req.params.id).select("status isPublished classCancelledAt");
  if (!existingCourse) {
    throw new ApiError(404, "Course not found");
  }

  if (existingCourse.status === "cancelled" || existingCourse.classCancelledAt) {
    throw new ApiError(400, "Cancelled courses cannot be published");
  }

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      status: "published",
      lifecycleStatus: "enrollment_open",
      isPublished: true,
      rejectionReason: "",
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!(existingCourse.status === "published" && existingCourse.isPublished === true)) {
    await notifyPublishedCourseByAdminChoice({
      course,
      notificationAudience: req.body?.notificationAudience || "all",
      notificationChannels: req.body?.notificationChannels || {},
    });
    const teacherId = course.teacher || course.teacherId || course.createdBy;
    if (teacherId) {
      await publishTeacherActivity({
        teacherId,
        type: "teacher_course",
        title: "A teacher you follow published a new course",
        body: course.title,
        url: `/course/${course.slug || course._id}`,
        eventKey: `course:${course._id}`,
      }).catch((error) => console.warn(`Failed to notify course followers: ${error.message}`));
    }
  }

  return res.json(
    new ApiResponse({
      message: "Course published successfully",
      data: course,
    }),
  );
});

export const unpublishCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      status: "approved",
      lifecycleStatus: "approved",
      isPublished: false,
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  triggerTelegramPostRemoval("course", course._id, { preserveHistory: true });

  return res.json(
    new ApiResponse({
      message: "Course unpublished successfully",
      data: course,
    }),
  );
});

export const approveCourseCancellation = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.cancellationRequest?.status !== "pending") {
    throw new ApiError(400, "No pending cancellation request for this course");
  }

  course.status = "cancelled";
  course.lifecycleStatus = "canceled";
  course.isPublished = false;
  course.classCancelledAt = new Date();
  course.cancellationRequest.status = "approved";
  course.cancellationRequest.reviewedAt = new Date();
  course.cancellationRequest.reviewedBy = req.user._id;
  course.cancellationRequest.adminResponse = String(req.body?.adminResponse || "").trim();
  await course.save();

  triggerTelegramPostRemoval("course", course._id, { preserveHistory: true });

  return res.json(
    new ApiResponse({
      message: "Course cancellation approved successfully",
      data: course,
    }),
  );
});

export const rejectCourseCancellation = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.cancellationRequest?.status !== "pending") {
    throw new ApiError(400, "No pending cancellation request for this course");
  }

  course.cancellationRequest.status = "rejected";
  course.cancellationRequest.reviewedAt = new Date();
  course.cancellationRequest.reviewedBy = req.user._id;
  course.cancellationRequest.adminResponse = String(req.body?.adminResponse || "").trim();
  await course.save();

  return res.json(
    new ApiResponse({
      message: "Course cancellation rejected successfully",
      data: course,
    }),
  );
});

export const approveCourseEndRequest = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate("teacher", "name")
    .populate("createdBy", "name");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.endRequest?.status !== "pending") {
    throw new ApiError(400, "No pending end request for this course");
  }

  course.endRequest.status = "approved";
  course.endRequest.reviewedAt = new Date();
  course.endRequest.reviewedBy = req.user._id;
  course.endRequest.adminResponse = String(req.body?.adminResponse || "").trim();

  let result;
  try {
    result = await finalizeCourseEnd({
      course,
      endedAt: new Date(),
      forceCourseUpdate: true,
    });
  } catch (error) {
    throw new ApiError(500, error?.message || "Failed to finalize class enrollments");
  }

  return res.json(
    new ApiResponse({
      message: "Course end request approved successfully",
      data: {
        course,
        completion: result,
      },
    }),
  );
});

export const rejectCourseEndRequest = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.endRequest?.status !== "pending") {
    throw new ApiError(400, "No pending end request for this course");
  }

  course.endRequest.status = "rejected";
  course.endRequest.reviewedAt = new Date();
  course.endRequest.reviewedBy = req.user._id;
  course.endRequest.adminResponse = String(req.body?.adminResponse || "").trim();
  course.lifecycleStatus = course.classStartedAt ? "in_progress" : "enrollment_open";
  await course.save();

  return res.json(
    new ApiResponse({
      message: "Course end request rejected successfully",
      data: course,
    }),
  );
});
