import Joi from "joi";
import { objectId } from "./common.validators.js";

const DESCRIPTION_MIN_CHARS = 120;
const DESCRIPTION_MAX_CHARS = 2000;
const TITLE_MIN_CHARS = 5;
const TITLE_MAX_CHARS = 120;
const LIST_ITEM_MIN_CHARS = 3;
const LIST_ITEM_MAX_CHARS = 180;
const LIST_MAX_ITEMS = 30;
const DURATION_LABEL_MAX_CHARS = 80;
const PRICE_MAX_USD = 10000;
const PRICE_MIN_PAID_USD = 1;
const MAX_STUDENTS_MAX = 2000;
const LANGUAGE_MIN_CHARS = 2;
const LANGUAGE_MAX_CHARS = 60;
const PREVIEW_VIDEO_MAX_ITEMS = 5;
const COURSE_START_DATE_DAYS = [1, 15];
const COURSE_CURRENCIES = ["USD", "AFN", "IRR"];
const courseTypeSchema = Joi.string().valid("general", "special");
const paymentPlanSchema = Joi.string().valid("monthly", "whole_period");
const notificationAudienceSchema = Joi.string().valid("all", "students", "teachers");
const notificationChannelsSchema = Joi.object({
  push: Joi.boolean().default(false),
  telegram: Joi.boolean().default(false),
}).default({ push: false, telegram: false });

const regionalPriceRowSchema = (currency, { allowInternationalFallback = false } = {}) =>
  Joi.object({
    currency: Joi.string().valid(currency).required(),
    regularPrice: Joi.number().min(0).max(1_000_000_000).allow(null),
    discountedPrice: Joi.number().min(0).max(1_000_000_000).allow(null, ""),
    regularPriceUsd: Joi.number().min(0).max(10000).allow(null, ""),
    discountedPriceUsd: Joi.number().min(0).max(10000).allow(null, ""),
    usdExchangeRate: Joi.number().min(0).max(1_000_000_000).allow(null, ""),
    isFree: Joi.boolean().default(false),
    ...(allowInternationalFallback
      ? { useInternationalPrice: Joi.boolean().default(false) }
      : {}),
  }).custom((value, helpers) => {
    if (value.isFree || value.useInternationalPrice) return value;
    if (!(Number(value.regularPrice) > 0)) {
      return helpers.message("Regular regional price is required");
    }
    if (
      value.discountedPrice !== null &&
      value.discountedPrice !== "" &&
      value.discountedPrice !== undefined &&
      Number(value.discountedPrice) >= Number(value.regularPrice)
    ) {
      return helpers.message("Discounted regional price must be lower than regular price");
    }
    return value;
  });

const regionalPricesSchema = Joi.object({
  afghanistan: regionalPriceRowSchema("AFN", { allowInternationalFallback: true }).required(),
  iran: regionalPriceRowSchema("TOMAN", { allowInternationalFallback: true }).required(),
  international: regionalPriceRowSchema("USD").required(),
}).required();

const getYouTubeVideoKey = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return id ? `youtube:${id}` : "";
    }
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname.startsWith("/watch")) {
        const id = url.searchParams.get("v") || "";
        return id ? `youtube:${id}` : "";
      }
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/").filter(Boolean)[1] || "";
        return id ? `youtube:${id}` : "";
      }
    }
    return "";
  } catch {
    return "";
  }
};

const isYouTubeUrl = (value = "") => Boolean(getYouTubeVideoKey(value));

const scheduleItemSchema = Joi.object({
  day: Joi.string().trim().required(),
  startTime: Joi.string().trim().required(),
  endTime: Joi.string().trim().required(),
});

const listItemSchema = Joi.string().trim().min(LIST_ITEM_MIN_CHARS).max(LIST_ITEM_MAX_CHARS);

const meetingTypeSchema = Joi.string().valid(
  "google_meet",
  "zoom",
  "physical",
  "recorded",
);

const languageSchema = Joi.string().trim().min(LANGUAGE_MIN_CHARS).max(LANGUAGE_MAX_CHARS);
const titleSchema = Joi.string()
  .trim()
  .min(TITLE_MIN_CHARS)
  .max(TITLE_MAX_CHARS)
  .custom((value, helpers) =>
    /\p{L}/u.test(value)
      ? value
      : helpers.message("Course title must contain at least one letter"),
  );
const timezoneSchema = Joi.string().trim().max(80).custom((value, helpers) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return helpers.message("Course timezone must be a valid IANA timezone");
  }
});
const tagsSchema = Joi.array()
  .items(Joi.string().trim().min(1).max(30))
  .max(10)
  .custom((value, helpers) => {
    const normalized = (value || []).map((item) => String(item).trim().toLowerCase());
    return new Set(normalized).size === normalized.length
      ? value
      : helpers.message("Course tags cannot contain duplicates");
  });
const certificateSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minimumAttendance: Joi.number().min(0).max(100).default(0),
  minimumPassingGrade: Joi.number().min(0).max(100).default(0),
  assignmentsRequired: Joi.boolean().default(false),
  finalProjectRequired: Joi.boolean().default(false),
  fullPaymentRequired: Joi.boolean().default(true),
});
const coursePoliciesSchema = Joi.object({
  refundPolicyAccepted: Joi.boolean().required(),
  attendancePolicy: Joi.string().trim().max(1200).allow("").default(""),
  makeupClassPolicyAccepted: Joi.boolean().required(),
  conductPolicyAccepted: Joi.boolean().required(),
  intellectualPropertyAccepted: Joi.boolean().required(),
});
const agreementsSchema = Joi.object({
  informationAccurate: Joi.boolean().valid(true).required(),
  contentPermission: Joi.boolean().valid(true).required(),
  teacherPoliciesAccepted: Joi.boolean().valid(true).required(),
  refundRulesAccepted: Joi.boolean().valid(true).required(),
  sessionCommitmentAccepted: Joi.boolean().valid(true).required(),
  acceptedAt: Joi.date().optional(),
});

const thumbnailSchema = Joi.alternatives()
  .try(
    Joi.string().uri(),
    Joi.string().pattern(/^\/uploads\/course-thumbnails\/[\w.-]+$/),
  )
  .allow("");

const youtubeUrlSchema = Joi.string()
  .trim()
  .uri()
  .max(250)
  .custom((value, helpers) =>
    isYouTubeUrl(value) ? value : helpers.message("Preview videos must be YouTube links"),
  );

const optionalPreviewVideoUrlsSchema = Joi.array()
  .items(youtubeUrlSchema)
  .max(PREVIEW_VIDEO_MAX_ITEMS)
  .custom((value, helpers) => {
    const rows = Array.isArray(value) ? value : [];
    if (rows.length === 0) {
      return value;
    }
    if (rows.length > PREVIEW_VIDEO_MAX_ITEMS) {
      return helpers.message("Preview videos cannot contain more than 5 YouTube links");
    }
    const videoKeys = rows.map(getYouTubeVideoKey);
    if (new Set(videoKeys).size !== videoKeys.length) {
      return helpers.message("Preview videos cannot contain duplicate YouTube videos");
    }
    return value;
  });

const getCourseStartDay = (value) => {
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return Number(match[3]);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDate();
};

const getCourseStartYear = (value) => {
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return Number(match[1]);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
};

const teacherCourseStartDateSchema = Joi.date().custom((value, helpers) => {
  const originalValue = helpers.original ?? value;
  const day = getCourseStartDay(originalValue);
  const year = getCourseStartYear(originalValue);
  const currentYear = new Date().getFullYear();

  if (year !== currentYear) {
    return helpers.error("any.invalid", {
      message: "Course start date must be within the current year",
    });
  }

  if (!COURSE_START_DATE_DAYS.includes(day)) {
    return helpers.error("any.invalid", {
      message: "Course start date can only be the 1st or 15th of a month",
    });
  }

  const selectedDate = new Date(value);
  selectedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    return helpers.error("any.invalid", {
      message: "Course start date cannot be in the past",
    });
  }
  return value;
}, "Teacher course start date validation");

const baseCourseSchema = {
  title: titleSchema.required(),
  description: Joi.string().trim().min(DESCRIPTION_MIN_CHARS).max(DESCRIPTION_MAX_CHARS).required(),
  category: objectId.required(),
  subcategory: objectId.allow(null, ""),
  teacher: objectId.required(),
  level: Joi.string().valid("beginner", "intermediate", "advanced").required(),
  language: languageSchema.required(),
  thumbnail: thumbnailSchema.optional(),
  promoVideo: Joi.string().uri().optional().allow(""),
  previewVideoUrls: optionalPreviewVideoUrlsSchema.default([]),
  tags: tagsSchema.default([]),
  price: Joi.number().min(0).max(PRICE_MAX_USD).required(),
  discountPrice: Joi.number().min(0).max(PRICE_MAX_USD).default(0),
  teacherDiscountPercentage: Joi.number().min(0).max(100).default(0),
  currency: Joi.string().valid(...COURSE_CURRENCIES).default("USD"),
  isFree: Joi.boolean().default(false),
  pricingType: Joi.string().valid("single", "regional").default("single"),
  prices: Joi.when("pricingType", {
    is: "regional",
    then: regionalPricesSchema.required(),
    otherwise: regionalPricesSchema.optional(),
  }),
  paymentPlan: paymentPlanSchema.default("monthly"),
  duration: Joi.string().trim().max(DURATION_LABEL_MAX_CHARS).allow(""),
  durationWeeks: Joi.number().integer().min(1).max(104).optional(),
  totalSessions: Joi.number().integer().min(8).max(728).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  schedule: Joi.array().items(scheduleItemSchema).default([]),
  timezone: timezoneSchema.default("Asia/Kabul"),
  certificate: certificateSchema.default({
    enabled: false,
    minimumAttendance: 0,
    minimumPassingGrade: 0,
    assignmentsRequired: false,
    finalProjectRequired: false,
    fullPaymentRequired: true,
  }),
  coursePolicies: coursePoliciesSchema.optional(),
  agreements: agreementsSchema.optional(),
  meetingType: meetingTypeSchema.default("recorded"),
  meetingLink: Joi.string().uri().allow(""),
  requirements: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS).default([]),
  whatYouWillLearn: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS).default([]),
  targetAudience: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS).default([]),
  curriculumTopics: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS).default([]),
  courseType: courseTypeSchema.default("general"),
  maxStudents: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX).default(100),
  minimumStudentsToStart: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX).default(1),
  status: Joi.string().valid(
    "draft",
    "pending",
    "approved",
    "rejected",
    "published",
    "cancelled",
    "class_started",
    "class_ended",
    "cancellation_pending",
  ),
};

const hasAtMostOneDecimalPlace = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  return Math.abs((numeric * 10) - Math.round(numeric * 10)) < 1e-8;
};

const dateValidation = (value, helpers) => {
  if (value.startDate && value.endDate) {
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    if (start > end) {
      return helpers.error("any.invalid", {
        message: "startDate cannot be after endDate",
      });
    }
  }

  if (value.pricingType !== "regional" && value.discountPrice > value.price) {
    return helpers.error("any.invalid", {
      message: "discountPrice cannot be greater than price",
    });
  }

  if (value.meetingType === "zoom" && !value.meetingLink) {
    return helpers.error("any.invalid", {
      message: "meetingLink is required for zoom",
    });
  }

  const hasPrice = Object.prototype.hasOwnProperty.call(value, "price");
  const isFreeExplicit = Object.prototype.hasOwnProperty.call(value, "isFree");
  const isPaidContext = isFreeExplicit ? value.isFree === false : true;
  if (value.pricingType !== "regional" && isPaidContext && hasPrice) {
    const price = Number(value.price);
    if (
      !Number.isFinite(price) ||
      price < PRICE_MIN_PAID_USD ||
      price > PRICE_MAX_USD ||
      !hasAtMostOneDecimalPlace(price)
    ) {
      return helpers.error("any.invalid", {
        message: `paid course price must be >= ${PRICE_MIN_PAID_USD} USD and use at most 1 decimal place`,
      });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "minimumStudentsToStart") &&
    Object.prototype.hasOwnProperty.call(value, "maxStudents")
  ) {
    const minimumStudentsToStart = Number(value.minimumStudentsToStart || 0);
    const maxStudents = Number(value.maxStudents || 0);
    if (
      Number.isFinite(minimumStudentsToStart) &&
      Number.isFinite(maxStudents) &&
      minimumStudentsToStart > maxStudents
    ) {
      return helpers.error("any.invalid", {
        message: "minimumStudentsToStart cannot be greater than maxStudents",
      });
    }
  }

  return value;
};

export const createCourseByAdminSchema = Joi.object(baseCourseSchema)
  .custom(dateValidation)
  .messages({ "any.invalid": "{{#message}}" });

export const updateCourseByAdminSchema = Joi.object({
  ...baseCourseSchema,
  title: titleSchema,
  description: Joi.string().trim().min(DESCRIPTION_MIN_CHARS).max(DESCRIPTION_MAX_CHARS),
  category: objectId,
  subcategory: objectId.allow(null, ""),
  teacher: objectId,
  level: Joi.string().valid("beginner", "intermediate", "advanced"),
  courseType: courseTypeSchema,
  language: languageSchema,
  price: Joi.number().min(0).max(PRICE_MAX_USD),
  discountPrice: Joi.number().min(0).max(PRICE_MAX_USD),
  teacherDiscountPercentage: Joi.number().min(0).max(100),
  currency: Joi.string().valid(...COURSE_CURRENCIES),
  isFree: Joi.boolean(),
  pricingType: Joi.string().valid("single", "regional"),
  prices: regionalPricesSchema.optional(),
  paymentPlan: paymentPlanSchema,
  meetingType: meetingTypeSchema,
  previewVideoUrls: optionalPreviewVideoUrlsSchema,
  tags: tagsSchema,
  timezone: timezoneSchema,
  certificate: certificateSchema,
  coursePolicies: coursePoliciesSchema,
  agreements: agreementsSchema,
  requirements: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  whatYouWillLearn: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  targetAudience: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  curriculumTopics: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  schedule: Joi.array().items(scheduleItemSchema),
  maxStudents: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX),
  minimumStudentsToStart: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX),
}).min(1)
  .custom(dateValidation)
  .messages({ "any.invalid": "{{#message}}" });

export const createCourseByTeacherSchema = Joi.object({
  ...baseCourseSchema,
  teacher: Joi.forbidden(),
  status: Joi.forbidden(),
  startDate: teacherCourseStartDateSchema.optional(),
  tags: tagsSchema.default([]),
  timezone: timezoneSchema.default("Asia/Kabul"),
  certificate: certificateSchema.required(),
  coursePolicies: coursePoliciesSchema.required(),
  agreements: agreementsSchema.required(),
  requirements: Joi.array().items(listItemSchema).min(1).max(LIST_MAX_ITEMS).required(),
  whatYouWillLearn: Joi.array().items(listItemSchema).min(1).max(LIST_MAX_ITEMS).required(),
  targetAudience: Joi.array().items(listItemSchema).min(1).max(LIST_MAX_ITEMS).required(),
  curriculumTopics: Joi.array().items(listItemSchema).min(1).max(LIST_MAX_ITEMS).required(),
  courseType: courseTypeSchema.default("general"),
  totalSessions: Joi.number().integer().min(8).max(728).required(),
  schedule: Joi.array().items(scheduleItemSchema).min(2).required(),
}).custom((value, helpers) => {
  const uniqueDays = new Set((value.schedule || []).map((row) => String(row.day).toLowerCase()));
  if (uniqueDays.size < 2) {
    return helpers.error("any.invalid", {
      message: "Select at least two teaching days per week",
    });
  }
  return value;
}).messages({ "any.invalid": "{{#message}}" });

export const updateCourseByTeacherSchema = Joi.object({
  title: titleSchema,
  description: Joi.string().trim().min(DESCRIPTION_MIN_CHARS).max(DESCRIPTION_MAX_CHARS),
  category: objectId,
  subcategory: objectId.allow(null, ""),
  level: Joi.string().valid("beginner", "intermediate", "advanced"),
  courseType: courseTypeSchema,
  language: languageSchema,
  thumbnail: thumbnailSchema,
  promoVideo: Joi.string().uri().allow(""),
  previewVideoUrls: optionalPreviewVideoUrlsSchema,
  tags: tagsSchema,
  timezone: timezoneSchema,
  certificate: certificateSchema,
  coursePolicies: coursePoliciesSchema,
  agreements: agreementsSchema,
  price: Joi.number().min(0).max(PRICE_MAX_USD),
  discountPrice: Joi.number().min(0).max(PRICE_MAX_USD),
  teacherDiscountPercentage: Joi.number().min(0).max(100),
  currency: Joi.string().valid(...COURSE_CURRENCIES),
  isFree: Joi.boolean(),
  pricingType: Joi.string().valid("single", "regional"),
  prices: regionalPricesSchema.optional(),
  paymentPlan: paymentPlanSchema,
  duration: Joi.string().trim().max(DURATION_LABEL_MAX_CHARS).allow(""),
  durationWeeks: Joi.number().integer().min(1).max(104),
  totalSessions: Joi.number().integer().min(8).max(728),
  startDate: teacherCourseStartDateSchema,
  endDate: Joi.date(),
  schedule: Joi.array().items(scheduleItemSchema),
  meetingType: meetingTypeSchema,
  meetingLink: Joi.string().uri().allow(""),
  requirements: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  whatYouWillLearn: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  targetAudience: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  curriculumTopics: Joi.array().items(listItemSchema).max(LIST_MAX_ITEMS),
  maxStudents: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX),
  minimumStudentsToStart: Joi.number().integer().min(1).max(MAX_STUDENTS_MAX),
}).min(1)
  .custom(dateValidation)
  .messages({ "any.invalid": "{{#message}}" });

export const rejectCourseSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(3).required(),
});

export const requestCourseCancellationSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(1000).required(),
});

export const requestCourseEndReviewSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(1000).required(),
});

export const reviewCourseCancellationSchema = Joi.object({
  adminResponse: Joi.string().trim().max(1000).allow(""),
});

export const reviewCourseEndSchema = Joi.object({
  adminResponse: Joi.string().trim().max(1000).allow(""),
});

export const adminCoursePublishSchema = Joi.object({
  notificationAudience: notificationAudienceSchema.default("all"),
  notificationChannels: notificationChannelsSchema,
});

export const courseListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow(""),
  category: objectId,
  subcategory: objectId.allow(null, ""),
  level: Joi.string().valid("beginner", "intermediate", "advanced"),
  language: languageSchema,
  pricing: Joi.string().valid("free", "paid"),
  meetingType: meetingTypeSchema,
  courseType: courseTypeSchema,
  paymentPlan: paymentPlanSchema,
  minPrice: Joi.number().min(0).max(PRICE_MAX_USD),
  maxPrice: Joi.number().min(0).max(PRICE_MAX_USD),
  status: Joi.string().valid(
    "draft",
    "pending",
    "approved",
    "rejected",
    "published",
    "cancelled",
    "class_started",
    "class_ended",
    "cancellation_pending",
  ),
  cancellationRequestStatus: Joi.string().valid("none", "pending", "approved", "rejected"),
  endRequestStatus: Joi.string().valid("none", "pending", "approved", "rejected"),
  teacher: objectId,
  sortBy: Joi.string().valid("popular", "newest", "price", "startDate").default("popular"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const idParamSchema = Joi.object({
  id: objectId.required(),
});

export const courseResourceParamSchema = Joi.object({
  id: objectId.required(),
  resourceId: objectId.required(),
});

export const slugParamSchema = Joi.object({
  slug: Joi.string().trim().required(),
});
