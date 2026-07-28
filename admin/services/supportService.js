import { io } from "socket.io-client";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";
import { getToken } from "./portal";

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...buildAuthHeaders(),
      "x-admin-no-dedupe": "true",
      ...(options.headers || {}),
    },
  });
  const payload = await parseJsonResponse(response);
  return payload?.data || {};
};

export const fetchSupportQueue = (query = {}) => {
  const normalizedQuery = {
    status: "all",
    category: "all",
    priority: "all",
    requesterRole: "all",
    page: 1,
    limit: 100,
    ...query,
  };
  const params = new URLSearchParams(
    Object.entries(normalizedQuery).filter(
      ([, value]) => value !== "" && value != null,
    ),
  );
  return request(`/admin/support/tickets?${params.toString()}`);
};
export const fetchAdminSupportTicket = (
  id,
  { before = "", limit = 30 } = {},
) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set("before", before);
  return request(
    `/admin/support/tickets/${encodeURIComponent(id)}?${query.toString()}`,
  );
};
export const sendAdminSupportMessage = (
  id,
  body,
  internalNote = false,
  replyTo = null,
) =>
  request(`/admin/support/tickets/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, internalNote, replyTo }),
  });
export const deleteSelectedAdminSupportMessages = (id, messageIds, scope) =>
  request(`/admin/support/tickets/${encodeURIComponent(id)}/messages/delete`, {
    method: "POST",
    body: JSON.stringify({ messageIds, scope }),
  });
export const updateAdminSupportTicket = (id, changes) =>
  request(`/admin/support/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
export const markAdminSupportTicketRead = (id) =>
  request(`/admin/support/tickets/${encodeURIComponent(id)}/read`, { method: "PATCH" });

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
