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
export const fetchSupportTicket = (id) => request(`/support/tickets/${encodeURIComponent(id)}`);
export const createSupportTicket = (data) =>
  request("/support/tickets", { method: "POST", body: JSON.stringify(data) });
export const sendSupportMessage = (id, body) =>
  request(`/support/tickets/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
export const markSupportTicketRead = (id) =>
  request(`/support/tickets/${encodeURIComponent(id)}/read`, { method: "PATCH" });

export const connectSupportSocket = () => {
  const origin = getApiBase().replace(/\/api\/v\d+$/i, "");
  return io(origin, {
    path: "/support-socket",
    auth: { token: getToken() },
    transports: ["websocket", "polling"],
    reconnection: true,
  });
};
