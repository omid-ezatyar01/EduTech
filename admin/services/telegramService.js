import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const fetchAdminTelegramSettings = async () => {
  const response = await fetch(`${getApiBase()}/admin/telegram/settings`, {
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const updateAdminTelegramSettings = async (payload) => {
  const response = await fetch(`${getApiBase()}/admin/telegram/settings`, {
    method: "PUT",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const sendAdminTelegramTestPost = async () => {
  const response = await fetch(`${getApiBase()}/admin/telegram/test-post`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return data?.data || null;
};

export const fetchAdminTelegramPosts = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${getApiBase()}/admin/telegram/posts${suffix}`, {
    headers: buildAuthHeaders(),
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};
