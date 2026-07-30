import { buildAuthHeaders, fetchJsonWithCache, getApiBase, getApiCacheTtl, invalidateApiCache, parseJsonResponse } from "./http.js";

export const fetchPublicVideos = async ({ feed = "all", platform = "all", sort = "popular", page = 1, limit = 6, teacherId = "" } = {}) => {
  const authenticatedFeed = feed === "following" || feed === "saved";
  const params = new URLSearchParams({ platform, sort, page: String(page), limit: String(limit) });
  if (authenticatedFeed) params.set("feed", feed);
  if (teacherId) params.set("teacherId", teacherId);
  const path = authenticatedFeed ? "/student/videos" : "/videos";
  const requestOptions = authenticatedFeed ? { headers: buildAuthHeaders(), cache: "no-store" } : {};
  const response = authenticatedFeed
    ? await parseJsonResponse(await fetch(`${getApiBase()}${path}?${params.toString()}`, requestOptions))
    : await fetchJsonWithCache(`${getApiBase()}${path}?${params.toString()}`, requestOptions, {
      ttlMs: getApiCacheTtl({ publicTtl: 2 * 60 * 1000 }),
      cacheKey: `public-videos:${platform}:${sort}:${page}:${limit}:${teacherId || "all-teachers"}`,
    });
  return {
    videos: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta || { feed, platform, sort, page, limit, total: 0, totalPages: 0, hasMore: false },
  };
};

export const fetchPublicVideo = async (videoId) => {
  const response = await fetchJsonWithCache(`${getApiBase()}/videos/${encodeURIComponent(videoId)}`, {}, {
    ttlMs: getApiCacheTtl({ publicTtl: 2 * 60 * 1000 }),
    cacheKey: `public-video:${videoId}`,
  });
  return response?.data || null;
};

export const fetchVideoSocialState = async () => {
  const response = await fetch(`${getApiBase()}/student/video-social-state`, { headers: buildAuthHeaders(), cache: "no-store" });
  return (await parseJsonResponse(response))?.data || { likedVideoIds: [] };
};

export const toggleVideoLike = async (videoId) => {
  const response = await fetch(`${getApiBase()}/videos/${videoId}/like`, { method: "POST", headers: buildAuthHeaders() });
  const data = (await parseJsonResponse(response))?.data || {};
  invalidateApiCache((key) => String(key).includes("public-video"));
  return data;
};

export const toggleVideoSave = async (videoId) => {
  const response = await fetch(`${getApiBase()}/videos/${videoId}/save`, { method: "POST", headers: buildAuthHeaders() });
  return (await parseJsonResponse(response))?.data || {};
};
