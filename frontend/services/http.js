import {
  getToken,
  handleAuthExpired,
  isAuthExpiredResponse,
} from "./portal";

const DEFAULT_API_BASE = "http://localhost:5000/api/v1";
const apiResponseCache = new Map();
const apiInflightRequests = new Map();

const cloneData = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export const isConstrainedConnection = () => {
  if (typeof navigator === "undefined") return false;
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return (
    Boolean(connection?.saveData) ||
    /(^|slow-)2g/i.test(String(connection?.effectiveType || ""))
  );
};

export const getApiCacheTtl = ({
  authenticated = false,
  publicTtl = 5 * 60 * 1000,
  authenticatedTtl = 60 * 1000,
} = {}) => {
  if (!isConstrainedConnection()) {
    return authenticated ? authenticatedTtl : publicTtl;
  }

  return authenticated
    ? Math.max(authenticatedTtl, 3 * 60 * 1000)
    : Math.max(publicTtl, 15 * 60 * 1000);
};

export const getApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || DEFAULT_API_BASE;
  const normalized = String(raw).replace(/\/+$/, "");

  if (/\/api\/v\d+$/i.test(normalized)) return normalized;
  if (/\/api$/i.test(normalized)) return `${normalized}/v1`;
  return `${normalized}/api/v1`;
};

export const buildAuthHeaders = () => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const normalizeHeaders = (headers = {}) => {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return headers || {};
};

const getRequestCacheKey = (url, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const headers = normalizeHeaders(options.headers);
  const authHeader =
    headers.Authorization ||
    headers.authorization ||
    "";

  return `${method}:${url}:auth=${authHeader}`;
};

export const parseJsonResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    error.data = data;
    error.isUnauthorized = isAuthExpiredResponse(
      response.status,
      data?.message,
      data?.code,
    );
    if (error.isUnauthorized) {
      handleAuthExpired(data?.message || "");
    }
    throw error;
  }

  return data;
};

export const fetchJsonWithCache = async (
  url,
  options = {},
  { ttlMs = 60 * 1000, cacheKey } = {},
) => {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET" || ttlMs <= 0) {
    const response = await fetch(url, options);
    return parseJsonResponse(response);
  }

  const key = cacheKey || getRequestCacheKey(url, options);
  const now = Date.now();
  const cached = apiResponseCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cloneData(cached.data);
  }

  if (apiInflightRequests.has(key)) {
    return cloneData(await apiInflightRequests.get(key));
  }

  const request = fetch(url, options)
    .then(parseJsonResponse)
    .then((data) => {
      apiResponseCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    })
    .finally(() => {
      apiInflightRequests.delete(key);
    });

  apiInflightRequests.set(key, request);
  return cloneData(await request);
};

export const invalidateApiCache = (matcher) => {
  if (!matcher) {
    apiResponseCache.clear();
    apiInflightRequests.clear();
    return;
  }

  const shouldDelete =
    typeof matcher === "function"
      ? matcher
      : (key) => String(key).includes(String(matcher));

  Array.from(apiResponseCache.keys()).forEach((key) => {
    if (shouldDelete(key)) apiResponseCache.delete(key);
  });
};

export const isUnauthorizedError = (error) => {
  if (!error) return false;
  if (typeof error.isUnauthorized === "boolean") return error.isUnauthorized;
  return isAuthExpiredResponse(
    error.status,
    error.message,
    error?.data?.code,
  );
};

export const isNetworkError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("connection refused") ||
    message.includes("failed to reach") ||
    message.includes("load failed") ||
    message.includes("err_network") ||
    message.includes("offline")
  );
};

export const getLocalizedRequestErrorMessage = (
  error,
  language = "fa",
  fallbackFa = "درخواست انجام نشد.",
  fallbackEn = "Request failed.",
) => {
  const isFa = language === "fa";
  const raw = String(error?.message || error || "").trim();
  const normalized = raw.toLowerCase();

  if (isNetworkError(error)) {
    return isFa
      ? "اتصال به اینترنت برقرار نیست یا سرور در دسترس نیست."
      : "No internet connection or server is unreachable.";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return isFa
      ? "زمان درخواست به پایان رسید. لطفاً دوباره تلاش کنید."
      : "Request timed out. Please try again.";
  }

  if (raw && normalized !== "request failed") {
    return raw;
  }

  return isFa ? fallbackFa : fallbackEn;
};
