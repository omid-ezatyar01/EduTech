import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  getAdminMessages,
  replyAdminMessage,
  sendAdminEmailToUser,
  updateAdminMessageStatus,
} from "../controllers/contactMessageController.js";
import {
  adminMessagesQuerySchema,
  createContactMessageSchema,
  messageIdParamSchema,
  replyContactMessageSchema,
  sendAdminEmailSchema,
  updateMessageStatusSchema,
} from "../validators/contactMessage.validators.js";
import { createSupportTicket } from "../controllers/supportController.js";

const router = express.Router();

router.post(
  "/contact/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(createContactMessageSchema),
  createSupportTicket,
);

router.get(
  "/admin/messages",
  protect,
  authorizeRoles("admin"),
  validateRequest(adminMessagesQuerySchema, "query"),
  getAdminMessages,
);

router.patch(
  "/admin/messages/:id/status",
  protect,
  authorizeRoles("admin"),
  validateRequest(messageIdParamSchema, "params"),
  validateRequest(updateMessageStatusSchema),
  updateAdminMessageStatus,
);

router.post(
  "/admin/messages/:id/reply",
  protect,
  authorizeRoles("admin"),
  validateRequest(messageIdParamSchema, "params"),
  validateRequest(replyContactMessageSchema),
  replyAdminMessage,
);

router.post(
  "/admin/messages/email",
  protect,
  authorizeRoles("admin"),
  validateRequest(sendAdminEmailSchema),
  sendAdminEmailToUser,
);

export default router;
