import {
  fetchJsonWithCache,
  getApiBase,
  getApiCacheTtl,
  invalidateApiCache,
} from "./http";
import { resolveAvatarUrl } from "../src/utils/avatar";
import {
  fetchMockPublicTeacherById,
  fetchMockPublicTeachers,
} from "./mockTeacherService.js";

const USE_FRONTEND_TEACHER_MOCKS = false;

const PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_TEACHER_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const publicTeacherListCache = new Map();
const publicTeacherDetailCache = new Map();

const cloneValue = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const buildPublicCacheKey = (prefix, value = {}) => {
  if (typeof value === "string") {
    return `${prefix}:${value.trim()}`;
  }

  const queryEntries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && String(entryValue).trim() !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return `${prefix}:${JSON.stringify(queryEntries)}`;
};

const readPublicCache = (cacheMap, cacheKey) => {
  const cached = cacheMap.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cacheMap.delete(cacheKey);
    return null;
  }
  return cloneValue(cached.data);
};

const writePublicCache = (cacheMap, cacheKey, data, ttlMs) => {
  cacheMap.set(cacheKey, {
    data: cloneValue(data),
    expiresAt: Date.now() + ttlMs,
  });
  return cloneValue(data);
};

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeArray = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => normalizeText(item || ""))
    .filter(Boolean);

const normalizeSkillRatings = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      name: normalizeText(item?.name || ""),
      percentage: Number(item?.percentage || 0),
    }))
    .filter((item) => item.name && Number.isFinite(item.percentage))
    .map((item) => ({
      name: item.name,
      percentage: Math.max(0, Math.min(100, Math.round(item.percentage))),
    }));

const normalizeReviews = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      _id: String(item?._id || ""),
      name: normalizeText(item?.studentName || "Student"),
      course: normalizeText(item?.courseTitle || "Course"),
      text: normalizeText(item?.comment || ""),
      rating: Math.max(1, Math.min(5, Math.round(Number(item?.rating || item?.teacherRating || 0) || 0))),
      createdAt: item?.createdAt || null,
      tags: Array.isArray(item?.tags) ? item.tags : [],
      verifiedLearner: Boolean(item?.verifiedLearner),
      teacherReply: String(item?.teacherReply || ""),
      helpfulCount: Number(item?.helpfulCount || 0),
    }))
    .filter((item) => item.rating > 0);

const mapTeacherCourse = (course = {}) => {
  const finalPrice = Number(course?.price || 0);
  const originalPrice = Number(course?.discountPrice || 0);
  const hasDiscount = originalPrice > 0 && originalPrice > finalPrice;
  const scheduleRows = Array.isArray(course.schedule) ? course.schedule : [];
  const firstSlot = scheduleRows[0] || null;

  return {
    ...course,
    id: course._id,
    _id: course._id,
    slug: course.slug || "",
    title: course.title || "",
    description: course.shortDescription || course.description || "",
    level: course.level || "beginner",
    language: course.language || "English",
    duration: course.duration || "",
    durationWeeks: Number(course.durationWeeks || 0),
    totalSessions: Number(course.totalSessions || 0),
    startDate: course.startDate || null,
    endDate: course.endDate || null,
    scheduleRows,
    schedule: scheduleRows.length
      ? scheduleRows.map((row) => row?.day || "").filter(Boolean).join(", ")
      : "Flexible",
    time: firstSlot ? `${firstSlot.startTime} - ${firstSlot.endTime}` : "Any time",
    price: finalPrice,
    discountPrice: originalPrice,
    originalPrice: hasDiscount ? originalPrice : 0,
    discountPercent:
      Number(course?.totalCourseDiscountPercentage || 0) > 0
        ? Number(course.totalCourseDiscountPercentage || 0)
        : Number(course?.globalCourseDiscountPercentage || 0) > 0
          ? Number(course.globalCourseDiscountPercentage || 0)
          : hasDiscount && originalPrice > 0
            ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
            : 0,
    teacherDiscountPercentage: Number(course.teacherDiscountPercentage || 0),
    globalCourseDiscountPercentage: Number(course.globalCourseDiscountPercentage || 0),
    totalCourseDiscountPercentage: Number(course.totalCourseDiscountPercentage || 0),
    currency: course.currency || "USD",
    isFree: Boolean(course.isFree),
    rating: Number(course.rating || 0),
    ratingCount: Math.max(0, Number(course.ratingCount || 0)),
    meetingType: course.meetingType || "recorded",
    maxStudents: Number(course.maxStudents || 0),
    enrolledStudentsCount: Number(course.enrolledStudentsCount || 0),
    classEndedAt: course.classEndedAt || null,
    thumbnail: resolveAvatarUrl(
      course.thumbnail || "",
      course?.updatedAt || course?.createdAt || "",
    ),
  };
};

const mapTeacher = (teacher = {}) => ({
  ...teacher,
  _id: teacher._id,
  avatar: resolveAvatarUrl(teacher.avatar || ""),
  bio: normalizeText(teacher.bio || teacher.about || teacher.description),
  publishedCoursesCount: Number(teacher.publishedCoursesCount || 0),
  totalStudents: Number(teacher.totalStudents || 0),
  rating: Number(teacher.rating || 0),
  ratingCount: Math.max(0, Number(teacher.ratingCount || 0)),
  ratingDistribution: teacher?.ratingDistribution || {},
  tags: Array.isArray(teacher.tags) ? teacher.tags : [],
  reviews: normalizeReviews(teacher.reviews || []),
  teacherApplication: {
    status: normalizeText(teacher?.teacherApplication?.status || "draft"),
    professionalTitle: normalizeText(teacher?.teacherApplication?.professionalTitle || ""),
    yearsExperience: Number(teacher?.teacherApplication?.yearsExperience || 0),
    education: normalizeText(teacher?.teacherApplication?.education || ""),
    expertiseAreas: normalizeArray(teacher?.teacherApplication?.expertiseAreas || []),
    teachingLevels: normalizeArray(teacher?.teacherApplication?.teachingLevels || []),
    certifications: normalizeArray(teacher?.teacherApplication?.certifications || []),
    languages: normalizeArray(teacher?.teacherApplication?.languages || []),
    skillRatings: normalizeSkillRatings(teacher?.teacherApplication?.skillRatings || []),
    introVideoUrl: normalizeText(teacher?.teacherApplication?.introVideoUrl || ""),
    courseIntroVideoUrls: normalizeArray(
      teacher?.teacherApplication?.courseIntroVideoUrls || [],
    ).slice(0, 8),
  },
  endedCourses: Array.isArray(teacher.endedCourses)
    ? teacher.endedCourses.map(mapTeacherCourse)
    : [],
  publishedCourses: Array.isArray(teacher.publishedCourses)
    ? teacher.publishedCourses.map(mapTeacherCourse)
    : [],
});

export const fetchPublicTeachers = async (query = {}) => {
  const cacheKey = buildPublicCacheKey("public-teachers", query);
  const cached = readPublicCache(publicTeacherListCache, cacheKey);
  if (cached) return cached;

  if (USE_FRONTEND_TEACHER_MOCKS) {
    const result = await fetchMockPublicTeachers(query);
    return writePublicCache(publicTeacherListCache, cacheKey, result, PUBLIC_TEACHER_LIST_CACHE_TTL_MS);
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJsonWithCache(
    `${getApiBase()}/teachers${suffix}`,
    {},
    { ttlMs: getApiCacheTtl() },
  );

  return writePublicCache(publicTeacherListCache, cacheKey, {
    teachers: Array.isArray(data?.data) ? data.data.map(mapTeacher) : [],
    meta: data?.meta || {},
  }, getApiCacheTtl({ publicTtl: PUBLIC_TEACHER_LIST_CACHE_TTL_MS }));
};

export const fetchPublicTeacherById = async (id, { force = false } = {}) => {
  const cacheKey = buildPublicCacheKey("public-teacher-detail", id);
  if (force) {
    publicTeacherDetailCache.delete(cacheKey);
    invalidateApiCache((key) => key.includes(`/teachers/${encodeURIComponent(id)}`));
  }
  const cached = readPublicCache(publicTeacherDetailCache, cacheKey);
  if (cached) return cached;

  if (USE_FRONTEND_TEACHER_MOCKS) {
    const result = await fetchMockPublicTeacherById(id);
    return writePublicCache(publicTeacherDetailCache, cacheKey, result, PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS);
  }

  const data = await fetchJsonWithCache(
    `${getApiBase()}/teachers/${encodeURIComponent(id)}`,
    {},
    { ttlMs: force ? 0 : getApiCacheTtl({ publicTtl: PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS }) },
  );
  const row = data?.data || null;
  if (!row) return null;
  return writePublicCache(publicTeacherDetailCache, cacheKey, mapTeacher(row), getApiCacheTtl({
    publicTtl: PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS,
  }));
};

export const getCachedPublicTeachers = (query = {}) =>
  readPublicCache(publicTeacherListCache, buildPublicCacheKey("public-teachers", query));

export const getCachedPublicTeacherById = (id) =>
  readPublicCache(publicTeacherDetailCache, buildPublicCacheKey("public-teacher-detail", id));

export const invalidatePublicTeacherCaches = () => {
  publicTeacherDetailCache.clear();
  publicTeacherListCache.clear();
  invalidateApiCache((key) => key.includes("/teachers"));
};
