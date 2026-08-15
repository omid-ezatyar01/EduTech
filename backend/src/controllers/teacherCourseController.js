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
import {
  buildCourseCategoryFilter,
  resolveCourseCategoryAssignment,
} from "../utils/courseCategory.js";
import {
  notifyAdminCourseEndReview,
  notifyAdminCourseReview,
} from "../services/webPush.service.js";
import {
  deriveCourseSchedule,
  getUniqueTeachingDays,
} from "../utils/courseSchedule.js";
import {
  ensureCourseAutoStarted,
  resolveCourseScheduledStartAt,
} from "../utils/courseAutoStart.js";
import { getCoursePublicState } from "../utils/coursePublicState.js";
import { publishCourseStarted } from "../services/courseNotification.service.js";
import {
  normalizeRegionalPrices,
  validateRegionalMinimumPrices,
  validateRegionalPrices,
} from "../utils/courseRegionalPricing.js";

const buildSort = ({ sortBy = "newest", sortOrder = "desc" }) => {
  if (sortBy === "popular") {
    return {
      enrolledStudentsCount: sortOrder === "asc" ? 1 : -1,
      createdAt: -1,
    };
  }
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

const applyRegionalPricingPayload = (payload, fallbackCourse = null) => {
  const pricingType = String(payload.pricingType || fallbackCourse?.pricingType || "single");
  if (pricingType !== "regional") {
    payload.pricingType = "single";
    return false;
  }

  const sourcePrices = payload.prices || fallbackCourse?.prices || {};
  const validation = validateRegionalPrices(sourcePrices);
  if (!validation.valid) {
    throw new ApiError(400, Object.values(validation.errors)[0] || "Regional course prices are invalid");
  }

  payload.pricingType = "regional";
  payload.prices = normalizeRegionalPrices(validation.prices);
  const international = payload.prices.international;
  const afghanistan = payload.prices.afghanistan;
  const iran = payload.prices.iran;
  payload.isFree =
    international.isFree &&
    (afghanistan.isFree || afghanistan.useInternationalPrice) &&
    (iran.isFree || iran.useInternationalPrice);
  payload.price = international.isFree ? 0 : Number(international.regularPrice || 0);
  payload.discountPrice =
    international.isFree ? 0 : Number(international.discountedPrice || 0);
  payload.teacherDiscountPercentage =
    payload.price > 0 && payload.discountPrice > 0
      ? roundCurrencyAmount(((payload.price - payload.discountPrice) / payload.price) * 100)
      : 0;
  payload.currency = "USD";
  return true;
};

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
  payload.lifecycleStatus = "pending_review";
  payload.isPublished = false;
  payload.isFree = Boolean(payload.isFree);
  const usesRegionalPricing = applyRegionalPricingPayload(payload);
  if (!usesRegionalPricing) {
    payload.currency = "USD";
    payload.price = normalizeCoursePriceInput(payload.price);
  }
  payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
  payload.promoVideo = payload.previewVideoUrls[0] || "";
  if (payload.agreements) {
    payload.agreements = {
      ...payload.agreements,
      acceptedAt: new Date(),
    };
  }
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
    payload.pricingType = "single";
    delete payload.prices;
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else if (!usesRegionalPricing) {
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
  } else {
    const minimumValidation = validateRegionalMinimumPrices(
      payload.prices,
      pricing.minTeacherCoursePrice,
    );
    if (!minimumValidation.valid) {
      throw new ApiError(
        400,
        Object.values(minimumValidation.errors)[0],
      );
    }
  }
  payload.certificate = {
    ...(payload.certificate || {}),
    enabled: !payload.isFree,
    minimumAttendance: payload.isFree
      ? 0
      : Number(payload.certificate?.minimumAttendance || 0),
    minimumPassingGrade: payload.isFree
      ? 0
      : Number(payload.certificate?.minimumPassingGrade || 0),
    assignmentsRequired: payload.isFree
      ? false
      : Boolean(payload.certificate?.assignmentsRequired),
    finalProjectRequired: payload.isFree
      ? false
      : Boolean(payload.certificate?.finalProjectRequired),
    fullPaymentRequired: !payload.isFree,
  };

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

  const [courses, total, summaryCourses] = await Promise.all([
    Course.find(filter)
      .populate("category", "name slug parent")
      .populate("subcategory", "name slug parent")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Course.countDocuments(filter),
    Course.find(ownCourseFilter(req.user._id))
      .select("status enrolledStudentsCount")
      .lean(),
  ]);
  await Promise.all(courses.map((course) => ensureCourseAutoStarted(course)));
  const pricing = await getPlatformPricingSettings();
  const courseSummary = summaryCourses.reduce(
    (summary, course) => {
      summary.total += 1;
      summary.totalStudents += Number(course?.enrolledStudentsCount || 0);
      const status = String(course?.status || "draft").toLowerCase();
      if (["published", "approved"].includes(status)) summary.published += 1;
      else if (status === "pending") summary.pending += 1;
      else if (status === "rejected") summary.rejected += 1;
      else if (status === "cancelled") summary.cancelled += 1;
      else summary.draft += 1;
      return summary;
    },
    {
      total: 0,
      published: 0,
      pending: 0,
      draft: 0,
      rejected: 0,
      cancelled: 0,
      totalStudents: 0,
    },
  );

  return res.json(
    new ApiResponse({
      message: "Teacher courses fetched successfully",
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
        courseSummary,
        pricing,
      },
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
      data: {
        ...course.toObject(),
        publicState: getCoursePublicState({ course }),
      },
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
  if (existingCourse.isBootcampInternal) {
    throw new ApiError(409, "Bootcamp details are managed by the administrator");
  }
  const nextIsFreeForCertificate = Object.prototype.hasOwnProperty.call(payload, "isFree")
    ? Boolean(payload.isFree)
    : Boolean(existingCourse.isFree);
  if (payload.certificate || Object.prototype.hasOwnProperty.call(payload, "isFree")) {
    payload.certificate = {
      ...(existingCourse.certificate?.toObject?.() || existingCourse.certificate || {}),
      ...(payload.certificate || {}),
      enabled: !nextIsFreeForCertificate,
      minimumAttendance: nextIsFreeForCertificate
        ? 0
        : Number(
            payload.certificate?.minimumAttendance ??
            existingCourse.certificate?.minimumAttendance ??
            0,
          ),
      minimumPassingGrade: nextIsFreeForCertificate
        ? 0
        : Number(
            payload.certificate?.minimumPassingGrade ??
            existingCourse.certificate?.minimumPassingGrade ??
            0,
          ),
      assignmentsRequired: nextIsFreeForCertificate
        ? false
        : Boolean(
            payload.certificate?.assignmentsRequired ??
            existingCourse.certificate?.assignmentsRequired,
          ),
      finalProjectRequired: nextIsFreeForCertificate
        ? false
        : Boolean(
            payload.certificate?.finalProjectRequired ??
            existingCourse.certificate?.finalProjectRequired,
          ),
      fullPaymentRequired: !nextIsFreeForCertificate,
    };
  }

  if (existingCourse.classEndedAt) {
    throw new ApiError(400, "Ended courses cannot be edited by teacher");
  }
  if (
    existingCourse.status === "pending" ||
    existingCourse.lifecycleStatus === "pending_review"
  ) {
    throw new ApiError(
      409,
      "This course is locked while admin review is pending",
    );
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
  delete payload.lifecycleStatus;
  delete payload.classStartedAt;
  delete payload.actualStartedAt;
  delete payload.startedBy;
  delete payload.currentSessionNumber;
  delete payload.minimumReachedAt;
  delete payload.classEndedAt;

  if (Object.prototype.hasOwnProperty.call(payload, "isFree")) {
    payload.isFree = Boolean(payload.isFree);
  }
  const nextPricingType = String(payload.pricingType || existingCourse.pricingType || "single");
  const usesRegionalPricing = nextPricingType === "regional"
    ? applyRegionalPricingPayload(payload, existingCourse)
    : false;
  if (usesRegionalPricing) {
    const minimumValidation = validateRegionalMinimumPrices(
      payload.prices,
      pricing.minTeacherCoursePrice,
    );
    if (!minimumValidation.valid) {
      throw new ApiError(
        400,
        Object.values(minimumValidation.errors)[0],
      );
    }
  }
  if (usesRegionalPricing && payload.certificate) {
    payload.certificate = {
      ...payload.certificate,
      enabled: !payload.isFree,
      minimumAttendance: payload.isFree
        ? 0
        : Number(payload.certificate.minimumAttendance || 0),
      minimumPassingGrade: payload.isFree
        ? 0
        : Number(payload.certificate.minimumPassingGrade || 0),
      assignmentsRequired: payload.isFree
        ? false
        : Boolean(payload.certificate.assignmentsRequired),
      finalProjectRequired: payload.isFree
        ? false
        : Boolean(payload.certificate.finalProjectRequired),
      fullPaymentRequired: !payload.isFree,
    };
  }
  if (!usesRegionalPricing && Object.prototype.hasOwnProperty.call(payload, "price")) {
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
  const regionalPricingChanged =
    String(existingCourse.pricingType || "single") !== String(payload.pricingType || existingCourse.pricingType || "single") ||
    (
      usesRegionalPricing &&
      JSON.stringify(normalizeRegionalPrices(payload.prices || {})) !==
        JSON.stringify(normalizeRegionalPrices(existingCourse.prices || {}))
    );

  if (Object.prototype.hasOwnProperty.call(payload, "previewVideoUrls")) {
    payload.previewVideoUrls = normalizePreviewVideoUrls(payload.previewVideoUrls);
    payload.promoVideo = payload.previewVideoUrls[0] || "";
  }

  if (payload.isFree === true) {
    payload.pricingType = "single";
    delete payload.prices;
    payload.price = 0;
    payload.discountPrice = 0;
    payload.teacherDiscountPercentage = 0;
  } else if (Object.prototype.hasOwnProperty.call(payload, "teacherDiscountPercentage")) {
    payload.teacherDiscountPercentage = normalizeTeacherCourseDiscountPercentage(
      payload.teacherDiscountPercentage,
    );
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
    if (regionalPricingChanged) {
      pricingChanges.push("regional pricing");
    }

    if (pricingChanges.length) {
      throw new ApiError(
        400,
        "Course price settings cannot be changed after the class starts",
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, "startDate") &&
      new Date(payload.startDate).getTime() !==
        new Date(existingCourse.startDate).getTime()
    ) {
      throw new ApiError(
        400,
        "The official course start date cannot be changed after the class starts",
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "totalSessions") &&
      Number(payload.totalSessions) < Number(existingCourse.totalSessions || 0)
    ) {
      throw new ApiError(
        400,
        "Total sessions cannot be reduced after the class starts",
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "language") &&
      String(payload.language) !== String(existingCourse.language)
    ) {
      throw new ApiError(
        400,
        "Course language cannot be changed after the class starts",
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

  if (!usesRegionalPricing && !Boolean(payload.isFree)) {
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

  if (
    !usesRegionalPricing &&
    !nextIsFree &&
    nextPrice < Number(pricing.minTeacherCoursePrice || 0)
  ) {
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

  const now = new Date();
  const scheduledStartAt = resolveCourseScheduledStartAt(course);
  if (!scheduledStartAt || now < scheduledStartAt) {
    throw new ApiError(400, "The course cannot be started before its scheduled start time");
  }

  const activeStudentsCount = await Enrollment.countDocuments({
    courseId: course._id,
    enrollmentStatus: { $in: ["active", "completed"] },
    accessStatus: "allowed",
    $or: [
      { accessExpiresAt: { $exists: false } },
      { accessExpiresAt: null },
      { accessExpiresAt: { $gt: now } },
    ],
  });
  const minimumStudentsToStart = Math.max(
    1,
    Number(course.minimumStudentsToStart || 1),
  );
  const startsBelowMinimum = activeStudentsCount < minimumStudentsToStart;
  if (startsBelowMinimum && req.body?.startBelowMinimum !== true) {
    throw new ApiError(
      409,
      `Minimum enrollment has not been reached (${activeStudentsCount}/${minimumStudentsToStart}). Confirm starting with the current students.`,
    );
  }

  course.classStartedAt = now;
  course.actualStartedAt = now;
  course.startedBy = req.user._id;
  course.currentSessionNumber = Math.max(
    1,
    Number(course.currentSessionNumber || 0),
  );
  course.lifecycleStatus = "in_progress";
  await course.save();
  await publishCourseStarted({ courseId: course._id });

  if (startsBelowMinimum) {
    try {
      await AdminNotification.create({
        type: "course_minimum_override",
        dedupeKey: `course_minimum_override:${course._id}:${now.getTime()}`,
        title: "Course started below minimum enrollment",
        message: `${req.user?.name || "A teacher"} started “${course.title}” with ${activeStudentsCount} of ${minimumStudentsToStart} required students.`,
        course: course._id,
        submittedBy: req.user._id,
      });
    } catch (notificationError) {
      if (notificationError?.code !== 11000) {
        console.warn(
          `Failed to record below-minimum course start: ${notificationError.message}`,
        );
      }
    }
  }

  return res.json(
    new ApiResponse({
      message: "Course officially started. Live sessions remain independently managed.",
      data: course,
    }),
  );
});

export const deleteTeacherCourse = asyncHandler(async (req, res) => {
  const existingCourse = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  }).select("_id classEndedAt isBootcampInternal");

  if (!existingCourse) {
    throw new ApiError(404, "Course not found");
  }
  if (existingCourse.isBootcampInternal) {
    throw new ApiError(409, "Bootcamps can only be deleted from bootcamp management");
  }

  if (existingCourse.classEndedAt) {
    throw new ApiError(400, "Ended courses cannot be deleted by teacher");
  }

  const deleted = await deleteCourseWithRelationsByFilter({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  return res.json(
    new ApiResponse({
      message: "Course deleted successfully",
      data: deleted,
    }),
  );
});

export const endTeacherCourseClass = asyncHandler(async (req, res) => {
  void req;
  void res;
  throw new ApiError(
    403,
    "Teachers cannot end classes directly. Please send an end request for admin review.",
  );
});

export const requestTeacherCourseEndReview = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  const course = await Course.findOne({
    _id: req.params.id,
    ...ownCourseFilter(req.user._id),
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.status === "cancelled" || course.classCancelledAt) {
    throw new ApiError(400, "Cancelled classes cannot be ended");
  }

  if (course.classEndedAt) {
    throw new ApiError(400, "This class is already ended");
  }

  if (!course.classStartedAt) {
    throw new ApiError(400, "Class must be started before requesting to end it");
  }

  if (course.endRequest?.status === "pending") {
    throw new ApiError(400, "An end request is already pending for this class");
  }

  course.endRequest = {
    status: "pending",
    reason,
    requestedAt: new Date(),
    reviewedAt: undefined,
    reviewedBy: undefined,
    adminResponse: "",
  };
  course.lifecycleStatus = "awaiting_completion";
  await course.save();

  try {
    const teacherName = String(req.user?.name || "A teacher").trim();
    await AdminNotification.create({
      type: "course_end_review",
      dedupeKey: `course_end_review:${course._id}:${course.endRequest.requestedAt?.getTime?.() || Date.now()}`,
      title: "Course end request awaiting review",
      message: `${teacherName} requested to end “${course.title}”.`,
      course: course._id,
      submittedBy: req.user._id,
    });
  } catch (notificationError) {
    if (notificationError?.code !== 11000) {
      console.warn(
        `Failed to create admin course end review notification: ${notificationError.message}`,
      );
    }
  }

  notifyAdminCourseEndReview(course, req.user).catch((notificationError) => {
    console.warn(
      `Failed to send admin course end review push notification: ${notificationError.message}`,
    );
  });

  return res.json(
    new ApiResponse({
      message: "Course end request sent to admin",
      data: course,
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

  if (course.isBootcampInternal) {
    throw new ApiError(409, "Bootcamp cancellation is managed by the administrator");
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
