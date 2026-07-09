import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
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
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  getGoogleOAuthUrl,
);
router.get(
  "/google/account-status",
  protect,
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  getGoogleAccountStatus,
);
router.get(
  "/google/oauth/callback",
  validateRequest(googleOAuthCallbackQuerySchema, "query"),
  handleGoogleOAuthCallback,
);

export default router;
