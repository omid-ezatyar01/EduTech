import { getApiBase } from "../../services/http";

const getApiOrigin = () => {
  try {
    return new URL(getApiBase()).origin;
  } catch {
    return "";
  }
};

const appendCacheKey = (url, cacheKey) => {
  const normalizedCacheKey = String(cacheKey || "").trim();
  if (!url || !normalizedCacheKey) return url;

  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    parsed.searchParams.set("v", normalizedCacheKey);
    if (/^https?:\/\//i.test(url)) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(normalizedCacheKey)}`;
  }
};

export const resolveAvatarUrl = (avatar, cacheKey = "") => {
  if (!avatar || typeof avatar !== "string") return "";

  const apiOrigin = getApiOrigin();

  if (avatar.startsWith("/uploads/")) {
    const resolved = apiOrigin ? `${apiOrigin}${avatar}` : avatar;
    return appendCacheKey(resolved, cacheKey);
  }

  if (/^https?:\/\//i.test(avatar)) {
    try {
      const parsed = new URL(avatar);
      const isUploadsPath = parsed.pathname.startsWith("/uploads/");
      const apiHost = apiOrigin ? new URL(apiOrigin).host : "";
      const avatarHost = parsed.host;

      if (isUploadsPath && apiOrigin && avatarHost !== apiHost) {
        return appendCacheKey(`${apiOrigin}${parsed.pathname}${parsed.search}`, cacheKey);
      }
      return isUploadsPath ? appendCacheKey(avatar, cacheKey) : avatar;
    } catch {
      return avatar;
    }
  }

  return avatar;
};
