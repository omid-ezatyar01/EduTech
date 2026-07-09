import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const fetchOtpEmailStatuses = async ({ search = "", status = "all", page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);
  params.set("page", String(page));
  params.set("limit", String(limit));

  const response = await fetch(`${getApiBase()}/admin/otp-email-statuses?${params.toString()}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  return {
    rows: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta || {},
  };
};
