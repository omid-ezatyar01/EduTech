import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";

export const fetchTeacherLiveSessions = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/teacher/live-sessions${suffix}`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    sessions: rows.filter((row) => Boolean(String(row?.course?.title || "").trim())),
    meta: data?.meta || {},
  };
};

export const createTeacherLiveSession = async (payload) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const startTeacherLiveSession = async (sessionId) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}/start`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const endTeacherLiveSession = async (sessionId) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}/end`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const cancelTeacherLiveSession = async (sessionId, reason = "") => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}/cancel`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const deleteTeacherLiveSession = async (sessionId) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  return parseJsonResponse(response);
};

export const fetchTeacherLiveSessionAttendance = async (sessionId) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}/attendance`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const updateTeacherLiveSessionAttendance = async (sessionId, attendees = []) => {
  const response = await fetch(`${getApiBase()}/teacher/live-sessions/${sessionId}/attendance`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ attendees }),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherAttendanceOverview = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/teacher/attendance${suffix}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return {
    courses: Array.isArray(data?.data?.courses) ? data.data.courses : [],
    sessions: Array.isArray(data?.data?.sessions) ? data.data.sessions : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
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
