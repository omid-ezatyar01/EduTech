export const PORTAL_CONFIG = {
  role: "student",
  loginEndpoint: "/auth/student/login",
  loginErrorMessage: {
    en: "Only students can login from this portal.",
    fa: "فقط محصلان می‌توانند از این پنل وارد شوند.",
  },
  dashboardPath: "/student/dashboard",
  loginPath: "/login",
};
const AUTH_NOTICE_KEY = "edutech_auth_notice";

export const getStoredJson = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const getAuthUser = () => getStoredJson("edutech_user", null);

export const getToken = () => localStorage.getItem("edutech_token");

export const clearAuth = () => {
  localStorage.removeItem("edutech_user");
  localStorage.removeItem("edutech_token");
  localStorage.removeItem("edutech_auth");
  window.dispatchEvent(new Event("auth_change"));
};

export const handleAuthExpired = (message = "") => {
  clearAuth();
  if (message) setAuthNotice(message);

  if (typeof window === "undefined") return;
  if (window.location.pathname === PORTAL_CONFIG.loginPath) return;

  window.location.replace(PORTAL_CONFIG.loginPath);
};

export const setAuthNotice = (message) => {
  try {
    sessionStorage.setItem(AUTH_NOTICE_KEY, String(message || ""));
  } catch {
    // ignore storage failures
  }
};

export const consumeAuthNotice = () => {
  try {
    const value = sessionStorage.getItem(AUTH_NOTICE_KEY) || "";
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return value;
  } catch {
    return "";
  }
};

export const saveAuth = (data) => {
  const { token, ...user } = data;
  localStorage.setItem("edutech_user", JSON.stringify(user));
  localStorage.setItem("edutech_token", token);
  localStorage.setItem("edutech_auth", "true");
  window.dispatchEvent(new Event("auth_change"));
};

export const isCorrectRole = (user) => {
  return user && user.role === PORTAL_CONFIG.role;
};
