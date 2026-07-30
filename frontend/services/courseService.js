import {
  buildAuthHeaders,
  fetchJsonWithCache,
  getApiBase,
  getApiCacheTtl,
  invalidateApiCache,
  parseJsonResponse,
} from "./http";
import { resolveAvatarUrl } from "../src/utils/avatar";
import {
  fetchMockPublicCategories,
  fetchMockPublishedCourseBySlug,
  fetchMockPublishedCourses,
} from "./mockCourseService.js";
import { invalidatePublicTeacherCaches } from "./teacherService.js";

const USE_FRONTEND_COURSE_MOCKS = false;

const PUBLIC_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_CATEGORY_CACHE_TTL_MS = 30 * 60 * 1000;
const publicCourseListCache = new Map();
const publicCourseDetailCache = new Map();
const publicCategoryCache = new Map();

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

const normalizeCategoryId = (value) => String(value || "").trim();

const collectUsedCategoryIds = (courses = []) => {
  const usedIds = new Set();

  (Array.isArray(courses) ? courses : []).forEach((course) => {
    const categoryId = normalizeCategoryId(course?.category?._id || course?.categoryId || course?.category);
    const subcategoryId = normalizeCategoryId(
      course?.subcategory?._id || course?.subcategoryId || course?.subcategory,
    );

    if (categoryId) usedIds.add(categoryId);
    if (subcategoryId) usedIds.add(subcategoryId);
  });

  return usedIds;
};

const filterCategoriesWithCourses = (categories = [], courses = []) => {
  const rows = Array.isArray(categories) ? categories : [];
  const usedIds = collectUsedCategoryIds(courses);
  if (!rows.length || !usedIds.size) return [];

  const byId = new Map(
    rows.map((item) => [normalizeCategoryId(item?._id), item]),
  );
  const visibleIds = new Set();

  usedIds.forEach((id) => {
    let currentId = id;
    let depth = 0;

    while (currentId && depth < 20) {
      if (visibleIds.has(currentId)) break;
      visibleIds.add(currentId);
      const current = byId.get(currentId);
      currentId = normalizeCategoryId(current?.parent?._id || current?.parent);
      depth += 1;
    }
  });

  return rows.filter((item) => visibleIds.has(normalizeCategoryId(item?._id)));
};

const fetchPublishedCoursesForCategoryFiltering = async () => {
  const limit = 100;
  const firstPage = await fetchJsonWithCache(
    `${getApiBase()}/courses?page=1&limit=${limit}`,
    {},
    { ttlMs: getApiCacheTtl({ publicTtl: PUBLIC_CATEGORY_CACHE_TTL_MS }) },
  );

  const firstRows = Array.isArray(firstPage?.data) ? firstPage.data : [];
  const totalPages = Math.max(1, Number(firstPage?.meta?.totalPages || 1));

  if (totalPages === 1) {
    return firstRows;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchJsonWithCache(
        `${getApiBase()}/courses?page=${index + 2}&limit=${limit}`,
        {},
        { ttlMs: getApiCacheTtl({ publicTtl: PUBLIC_CATEGORY_CACHE_TTL_MS }) },
      ),
    ),
  );

  return [
    ...firstRows,
    ...remainingPages.flatMap((page) => (Array.isArray(page?.data) ? page.data : [])),
  ];
};

const normalizeReviews = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      _id: String(item?._id || ""),
      name: String(item?.studentName || "Student").trim(),
      course: String(item?.courseTitle || "Course").trim(),
      text: String(item?.comment || "").trim(),
      rating: Math.max(1, Math.min(5, Math.round(Number(item?.rating || item?.courseRating || 0) || 0))),
      createdAt: item?.createdAt || null,
      tags: Array.isArray(item?.tags) ? item.tags : [],
      verifiedLearner: Boolean(item?.verifiedLearner),
      teacherReply: String(item?.teacherReply || ""),
      helpfulCount: Number(item?.helpfulCount || 0),
    }))
    .filter((item) => item._id && item.rating > 0);

const mapCourse = (course = {}) => {
  const finalPrice = Number(course?.price || 0);
  const originalPrice = Number(course?.discountPrice || 0);
  const hasDiscount = originalPrice > 0 && originalPrice > finalPrice;
  const enrolledStudentsCount = Number(
    course?.enrolledStudentsCount ??
      course?.registeredStudentsCount ??
      course?.studentsCount ??
      course?.enrollmentsCount ??
      0,
  );
  const teacherProfile = course.teacher || course.teacherId || {};
  const teacherId =
    (typeof teacherProfile === "object" ? teacherProfile?._id || teacherProfile?.id : "") ||
    (typeof course.teacherId === "object" ? course.teacherId?._id || course.teacherId?.id : course.teacherId) ||
    (typeof course.teacher === "object" ? course.teacher?._id || course.teacher?.id : "") ||
    "";
  const teacherName = teacherProfile?.name || teacherProfile?.username || "Teacher";

  const scheduleRows = Array.isArray(course.schedule) ? course.schedule : [];
  const firstSlot = scheduleRows[0] || null;

  return {
    ...course,
    id: course._id,
    slug: course.slug,
    title: course.title,
    description: course.description || "",
    level: course.level || "beginner",
    teacher: teacherName,
    teacherId: teacherId ? String(teacherId) : "",
    teacherName,
    teacherBio: teacherProfile?.bio || "",
    teacherRole: teacherProfile?.role || "",
    teacherAvatar: resolveAvatarUrl(teacherProfile?.avatar || ""),
    bankPaymentAvailable: Boolean(course?.bankPaymentAvailable),
    thumbnail: resolveAvatarUrl(course?.thumbnail || "", course?.updatedAt || course?.createdAt || ""),
    promoVideo: course?.promoVideo || "",
    previewVideoUrls: Array.isArray(course?.previewVideoUrls) && course.previewVideoUrls.length
      ? course.previewVideoUrls
      : course?.promoVideo
        ? [course.promoVideo]
        : [],
    scheduleRows,
    schedule: scheduleRows.length ? scheduleRows.map((row) => row?.day || "").filter(Boolean).join(", ") : "Flexible",
    time: firstSlot ? `${firstSlot.startTime} - ${firstSlot.endTime}` : "Any time",
    price: finalPrice,
    originalPrice: hasDiscount ? originalPrice : 0,
    discountPercent:
      Number(course?.totalCourseDiscountPercentage || 0) > 0
        ? Number(course.totalCourseDiscountPercentage || 0)
        : Number(course?.globalCourseDiscountPercentage || 0) > 0
          ? Number(course.globalCourseDiscountPercentage || 0)
        : hasDiscount && originalPrice > 0
          ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
          : 0,
    currency: course.currency || "USD",
    categoryId:
      typeof course?.category === "object"
        ? String(course?.category?._id || "")
        : String(course?.category || ""),
    subcategoryId:
      typeof course?.subcategory === "object"
        ? String(course?.subcategory?._id || "")
        : String(course?.subcategory || ""),
    categoryName: course?.category?.name || "",
    subcategoryName: course?.subcategory?.name || "",
    categoryPathLabel: course?.subcategory?.name
      ? `${course?.category?.name || ""} / ${course?.subcategory?.name || ""}`.trim()
      : course?.category?.name || "",
    isFree: Boolean(course.isFree),
    rating: Number(course?.rating || 0),
    ratingCount: Math.max(0, Number(course?.ratingCount || 0)),
    ratingDistribution: course?.ratingDistribution || {},
    reviews: normalizeReviews(course?.reviews || []),
    enrolledStudentsCount: Number.isFinite(enrolledStudentsCount)
      ? Math.max(0, enrolledStudentsCount)
      : 0,
    minimumStudentsToStart: Math.max(1, Number(course?.minimumStudentsToStart || 1)),
  };
};

const hasExistingCourse = (enrollment = {}) => {
  const course = enrollment?.courseId;
  return Boolean(course && typeof course === "object" && String(course.title || "").trim());
};

export const fetchPublishedCourses = async (query = {}) => {
  const cacheKey = buildPublicCacheKey("published-courses", query);
  const cached = readPublicCache(publicCourseListCache, cacheKey);
  if (cached) return cached;

  if (USE_FRONTEND_COURSE_MOCKS) {
    const result = await fetchMockPublishedCourses(query);
    return writePublicCache(publicCourseListCache, cacheKey, result, PUBLIC_LIST_CACHE_TTL_MS);
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJsonWithCache(
    `${getApiBase()}/courses${suffix}`,
    {},
    { ttlMs: getApiCacheTtl({ publicTtl: PUBLIC_LIST_CACHE_TTL_MS }) },
  );

  const rows = Array.isArray(data?.data)
    ? data.data.filter((course) => !course?.classEndedAt)
    : [];
  const meta = data?.meta || {};

  return writePublicCache(publicCourseListCache, cacheKey, {
    courses: rows.map(mapCourse),
    meta,
  }, getApiCacheTtl({ publicTtl: PUBLIC_LIST_CACHE_TTL_MS }));
};

export const fetchPublishedCourseBySlug = async (slug, { force = false } = {}) => {
  const cacheKey = buildPublicCacheKey("published-course-detail", slug);
  if (force) {
    publicCourseDetailCache.delete(cacheKey);
    invalidateApiCache((key) => key.includes(`/courses/${encodeURIComponent(slug)}`));
  }
  const cached = readPublicCache(publicCourseDetailCache, cacheKey);
  if (cached) return cached;

  if (USE_FRONTEND_COURSE_MOCKS) {
    const result = await fetchMockPublishedCourseBySlug(slug);
    return writePublicCache(publicCourseDetailCache, cacheKey, result, PUBLIC_DETAIL_CACHE_TTL_MS);
  }

  const data = await fetchJsonWithCache(
    `${getApiBase()}/courses/${encodeURIComponent(slug)}`,
    {},
    { ttlMs: force ? 0 : getApiCacheTtl({ publicTtl: PUBLIC_DETAIL_CACHE_TTL_MS }) },
  );
  const row = data?.data || null;
  if (!row) return null;
  return writePublicCache(publicCourseDetailCache, cacheKey, mapCourse(row), getApiCacheTtl({
    publicTtl: PUBLIC_DETAIL_CACHE_TTL_MS,
  }));
};

export const fetchPublicCategories = async () => {
  const cacheKey = buildPublicCacheKey("public-categories");
  const cached = readPublicCache(publicCategoryCache, cacheKey);
  if (cached) return cached;

  if (USE_FRONTEND_COURSE_MOCKS) {
    const [categories, coursesResult] = await Promise.all([
      fetchMockPublicCategories(),
      fetchMockPublishedCourses({ page: 1, limit: 1000 }),
    ]);
    const filtered = filterCategoriesWithCourses(
      categories,
      Array.isArray(coursesResult?.courses) ? coursesResult.courses : [],
    );
    return writePublicCache(publicCategoryCache, cacheKey, filtered, PUBLIC_CATEGORY_CACHE_TTL_MS);
  }

  const [categoryData, publishedCourses] = await Promise.all([
    fetchJsonWithCache(
      `${getApiBase()}/categories`,
      {},
      { ttlMs: getApiCacheTtl({ publicTtl: PUBLIC_CATEGORY_CACHE_TTL_MS }) },
    ),
    fetchPublishedCoursesForCategoryFiltering(),
  ]);

  const filteredCategories = filterCategoriesWithCourses(
    Array.isArray(categoryData?.data) ? categoryData.data : [],
    publishedCourses,
  );

  return writePublicCache(
    publicCategoryCache,
    cacheKey,
    filteredCategories,
    getApiCacheTtl({ publicTtl: PUBLIC_CATEGORY_CACHE_TTL_MS }),
  );
};

export const getCachedPublishedCourses = (query = {}) =>
  readPublicCache(publicCourseListCache, buildPublicCacheKey("published-courses", query));

export const getCachedPublishedCourseBySlug = (slug) =>
  readPublicCache(publicCourseDetailCache, buildPublicCacheKey("published-course-detail", slug));

export const getCachedPublicCategories = () =>
  readPublicCache(publicCategoryCache, buildPublicCacheKey("public-categories"));

export const invalidatePublicCourseCaches = () => {
  publicCourseDetailCache.clear();
  publicCourseListCache.clear();
  invalidateApiCache((key) => key.includes("/courses"));
};

export const enrollCourse = async (courseId, pricingRegion = "international") => {
  const response = await fetch(`${getApiBase()}/courses/${courseId}/enroll`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ pricingRegion }),
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache((key) =>
    key.includes("/courses") ||
    key.includes("/student/enrollments") ||
    key.includes("/student/learning-stats") ||
    key.includes("/student/live-sessions"),
  );
  publicCourseDetailCache.clear();
  publicCourseListCache.clear();
  return data?.data;
};

export const fetchStudentEnrollments = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/enrollments`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 45 * 1000 }) },
  );

  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.filter(hasExistingCourse);
};

export const fetchStudentLiveSessions = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/live-sessions${suffix}`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 30 * 1000 }) },
  );
  const sessions = Array.isArray(data?.data) ? data.data : [];
  return {
    sessions: sessions.filter((session) => Boolean(String(session?.course?.title || "").trim())),
    meta: data?.meta || {},
  };
};

export const joinStudentLiveSession = async (sessionId) => {
  const response = await fetch(`${getApiBase()}/student/live-sessions/${sessionId}/join`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/live-sessions");
  return data?.data || {};
};

export const fetchPendingCourseRatings = async (courseId = "") => {
  const normalizedCourseId = String(courseId || "").trim();
  const query = normalizedCourseId
    ? `?courseId=${encodeURIComponent(normalizedCourseId)}`
    : "";
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/ratings/pending${query}`,
    { headers: buildAuthHeaders() },
    { ttlMs: 0 },
  );
  return Array.isArray(data?.data) ? data.data : [];
};

export const submitCourseRating = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/student/ratings`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      courseId: payload.courseId,
      courseRating: payload.courseRating,
      teacherRating: payload.teacherRating,
      comment: payload.comment || "",
      tags: payload.tags || [],
      displayName: payload.displayName !== false,
    }),
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache((key) =>
    key.includes("/courses") ||
    key.includes("/teachers") ||
    key.includes("/student/ratings/pending"),
  );
  publicCourseDetailCache.clear();
  publicCourseListCache.clear();
  return data?.data || null;
};

export const fetchStudentRatings = async () => {
  const data = await fetchJsonWithCache(`${getApiBase()}/student/ratings`, { headers: buildAuthHeaders() }, { ttlMs: 0 });
  return Array.isArray(data?.data) ? data.data : [];
};

export const updateStudentRating = async (ratingId, payload = {}) => {
  const response = await fetch(`${getApiBase()}/student/ratings/${encodeURIComponent(ratingId)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  invalidateApiCache((key) => key.includes("/ratings") || key.includes("/courses") || key.includes("/teachers"));
  publicCourseDetailCache.clear();
  publicCourseListCache.clear();
  return data?.data || null;
};

export const fetchPendingTeacherRatings = async () => {
  const data = await fetchJsonWithCache(`${getApiBase()}/student/teacher-ratings/pending`, { headers: buildAuthHeaders() }, { ttlMs: 0 });
  return Array.isArray(data?.data) ? data.data : [];
};

export const fetchStudentTeacherRatings = async () => {
  const data = await fetchJsonWithCache(`${getApiBase()}/student/teacher-ratings`, { headers: buildAuthHeaders() }, { ttlMs: 0 });
  return Array.isArray(data?.data) ? data.data : [];
};

export const submitTeacherRating = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/student/teacher-ratings`, { method: "POST", headers: buildAuthHeaders(), body: JSON.stringify(payload) });
  const data = await parseJsonResponse(response);
  invalidateApiCache((key) => key.includes("/teachers") || key.includes("/teacher-ratings"));
  invalidatePublicTeacherCaches();
  return data?.data || null;
};

export const updateStudentTeacherRating = async (ratingId, payload = {}) => {
  const response = await fetch(`${getApiBase()}/student/teacher-ratings/${encodeURIComponent(ratingId)}`, { method: "PATCH", headers: buildAuthHeaders(), body: JSON.stringify(payload) });
  const data = await parseJsonResponse(response);
  invalidateApiCache((key) => key.includes("/teachers") || key.includes("/teacher-ratings"));
  invalidatePublicTeacherCaches();
  return data?.data || null;
};

export const submitPlatformFeedback = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/student/platform-feedback`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const fetchMonthlyPlatformFeedbackStatus = async () => {
  const data = await fetchJsonWithCache(`${getApiBase()}/student/platform-feedback/monthly-status`, { headers: buildAuthHeaders() }, { ttlMs: 0 });
  return data?.data || { canSubmit: true };
};

export const toggleReviewHelpful = async (ratingId) => {
  const response = await fetch(`${getApiBase()}/ratings/${encodeURIComponent(ratingId)}/helpful`, { method: "POST", headers: buildAuthHeaders() });
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const reportReview = async (ratingId, reason = "") => {
  const response = await fetch(`${getApiBase()}/ratings/${encodeURIComponent(ratingId)}/report`, { method: "POST", headers: buildAuthHeaders(), body: JSON.stringify({ reason }) });
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchStudentLiveSessionLink = async (sessionId) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/course-sessions/${encodeURIComponent(sessionId)}/live-link`,
    {
      headers: buildAuthHeaders(),
    },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 20 * 1000 }) },
  );
  return data?.data || {};
};

export const fetchStudentAttendance = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/attendance${suffix}`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 45 * 1000 }) },
  );
  return {
    courses: Array.isArray(data?.data?.courses) ? data.data.courses : [],
    sessions: Array.isArray(data?.data?.sessions) ? data.data.sessions : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
};

export const fetchStudentAssignments = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/assignments`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 45 * 1000 }) },
  );
  return Array.isArray(data?.data) ? data.data : [];
};

export const submitStudentAssignment = async (assignmentId, payload = {}) => {
  const hasFile = typeof File !== "undefined" && payload?.submissionFile instanceof File;
  let body;
  let headers = buildAuthHeaders();

  if (hasFile) {
    const formData = new FormData();
    if (payload?.textAnswer !== undefined && payload?.textAnswer !== null) {
      formData.append("textAnswer", String(payload.textAnswer));
    }
    if (payload?.attachmentUrl !== undefined && payload?.attachmentUrl !== null) {
      formData.append("attachmentUrl", String(payload.attachmentUrl));
    }
    formData.append("submissionFile", payload.submissionFile);
    body = formData;
    headers = { ...headers };
    delete headers["Content-Type"];
  } else {
    body = JSON.stringify({
      textAnswer: payload?.textAnswer || "",
      attachmentUrl: payload?.attachmentUrl || "",
    });
  }

  const response = await fetch(`${getApiBase()}/student/assignments/${encodeURIComponent(assignmentId)}/submit`, {
    method: "POST",
    headers,
    body,
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache((key) =>
    key.includes("/student/assignments") ||
    key.includes("/student/learning-stats"),
  );
  return data?.data || null;
};

export const fetchStudentResources = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/resources`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 2 * 60 * 1000 }) },
  );
  return Array.isArray(data?.data) ? data.data : [];
};

export const fetchStudentLearningStats = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/learning-stats`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 45 * 1000 }) },
  );
  const stats = data?.data || {};
  return {
    enrolledCourses: Number(stats.enrolledCourses || 0),
    completedAssignments: Number(stats.completedAssignments || 0),
    learningHours: Number(stats.learningHours || 0),
    averageProgress: Number(stats.averageProgress || 0),
  };
};

export const fetchPublicPlatformStats = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/stats/platform`,
    {},
    { ttlMs: 0 },
  );
  const stats = data?.data || {};

  return {
    activeCourses: Number(stats.activeCourses || 0),
    expertTeachers: Number(stats.expertTeachers || 0),
    happyStudents: Number(stats.happyStudents || 0),
    satisfactionRate: Number(stats.satisfactionRate || 0),
    lastUpdatedAt: stats.lastUpdatedAt || null,
  };
};

export const verifyCertificateById = async (certificateId) => {
  const normalizedId = String(certificateId || "").trim().toUpperCase();
  const response = await fetch(
    `${getApiBase()}/certificates/verify/${encodeURIComponent(normalizedId)}`,
  );
  const data = await parseJsonResponse(response);
  return data?.data || null;
};
