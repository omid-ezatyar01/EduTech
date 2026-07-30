import express from "express";
import {
  getAdminDashboard,
  getAdminReports,
  getAllUsers,
  createUserByAdmin,
  createTeacherByAdmin,
  getAllTeachers,
  getTeacherById,
  updateTeacherByAdmin,
  reviewTeacherApplicationByAdmin,
  getTeacherBankPaymentReviews,
  reviewTeacherBankPaymentInfoByAdmin,
  deleteTeacherByAdmin,
  getUserById,
  updateUserByAdmin,
  deleteUserByAdmin,
  getAdminPlatformSettings,
  updateAdminPlatformSettings,
  getAdminCertificates,
  reviewAdminCertificate,
} from "../controllers/adminController.js";
import {
  replyAdminMessage,
  sendAdminEmailToUser,
} from "../controllers/contactMessageController.js";
import {
  getAdminTeacherConversationMessages,
  getAdminTeacherConversations,
  markAdminTeacherConversationRead,
  sendAdminTeacherMessage,
} from "../controllers/adminTeacherMessageController.js";
import {
  deleteAdminNotification,
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
import {
  createAdminCoupon,
  deactivateAdminCoupon,
  getAdminCouponUsage,
  getAdminCoupons,
  getCouponCourseOptions,
  updateAdminCoupon,
} from "../controllers/couponController.js";

import { protect, admin } from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  adminEntityIdParamSchema,
  adminPlatformSettingsSchema,
  adminReportsQuerySchema,
  adminTelegramPostsQuerySchema,
  adminTelegramSettingsSchema,
  adminTeachersQuerySchema,
  adminUsersQuerySchema,
  adminCertificatesQuerySchema,
  adminCertificateDecisionSchema,
  adminTeacherBankReviewsQuerySchema,
  adminTeacherBankReviewDecisionSchema,
} from "../validators/admin.validators.js";
import {
  messageIdParamSchema,
  replyContactMessageSchema,
  sendAdminEmailSchema,
} from "../validators/contactMessage.validators.js";
import {
  adminTeacherConversationParamSchema,
  sendMessageSchema,
} from "../validators/message.validators.js";
import {
  adminCouponsQuerySchema,
  couponIdParamSchema,
  createCouponSchema,
  updateCouponSchema,
} from "../validators/coupon.validators.js";

const router = express.Router();

// Every route below this line requires login + admin role
router.use(protect);
router.use(admin);

router.get("/dashboard", getAdminDashboard);
router.get(
  "/reports",
  validateRequest(adminReportsQuerySchema, "query"),
  getAdminReports,
);
router.get(
  "/coupons",
  validateRequest(adminCouponsQuerySchema, "query"),
  getAdminCoupons,
);
router.get("/coupons/course-options", getCouponCourseOptions);
router.post("/coupons", validateRequest(createCouponSchema), createAdminCoupon);
router.patch(
  "/coupons/:id",
  validateRequest(couponIdParamSchema, "params"),
  validateRequest(updateCouponSchema),
  updateAdminCoupon,
);
router.delete(
  "/coupons/:id",
  validateRequest(couponIdParamSchema, "params"),
  deactivateAdminCoupon,
);
router.get(
  "/coupons/:id/usage",
  validateRequest(couponIdParamSchema, "params"),
  getAdminCouponUsage,
);
router.get("/notifications", getAdminNotifications);
router.patch("/notifications/read-all", markAllAdminNotificationsRead);
router.patch(
  "/notifications/:id/read",
  validateRequest(adminEntityIdParamSchema, "params"),
  markAdminNotificationRead,
);
router.delete(
  "/notifications/:id",
  validateRequest(adminEntityIdParamSchema, "params"),
  deleteAdminNotification,
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
router.get(
  "/certificates",
  validateRequest(adminCertificatesQuerySchema, "query"),
  getAdminCertificates,
);
router.patch(
  "/certificates/:id/review",
  validateRequest(adminEntityIdParamSchema, "params"),
  validateRequest(adminCertificateDecisionSchema),
  reviewAdminCertificate,
);

router.post(
  "/messages/email",
  validateRequest(sendAdminEmailSchema),
  sendAdminEmailToUser,
);

router.get("/messages/teacher-conversations", getAdminTeacherConversations);

router.get(
  "/messages/teacher-conversations/:teacherId/messages",
  validateRequest(adminTeacherConversationParamSchema, "params"),
  getAdminTeacherConversationMessages,
);

router.post(
  "/messages/teacher-conversations/:teacherId/messages",
  validateRequest(adminTeacherConversationParamSchema, "params"),
  validateRequest(sendMessageSchema),
  sendAdminTeacherMessage,
);

router.patch(
  "/messages/teacher-conversations/:teacherId/read",
  validateRequest(adminTeacherConversationParamSchema, "params"),
  markAdminTeacherConversationRead,
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
router.get(
  "/teacher-bank-reviews",
  validateRequest(adminTeacherBankReviewsQuerySchema, "query"),
  getTeacherBankPaymentReviews,
);
router.patch(
  "/teachers/:id/bank-payment-review",
  validateRequest(adminEntityIdParamSchema, "params"),
  validateRequest(adminTeacherBankReviewDecisionSchema),
  reviewTeacherBankPaymentInfoByAdmin,
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
