const memoryCache = new Map();
const STORAGE_PREFIX = "edutech_support_page_cache:";

const storageKey = (key) => `${STORAGE_PREFIX}${key}`;

export const buildSupportCacheKey = (portal, userId, resource) =>
  [portal || "support", userId || "anonymous", resource || "data"]
    .map((value) => encodeURIComponent(String(value)))
    .join(":");

export const readSupportPageCache = (key, maxAgeMs = 30 * 60 * 1000) => {
  if (!key) return null;
  let entry = memoryCache.get(key);
  if (!entry && typeof window !== "undefined") {
    try {
      entry = JSON.parse(window.sessionStorage.getItem(storageKey(key)) || "null");
      if (entry) memoryCache.set(key, entry);
    } catch {
      entry = null;
    }
  }
  if (!entry) return null;
  if (
    maxAgeMs > 0 &&
    Date.now() - Number(entry.updatedAt || 0) > maxAgeMs
  ) {
    memoryCache.delete(key);
    try {
      window.sessionStorage.removeItem(storageKey(key));
    } catch {
      // Ignore unavailable browser storage.
    }
    return null;
  }
  return entry.value ?? null;
};

export const writeSupportPageCache = (key, value) => {
  if (!key) return value;
  const entry = { value, updatedAt: Date.now() };
  memoryCache.set(key, entry);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
    } catch {
      // The in-memory copy remains available when storage is unavailable.
    }
  }
  return value;
};
