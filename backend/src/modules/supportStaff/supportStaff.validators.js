import Joi from "joi";
import { objectId } from "../../validators/common.validators.js";
import { SUPPORT_SPECIALIZATIONS } from "./supportStaff.constants.js";

const strongPassword = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[a-z]/, "lowercase letter")
  .pattern(/[A-Z]/, "uppercase letter")
  .pattern(/[0-9]/, "number")
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.name":
      "Password must include an uppercase letter, a lowercase letter, and a number",
  });

export const supportStaffIdSchema = Joi.object({
  staffId: objectId.required(),
});

export const supportStaffListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().valid("all", "active", "blocked").default("all"),
  specialization: Joi.string()
    .valid("all", ...SUPPORT_SPECIALIZATIONS)
    .default("all"),
  search: Joi.string().trim().max(120).allow("").default(""),
});

export const createSupportStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email().trim().lowercase().required(),
  phone: Joi.string().trim().min(5).max(40).required(),
  password: strongPassword,
  specialization: Joi.string()
    .valid(...SUPPORT_SPECIALIZATIONS)
    .required(),
});

export const updateSupportStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  phone: Joi.string().trim().min(5).max(40),
  status: Joi.string().valid("active", "blocked"),
  specialization: Joi.string().valid(...SUPPORT_SPECIALIZATIONS),
}).min(1);

export const resetSupportStaffPasswordSchema = Joi.object({
  password: strongPassword,
});

export const supportConversationSchema = Joi.object({
  conversationId: Joi.alternatives()
    .try(Joi.string().valid("general"), objectId)
    .required(),
});

export const supportTeamMessageListSchema = Joi.object({
  limit: Joi.number().integer().min(10).max(50).default(30),
  before: Joi.date().iso(),
});

export const sendSupportTeamMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
  replyTo: Joi.alternatives().try(objectId, Joi.valid(null)),
});

export const supportTeamMessageIdSchema = Joi.object({
  messageId: objectId.required(),
});

export const updateSupportTeamMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
});

export const deleteSupportTeamMessagesSchema = Joi.object({
  messageIds: Joi.array().items(objectId).min(1).max(100),
  all: Joi.boolean().default(false),
}).custom((value, helpers) => {
  if (!value.all && !value.messageIds?.length) {
    return helpers.error("object.missing");
  }
  return value;
});

export const deleteSelectedSupportTeamMessagesSchema = Joi.object({
  messageIds: Joi.array().items(objectId).min(1).max(100).unique().required(),
  scope: Joi.string().valid("me", "everyone").required(),
});
