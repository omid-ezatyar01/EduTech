import { io } from "socket.io-client";
import { getApiBase } from "../../../../services/http.js";
import { clearSupportStaffAuth, getSupportStaffToken } from "./supportStaffAuth.js";

const request = async (path, options = {}) => {
  const token = getSupportStaffToken();
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ([401, 403].includes(response.status)) clearSupportStaffAuth();
    throw new Error(payload?.message || "Request failed");
  }
  return payload?.data || payload;
};

export const loginSupportStaff = (credentials) =>
  request("/auth/support/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

export const fetchSupportStaffQueue = (query = {}) => {
  const params = new URLSearchParams({
    page: "1",
    limit: "100",
    status: "all",
    category: "all",
    requesterRole: "all",
    ...query,
  });
  return request(`/support-staff/tickets?${params.toString()}`);
};

export const fetchSupportStaffTicket = (ticketId) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}`);

export const sendSupportStaffMessage = (ticketId, body, internalNote = false) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, internalNote }),
  });

export const updateSupportStaffMessage = (ticketId, messageId, body) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });

export const deleteSupportStaffMessage = (ticketId, messageId) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });

export const updateSupportStaffTicket = (ticketId, changes) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const deleteSupportStaffTicket = (ticketId) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}`, {
    method: "DELETE",
  });

export const markSupportStaffTicketRead = (ticketId) =>
  request(`/support-staff/tickets/${encodeURIComponent(ticketId)}/read`, {
    method: "PATCH",
  });

export const fetchSupportPushConfig = () =>
  request("/push/vapid-public-key");

export const saveSupportPushSubscription = (subscription) =>
  request("/push/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      app: "support",
      subscription: subscription.toJSON(),
    }),
  });

export const fetchSupportTeamDirectory = () =>
  request("/support-staff/team");

export const fetchSupportTeamMessages = (conversationId) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}`,
  );

export const sendSupportTeamChatMessage = (conversationId, body) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );

export const updateSupportTeamChatMessage = (messageId, body) =>
  request(`/support-staff/team/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });

export const deleteSupportTeamChatMessage = (messageId) =>
  request(`/support-staff/team/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });

export const markSupportTeamConversationRead = (conversationId) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "PATCH" },
  );

export const connectSupportStaffSocket = () => {
  const origin = getApiBase().replace(/\/api\/v\d+$/i, "");
  return io(origin, {
    path: "/api/support-socket",
    auth: { token: getSupportStaffToken() },
    transports: ["polling", "websocket"],
    upgrade: true,
    reconnection: true,
  });
};
