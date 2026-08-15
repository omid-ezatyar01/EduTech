import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const resolveBootcampImageUrl = (value = "") => {
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

export const uploadAdminBootcampCover = async (file) => {
  const formData = new FormData();
  formData.append("cover", file);
  const headers = buildAuthHeaders();
  delete headers["Content-Type"];
  const response = await fetch(`${getApiBase()}/admin/bootcamps/cover`, {
    method: "POST",
    headers,
    body: formData,
  });
  return (await parseJsonResponse(response))?.data?.coverImage || "";
};

export const fetchAdminBootcamps = async () => {
  const payload = await request("/admin/bootcamps");
  return Array.isArray(payload?.data)
    ? payload.data.map((bootcamp) => ({
        ...bootcamp,
        coverImage: resolveBootcampImageUrl(bootcamp.coverImage),
      }))
    : [];
};

export const createAdminBootcamp = async (payload) =>
  (await request("/admin/bootcamps", { method: "POST", body: JSON.stringify(payload) }))?.data;

export const updateAdminBootcamp = async (id, payload) =>
  (await request(`/admin/bootcamps/${id}`, { method: "PATCH", body: JSON.stringify(payload) }))?.data;

export const deleteAdminBootcamp = async (id) =>
  request(`/admin/bootcamps/${id}`, { method: "DELETE" });

export const fetchBootcampRegistrations = async (id) => {
  const payload = await request(`/admin/bootcamps/${id}/registrations`);
  return Array.isArray(payload?.data) ? payload.data : [];
};
