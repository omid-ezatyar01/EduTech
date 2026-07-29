import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const resolveGalleryImageUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const apiOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${apiOrigin}${path}`;
  }
  return path;
};

export const fetchAdminGallery = async ({
  category = "all",
  status = "all",
} = {}) => {
  const params = new URLSearchParams({ category, status });
  const response = await fetch(`${getApiBase()}/admin/gallery?${params}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const fetchAdminGalleryCategories = async () => {
  const response = await fetch(`${getApiBase()}/admin/gallery/categories`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const createAdminGalleryCategory = async (name) => {
  const response = await fetch(`${getApiBase()}/admin/gallery/categories`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  return (await parseJsonResponse(response))?.data?.name || "";
};

export const uploadAdminGalleryImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  const response = await fetch(`${getApiBase()}/admin/gallery/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  return (await parseJsonResponse(response))?.data?.image || "";
};

export const createAdminGalleryImage = async (payload) => {
  const response = await fetch(`${getApiBase()}/admin/gallery`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return (await parseJsonResponse(response))?.data;
};

export const updateAdminGalleryImage = async (id, payload) => {
  const response = await fetch(`${getApiBase()}/admin/gallery/${id}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return (await parseJsonResponse(response))?.data;
};

export const deleteAdminGalleryImage = async (id) => {
  const response = await fetch(`${getApiBase()}/admin/gallery/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });
  return parseJsonResponse(response);
};
