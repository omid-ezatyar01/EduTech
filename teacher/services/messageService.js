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

export const fetchTeacherMessageConversations = async (query = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/messages/conversations${toQueryString(query)}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return {
    conversations: Array.isArray(data?.data?.conversations) ? data.data.conversations : [],
    stats: data?.data?.stats || {},
    meta: data?.meta || {},
  };
};

export const fetchTeacherConversationMessages = async (studentId, query = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/conversations/${encodeURIComponent(studentId)}/messages${toQueryString(query)}`,
    {
      headers: buildAuthHeaders(),
      cache: "no-store",
    },
  );
  const data = await parseJsonResponse(response);
  return {
    student: data?.data?.student || null,
    messages: Array.isArray(data?.data?.messages) ? data.data.messages : [],
    meta: data?.meta || {},
  };
};

export const sendTeacherConversationMessage = async (studentId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/conversations/${encodeURIComponent(studentId)}/messages`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const markTeacherConversationAsRead = async (studentId) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/conversations/${encodeURIComponent(studentId)}/read`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const sendTeacherCourseBroadcastMessage = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/messages/broadcast/course`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherCourseBroadcastConversations = async () => {
  const response = await fetch(`${getApiBase()}/teacher/messages/broadcast/courses`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const fetchTeacherCourseBroadcastMessages = async (courseId) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/broadcast/course/${encodeURIComponent(courseId)}/messages`,
    {
      headers: buildAuthHeaders(),
      cache: "no-store",
    },
  );
  const data = await parseJsonResponse(response);
  return {
    course: data?.data?.course || null,
    messages: Array.isArray(data?.data?.messages) ? data.data.messages : [],
  };
};

export const deleteTeacherCourseBroadcastMessages = async (courseId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/broadcast/course/${encodeURIComponent(courseId)}/messages`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherCourseGroupMessageSettings = async (courseId) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/settings/course/${encodeURIComponent(courseId)}`,
    {
      headers: buildAuthHeaders(),
      cache: "no-store",
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const updateTeacherCourseGroupMessageSettings = async (courseId, payload = {}) => {
  const response = await fetch(
    `${getApiBase()}/teacher/messages/settings/course/${encodeURIComponent(courseId)}`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const fetchTeacherMessageSettings = async () => {
  const response = await fetch(`${getApiBase()}/teacher/messages/settings`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return data?.data || { allowStudentDirectMessages: true };
};

export const updateTeacherMessageSettings = async (payload = {}) => {
  const response = await fetch(`${getApiBase()}/teacher/messages/settings`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || { allowStudentDirectMessages: true };
};
