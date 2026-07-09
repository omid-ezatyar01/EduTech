import axios from "axios";
import { getApiBase } from "./http";
import { getToken, handleAuthExpired } from "./portal";

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
    const isExpiredSession =
      status === 401 ||
      status === 403 ||
      /not authorized, user not found|jwt expired|invalid token|token failed/i.test(message);

    if (isExpiredSession) {
      handleAuthExpired(message);
    }

    return Promise.reject(error);
  },
);

export default api;
