import { fetchJsonWithCache, getApiBase } from "./http.js";

export const resolveGalleryImageUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const apiOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${apiOrigin}${path}`;
  }
  return path;
};

export const fetchGallery = async ({
  category = "all",
  page = 1,
  limit = 48,
} = {}) => {
  const params = new URLSearchParams({
    category,
    page: String(page),
    limit: String(limit),
  });
  const response = await fetchJsonWithCache(
    `${getApiBase()}/gallery?${params}`,
    { cache: "no-store" },
    { ttlMs: 0 },
  );
  return {
    images: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta || {},
  };
};
