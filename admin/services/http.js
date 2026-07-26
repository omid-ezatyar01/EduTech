import {
  getToken,
  handleAuthExpired,
  isAuthExpiredResponse,
} from "./portal.js";

const GET_REQUEST_CACHE_TTL_MS = 15 * 1000;
const inflightGetRequests = new Map();
const recentGetResponses = new Map();
let fetchGuardInstalled = false;

const browserOrigin =
  typeof window !== "undefined" ? window.location.origin : "";
const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost =
  browserHost === "localhost" || browserHost === "127.0.0.1";
const DEFAULT_API_BASE = import.meta.env.DEV
  ? isLocalHost
    ? "http://localhost:5000/api/v1"
    : browserOrigin
      ? `${browserOrigin}/api/v1`
      : "http://localhost:5000/api/v1"
  : browserOrigin
    ? `${browserOrigin}/api/v1`
    : "http://localhost:5000/api/v1";

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
    return Array.from(headers.entries());
  }

  if (Array.isArray(headers)) {
    return headers;
  }

  return Object.entries(headers || {});
};

const buildRequestCacheKey = (input, init = {}) => {
  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : String(input?.url || "");

  const requestMethod = String(
    init?.method ||
      (typeof input === "object" && input && "method" in input ? input.method : "GET") ||
      "GET",
  ).toUpperCase();

  const normalizedHeaders = normalizeHeaders(init?.headers || input?.headers)
    .map(([key, value]) => [String(key).toLowerCase(), String(value)])
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify({
    method: requestMethod,
    url: requestUrl,
    headers: normalizedHeaders,
  });
};

const readRecentGetResponse = (key) => {
  const cached = recentGetResponses.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    recentGetResponses.delete(key);
    return null;
  }

  return cached.response.clone();
};

const storeRecentGetResponse = (key, response) => {
  recentGetResponses.set(key, {
    expiresAt: Date.now() + GET_REQUEST_CACHE_TTL_MS,
    response: response.clone(),
  });
};

export const installAdminFetchGuards = () => {
  if (fetchGuardInstalled || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const requestMethod = String(
      init?.method ||
        (typeof input === "object" && input && "method" in input ? input.method : "GET") ||
        "GET",
    ).toUpperCase();

    const shouldDeduplicate =
      (requestMethod === "GET" || requestMethod === "HEAD") &&
      init?.cache !== "no-store" &&
      init?.headers?.["x-admin-no-dedupe"] !== "true";

    if (!shouldDeduplicate) {
      if (requestMethod !== "GET" && requestMethod !== "HEAD") {
        recentGetResponses.clear();
      }
      return nativeFetch(input, init);
    }

    const cacheKey = buildRequestCacheKey(input, init);
    const cachedResponse = readRecentGetResponse(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const inflightRequest = inflightGetRequests.get(cacheKey);
    if (inflightRequest) {
      return inflightRequest.then((response) => response.clone());
    }

    const requestPromise = nativeFetch(input, init)
      .then((response) => {
        if (response.ok) {
          storeRecentGetResponse(cacheKey, response);
        }
        return response;
      })
      .finally(() => {
        inflightGetRequests.delete(cacheKey);
      });

    inflightGetRequests.set(cacheKey, requestPromise);
    return requestPromise.then((response) => response.clone());
  };

  fetchGuardInstalled = true;
};

export const parseJsonResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || "Request failed";
    const isExpiredSession = isAuthExpiredResponse(
      response.status,
      message,
      data?.code,
    );

    if (isExpiredSession) {
      handleAuthExpired();
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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
