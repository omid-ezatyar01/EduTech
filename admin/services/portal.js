export const PORTAL_CONFIG = {
  role: "admin",
  loginEndpoint: "/auth/admin/login",
  loginErrorMessage: {
    en: "Only admins can login from this portal.",
    fa: "فقط مدیران می‌توانند از این پنل وارد شوند.",
  },
  dashboardPath: "/",
  loginPath: "/login",
};

const normalizeBasePath = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw || raw === "/" || raw === "./") return "";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized.replace(/\/+$/, "");
};

export const getAdminBasePath = () => {
  if (typeof window === "undefined") return "";
  return normalizeBasePath(window.__EDUTECH_ADMIN_BASENAME__ || "");
};

export const buildAdminPath = (path = "/") => {
  const basePath = getAdminBasePath();
  const normalizedPath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "/")}`;
  if (!basePath) return normalizedPath;
  if (normalizedPath === "/") return basePath;
  return `${basePath}${normalizedPath}`;
};

const ADMIN_USER_KEY = "edutech_admin_user";
const ADMIN_TOKEN_KEY = "edutech_admin_token";
const ADMIN_AUTH_KEY = "edutech_admin_auth";

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

export const getAuthUser = () => getStoredJson(ADMIN_USER_KEY, null);

export const getToken = () => readLocalStorage(ADMIN_TOKEN_KEY);

export const saveAuthUser = (user) =>
  writeLocalStorage(ADMIN_USER_KEY, JSON.stringify(user || {}));

export const clearAuth = () => {
  removeLocalStorage(ADMIN_USER_KEY);
  removeLocalStorage(ADMIN_TOKEN_KEY);
  removeLocalStorage(ADMIN_AUTH_KEY);
  window.dispatchEvent(new Event("admin_auth_change"));
};

export const handleAuthExpired = () => {
  clearAuth();

  if (typeof window === "undefined") return;
  const loginPath = buildAdminPath(PORTAL_CONFIG.loginPath);
  if (window.location.pathname === loginPath) return;

  window.location.replace(loginPath);
};

export const saveAuth = (data) => {
  const { token, ...user } = data;
  saveAuthUser(user);
  writeLocalStorage(ADMIN_TOKEN_KEY, token);
  writeLocalStorage(ADMIN_AUTH_KEY, "true");
  window.dispatchEvent(new Event("admin_auth_change"));
};

export const isCorrectRole = (user) => {
  return user && user.role === PORTAL_CONFIG.role;
};

export const isAdminAuthenticated = () => {
  const isAuth = readLocalStorage(ADMIN_AUTH_KEY) === "true";
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
