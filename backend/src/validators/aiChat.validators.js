import Joi from "joi";

const chatMessageSchema = Joi.object({
  role: Joi.string().valid("user", "assistant").required(),
  content: Joi.string().trim().max(1200).required(),
});

export const createStudentChatReplySchema = Joi.object({
  messages: Joi.array().items(chatMessageSchema).min(1).max(12).required(),
  context: Joi.object({
    path: Joi.string().trim().max(200).allow(""),
    pageTitle: Joi.string().trim().max(120).allow(""),
    courseId: Joi.string().trim().max(80).allow(""),
  }).default({}),
});
