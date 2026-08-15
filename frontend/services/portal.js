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
const POST_AUTH_REDIRECT_KEY = "edutech_post_auth_redirect";
const TERMINAL_AUTH_CODES = new Set([
  "AUTH_TOKEN_MISSING",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_TOKEN_INVALID",
  "AUTH_USER_NOT_FOUND",
  "AUTH_TOKEN_REVOKED",
  "ACCOUNT_BLOCKED",
]);

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

export const setPostAuthRedirect = (path = "") => {
  const value = String(path || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return;
  localStorage.setItem(POST_AUTH_REDIRECT_KEY, value);
};

export const consumePostAuthRedirect = (fallback = PORTAL_CONFIG.dashboardPath) => {
  const value = localStorage.getItem(POST_AUTH_REDIRECT_KEY) || "";
  localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
};

export const getToken = () => localStorage.getItem("edutech_token");

export const clearAuth = () => {
  localStorage.removeItem("edutech_user");
  localStorage.removeItem("edutech_token");
  localStorage.removeItem("edutech_auth");
  window.dispatchEvent(new Event("auth_change"));
};

export const getLocalizedPortalPath = (path) => {
  if (typeof window === "undefined") return path;
  const language = window.location.pathname.match(/^\/(fa|en)(?=\/|$)/)?.[1];
  return language ? `/${language}${path}` : path;
};

export const handleAuthExpired = (message = "") => {
  clearAuth();
  if (message) setAuthNotice(message);

  if (typeof window === "undefined") return;
  const loginPath = getLocalizedPortalPath(PORTAL_CONFIG.loginPath);
  if (window.location.pathname === loginPath) return;

  window.location.replace(loginPath);
};

export const isAuthExpiredResponse = (status, message = "", code = "") => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (TERMINAL_AUTH_CODES.has(normalizedCode)) return true;
  if (![401, 403].includes(Number(status))) return false;

  return /not authorized, (?:no token|user not found|token expired|token failed)|jwt expired|invalid token|password changed|account has been blocked/i.test(
    String(message || ""),
  );
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
