import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const buildCourseRequestBody = (payload = {}) => {
  const hasThumbnail =
    typeof File !== "undefined" && payload?.thumbnailFile instanceof File;

  if (!hasThumbnail) {
    return {
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    };
  }

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

  const headers = { ...buildAuthHeaders() };
  delete headers["Content-Type"];

  return {
    headers,
    body: formData,
  };
};

export const fetchAdminCourses = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/admin/courses${suffix}`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return {
    courses: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || {},
  };
};

export const fetchAdminCourseById = async (courseId) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${encodeURIComponent(courseId)}`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const fetchAdminTeachers = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  if (!params.has("page")) params.set("page", "1");
  if (!params.has("limit")) params.set("limit", "100");

  const response = await fetch(`${getApiBase()}/admin/teachers?${params.toString()}`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return Array.isArray(data?.teachers) ? data.teachers : [];
};

export const createAdminCourse = async (payload) => {
  const request = buildCourseRequestBody(payload);
  const response = await fetch(`${getApiBase()}/admin/courses`, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const updateAdminCourse = async (courseId, payload) => {
  const request = buildCourseRequestBody(payload);
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}`, {
    method: "PATCH",
    headers: request.headers,
    body: request.body,
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const deleteAdminCourse = async (courseId) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  return parseJsonResponse(response);
};

export const publishAdminCourse = async (courseId, payload = {}) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/publish`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const unpublishAdminCourse = async (courseId) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/unpublish`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const approveAdminCourse = async (courseId, payload = {}) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/approve`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const rejectAdminCourse = async (courseId, rejectionReason) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/reject`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ rejectionReason }),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const approveCourseCancellationRequest = async (courseId, adminResponse = "") => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/cancellation-request/approve`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ adminResponse }),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const rejectCourseCancellationRequest = async (courseId, adminResponse = "") => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/cancellation-request/reject`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ adminResponse }),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const approveCourseEndRequest = async (courseId, adminResponse = "") => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/end-request/approve`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ adminResponse }),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const rejectCourseEndRequest = async (courseId, adminResponse = "") => {
  const response = await fetch(`${getApiBase()}/admin/courses/${courseId}/end-request/reject`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ adminResponse }),
  });
  const data = await parseJsonResponse(response);
  return data?.data;
};

export const fetchGoogleAccountStatus = async () => {
  const response = await fetch(`${getApiBase()}/google/account-status`, {
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchGoogleAuthUrl = async () => {
  const response = await fetch(`${getApiBase()}/google/auth-url`, {
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data?.url || "";
};

export const generateCourseMeetLinks = async (courseId, payload) => {
  const response = await fetch(
    `${getApiBase()}/courses/${encodeURIComponent(courseId)}/generate-month-meet-links`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchAdminCourseSessions = async (courseId) => {
  const response = await fetch(`${getApiBase()}/admin/courses/${encodeURIComponent(courseId)}/sessions`, {
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};
