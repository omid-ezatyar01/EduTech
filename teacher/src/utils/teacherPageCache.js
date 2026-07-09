const teacherPageCache = new Map();

export const readTeacherPageCache = (key, options = {}) => {
  if (!key) return null;
  const entry = teacherPageCache.get(key);
  if (!entry) return null;

  const maxAgeMs = Number(options?.maxAgeMs || 0);
  if (maxAgeMs > 0 && Date.now() - Number(entry.updatedAt || 0) > maxAgeMs) {
    teacherPageCache.delete(key);
    return null;
  }

  return entry.value ?? null;
};

export const writeTeacherPageCache = (key, value) => {
  if (!key) return value;
  teacherPageCache.set(key, {
    value,
    updatedAt: Date.now(),
  });
  return value;
};

export const clearTeacherPageCache = (prefix = "") => {
  if (!prefix) {
    teacherPageCache.clear();
    return;
  }

  Array.from(teacherPageCache.keys()).forEach((key) => {
    if (String(key).startsWith(prefix)) {
      teacherPageCache.delete(key);
    }
  });
};

export const getTeacherPageCacheKey = (name, params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  if (!entries.length) return `teacher:${name}`;
  return `teacher:${name}:${JSON.stringify(Object.fromEntries(entries))}`;
};
