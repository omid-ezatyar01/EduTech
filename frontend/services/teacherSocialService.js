import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";
import { invalidatePublicTeacherCaches } from "./teacherService.js";

const authRequest = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers: buildAuthHeaders(), cache: "no-store" });
  return parseJsonResponse(response);
};

export const fetchTeacherFollowStatus = async (teacherId) => (await authRequest(`/teachers/${teacherId}/follow-status`))?.data || {};
export const followTeacher = async (teacherId) => {
  const data = (await authRequest(`/teachers/${teacherId}/follow`, { method: "POST" }))?.data || {};
  invalidatePublicTeacherCaches();
  return data;
};
export const unfollowTeacher = async (teacherId) => {
  const data = (await authRequest(`/teachers/${teacherId}/follow`, { method: "DELETE" }))?.data || {};
  invalidatePublicTeacherCaches();
  return data;
};
export const fetchTeacherNotifications = async () => (await authRequest("/student/teacher-notifications"))?.data || { notifications: [], unreadCount: 0 };
export const markTeacherNotificationRead = async (id) => authRequest(`/student/teacher-notifications/${id}/read`, { method: "PATCH" });
export const markAllTeacherNotificationsRead = async () => authRequest("/student/teacher-notifications/read-all", { method: "PATCH" });
