import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";

export const fetchTeacherCourses = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/teacher/courses${suffix}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return {
    courses: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || {},
    extra: {
      ...(data?.meta?.pricing || {}),
      ...(data?.extra || {}),
      courseSummary: data?.meta?.courseSummary || data?.extra?.courseSummary || null,
    },
  };
};

export const fetchTeacherCoursePricingSettings = async () => {
  const response = await fetch(`${getApiBase()}/teacher/courses/pricing-settings`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const createTeacherCourse = async (payload) => {
  const hasThumbnail =
    typeof File !== "undefined" && payload?.thumbnailFile instanceof File;
  let body;
  let headers = buildAuthHeaders();

  if (hasThumbnail) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (key === "autoMeetConfig" || value === undefined || value === null) return;
      if (key === "thumbnailFile") {
        formData.append("thumbnailFile", value);
        return;
      }
      if (Array.isArray(value) || typeof value === "object") {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });

    body = formData;
    headers = { ...headers };
    delete headers["Content-Type"];
  } else {
    body = JSON.stringify(payload);
  }

  const response = await fetch(`${getApiBase()}/teacher/courses`, {
    method: "POST",
    headers,
    body,
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const fetchTeacherCourseById = async (courseId) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const updateTeacherCourse = async (courseId, payload) => {
  const hasThumbnail =
    typeof File !== "undefined" && payload?.thumbnailFile instanceof File;
  let body;
  let headers = buildAuthHeaders();

  if (hasThumbnail) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "thumbnailFile") {
        formData.append("thumbnailFile", value);
        return;
      }
      if (Array.isArray(value) || typeof value === "object") {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });

    body = formData;
    headers = { ...headers };
    delete headers["Content-Type"];
  } else {
    body = JSON.stringify(payload);
  }

  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}`, {
    method: "PATCH",
    headers,
    body,
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const endTeacherCourseClass = async (courseId) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}/end-class`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const requestTeacherCourseEndReview = async (courseId, reason) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}/end-request`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const startTeacherCourseClass = async (
  courseId,
  { startBelowMinimum = false } = {},
) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}/start-class`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ startBelowMinimum: Boolean(startBelowMinimum) }),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const requestTeacherCourseCancellation = async (courseId, reason) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}/cancellation-request`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const deleteTeacherCourse = async (courseId) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${courseId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  return parseJsonResponse(response);
};

const buildResourceFormData = (payload = {}) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === "resourceFile") {
      if (value instanceof File) formData.append("resourceFile", value);
      return;
    }
    formData.append(key, String(value));
  });
  return formData;
};

export const fetchTeacherCourseResources = async (courseId) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${encodeURIComponent(courseId)}/resources`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const createTeacherCourseResource = async (courseId, payload) => {
  const tokenHeaders = buildAuthHeaders();
  delete tokenHeaders["Content-Type"];
  const response = await fetch(`${getApiBase()}/teacher/courses/${encodeURIComponent(courseId)}/resources`, {
    method: "POST",
    headers: tokenHeaders,
    body: buildResourceFormData(payload),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const updateTeacherCourseResource = async (courseId, resourceId, payload) => {
  const tokenHeaders = buildAuthHeaders();
  delete tokenHeaders["Content-Type"];
  const response = await fetch(`${getApiBase()}/teacher/courses/${encodeURIComponent(courseId)}/resources/${encodeURIComponent(resourceId)}`, {
    method: "PATCH",
    headers: tokenHeaders,
    body: buildResourceFormData(payload),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const deleteTeacherCourseResource = async (courseId, resourceId) => {
  const response = await fetch(`${getApiBase()}/teacher/courses/${encodeURIComponent(courseId)}/resources/${encodeURIComponent(resourceId)}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  return parseJsonResponse(response);
};

export const fetchCategories = async () => {
  const response = await fetch(`${getApiBase()}/categories`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};
