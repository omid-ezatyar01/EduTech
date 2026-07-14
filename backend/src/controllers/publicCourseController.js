import Course from "../models/Course.js";
import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";
import mongoose from "mongoose";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { hasUsableBankPaymentInfo } from "../utils/bankPaymentInfo.js";
import { getPlatformPricingSettings, resolveCourseDisplayPricing } from "../utils/platformSettings.js";
import { getCourseRatingAggregates, getPublicCourseReviews } from "../utils/courseRatings.js";
import { buildCourseCategoryFilter } from "../utils/courseCategory.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";

const activeEnrollmentFilter = (now = new Date()) => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: now } },
  ],
});

const getEnrollmentCountsByCourseId = async (courseIds = [], now = new Date()) => {
  const ids = courseIds.filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return new Map();

  const rows = await Enrollment.aggregate([
    {
      $match: {
        ...activeEnrollmentFilter(now),
        courseId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $match: { "student.0": { $exists: true } } },
    { $group: { _id: "$courseId", total: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.total || 0)]));
};

const buildSort = ({ sortBy = "popular", sortOrder = "desc" }) => {
  if (sortBy === "price") return { price: sortOrder === "asc" ? 1 : -1 };
  if (sortBy === "startDate") return { startDate: sortOrder === "asc" ? 1 : -1 };
  return { createdAt: -1 };
};

const buildPublishedCourseQuery = (filter) =>
  Course.find(filter)
    .populate("teacher", "name username avatar bio role bankPaymentInfo")
    .populate("teacherId", "name username avatar bio role bankPaymentInfo")
    .populate("createdBy", "name username avatar bio role bankPaymentInfo")
    .populate("category", "name slug parent")
    .populate("subcategory", "name slug parent");

const hasTeacherBankPaymentInfo = (teacher = null) =>
  Boolean(teacher && typeof teacher === "object" && hasUsableBankPaymentInfo(teacher.bankPaymentInfo || {}));

const resolvePreviewVideoUrls = (course = {}) => {
  const videos = Array.isArray(course?.previewVideoUrls)
    ? course.previewVideoUrls.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (videos.length) return videos;
  const promoVideo = String(course?.promoVideo || "").trim();
  return promoVideo ? [promoVideo] : [];
};

export const getPublishedCourses = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const approvedTeacherIds = await User.find({
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  }).distinct("_id");

  if (!approvedTeacherIds.length) {
    return res.json(
      new ApiResponse({
        message: "Published courses fetched successfully",
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          facets: {
            languages: [],
            priceRange: { min: 0, max: 0 },
          },
        },
      }),
    );
  }

  const baseFilter = {
    status: "published",
    isPublished: true,
    $or: [
      { teacher: { $in: approvedTeacherIds } },
      { teacherId: { $in: approvedTeacherIds } },
      { createdBy: { $in: approvedTeacherIds } },
    ],
  };
  const filter = { ...baseFilter };

  if (req.query.search) filter.$text = { $search: req.query.search };
  if (req.query.category) Object.assign(filter, await buildCourseCategoryFilter(req.query.category));
  if (req.query.level) filter.level = req.query.level;
  if (req.query.language) {
    const escapedLanguage = String(req.query.language).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.language = new RegExp(`^${escapedLanguage}$`, "i");
  }
  if (req.query.courseType) filter.courseType = req.query.courseType;
  if (req.query.paymentPlan) filter.paymentPlan = req.query.paymentPlan;
  if (req.query.pricing === "free") {
    filter.$and = [{ $or: [{ isFree: true }, { price: { $lte: 0 } }] }];
  } else if (req.query.pricing === "paid") {
    filter.$and = [{ isFree: { $ne: true } }, { price: { $gt: 0 } }];
  }

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.price = {};
    if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
  }

  const isPopularitySort = req.query.sortBy === "popular";
  const sort = buildSort(req.query);

  const [courseRows, total, pricingSettings, languageRows, priceRangeRows] = await Promise.all([
    isPopularitySort
      ? Course.find(filter).select("_id createdAt").lean()
      : buildPublishedCourseQuery(filter).sort(sort).skip(skip).limit(limit),
    Course.countDocuments(filter),
    getPlatformPricingSettings(),
    Course.aggregate([
      { $match: baseFilter },
      { $match: { language: { $type: "string", $ne: "" } } },
      {
        $project: {
          value: "$language",
          normalized: { $toLower: { $trim: { input: "$language" } } },
        },
      },
      { $group: { _id: "$normalized", value: { $first: "$value" }, count: { $sum: 1 } } },
      { $sort: { value: 1 } },
    ]),
    Course.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          min: { $min: "$price" },
          max: { $max: "$price" },
        },
      },
    ]),
  ]);

  const globalDiscountPercentage = Number(pricingSettings?.globalCourseDiscountPercentage || 0);
  let courses = courseRows;
  let courseIds = (Array.isArray(courses) ? courses : []).map((course) => course?._id);
  let [enrollmentCounts, ratingAggregates] = await Promise.all([
    getEnrollmentCountsByCourseId(courseIds),
    getCourseRatingAggregates(courseIds),
  ]);

  if (isPopularitySort) {
    const rankedRows = [...courseRows].sort((left, right) => {
      const leftId = String(left._id);
      const rightId = String(right._id);
      const studentDifference =
        Number(enrollmentCounts.get(rightId) || 0) -
        Number(enrollmentCounts.get(leftId) || 0);
      if (studentDifference) return studentDifference;

      const leftRating = ratingAggregates.get(leftId) || {};
      const rightRating = ratingAggregates.get(rightId) || {};
      const ratingDifference =
        Number(rightRating.rating || 0) - Number(leftRating.rating || 0);
      if (ratingDifference) return ratingDifference;

      const ratingCountDifference =
        Number(rightRating.ratingCount || 0) -
        Number(leftRating.ratingCount || 0);
      if (ratingCountDifference) return ratingCountDifference;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    const pageIds = rankedRows.slice(skip, skip + limit).map((row) => row._id);
    const pageCourses = pageIds.length
      ? await buildPublishedCourseQuery({ _id: { $in: pageIds } })
      : [];
    const byId = new Map(pageCourses.map((course) => [String(course._id), course]));
    courses = pageIds.map((id) => byId.get(String(id))).filter(Boolean);
    courseIds = pageIds;
  }
  await Promise.all(
    (Array.isArray(courses) ? courses : []).map((course) =>
      ensureCourseAutoStarted(course, {
        activeStudentsCount: enrollmentCounts.get(String(course?._id)) || 0,
      })),
  );
  const normalizedCourses = (Array.isArray(courses) ? courses : []).map((courseDoc) => {
    const row = typeof courseDoc?.toObject === "function" ? courseDoc.toObject() : courseDoc;
    const pricing = resolveCourseDisplayPricing(row, globalDiscountPercentage);
    const ratingStats = ratingAggregates.get(String(row._id)) || { rating: 0, ratingCount: 0 };
    return {
      ...row,
      price: pricing.finalPrice,
      discountPrice: pricing.originalPriceForDisplay || 0,
      teacherDiscountPercentage: pricing.teacherDiscountPercentage,
      globalCourseDiscountPercentage: pricing.globalDiscountPercentage,
      totalCourseDiscountPercentage: pricing.totalDiscountPercentage,
      globalCourseDiscountAmount: pricing.globalDiscountAmount,
      teacherEffectivePrice: pricing.teacherEffectivePrice,
      finalPriceForStudents: pricing.finalPrice,
      previewVideoUrls: resolvePreviewVideoUrls(row),
      isFree: Boolean(row?.isFree) || Number(pricing.finalPrice || 0) <= 0,
      bankPaymentAvailable:
        hasTeacherBankPaymentInfo(row?.teacher) ||
        hasTeacherBankPaymentInfo(row?.teacherId) ||
        hasTeacherBankPaymentInfo(row?.createdBy),
      enrolledStudentsCount: enrollmentCounts.get(String(row._id)) || 0,
      rating: ratingStats.rating,
      ratingCount: ratingStats.ratingCount,
    };
  });

  return res.json(
    new ApiResponse({
      message: "Published courses fetched successfully",
      data: normalizedCourses,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        facets: {
          languages: languageRows.map((row) => ({
            value: row.value,
            count: Number(row.count || 0),
          })),
          priceRange: {
            min: Number(priceRangeRows[0]?.min || 0),
            max: Number(priceRangeRows[0]?.max || 0),
          },
        },
      },
    }),
  );
});

export const getPublishedCourseBySlug = asyncHandler(async (req, res) => {
  const identifier = String(req.params.slug || "").trim();
  const approvedTeacherIds = await User.find({
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  }).distinct("_id");

  if (!approvedTeacherIds.length) {
    throw new ApiError(404, "Course not found");
  }

  const publishedFilter = {
    status: "published",
    isPublished: true,
    $or: [
      { teacher: { $in: approvedTeacherIds } },
      { teacherId: { $in: approvedTeacherIds } },
      { createdBy: { $in: approvedTeacherIds } },
    ],
  };
  const lookupFilter = mongoose.isValidObjectId(identifier)
    ? {
        ...publishedFilter,
        $or: [{ slug: identifier }, { _id: identifier }],
      }
    : {
        ...publishedFilter,
        slug: identifier,
      };

  const course = await Course.findOne(lookupFilter)
    .populate("teacher", "name username avatar bio role bankPaymentInfo")
    .populate("teacherId", "name username avatar bio role bankPaymentInfo")
    .populate("createdBy", "name username avatar bio role bankPaymentInfo")
    .populate("category", "name slug parent")
    .populate("subcategory", "name slug parent");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const pricingSettings = await getPlatformPricingSettings();
  const globalDiscountPercentage = Number(pricingSettings?.globalCourseDiscountPercentage || 0);
  const row = typeof course?.toObject === "function" ? course.toObject() : course;
  const pricing = resolveCourseDisplayPricing(row, globalDiscountPercentage);
  const [enrollmentCounts, ratingAggregates, reviews] = await Promise.all([
    getEnrollmentCountsByCourseId([row._id]),
    getCourseRatingAggregates([row._id]),
    getPublicCourseReviews(row._id),
  ]);
  await ensureCourseAutoStarted(course, {
    activeStudentsCount: enrollmentCounts.get(String(row._id)) || 0,
  });
  const ratingStats = ratingAggregates.get(String(row._id)) || { rating: 0, ratingCount: 0 };
  const normalizedCourse = {
    ...row,
    price: pricing.finalPrice,
    discountPrice: pricing.originalPriceForDisplay || 0,
    teacherDiscountPercentage: pricing.teacherDiscountPercentage,
    globalCourseDiscountPercentage: pricing.globalDiscountPercentage,
    totalCourseDiscountPercentage: pricing.totalDiscountPercentage,
    globalCourseDiscountAmount: pricing.globalDiscountAmount,
    teacherEffectivePrice: pricing.teacherEffectivePrice,
    finalPriceForStudents: pricing.finalPrice,
    previewVideoUrls: resolvePreviewVideoUrls(row),
    isFree: Boolean(row?.isFree) || Number(pricing.finalPrice || 0) <= 0,
    bankPaymentAvailable:
      hasTeacherBankPaymentInfo(row?.teacher) ||
      hasTeacherBankPaymentInfo(row?.teacherId) ||
      hasTeacherBankPaymentInfo(row?.createdBy),
    enrolledStudentsCount: enrollmentCounts.get(String(row._id)) || 0,
    rating: ratingStats.rating,
    ratingCount: ratingStats.ratingCount,
    reviews,
  };

  return res.json(
    new ApiResponse({
      message: "Course details fetched successfully",
      data: normalizedCourse,
    }),
  );
});

export const getPublicPlatformStats = asyncHandler(async (_req, res) => {
  const enrollmentResolvedFilter = {
    enrollmentStatus: { $in: ["active", "completed", "cancelled"] },
  };

  const approvedTeacherIds = await User.find({
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  }).distinct("_id");

  const activeCourseFilter = {
    status: "published",
    isPublished: true,
    $or: [
      { teacher: { $in: approvedTeacherIds } },
      { teacherId: { $in: approvedTeacherIds } },
      { createdBy: { $in: approvedTeacherIds } },
    ],
  };

  const activeCourseIds = approvedTeacherIds.length
    ? await Course.find(activeCourseFilter).distinct("_id")
    : [];

  const [
    registeredStudents,
    successfulEnrollments,
    resolvedEnrollments,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    activeCourseIds.length
      ? Enrollment.countDocuments({
          ...activeEnrollmentFilter(),
          courseId: { $in: activeCourseIds },
        })
      : 0,
    activeCourseIds.length
      ? Enrollment.countDocuments({
          ...enrollmentResolvedFilter,
          courseId: { $in: activeCourseIds },
        })
      : 0,
  ]);

  const satisfactionRate = resolvedEnrollments
    ? Math.round((successfulEnrollments / resolvedEnrollments) * 100)
    : 0;

  return res.json(
    new ApiResponse({
      message: "Public platform stats fetched successfully",
      data: {
        activeCourses: activeCourseIds.length,
        expertTeachers: approvedTeacherIds.length,
        happyStudents: registeredStudents,
        satisfactionRate,
        lastUpdatedAt: new Date().toISOString(),
      },
    }),
  );
});
