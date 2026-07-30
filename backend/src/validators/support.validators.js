import Joi from "joi";
import { objectId } from "./common.validators.js";

const categories = [
  "account",
  "course",
  "payment",
  "technical",
  "teaching",
  "certificate",
  "consultation",
  "registration",
  "feedback",
  "complaint",
  "other",
];
const statuses = ["open", "in_progress", "waiting_for_user", "resolved", "closed"];

export const createSupportTicketSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(160).required(),
  category: Joi.string().valid(...categories).default("other"),
  message: Joi.string().trim().min(2).max(4000).required(),
});

export const supportTicketIdSchema = Joi.object({
  ticketId: objectId.required(),
});

export const supportMessageIdSchema = Joi.object({
  ticketId: objectId.required(),
  messageId: objectId.required(),
});

export const supportMessageListSchema = Joi.object({
  limit: Joi.number().integer().min(10).max(50).default(30),
  before: Joi.date().iso(),
});

export const updateSupportMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
});

export const sendSupportMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
  internalNote: Joi.boolean().default(false),
  replyTo: Joi.alternatives().try(objectId, Joi.valid(null)),
});

export const deleteSupportMessagesSchema = Joi.object({
  messageIds: Joi.array().items(objectId).min(1).max(100).unique().required(),
  scope: Joi.string().valid("me", "everyone").required(),
});

export const supportTicketListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
  status: Joi.string().valid("all", "active", ...statuses).default("all"),
  category: Joi.string().valid("all", ...categories).default("all"),
  requesterRole: Joi.string().valid("all", "student", "teacher").default("all"),
  search: Joi.string().trim().max(120).allow("").default(""),
});

export const updateSupportTicketSchema = Joi.object({
  status: Joi.string().valid(...statuses),
  assignedTo: Joi.alternatives().try(objectId, Joi.valid(null)),
  handoffReason: Joi.string().trim().min(5).max(500),
}).min(1);

export const reopenSupportTicketSchema = Joi.object({
  status: Joi.string().valid("open").required(),
});
