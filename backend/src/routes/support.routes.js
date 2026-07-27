import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createSupportTicket,
  getAdminSupportTickets,
  getMySupportTickets,
  getSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
  updateAdminSupportTicket,
  updateOwnSupportTicket,
} from "../controllers/supportController.js";
import {
  createSupportTicketSchema,
  requesterTicketActionSchema,
  sendSupportMessageSchema,
  supportTicketIdSchema,
  supportTicketListSchema,
  updateSupportTicketSchema,
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
  getSupportTicket,
);
router.post(
  "/admin/support/tickets/:ticketId/messages",
  authorizeRoles("admin"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(sendSupportMessageSchema),
  sendSupportMessage,
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
  getSupportTicket,
);
router.post(
  "/support/tickets/:ticketId/messages",
  authorizeRoles("student", "teacher"),
  validateRequest(supportTicketIdSchema, "params"),
  validateRequest(sendSupportMessageSchema),
  sendSupportMessage,
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
  validateRequest(requesterTicketActionSchema),
  updateOwnSupportTicket,
);

export default router;
