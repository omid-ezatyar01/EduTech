import {
  buildAuthHeaders,
  getApiBase,
  parseJsonResponse,
} from "./http";

const request = async (path, data, { authenticated = false } = {}) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: authenticated
      ? buildAuthHeaders()
      : { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJsonResponse(response);
};

export const registerUser = (userData) =>
  request("/auth/register", userData);

export const loginUser = (userData) =>
  request("/auth/teacher/login", userData);

export const getCurrentUser = async () => {
  const response = await fetch(`${getApiBase()}/auth/profile`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  return parseJsonResponse(response);
};

export const verifyRegisterOtp = (data) =>
  request("/auth/verify-register-otp", data);

export const requestTeacherPasswordReset = (email) =>
  request("/auth/teacher/password-reset/request", { email });

export const verifyTeacherPasswordResetOtp = ({ email, otp }) =>
  request("/auth/teacher/password-reset/verify", { email, otp });

export const resetTeacherPassword = ({
  email,
  resetToken,
  newPassword,
  confirmPassword,
}) =>
  request("/auth/teacher/password-reset/reset", {
    email,
    resetToken,
    newPassword,
    confirmPassword,
  });

export const changeTeacherPassword = ({
  currentPassword,
  newPassword,
  confirmPassword,
}) =>
  request(
    "/auth/change-password",
    { currentPassword, newPassword, confirmPassword },
    { authenticated: true },
  );
