import { fetchJsonWithCache, getApiBase } from "./http.js";

const VISITOR_STORAGE_KEY = "edutech_article_visitor_id";
let memoryVisitorId = "";

export const resolveArticleCoverUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith("/uploads/")) {
    const apiOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
    return `${apiOrigin}${path}`;
  }
  return path;
};

const getArticleVisitorId = () => {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (/^[a-zA-Z0-9_-]{16,100}$/.test(stored || "")) {
      memoryVisitorId = stored;
      return memoryVisitorId;
    }
    memoryVisitorId = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_STORAGE_KEY, memoryVisitorId);
  } catch {
    memoryVisitorId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return memoryVisitorId;
};

export const fetchArticles = async ({ page = 1, limit = 9, category = "all", search = "", sort = "latest", authorId = "" } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), category, search, sort });
  if (authorId) params.set("authorId", authorId);
  const response = await fetchJsonWithCache(
    `${getApiBase()}/articles?${params.toString()}`,
    { cache: "no-store" },
    { ttlMs: 0 },
  );
  return { articles: Array.isArray(response?.data) ? response.data : [], meta: response?.meta || {} };
};

export const fetchArticleBySlug = async (slug) => {
  const response = await fetchJsonWithCache(
    `${getApiBase()}/articles/${encodeURIComponent(slug)}`,
    { cache: "no-store", headers: { "X-EduTech-Visitor-ID": getArticleVisitorId() } },
    { ttlMs: 0 },
  );
  return response?.data || null;
};
