import { fetchJsonWithCache, getApiBase } from "./http.js";

export const resolveHeroMediaUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const origin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${origin}${path}`;
  }
  return path;
};

export const fetchPublicHeroMedia = async () => {
  const response = await fetchJsonWithCache(
    `${getApiBase()}/hero-media`,
    { cache: "no-store" },
    { ttlMs: 60_000 },
  );
  return Array.isArray(response?.data) ? response.data : [];
};
