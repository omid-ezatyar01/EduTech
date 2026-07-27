import express from "express";
import { protect, admin } from "../../middlewares/authMiddleware.js";
import authorizeRoles from "../../middlewares/authorizeRoles.js";
import validateRequest from "../../middlewares/validateRequest.js";
import {
  deleteResolvedSupportTicket,
  deleteSupportMessage,
  getAdminSupportTickets,
  getSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
  updateSupportMessage,
  updateAdminSupportTicket,
} from "../../controllers/supportController.js";
import {
  sendSupportMessageSchema,
  supportMessageIdSchema,
  supportTicketIdSchema,
  supportTicketListSchema,
  updateSupportTicketSchema,
  updateSupportMessageSchema,
} from "../../validators/support.validators.js";
import {
  createSupportStaff,
  deleteGeneralSupportTeamMessages,
  deleteSupportTeamMessage,
  getSupportTeamDirectory,
  getSupportTeamMessages,
  listSupportStaff,
  markSupportTeamConversationRead,
  resetSupportStaffPassword,
  sendSupportTeamMessage,
  updateSupportTeamMessage,
  updateSupportStaff,
} from "./supportStaff.controller.js";
import {
  createSupportStaffSchema,
  deleteSupportTeamMessagesSchema,
  resetSupportStaffPasswordSchema,
  sendSupportTeamMessageSchema,
  supportConversationSchema,
  supportStaffIdSchema,
  supportStaffListSchema,
  supportTeamMessageIdSchema,
  supportTeamMessageListSchema,
  updateSupportTeamMessageSchema,
  updateSupportStaffSchema,
} from "./supportStaff.validators.js";

const router = express.Router();

router.get(
  "/admin/support-staff",
  protect,
  admin,
  validateRequest(supportStaffListSchema, "query"),
  listSupportStaff,
);
router.post(
  "/admin/support-staff",
  protect,
  admin,
  validateRequest(createSupportStaffSchema),
  createSupportStaff,
);
router.patch(
  "/admin/support-staff/:staffId",
  protect,
  admin,
  validateRequest(supportStaffIdSchema, "params"),
  validateRequest(updateSupportStaffSchema),
  updateSupportStaff,
);
router.patch(
  "/admin/support-staff/:staffId/password",
  protect,
  admin,
  validateRequest(supportStaffIdSchema, "params"),
  validateRequest(resetSupportStaffPasswordSchema),
  resetSupportStaffPassword,
);

router.get(
  "/support-staff/team",
  protect,
  authorizeRoles("support", "admin"),
  getSupportTeamDirectory,
);
router.get(
  "/support-staff/team/conversations/:conversationId",
  protect,
  authorizeRoles("support", "admin"),
  validateRequest(supportConversationSchema, "params"),
  validateRequest(supportTeamMessageListSchema, "query"),
  getSupportTeamMessages,
);
router.post(
  "/support-staff/team/conversations/:conversationId",
  protect,
  authorizeRoles("support", "admin"),
  validateRequest(supportConversationSchema, "params"),
  validateRequest(sendSupportTeamMessageSchema),
  sendSupportTeamMessage,
);
router.patch(
  "/support-staff/team/messages/:messageId",
  protect,
  authorizeRoles("support", "admin"),
  validateRequest(supportTeamMessageIdSchema, "params"),
  validateRequest(updateSupportTeamMessageSchema),
  updateSupportTeamMessage,
);
router.delete(
  "/support-staff/team/messages/:messageId",
  protect,
  authorizeRoles("support", "admin"),
  validateRequest(supportTeamMessageIdSchema, "params"),
  deleteSupportTeamMessage,
);
router.delete(
  "/support-staff/team/conversations/general/messages",
  protect,
  admin,
  validateRequest(deleteSupportTeamMessagesSchema),
  deleteGeneralSupportTeamMessages,
);
router.patch(
  "/support-staff/team/conversations/:conversationId/read",
  protect,
  authorizeRoles("support", "admin"),
  validateRequest(supportConversationSchema, "params"),
  markSupportTeamConversationRead,
);
router.use("/support-staff", protect, authorizeRoles("support"));
router.get(
  "/support-staff/tickets",
  validateRequest(supportTicketListSchema, "query"),
  getAdminSupportTickets,
);
router.get(
  "/support-staff/tickets/:ticketId",
  validateRequest(supportTicketIdSchema, "params"),
  getSupportTicket,
);
router.post(
  "/support-staff/tickets/:ticketId/messages",
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(sendSupportMessageSchema),
  sendSupportMessage,
);
router.patch(
  "/support-staff/tickets/:ticketId/messages/:messageId",
  validateRequest(supportMessageIdSchema, "params"),
  validateRequest(updateSupportMessageSchema),
  updateSupportMessage,
);
router.delete(
  "/support-staff/tickets/:ticketId/messages/:messageId",
  validateRequest(supportMessageIdSchema, "params"),
  deleteSupportMessage,
);
router.patch(
  "/support-staff/tickets/:ticketId",
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(updateSupportTicketSchema),
  updateAdminSupportTicket,
);
router.patch(
  "/support-staff/tickets/:ticketId/read",
  validateRequest(supportTicketIdSchema, "params"),
  markSupportTicketRead,
);
router.delete(
  "/support-staff/tickets/:ticketId",
  validateRequest(supportTicketIdSchema, "params"),
  deleteResolvedSupportTicket,
);

export default router;
