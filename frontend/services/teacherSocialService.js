import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const authRequest = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers: buildAuthHeaders(), cache: "no-store" });
  return parseJsonResponse(response);
};

export const fetchTeacherFollowStatus = async (teacherId) => (await authRequest(`/teachers/${teacherId}/follow-status`))?.data || {};
export const followTeacher = async (teacherId) => (await authRequest(`/teachers/${teacherId}/follow`, { method: "POST" }))?.data || {};
export const unfollowTeacher = async (teacherId) => (await authRequest(`/teachers/${teacherId}/follow`, { method: "DELETE" }))?.data || {};
export const fetchTeacherNotifications = async () => (await authRequest("/student/teacher-notifications"))?.data || { notifications: [], unreadCount: 0 };
export const markTeacherNotificationRead = async (id) => authRequest(`/student/teacher-notifications/${id}/read`, { method: "PATCH" });
export const markAllTeacherNotificationsRead = async () => authRequest("/student/teacher-notifications/read-all", { method: "PATCH" });

