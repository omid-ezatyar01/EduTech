import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  return parseJsonResponse(response);
};

export const fetchTeacherNotifications = async () =>
  (await request("/teacher/notifications"))?.data || {
    notifications: [],
    unreadCount: 0,
  };

export const markTeacherNotificationRead = async (notificationId) =>
  request(`/teacher/notifications/${notificationId}/read`, { method: "PATCH" });

export const markAllTeacherNotificationsRead = async () =>
  request("/teacher/notifications/read-all", { method: "PATCH" });

export const deleteTeacherNotification = async (notificationId) =>
  request(`/teacher/notifications/${notificationId}`, { method: "DELETE" });
