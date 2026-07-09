import crypto from "crypto";

export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

export const getOtpExpiryDate = () => {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
};
