import {
  buildAuthHeaders,
  fetchJsonWithCache,
  getApiBase,
  getApiCacheTtl,
  invalidateApiCache,
  parseJsonResponse,
} from "./http";

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

export const fetchStudentMessageConversations = async (query = {}) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/messages/conversations${toQueryString(query)}`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 10 * 1000 }) },
  );
  return {
    conversations: Array.isArray(data?.data?.conversations) ? data.data.conversations : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
};

export const fetchStudentConversationMessages = async (teacherId, query = {}) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/messages/conversations/${encodeURIComponent(teacherId)}/messages${toQueryString(query)}`,
    {
      headers: buildAuthHeaders(),
    },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 10 * 1000 }) },
  );
  return {
    teacher: data?.data?.teacher || null,
    messages: Array.isArray(data?.data?.messages) ? data.data.messages : [],
    meta: data?.meta || {},
  };
};

export const sendStudentConversationMessage = async (teacherId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/student/messages/conversations/${encodeURIComponent(teacherId)}/messages`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/messages/conversations");
  return data?.data || null;
};

export const markStudentConversationAsRead = async (teacherId) => {
  const response = await fetch(
    `${getApiBase()}/student/messages/conversations/${encodeURIComponent(teacherId)}/read`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
    },
  );
  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/messages/conversations");
  return data?.data || {};
};

export const fetchStudentGroupConversations = async (query = {}) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/messages/groups${toQueryString(query)}`,
    { headers: buildAuthHeaders() },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 10 * 1000 }) },
  );
  return {
    conversations: Array.isArray(data?.data?.conversations) ? data.data.conversations : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
};

export const fetchStudentGroupMessages = async (courseId) => {
  const data = await fetchJsonWithCache(
    `${getApiBase()}/student/messages/groups/${encodeURIComponent(courseId)}/messages`,
    {
      headers: buildAuthHeaders(),
    },
    { ttlMs: getApiCacheTtl({ authenticated: true, authenticatedTtl: 10 * 1000 }) },
  );
  return {
    course: data?.data?.course || null,
    messages: Array.isArray(data?.data?.messages) ? data.data.messages : [],
  };
};

export const sendStudentGroupMessage = async (courseId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/student/messages/groups/${encodeURIComponent(courseId)}/messages`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/messages/groups");
  return data?.data || null;
};

export const markStudentGroupAsRead = async (courseId) => {
  const response = await fetch(
    `${getApiBase()}/student/messages/groups/${encodeURIComponent(courseId)}/read`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
    },
  );
  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/messages/groups");
  return data?.data || {};
};

export const deleteStudentGroupMessages = async (courseId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/student/messages/groups/${encodeURIComponent(courseId)}/messages`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  invalidateApiCache("/student/messages/groups");
  return data?.data || {};
};
