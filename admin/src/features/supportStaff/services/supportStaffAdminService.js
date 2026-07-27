import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../../../services/http.js";

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

export const fetchSupportStaff = ({
  search = "",
  status = "all",
  specialization = "all",
} = {}) => {
  const query = new URLSearchParams({
    page: "1",
    limit: "100",
    search,
    status,
    specialization,
  });
  return request(`/admin/support-staff?${query.toString()}`);
};

export const createSupportStaff = (data) =>
  request("/admin/support-staff", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateSupportStaff = (staffId, data) =>
  request(`/admin/support-staff/${encodeURIComponent(staffId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const resetSupportStaffPassword = (staffId, password) =>
  request(`/admin/support-staff/${encodeURIComponent(staffId)}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });

export const fetchSupportTeamDirectory = () =>
  request("/support-staff/team");

export const fetchSupportTeamMessages = (
  conversationId,
  { before = "", limit = 30 } = {},
) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set("before", before);
  return request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}?${query.toString()}`,
  );
};

export const sendSupportTeamMessage = (conversationId, body, replyTo = null) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      body: JSON.stringify({ body, replyTo }),
    },
  );

export const updateSupportTeamMessage = (messageId, body) =>
  request(`/support-staff/team/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });

export const deleteSupportTeamMessage = (messageId) =>
  request(`/support-staff/team/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
export const deleteSelectedSupportTeamMessages = (messageIds, scope) =>
  request("/support-staff/team/messages/delete", {
    method: "POST",
    body: JSON.stringify({ messageIds, scope }),
  });

export const clearGeneralSupportTeamMessages = (messageIds = []) =>
  request("/support-staff/team/conversations/general/messages", {
    method: "DELETE",
    body: JSON.stringify(
      messageIds.length ? { messageIds } : { all: true },
    ),
  });

export const markSupportTeamConversationRead = (conversationId) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "PATCH" },
  );
