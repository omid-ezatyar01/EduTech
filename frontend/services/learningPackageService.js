import { getApiBase, parseJsonResponse } from "./http.js";
import { resolveAvatarUrl } from "../src/utils/avatar.js";

const request = async (path) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return parseJsonResponse(response);
};

export const fetchLearningPackages = async () => {
  const payload = await request("/packages");
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const fetchLearningPackage = async (slug) => {
  const payload = await request(`/packages/${encodeURIComponent(slug)}`);
  return payload?.data || null;
};

export const resolveLearningPackageCoverImage = (value) => {
  const source = String(value || "").trim();
  if (!source) return "";
  return resolveAvatarUrl(source);
};

export const resolvePackageCourseImage = (value) => {
  const source = String(value || "").trim();
  if (!source) return "/logo.png";
  return resolveAvatarUrl(source) || "/logo.png";
};
