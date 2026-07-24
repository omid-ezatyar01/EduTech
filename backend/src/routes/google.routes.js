import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  getGoogleAccountStatus,
  getGoogleOAuthUrl,
  handleGoogleOAuthCallback,
} from "../controllers/googleCalendarController.js";
import { googleOAuthCallbackQuerySchema } from "../validators/liveSession.validators.js";

const router = express.Router();

router.get(
  "/google/auth-url",
  protect,
  authorizeRoles("student", "teacher", "admin"),
  getGoogleOAuthUrl,
);
router.get(
  "/google/account-status",
  protect,
  authorizeRoles("student", "teacher", "admin"),
  getGoogleAccountStatus,
);
router.get(
  "/google/oauth/callback",
  validateRequest(googleOAuthCallbackQuerySchema, "query"),
  handleGoogleOAuthCallback,
);

export default router;
