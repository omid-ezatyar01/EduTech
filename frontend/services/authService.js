import api from "./api";

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);

  return response.data;
};

export const loginUser = async (userData) => {
  const response = await api.post("/auth/login", userData);

  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/profile");
  return response.data;
};

export const verifyRegisterOtp = async (data) => {
  const response = await api.post("/auth/verify-register-otp", data);
  return response.data;
};

export const getRegisterOtpStatus = async (email) => {
  const response = await api.get("/auth/register-otp-status", {
    params: { email },
  });
  return response.data;
};

export const resendRegisterOtp = async (email) => {
  const response = await api.post("/auth/resend-register-otp", { email });
  return response.data;
};

export const updateCurrentUserProfile = async (payload) => {
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === "avatarFile") {
      if (value instanceof File) {
        formData.append("avatar", value);
      }
      return;
    }

    if (typeof value === "object" && !(value instanceof Blob)) {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  const response = await api.patch("/auth/profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const changeCurrentUserPassword = async (payload) => {
  const response = await api.post("/auth/change-password", payload);
  return response.data;
};

export const getStudentGoogleAuthUrl = async (mode = "login") => {
  const response = await api.get("/auth/student/google/auth-url", {
    params: { mode },
  });
  return response.data;
};

export const exchangeStudentGoogleAuth = async (exchangeToken) => {
  const response = await api.post("/auth/student/google/exchange", {
    exchangeToken,
  });
  return response.data;
};
