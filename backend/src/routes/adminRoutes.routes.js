import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  getOtpEmailStatuses,
  createUserByAdmin,
  createTeacherByAdmin,
  getAllTeachers,
  getTeacherById,
  updateTeacherByAdmin,
  reviewTeacherApplicationByAdmin,
  deleteTeacherByAdmin,
  getUserById,
  updateUserByAdmin,
  deleteUserByAdmin,
  getAdminPlatformSettings,
  updateAdminPlatformSettings,
} from "../controllers/adminController.js";
import {
  replyAdminMessage,
  sendAdminEmailToUser,
} from "../controllers/contactMessageController.js";
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../controllers/adminNotificationController.js";
import {
  getAdminTelegramPosts,
  getAdminTelegramSettings,
  sendAdminTelegramTestPost,
  updateAdminTelegramSettings,
} from "../controllers/adminTelegramController.js";

import { protect, admin } from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  adminEntityIdParamSchema,
  adminPlatformSettingsSchema,
  adminTelegramPostsQuerySchema,
  adminTelegramSettingsSchema,
  adminTeachersQuerySchema,
  adminUsersQuerySchema,
} from "../validators/admin.validators.js";
import {
  messageIdParamSchema,
  replyContactMessageSchema,
  sendAdminEmailSchema,
} from "../validators/contactMessage.validators.js";

const router = express.Router();

// Every route below this line requires login + admin role
router.use(protect);
router.use(admin);

router.get("/dashboard", getAdminDashboard);
router.get("/notifications", getAdminNotifications);
router.patch("/notifications/read-all", markAllAdminNotificationsRead);
router.patch(
  "/notifications/:id/read",
  validateRequest(adminEntityIdParamSchema, "params"),
  markAdminNotificationRead,
);
router.get("/settings", getAdminPlatformSettings);
router.patch("/settings", validateRequest(adminPlatformSettingsSchema), updateAdminPlatformSettings);
router.get("/telegram/settings", getAdminTelegramSettings);
router.put(
  "/telegram/settings",
  validateRequest(adminTelegramSettingsSchema),
  updateAdminTelegramSettings,
);
router.post("/telegram/test-post", sendAdminTelegramTestPost);
router.get(
  "/telegram/posts",
  validateRequest(adminTelegramPostsQuerySchema, "query"),
  getAdminTelegramPosts,
);
router.get("/otp-email-statuses", getOtpEmailStatuses);

router.post(
  "/messages/email",
  validateRequest(sendAdminEmailSchema),
  sendAdminEmailToUser,
);

router.post(
  "/messages/:id/reply",
  validateRequest(messageIdParamSchema, "params"),
  validateRequest(replyContactMessageSchema),
  replyAdminMessage,
);

router
  .route("/teachers")
  .get(validateRequest(adminTeachersQuerySchema, "query"), getAllTeachers)
  .post(createTeacherByAdmin);

router
  .route("/teachers/:id")
  .get(validateRequest(adminEntityIdParamSchema, "params"), getTeacherById)
  .patch(validateRequest(adminEntityIdParamSchema, "params"), updateTeacherByAdmin)
  .delete(validateRequest(adminEntityIdParamSchema, "params"), deleteTeacherByAdmin);

router.post(
  "/teachers/:id/application-review",
  validateRequest(adminEntityIdParamSchema, "params"),
  reviewTeacherApplicationByAdmin,
);

router
  .route("/users")
  .get(validateRequest(adminUsersQuerySchema, "query"), getAllUsers)
  .post(createUserByAdmin);

router
  .route("/users/:id")
  .get(validateRequest(adminEntityIdParamSchema, "params"), getUserById)
  .patch(validateRequest(adminEntityIdParamSchema, "params"), updateUserByAdmin)
  .delete(validateRequest(adminEntityIdParamSchema, "params"), deleteUserByAdmin);

export default router;
