import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const resolveHeroMediaUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const origin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${origin}${path}`;
  }
  return path;
};

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
    ...options,
    headers: { ...buildAuthHeaders(), ...(options.headers || {}) },
  });
  return parseJsonResponse(response);
};

export const fetchAdminHeroMedia = async () => {
  const payload = await request("/admin/hero-media");
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const uploadAdminHeroMedia = async (file) => {
  const formData = new FormData();
  formData.append("media", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  const response = await fetch(`${getApiBase()}/admin/hero-media/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  return (await parseJsonResponse(response))?.data;
};

export const createAdminHeroMedia = async (payload) =>
  (await request("/admin/hero-media", { method: "POST", body: JSON.stringify(payload) }))?.data;

export const updateAdminHeroMedia = async (id, payload) =>
  (await request(`/admin/hero-media/${id}`, { method: "PATCH", body: JSON.stringify(payload) }))?.data;

export const deleteAdminHeroMedia = async (id) =>
  request(`/admin/hero-media/${id}`, { method: "DELETE" });
