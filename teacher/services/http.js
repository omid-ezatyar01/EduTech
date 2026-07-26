import { getToken, handleAuthExpired, isAuthExpiredResponse } from "./portal";

const DEFAULT_API_BASE = "http://localhost:5000/api/v1";
const GET_REQUEST_CACHE_TTL_MS = 15 * 1000;
const inflightGetRequests = new Map();
const recentGetResponses = new Map();
let fetchGuardInstalled = false;
const getDefaultApiBase = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }

  return DEFAULT_API_BASE;
};

export const getApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || getDefaultApiBase();
  const normalized = String(raw).replace(/\/+$/, "");

  if (/\/api\/v\d+$/i.test(normalized)) return normalized;
  if (/\/api$/i.test(normalized)) return `${normalized}/v1`;
  return `${normalized}/api/v1`;
};

const buildRequestKey = (input, init = {}) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : String(input?.url || "");
  const method = String(init?.method || input?.method || "GET").toUpperCase();
  const headers =
    init?.headers instanceof Headers
      ? Array.from(init.headers.entries())
      : Object.entries(init?.headers || {});
  return JSON.stringify({
    method,
    url,
    headers: headers
      .map(([key, value]) => [String(key).toLowerCase(), String(value)])
      .sort(([left], [right]) => left.localeCompare(right)),
  });
};

export const installTeacherFetchGuards = () => {
  if (fetchGuardInstalled || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const method = String(init?.method || input?.method || "GET").toUpperCase();
    if (!["GET", "HEAD"].includes(method)) {
      recentGetResponses.clear();
      return nativeFetch(input, init);
    }

    const key = buildRequestKey(input, init);
    const allowRecentCache = init?.cache !== "no-store";
    const cached = allowRecentCache ? recentGetResponses.get(key) : null;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response.clone();
    }
    if (cached) recentGetResponses.delete(key);

    const inflight = inflightGetRequests.get(key);
    if (inflight) return inflight.then((response) => response.clone());

    const request = nativeFetch(input, init)
      .then((response) => {
        if (response.ok && allowRecentCache) {
          recentGetResponses.set(key, {
            response: response.clone(),
            expiresAt: Date.now() + GET_REQUEST_CACHE_TTL_MS,
          });
        }
        return response;
      })
      .finally(() => {
        inflightGetRequests.delete(key);
      });

    inflightGetRequests.set(key, request);
    return request.then((response) => response.clone());
  };

  fetchGuardInstalled = true;
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

export const parseJsonResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || "Request failed";

    if (isAuthExpiredResponse(response.status, message, data?.code)) {
      handleAuthExpired();
    }

    throw new Error(message);
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
