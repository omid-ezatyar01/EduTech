import {
  buildAuthHeaders,
  getApiBase,
  parseJsonResponse,
} from "./http.js";

export const fetchGoogleCalendarStatus = async () => {
  const response = await fetch(`${getApiBase()}/google/account-status`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return data?.data || { connected: false, googleEmail: "" };
};

export const fetchGoogleCalendarAuthUrl = async () => {
  const response = await fetch(`${getApiBase()}/google/auth-url`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return data?.data?.url || "";
};
