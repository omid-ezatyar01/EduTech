import { io } from "socket.io-client";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";
import { getToken } from "./portal";

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    cache: "no-store",
    headers: { ...buildAuthHeaders(), ...(options.headers || {}) },
  });
  const payload = await parseJsonResponse(response);
  return payload?.data || {};
};

export const fetchMySupportTickets = () => request("/support/tickets");
export const fetchSupportTicket = (id, { before = "", limit = 30 } = {}) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set("before", before);
  return request(`/support/tickets/${encodeURIComponent(id)}?${query.toString()}`);
};
export const createSupportTicket = (data) =>
  request("/support/tickets", { method: "POST", body: JSON.stringify(data) });
export const sendSupportMessage = (id, body, replyTo = null) =>
  request(`/support/tickets/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, replyTo }),
  });
export const updateSupportMessage = (ticketId, messageId, body) =>
  request(`/support/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
export const deleteSupportMessage = (ticketId, messageId) =>
  request(`/support/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
export const deleteSelectedSupportMessages = (ticketId, messageIds, scope) =>
  request(`/support/tickets/${encodeURIComponent(ticketId)}/messages/delete`, {
    method: "POST",
    body: JSON.stringify({ messageIds, scope }),
  });
export const markSupportTicketRead = (id) =>
  request(`/support/tickets/${encodeURIComponent(id)}/read`, { method: "PATCH" });

export const connectSupportSocket = () => {
  const origin = getApiBase().replace(/\/api\/v\d+$/i, "");
  return io(origin, {
    path: "/api/support-socket",
    auth: { token: getToken() },
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    upgrade: true,
    reconnection: true,
  });
};
