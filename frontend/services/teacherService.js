import {
  fetchJsonWithCache,
  getApiBase,
  getApiCacheTtl,
} from "./http";
import { resolveAvatarUrl } from "../src/utils/avatar";

const PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;

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
    }))
    .filter((item) => item.text);

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
    thumbnail: resolveAvatarUrl(course.thumbnail || ""),
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
  },
  endedCourses: Array.isArray(teacher.endedCourses)
    ? teacher.endedCourses.map(mapTeacherCourse)
    : [],
  publishedCourses: Array.isArray(teacher.publishedCourses)
    ? teacher.publishedCourses.map(mapTeacherCourse)
    : [],
});

export const fetchPublicTeachers = async (query = {}) => {
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

  return {
    teachers: Array.isArray(data?.data) ? data.data.map(mapTeacher) : [],
    meta: data?.meta || {},
  };
};

export const fetchPublicTeacherById = async (id) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/teachers/${encodeURIComponent(id)}`,
    {},
    { ttlMs: getApiCacheTtl({ publicTtl: PUBLIC_TEACHER_DETAIL_CACHE_TTL_MS }) },
  );
  const row = data?.data || null;
  if (!row) return null;
  return mapTeacher(row);
};
