import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const resolveArticleCoverUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const apiOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${apiOrigin}${path}`;
  }
  return path;
};

export const uploadAdminArticleCover = async (file) => {
  const formData = new FormData();
  formData.append("cover", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  const response = await fetch(`${getApiBase()}/admin/articles/cover`, { method: "POST", headers, body: formData });
  return (await parseJsonResponse(response))?.data?.coverImage || "";
};

export const fetchAdminArticles = async ({ status = "all", search = "" } = {}) => {
  const params = new URLSearchParams({ status, search, limit: "100" });
  const response = await fetch(`${getApiBase()}/admin/articles?${params.toString()}`, { headers: buildAuthHeaders(), cache: "no-store" });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const createAdminArticle = async (payload) => {
  const response = await fetch(`${getApiBase()}/admin/articles`, { method: "POST", headers: buildAuthHeaders(), body: JSON.stringify(payload) });
  return (await parseJsonResponse(response))?.data;
};

export const updateAdminArticle = async (id, payload) => {
  const response = await fetch(`${getApiBase()}/admin/articles/${id}`, { method: "PATCH", headers: buildAuthHeaders(), body: JSON.stringify(payload) });
  return (await parseJsonResponse(response))?.data;
};

export const deleteAdminArticle = async (id) => {
  const response = await fetch(`${getApiBase()}/admin/articles/${id}`, { method: "DELETE", headers: buildAuthHeaders() });
  return parseJsonResponse(response);
};
