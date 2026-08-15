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

export const resolveHeroMediaLink = (value = "") => {
  const link = String(value || "").trim();
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  try {
    return ["http:", "https:"].includes(new URL(link).protocol) ? link : "";
  } catch {
    return "";
  }
};

export const fetchPublicHeroMedia = async () => {
  const response = await fetchJsonWithCache(
    `${getApiBase()}/hero-media`,
    { cache: "no-store" },
    { ttlMs: 0 },
  );
  return Array.isArray(response?.data) ? response.data : [];
};
