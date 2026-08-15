import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  getUserProfile,
  verifyRegisterOtp,
  getRegisterOtpStatus,
  resendRegisterOtp,
  changeUserPassword,
  requestTeacherPasswordReset,
  verifyTeacherPasswordResetOtp,
  resetTeacherPassword,
  updateUserProfile,
  getStudentGoogleAuthUrl,
  handleStudentGoogleOAuthCallback,
  exchangeStudentGoogleAuth,
} from "../controllers/authController.js";

import { protect } from "../middlewares/authMiddleware.js";
import avatarUpload from "../middlewares/avatarUpload.js";

const router = express.Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many password reset requests. Please try again later.",
  },
});

const passwordResetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many verification attempts. Please try again later.",
  },
});

const passwordResetCompleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many password reset attempts. Please try again later.",
  },
});

const loginAs = (role) => {
  return (req, res, next) => {
    req.allowedLoginRole = role;
    next();
  };
};

const passwordResetAs = (role) => (req, _res, next) => {
  req.passwordResetRole = role;
  next();
};

router.post("/register", otpRequestLimiter, registerUser);
router.post("/verify-register-otp", verifyRegisterOtp);
router.get("/register-otp-status", otpRequestLimiter, getRegisterOtpStatus);
router.post("/resend-register-otp", otpRequestLimiter, resendRegisterOtp);
router.get("/student/google/auth-url", getStudentGoogleAuthUrl);
router.get("/student/google/callback", handleStudentGoogleOAuthCallback);
router.post("/student/google/exchange", exchangeStudentGoogleAuth);

// Role-based login routes
router.post("/student/login", loginLimiter, loginAs("student"), loginUser);
router.post("/teacher/login", loginLimiter, loginAs("teacher"), loginUser);
router.post("/admin/login", loginLimiter, loginAs("admin"), loginUser);
router.post("/support/login", loginLimiter, loginAs("support"), loginUser);
router.post(
  "/student/password-reset/request",
  passwordResetRequestLimiter,
  passwordResetAs("student"),
  requestTeacherPasswordReset,
);
router.post(
  "/student/password-reset/verify",
  passwordResetVerifyLimiter,
  passwordResetAs("student"),
  verifyTeacherPasswordResetOtp,
);
router.post(
  "/student/password-reset/reset",
  passwordResetCompleteLimiter,
  passwordResetAs("student"),
  resetTeacherPassword,
);
router.post(
  "/teacher/password-reset/request",
  passwordResetRequestLimiter,
  passwordResetAs("teacher"),
  requestTeacherPasswordReset,
);
router.post(
  "/teacher/password-reset/verify",
  passwordResetVerifyLimiter,
  passwordResetAs("teacher"),
  verifyTeacherPasswordResetOtp,
);
router.post(
  "/teacher/password-reset/reset",
  passwordResetCompleteLimiter,
  passwordResetAs("teacher"),
  resetTeacherPassword,
);
router.post(
  "/admin/password-reset/request",
  passwordResetRequestLimiter,
  passwordResetAs("admin"),
  requestTeacherPasswordReset,
);
router.post(
  "/admin/password-reset/verify",
  passwordResetVerifyLimiter,
  passwordResetAs("admin"),
  verifyTeacherPasswordResetOtp,
);
router.post(
  "/admin/password-reset/reset",
  passwordResetCompleteLimiter,
  passwordResetAs("admin"),
  resetTeacherPassword,
);

router.get("/profile", protect, getUserProfile);
router.patch(
  "/profile",
  protect,
  avatarUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "cvFile", maxCount: 1 },
    { name: "certificateFiles", maxCount: 5 },
  ]),
  updateUserProfile,
);
router.post("/change-password", protect, changeUserPassword);

export default router;
