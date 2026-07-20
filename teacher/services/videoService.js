import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http.js";

const request = async (path, options = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers: buildAuthHeaders() });
  return parseJsonResponse(response);
};

export const fetchTeacherVideos = async () => (await request("/teacher/videos"))?.data || [];
export const createTeacherVideo = async (payload) => (await request("/teacher/videos", { method: "POST", body: JSON.stringify(payload) }))?.data;
export const updateTeacherVideo = async (id, payload) => (await request(`/teacher/videos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }))?.data;
export const deleteTeacherVideo = async (id) => request(`/teacher/videos/${id}`, { method: "DELETE" });

