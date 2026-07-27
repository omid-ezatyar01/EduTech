import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

const CONTACT_MESSAGE_MAX_LENGTH = 1000;

export const createContactMessageSchema = Joi.object({
  subject: Joi.string().trim().min(2).max(160).required(),
  message: Joi.string().trim().min(5).max(CONTACT_MESSAGE_MAX_LENGTH).required(),
});

export const adminMessagesQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("new", "pending", "replied", "resolved", "all").default("all"),
});

export const messageIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const updateMessageStatusSchema = Joi.object({
  status: Joi.string().valid("new", "pending", "replied", "resolved").required(),
});

export const replyContactMessageSchema = Joi.object({
  subject: Joi.string().trim().min(2).max(200).allow(""),
  message: Joi.string().trim().min(2).max(4000).required(),
});

export const sendAdminEmailSchema = Joi.object({
  recipientRole: Joi.string().valid("student", "teacher").required(),
  recipientEmail: Joi.string().email().trim().lowercase().required(),
  subject: Joi.string().trim().min(2).max(200).required(),
  message: Joi.string().trim().min(2).max(4000).required(),
});
