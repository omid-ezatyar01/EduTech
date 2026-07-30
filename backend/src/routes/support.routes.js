import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createSupportTicket,
  deleteSelectedSupportMessages,
  deleteSupportMessage,
  getAdminSupportTickets,
  getMySupportTickets,
  getSupportTicket,
  markSupportTicketRead,
  reopenSupportTicket,
  sendSupportMessage,
  updateSupportMessage,
  updateAdminSupportTicket,
} from "../controllers/supportController.js";
import {
  createSupportTicketSchema,
  deleteSupportMessagesSchema,
  sendSupportMessageSchema,
  supportMessageIdSchema,
  supportMessageListSchema,
  supportTicketIdSchema,
  supportTicketListSchema,
  reopenSupportTicketSchema,
  updateSupportTicketSchema,
  updateSupportMessageSchema,
} from "../validators/support.validators.js";

const router = express.Router();

router.use(protect);

router.get(
  "/admin/support/tickets",
  authorizeRoles("admin"),
  validateRequest(supportTicketListSchema, "query"),
  getAdminSupportTickets,
);
router.get(
  "/admin/support/tickets/:ticketId",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(supportMessageListSchema, "query"),
  getSupportTicket,
);
router.post(
  "/admin/support/tickets/:ticketId/messages",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(sendSupportMessageSchema),
  sendSupportMessage,
);
router.post(
  "/admin/support/tickets/:ticketId/messages/delete",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(deleteSupportMessagesSchema),
  deleteSelectedSupportMessages,
);
router.patch(
  "/admin/support/tickets/:ticketId/messages/:messageId",
  authorizeRoles("admin"),
  validateRequest(supportMessageIdSchema, "params"),
  validateRequest(updateSupportMessageSchema),
  updateSupportMessage,
);
router.delete(
  "/admin/support/tickets/:ticketId/messages/:messageId",
  authorizeRoles("admin"),
  validateRequest(supportMessageIdSchema, "params"),
  deleteSupportMessage,
);
router.patch(
  "/admin/support/tickets/:ticketId",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(updateSupportTicketSchema),
  updateAdminSupportTicket,
);
router.patch(
  "/admin/support/tickets/:ticketId/read",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  markSupportTicketRead,
);

router.post(
  "/support/tickets",
  authorizeRoles("student", "teacher"),
  validateRequest(createSupportTicketSchema),
  createSupportTicket,
);
router.get("/support/tickets", authorizeRoles("student", "teacher"), getMySupportTickets);
router.get(
  "/support/tickets/:ticketId",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(supportMessageListSchema, "query"),
  getSupportTicket,
);
router.post(
  "/support/tickets/:ticketId/messages",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(sendSupportMessageSchema),
  sendSupportMessage,
);
router.post(
  "/support/tickets/:ticketId/messages/delete",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(deleteSupportMessagesSchema),
  deleteSelectedSupportMessages,
);
router.patch(
  "/support/tickets/:ticketId/messages/:messageId",
  authorizeRoles("student", "teacher"),
  validateRequest(supportMessageIdSchema, "params"),
  validateRequest(updateSupportMessageSchema),
  updateSupportMessage,
);
router.delete(
  "/support/tickets/:ticketId/messages/:messageId",
  authorizeRoles("student", "teacher"),
  validateRequest(supportMessageIdSchema, "params"),
  deleteSupportMessage,
);
router.patch(
  "/support/tickets/:ticketId/read",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  markSupportTicketRead,
);
router.patch(
  "/support/tickets/:ticketId",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(reopenSupportTicketSchema),
  reopenSupportTicket,
);
export default router;
