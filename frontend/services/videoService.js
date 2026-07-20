import { buildAuthHeaders, fetchJsonWithCache, getApiBase, getApiCacheTtl, parseJsonResponse } from "./http.js";

export const fetchPublicVideos = async ({ platform = "all", page = 1, limit = 6 } = {}) => {
  const params = new URLSearchParams({ platform, page: String(page), limit: String(limit) });
  const response = await fetchJsonWithCache(`${getApiBase()}/videos?${params.toString()}`, {}, {
    ttlMs: getApiCacheTtl({ publicTtl: 2 * 60 * 1000 }),
    cacheKey: `public-videos:${platform}:${page}:${limit}`,
  });
  return {
    videos: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta || { platform, page, limit, total: 0, totalPages: 0, hasMore: false },
  };
};

export const fetchVideoSocialState = async () => {
  const response = await fetch(`${getApiBase()}/student/video-social-state`, { headers: buildAuthHeaders(), cache: "no-store" });
  return (await parseJsonResponse(response))?.data || { likedVideoIds: [] };
};

export const toggleVideoLike = async (videoId) => {
  const response = await fetch(`${getApiBase()}/videos/${videoId}/like`, { method: "POST", headers: buildAuthHeaders() });
  return (await parseJsonResponse(response))?.data || {};
};
