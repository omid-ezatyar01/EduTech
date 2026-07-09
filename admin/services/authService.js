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
