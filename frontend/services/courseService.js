import {
  buildAuthHeaders,
  fetchJsonWithCache,
  getApiBase,
  getApiCacheTtl,
  invalidateApiCache,
  parseJsonResponse,
} from "./http";
import { resolveAvatarUrl } from "../src/utils/avatar";

const PUBLIC_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;

const normalizeReviews = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      _id: String(item?._id || ""),
      name: String(item?.studentName || "Student").trim(),
      course: String(item?.courseTitle || "Course").trim(),
      text: String(item?.comment || "").trim(),
      rating: Math.max(1, Math.min(5, Math.round(Number(item?.rating || item?.courseRating || 0) || 0))),
      createdAt: item?.createdAt || null,
    }))
    .filter((item) => item.text);

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
    description: course.shortDescription || course.description || "",
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
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/courses${suffix}`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);

  const rows = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta || {};

  return {
    courses: rows.map(mapCourse),
    meta,
  };
};

export const fetchPublishedCourseBySlug = async (slug) => {
  const response = await fetch(`${getApiBase()}/courses/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  const row = data?.data || null;
  if (!row) return null;
  return mapCourse(row);
};

export const fetchPublicCategories = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/categories`,
    {},
    { ttlMs: getApiCacheTtl({ publicTtl: 30 * 60 * 1000 }) },
  );
  return Array.isArray(data?.data) ? data.data : [];
};

export const enrollCourse = async (courseId) => {
  const response = await fetch(`${getApiBase()}/courses/${courseId}/enroll`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache((key) =>
    key.includes("/courses") ||
    key.includes("/student/enrollments") ||
    key.includes("/student/learning-stats") ||
    key.includes("/student/live-sessions"),
  );
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

export const fetchPendingCourseRatings = async () => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/ratings/pending`,
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
    }),
  });

  const data = await parseJsonResponse(response);
  invalidateApiCache((key) =>
    key.includes("/courses") ||
    key.includes("/teachers") ||
    key.includes("/student/ratings/pending"),
  );
  return data?.data || null;
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
    { ttlMs: getApiCacheTtl({ publicTtl: 10 * 60 * 1000 }) },
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
