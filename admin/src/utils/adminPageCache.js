const adminPageCache = new Map();
const STORAGE_PREFIX = "edutech_admin_page_cache:";

const readSessionCacheEntry = (key) => {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSessionCacheEntry = (key, entry) => {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
};

const removeSessionCacheEntry = (key) => {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // ignore storage failures
  }
};

export const readAdminPageCache = (key, options = {}) => {
  if (!key) return null;
  let entry = adminPageCache.get(key);
  if (!entry) {
    entry = readSessionCacheEntry(key);
    if (entry) {
      adminPageCache.set(key, entry);
    }
  }
  if (!entry) return null;

  const maxAgeMs = Number(options?.maxAgeMs || 0);
  if (maxAgeMs > 0 && Date.now() - Number(entry.updatedAt || 0) > maxAgeMs) {
    adminPageCache.delete(key);
    removeSessionCacheEntry(key);
    return null;
  }

  return entry.value ?? null;
};

export const writeAdminPageCache = (key, value) => {
  if (!key) return value;
  const entry = {
    value,
    updatedAt: Date.now(),
  };
  adminPageCache.set(key, entry);
  writeSessionCacheEntry(key, entry);
  return value;
};

export const clearAdminPageCache = (prefix = "") => {
  if (!prefix) {
    adminPageCache.clear();
    if (typeof window !== "undefined") {
      try {
        Object.keys(window.sessionStorage).forEach((storageKey) => {
          if (storageKey.startsWith(STORAGE_PREFIX)) {
            window.sessionStorage.removeItem(storageKey);
          }
        });
      } catch {
        // ignore storage failures
      }
    }
    return;
  }

  Array.from(adminPageCache.keys()).forEach((key) => {
    if (String(key).startsWith(prefix)) {
      adminPageCache.delete(key);
      removeSessionCacheEntry(key);
    }
  });

  if (typeof window !== "undefined") {
    try {
      Object.keys(window.sessionStorage).forEach((storageKey) => {
        if (storageKey === `${STORAGE_PREFIX}${prefix}` || storageKey.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
          window.sessionStorage.removeItem(storageKey);
        }
      });
    } catch {
      // ignore storage failures
    }
  }
};

export const getAdminPageCacheKey = (name, params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  if (!entries.length) return `admin:${name}`;
  return `admin:${name}:${JSON.stringify(Object.fromEntries(entries))}`;
};
