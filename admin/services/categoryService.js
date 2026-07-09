import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

export const fetchAdminCategories = async () => {
  const response = await fetch(`${getApiBase()}/admin/categories`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return Array.isArray(data?.data) ? data.data : [];
};

export const createAdminCategory = async (payload) => {
  const response = await fetch(`${getApiBase()}/admin/categories`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const updateAdminCategory = async (categoryId, payload) => {
  const response = await fetch(`${getApiBase()}/admin/categories/${categoryId}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  return data?.data;
};

export const deleteAdminCategory = async (categoryId) => {
  const response = await fetch(`${getApiBase()}/admin/categories/${categoryId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  return parseJsonResponse(response);
};
