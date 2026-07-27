const TOKEN_KEY = "edutech_support_staff_token";
const USER_KEY = "edutech_support_staff_user";
const AUTH_EVENT = "edutech_support_staff_auth_change";

export const getSupportStaffToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const getSupportStaffUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const saveSupportStaffAuth = (payload = {}) => {
  const { token, ...user } = payload;
  if (!token || user.role !== "support") {
    throw new Error("This account is not authorized for the support workspace");
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearSupportStaffAuth = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const isSupportStaffAuthenticated = () =>
  Boolean(getSupportStaffToken() && getSupportStaffUser()?.role === "support");

export const onSupportStaffAuthChange = (handler) => {
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
};

