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

export const fetchSupportTeamMessages = (conversationId) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}?limit=100`,
  );

export const sendSupportTeamMessage = (conversationId, body) =>
  request(
    `/support-staff/team/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
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
