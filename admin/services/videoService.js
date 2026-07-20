import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const fetchAdminVideos = async () => {
  const response = await fetch(`${getApiBase()}/admin/videos`, { headers: buildAuthHeaders() });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const createAdminVideo = async (payload) => {
  const response = await fetch(`${getApiBase()}/admin/videos`, {
    method: "POST", headers: buildAuthHeaders(), body: JSON.stringify(payload),
  });
  return (await parseJsonResponse(response))?.data;
};

export const updateAdminVideo = async (id, payload) => {
  const response = await fetch(`${getApiBase()}/admin/videos/${id}`, {
    method: "PATCH", headers: buildAuthHeaders(), body: JSON.stringify(payload),
  });
  return (await parseJsonResponse(response))?.data;
};

export const deleteAdminVideo = async (id) => {
  const response = await fetch(`${getApiBase()}/admin/videos/${id}`, {
    method: "DELETE", headers: buildAuthHeaders(),
  });
  return parseJsonResponse(response);
};

