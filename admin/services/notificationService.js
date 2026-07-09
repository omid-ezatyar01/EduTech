import {
  buildAuthHeaders,
  getApiBase,
  parseJsonResponse,
} from "./http.js";

export const fetchAdminNotifications = async (limit = 20) => {
  const response = await fetch(
    `${getApiBase()}/admin/notifications?limit=${encodeURIComponent(limit)}`,
    { headers: buildAuthHeaders() },
  );
  const payload = await parseJsonResponse(response);
  return payload?.data || { notifications: [], unreadCount: 0 };
};

export const markAdminNotificationRead = async (notificationId) => {
  const response = await fetch(
    `${getApiBase()}/admin/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
    },
  );
  return parseJsonResponse(response);
};

export const markAllAdminNotificationsRead = async () => {
  const response = await fetch(
    `${getApiBase()}/admin/notifications/read-all`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
    },
  );
  return parseJsonResponse(response);
};
