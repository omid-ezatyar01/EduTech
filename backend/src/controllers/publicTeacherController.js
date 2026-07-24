import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import TeacherFollow from "../models/TeacherFollow.js";
import { getPlatformPricingSettings, resolveCourseDisplayPricing } from "../utils/platformSettings.js";
import {
  getCourseRatingAggregates,
  getPublicTeacherReviews,
  getTeacherRatingAggregates,
} from "../utils/courseRatings.js";

const activeEnrollmentFilter = (now = new Date()) => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: now } },
  ],
});

const buildTeacherCourseFilter = (teacherId) => ({
  status: "published",
  isPublished: true,
  classEndedAt: null,
  $and: [
    {
      $or: [
        { classCancelledAt: { $exists: false } },
        { classCancelledAt: null },
      ],
    },
  ],
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const buildTeacherEndedCourseFilter = (teacherId) => ({
  ...buildTeacherCourseFilter(teacherId),
  classEndedAt: { $exists: true, $ne: null },
  $and: [
    {
      $or: [
        { classCancelledAt: { $exists: false } },
        { classCancelledAt: null },
      ],
    },
  ],
});

const getActiveEnrollmentCountsByCourse = async (courseIds = []) => {
  if (!courseIds.length) return new Map();
  const rows = await Enrollment.aggregate([
    {
      $match: {
        ...activeEnrollmentFilter(),
        courseId: { $in: courseIds },
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

const getActiveEnrollmentCount = async (courseIds = []) => {
  const counts = await getActiveEnrollmentCountsByCourse(courseIds);
  return Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
};

const mapTeacherRow = ({
  teacher,
  courses = [],
  enrollmentCounts = new Map(),
  teacherRatingMap = new Map(),
  followerCount = 0,
}) => {
  const publishedCoursesCount = courses.length;
  const totalStudents = courses.reduce(
    (sum, course) => sum + Number(enrollmentCounts.get(String(course._id)) || 0),
    0,
  );
  const ratingStats = teacherRatingMap.get(String(teacher._id)) || { rating: 0, ratingCount: 0 };

  const tags = [
    ...new Set(
      courses.slice(0, 3)
        .flatMap((course) => [course.level, course.language])
        .filter(Boolean),
    ),
  ].slice(0, 3);

  return {
    _id: teacher._id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    avatar: teacher.avatar || "",
    bio: teacher.bio || "",
    city: teacher.city || "",
    country: teacher.country || "",
    socialLinks: {
      linkedin: teacher.socialLinks?.linkedin || "",
      youtube: teacher.socialLinks?.youtube || "",
      instagram: teacher.socialLinks?.instagram || "",
      facebook: teacher.socialLinks?.facebook || "",
      whatsapp: teacher.socialLinks?.whatsapp || "",
      twitter: teacher.socialLinks?.twitter || "",
      github: teacher.socialLinks?.github || "",
    },
    joinedAt: teacher.createdAt,
    teacherApplication: mapPublicTeacherApplication(teacher.teacherApplication || {}),
    publishedCoursesCount,
    totalStudents,
    rating: ratingStats.rating,
    ratingCount: ratingStats.ratingCount,
    ratingDistribution: ratingStats.ratingDistribution || {},
    followerCount: Number(followerCount || 0),
    tags,
  };
};

const mapTeacherCourses = (courses = [], globalCourseDiscountPercentage = 0, ratingMap = new Map()) =>
  courses.map((course) => ({
    ...(() => {
      const pricing = resolveCourseDisplayPricing(course, globalCourseDiscountPercentage);
      const ratingStats = ratingMap.get(String(course._id)) || { rating: 0, ratingCount: 0 };
      return {
        _id: course._id,
        slug: course.slug,
        title: course.title,
        level: course.level || "beginner",
        language: course.language || "English",
        duration: course.duration || "",
        durationWeeks: Number(course.durationWeeks || 0),
        totalSessions: Number(course.totalSessions || 0),
        startDate: course.startDate || null,
        endDate: course.endDate || null,
        description: course.description || "",
        schedule: Array.isArray(course.schedule) ? course.schedule : [],
        price: Number(pricing.finalPrice || 0),
        discountPrice: Number(pricing.originalPriceForDisplay || 0),
        teacherDiscountPercentage: Number(pricing.teacherDiscountPercentage || 0),
        globalCourseDiscountPercentage: Number(pricing.globalDiscountPercentage || 0),
        totalCourseDiscountPercentage: Number(pricing.totalDiscountPercentage || 0),
        currency: course.currency || "USD",
        isFree: Boolean(course.isFree) || Number(pricing.finalPrice || 0) <= 0,
        meetingType: course.meetingType || "recorded",
        maxStudents: Number(course.maxStudents || 0),
        enrolledStudentsCount: Number(course.enrolledStudentsCount || 0),
        thumbnail: course.thumbnail || "",
        classEndedAt: course.classEndedAt || null,
        rating: ratingStats.rating,
        ratingCount: ratingStats.ratingCount,
      };
    })(),
  }));

const mapPublicTeacherApplication = (application = {}) => ({
  status: application.status || "draft",
  professionalTitle: application.professionalTitle || "",
  yearsExperience: Number(application.yearsExperience || 0),
  education: application.education || "",
  expertiseAreas: Array.isArray(application.expertiseAreas)
    ? application.expertiseAreas.filter(Boolean)
    : [],
  teachingLevels: Array.isArray(application.teachingLevels)
    ? application.teachingLevels.filter(Boolean)
    : [],
  certifications: Array.isArray(application.certifications)
    ? application.certifications.filter(Boolean)
    : [],
  languages: Array.isArray(application.languages)
    ? application.languages.filter(Boolean)
    : [],
  skillRatings: Array.isArray(application.skillRatings)
    ? application.skillRatings
        .map((item) => ({
          name: String(item?.name || "").trim(),
          percentage: Number(item?.percentage || 0),
        }))
        .filter((item) => item.name && Number.isFinite(item.percentage))
        .map((item) => ({
          name: item.name,
          percentage: Math.max(0, Math.min(100, Math.round(item.percentage))),
        }))
    : [],
  introVideoUrl: application.introVideoUrl || "",
  courseIntroVideoUrls: Array.isArray(application.courseIntroVideoUrls)
    ? application.courseIntroVideoUrls.filter(Boolean).slice(0, 8)
    : [],
});

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBooleanQuery = (value) => {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
};

const normalizeFacetValues = (values = []) => {
  const byKey = new Map();
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    const key = normalized.toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, normalized);
  });
  return [...byKey.values()].sort((left, right) => left.localeCompare(right));
};

export const getPublicTeachers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 12));
  const search = String(req.query.search || "").trim();
  const skip = (page - 1) * limit;

  const baseFilter = {
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  };
  const filter = { ...baseFilter };

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
      { "teacherApplication.professionalTitle": { $regex: safeSearch, $options: "i" } },
      { "teacherApplication.expertiseAreas": { $regex: safeSearch, $options: "i" } },
    ];
  }
  if (req.query.language) {
    filter["teacherApplication.languages"] = new RegExp(
      `^${escapeRegex(req.query.language)}$`,
      "i",
    );
  }
  if (req.query.expertise) {
    filter["teacherApplication.expertiseAreas"] = new RegExp(
      `^${escapeRegex(req.query.expertise)}$`,
      "i",
    );
  }
  if (req.query.teachingLevel) {
    filter["teacherApplication.teachingLevels"] = new RegExp(
      `^${escapeRegex(req.query.teachingLevel)}$`,
      "i",
    );
  }
  if (req.query.country) {
    filter.country = new RegExp(`^${escapeRegex(req.query.country)}$`, "i");
  }
  if (req.query.minExperience !== undefined) {
    filter["teacherApplication.yearsExperience"] = {
      $gte: Number(req.query.minExperience),
    };
  }
  const hasIntroVideo = parseBooleanQuery(req.query.hasIntroVideo);
  if (hasIntroVideo === true) {
    filter["teacherApplication.introVideoUrl"] = { $type: "string", $ne: "" };
  } else if (hasIntroVideo === false) {
    filter.$and = [
      {
        $or: [
          { "teacherApplication.introVideoUrl": { $exists: false } },
          { "teacherApplication.introVideoUrl": "" },
        ],
      },
    ];
  }

  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const sort =
    req.query.sortBy === "experience"
      ? { "teacherApplication.yearsExperience": sortOrder, createdAt: -1 }
      : req.query.sortBy === "name"
        ? { name: sortOrder }
        : { createdAt: sortOrder };

  const [teachers, total, languages, expertiseAreas, teachingLevels, countries] =
    await Promise.all([
    User.find(filter)
      .select("name email phone avatar bio city country socialLinks createdAt teacherApplication.status teacherApplication.professionalTitle teacherApplication.yearsExperience teacherApplication.education teacherApplication.expertiseAreas teacherApplication.teachingLevels teacherApplication.certifications teacherApplication.languages teacherApplication.skillRatings teacherApplication.introVideoUrl teacherApplication.courseIntroVideoUrls")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
    User.distinct("teacherApplication.languages", baseFilter),
    User.distinct("teacherApplication.expertiseAreas", baseFilter),
    User.distinct("teacherApplication.teachingLevels", baseFilter),
    User.distinct("country", baseFilter),
  ]);

  const teacherIds = teachers.map((teacher) => teacher._id);
  const publishedCourses = teacherIds.length
    ? await Course.find({
        status: "published",
        isPublished: true,
        $or: [
          { teacher: { $in: teacherIds } },
          { teacherId: { $in: teacherIds } },
          { createdBy: { $in: teacherIds } },
        ],
      })
        .select("_id teacher teacherId createdBy level language createdAt")
        .sort({ createdAt: -1 })
        .lean()
    : [];
  const teacherIdSet = new Set(teacherIds.map(String));
  const coursesByTeacher = new Map(teacherIds.map((id) => [String(id), []]));
  publishedCourses.forEach((course) => {
    const ownerId = [course.teacher, course.teacherId, course.createdBy]
      .map(String)
      .find((id) => teacherIdSet.has(id));
    if (ownerId) coursesByTeacher.get(ownerId)?.push(course);
  });
  const [enrollmentCounts, teacherRatingMap, followerRows] = await Promise.all([
    getActiveEnrollmentCountsByCourse(publishedCourses.map((course) => course._id)),
    getTeacherRatingAggregates(teacherIds),
    TeacherFollow.aggregate([
      { $match: { teacher: { $in: teacherIds } } },
      { $group: { _id: "$teacher", count: { $sum: 1 } } },
    ]),
  ]);
  const followerCountMap = new Map(followerRows.map((row) => [String(row._id), Number(row.count || 0)]));
  const rows = teachers.map((teacher) =>
    mapTeacherRow({
      teacher,
      courses: coursesByTeacher.get(String(teacher._id)) || [],
      enrollmentCounts,
      teacherRatingMap,
      followerCount: followerCountMap.get(String(teacher._id)) || 0,
    }),
  );

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalCourses += Number(row.publishedCoursesCount || 0);
      acc.totalStudents += Number(row.totalStudents || 0);
      return acc;
    },
    { totalTeachers: rows.length, totalCourses: 0, totalStudents: 0 },
  );

  return res.json(
    new ApiResponse({
      message: "Teachers fetched successfully",
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        summary,
        facets: {
          languages: normalizeFacetValues(languages),
          expertiseAreas: normalizeFacetValues(expertiseAreas),
          teachingLevels: normalizeFacetValues(teachingLevels),
          countries: normalizeFacetValues(countries),
        },
      },
    }),
  );
});

export const getPublicTeacherById = asyncHandler(async (req, res) => {
  const teacher = await User.findOne({
    _id: req.params.id,
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  }).select(
    "name email phone avatar bio city country socialLinks createdAt teacherApplication.status teacherApplication.professionalTitle teacherApplication.yearsExperience teacherApplication.education teacherApplication.expertiseAreas teacherApplication.teachingLevels teacherApplication.certifications teacherApplication.languages teacherApplication.skillRatings teacherApplication.introVideoUrl teacherApplication.courseIntroVideoUrls",
  );

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  const filter = buildTeacherCourseFilter(teacher._id);
  const endedFilter = buildTeacherEndedCourseFilter(teacher._id);

  const [publishedCoursesCount, courses, endedCourses, allCourseIds, pricingSettings, followerCount] = await Promise.all([
    Course.countDocuments(filter),
    Course.find(filter)
      .select(
        "slug title description level language duration durationWeeks startDate endDate schedule price discountPrice teacherDiscountPercentage currency isFree meetingType maxStudents enrolledStudentsCount thumbnail",
      )
      .sort({ createdAt: -1 })
      .limit(12),
    Course.find(endedFilter)
      .select(
        "slug title description level language duration durationWeeks startDate endDate classEndedAt schedule price discountPrice teacherDiscountPercentage currency isFree meetingType maxStudents enrolledStudentsCount thumbnail",
      )
      .sort({ classEndedAt: -1, createdAt: -1 })
      .limit(6),
    Course.find(filter).distinct("_id"),
    getPlatformPricingSettings(),
    TeacherFollow.countDocuments({ teacher: teacher._id }),
  ]);

  const activeCourseIds = courses.map((course) => course._id);
  const endedCourseIds = endedCourses.map((course) => course._id);
  const [totalStudents, teacherRatingMap, courseRatingMap, endedCourseRatingMap, reviews] = await Promise.all([
    getActiveEnrollmentCount(allCourseIds),
    getTeacherRatingAggregates([teacher._id]),
    getCourseRatingAggregates(activeCourseIds),
    getCourseRatingAggregates(endedCourseIds),
    getPublicTeacherReviews(teacher._id),
  ]);
  const [enrollmentCountMap, endedEnrollmentCountMap] = await Promise.all([
    getActiveEnrollmentCountsByCourse(activeCourseIds),
    getActiveEnrollmentCountsByCourse(endedCourseIds),
  ]);
  const teacherRatingStats = teacherRatingMap.get(String(teacher._id)) || {
    rating: 0,
    ratingCount: 0,
  };
  courses.forEach((course) => {
    course.enrolledStudentsCount = enrollmentCountMap.get(String(course._id)) || 0;
  });
  endedCourses.forEach((course) => {
    course.enrolledStudentsCount = endedEnrollmentCountMap.get(String(course._id)) || 0;
  });
  const mappedCourses = mapTeacherCourses(
    courses,
    Number(pricingSettings?.globalCourseDiscountPercentage || 0),
    courseRatingMap,
  );
  const mappedEndedCourses = mapTeacherCourses(
    endedCourses,
    Number(pricingSettings?.globalCourseDiscountPercentage || 0),
    endedCourseRatingMap,
  );
  const tags = [
    ...new Set(
      mappedCourses
        .flatMap((course) => [course.level, course.language])
        .filter(Boolean),
    ),
  ].slice(0, 4);

  return res.json(
    new ApiResponse({
      message: "Teacher details fetched successfully",
      data: {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        avatar: teacher.avatar || "",
        bio: teacher.bio || "",
        city: teacher.city || "",
        country: teacher.country || "",
        socialLinks: {
          linkedin: teacher.socialLinks?.linkedin || "",
          youtube: teacher.socialLinks?.youtube || "",
          instagram: teacher.socialLinks?.instagram || "",
          facebook: teacher.socialLinks?.facebook || "",
          whatsapp: teacher.socialLinks?.whatsapp || "",
          twitter: teacher.socialLinks?.twitter || "",
          github: teacher.socialLinks?.github || "",
        },
        joinedAt: teacher.createdAt,
        publishedCoursesCount,
        totalStudents,
        rating: teacherRatingStats.rating,
        ratingCount: teacherRatingStats.ratingCount,
        ratingDistribution: teacherRatingStats.ratingDistribution || {},
        followerCount,
        tags,
        reviews,
        publishedCourses: mappedCourses,
        endedCourses: mappedEndedCourses,
        teacherApplication: mapPublicTeacherApplication(teacher.teacherApplication || {}),
      },
    }),
  );
});
