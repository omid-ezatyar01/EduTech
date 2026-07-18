import { getToken, handleAuthExpired, isAuthExpiredResponse } from "./portal";

const DEFAULT_API_BASE = "http://localhost:5000/api/v1";
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

    if (isAuthExpiredResponse(response.status, message)) {
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
