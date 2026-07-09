import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";

const toQueryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });
  const raw = params.toString();
  return raw ? `?${raw}` : "";
};

export const fetchTeacherAssignments = async (query = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/assignments${toQueryString(query)}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return {
    items: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || {},
  };
};

export const createTeacherAssignment = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/assignments`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const updateTeacherAssignment = async (id, payload = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/assignments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const deleteTeacherAssignment = async (id) => {
  const response = await fetch(`${getApiBase()}/teacher/assignments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherAssignmentSubmissions = async (assignmentId, query = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions${toQueryString(query)}`,
    {
      headers: buildAuthHeaders(),
      cache: "no-store",
    },
  );
  const data = await parseJsonResponse(response);
  return {
    assignment: data?.data?.assignment || null,
    submissions: Array.isArray(data?.data?.submissions) ? data.data.submissions : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
};

export const reviewTeacherAssignmentSubmission = async (assignmentId, studentId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(studentId)}/review`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

