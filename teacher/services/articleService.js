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

export const uploadTeacherArticleCover = async (file) => {
  const formData = new FormData();
  formData.append("cover", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  return (await request("/teacher/articles/cover", { method: "POST", headers, body: formData }))?.data?.coverImage || "";
};

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers: options.headers || buildAuthHeaders() });
  return parseJsonResponse(response);
};

export const fetchTeacherArticles = async ({ status = "all", search = "" } = {}) => {
  const params = new URLSearchParams({ status, search, page: "1", limit: "100" });
  return (await request(`/teacher/articles?${params.toString()}`))?.data || [];
};

export const createTeacherArticle = async (payload) => (await request("/teacher/articles", {
  method: "POST",
  body: JSON.stringify(payload),
}))?.data;

export const updateTeacherArticle = async (id, payload) => (await request(`/teacher/articles/${id}`, {
  method: "PATCH",
  body: JSON.stringify(payload),
}))?.data;

export const deleteTeacherArticle = async (id) => request(`/teacher/articles/${id}`, { method: "DELETE" });
