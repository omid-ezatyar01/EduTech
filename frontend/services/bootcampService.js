import { getApiBase, parseJsonResponse } from "./http.js";
import { getToken } from "./portal.js";

export const resolveBootcampImageUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const origin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${origin}${path}`;
  }
  return path;
};

const request = async (path, options = {}, authenticated = false) => {
  const token = authenticated ? getToken() : "";
  const response = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return parseJsonResponse(response);
};

export const fetchPublicBootcamps = async () => {
  const payload = await request("/bootcamps");
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const fetchPublicBootcamp = async (slug) =>
  (await request(`/bootcamps/${encodeURIComponent(slug)}`))?.data;

export const registerForBootcamp = async (slug, form) =>
  (await request(`/bootcamps/${encodeURIComponent(slug)}/register`, {
    method: "POST",
    body: JSON.stringify(form),
  }, true))?.data;

export const fetchStudentBootcampRegistrations = async () => {
  const payload = await request("/student/bootcamp-registrations", {}, true);
  return Array.isArray(payload?.data) ? payload.data : [];
};
