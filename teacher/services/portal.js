import { clearTeacherPageCache } from "../src/utils/teacherPageCache.js";

export const PORTAL_CONFIG = {
  role: "teacher",
  loginEndpoint: "/auth/teacher/login",
  loginErrorMessage: {
    en: "Only teachers can login from this portal.",
    fa: "فقط مدرسان می‌توانند از این پنل وارد شوند.",
  },
  dashboardPath: "/teacher/dashboard",
  loginPath: "/teacher/login",
};

const TEACHER_USER_KEY = "edutech_teacher_user";
const TEACHER_TOKEN_KEY = "edutech_teacher_token";
const TEACHER_AUTH_KEY = "edutech_teacher_auth";
const TERMINAL_AUTH_CODES = new Set([
  "AUTH_TOKEN_MISSING",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_TOKEN_INVALID",
  "AUTH_USER_NOT_FOUND",
  "AUTH_TOKEN_REVOKED",
  "ACCOUNT_BLOCKED",
  "TEACHER_CONTRACT_EXPIRED",
]);

export const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

export const getStoredJson = (key, fallback = null) => {
  try {
    const raw = readLocalStorage(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const getAuthUser = () => getStoredJson(TEACHER_USER_KEY, null);

export const getToken = () => readLocalStorage(TEACHER_TOKEN_KEY);

export const saveAuthUser = (user) =>
  writeLocalStorage(TEACHER_USER_KEY, JSON.stringify(user || {}));

export const clearAuth = ({ notify = true } = {}) => {
  clearTeacherPageCache();
  removeLocalStorage(TEACHER_USER_KEY);
  removeLocalStorage(TEACHER_TOKEN_KEY);
  removeLocalStorage(TEACHER_AUTH_KEY);
  if (notify) {
    window.dispatchEvent(new Event("teacher_auth_change"));
  }
};

export const handleAuthExpired = () => {
  clearAuth({ notify: false });

  if (typeof window === "undefined") return;
  if (window.location.pathname === PORTAL_CONFIG.loginPath) return;

  window.location.replace(PORTAL_CONFIG.loginPath);
};

export const isAuthExpiredResponse = (status, message = "", code = "") => {
  const normalizedMessage = String(message || "");
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (TERMINAL_AUTH_CODES.has(normalizedCode)) return true;
  if (![401, 403].includes(Number(status))) return false;

  return (
    /not authorized, (?:no token|user not found|token expired|token failed)|jwt expired|invalid token|password changed|account has been blocked|contract has expired/i.test(
      normalizedMessage,
    )
  );
};

export const saveAuth = (data) => {
  const { token, ...user } = data;
  saveAuthUser(user);
  writeLocalStorage(TEACHER_TOKEN_KEY, token);
  writeLocalStorage(TEACHER_AUTH_KEY, "true");
  window.dispatchEvent(new Event("teacher_auth_change"));
};

export const isCorrectRole = (user) => {
  return user && user.role === PORTAL_CONFIG.role;
};

export const getTeacherEntryPath = (user = getAuthUser()) => {
  const applicationStatus = String(user?.teacherApplication?.status || "").trim();
  return applicationStatus === "approved" ? PORTAL_CONFIG.dashboardPath : "/teacher/profile";
};

export const isTeacherAuthenticated = () => {
  const isAuth = readLocalStorage(TEACHER_AUTH_KEY) === "true";
  if (!isAuth) return false;

  const token = getToken();
  if (!token) {
    clearAuth();
    return false;
  }

  const user = getAuthUser();
  if (!isCorrectRole(user)) {
    clearAuth();
    return false;
  }

  return true;
};
