import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
    ...options,
    headers: { ...buildAuthHeaders(), ...(options.headers || {}) },
  });
  return parseJsonResponse(response);
};

export const resolveLearningPackageCoverUrl = (value = "") => {
  const source = String(value || "").trim();
  if (!source || /^(?:https?:|data:|blob:)/i.test(source)) return source;
  const apiOrigin = getApiBase().replace(/\/api\/v\d+\/?$/i, "").replace(/\/api$/i, "");
  return `${apiOrigin}/${source.replace(/^\/+/, "")}`;
};

export const uploadAdminLearningPackageCover = async (file) => {
  const formData = new FormData();
  formData.append("cover", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  const response = await fetch(`${getApiBase()}/admin/packages/cover`, {
    method: "POST",
    headers,
    body: formData,
  });
  return (await parseJsonResponse(response))?.data?.coverImage || "";
};

export const fetchAdminLearningPackages = async () => {
  const payload = await request("/admin/packages");
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const createAdminLearningPackage = async (payload) =>
  (await request("/admin/packages", { method: "POST", body: JSON.stringify(payload) }))?.data;

export const updateAdminLearningPackage = async (id, payload) =>
  (await request(`/admin/packages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }))?.data;

export const deleteAdminLearningPackage = async (id) =>
  request(`/admin/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
