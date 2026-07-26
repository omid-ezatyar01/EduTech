import axios from "axios";
import { getApiBase } from "./http";
import { getToken, handleAuthExpired, isAuthExpiredResponse } from "./portal";

const api = axios.create({
  baseURL: getApiBase(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || "");
    const code = String(error?.response?.data?.code || "");

    if (isAuthExpiredResponse(status, message, code)) {
      handleAuthExpired();
    }

    return Promise.reject(error);
  },
);

export default api;
