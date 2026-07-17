import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

export const conversationListQuerySchema = paginationQuerySchema.keys({
  courseId: objectId,
  unreadOnly: Joi.boolean().default(false),
});

export const teacherConversationParamSchema = Joi.object({
  studentId: objectId.required(),
});

export const adminTeacherConversationParamSchema = Joi.object({
  teacherId: objectId.required(),
});

export const teacherCourseParamSchema = Joi.object({
  courseId: objectId.required(),
});

export const studentConversationParamSchema = Joi.object({
  teacherId: objectId.required(),
});

export const conversationMessageListQuerySchema = paginationQuerySchema.keys({
  before: Joi.date().iso(),
});

export const sendMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
  courseId: objectId,
});

export const teacherCourseBroadcastSchema = Joi.object({
  courseId: objectId.required(),
  body: Joi.string().trim().min(1).max(4000).required(),
});

export const teacherMessageSettingsSchema = Joi.object({
  allowStudentDirectMessages: Joi.boolean().required(),
});

export const teacherCourseGroupMessageSettingsSchema = Joi.object({
  allowStudentGroupMessages: Joi.boolean().required(),
});

export const groupMessageDeleteSchema = Joi.object({
  clearAll: Joi.boolean().default(false),
  messageIds: Joi.array()
    .items(Joi.string().trim().pattern(/^(group|msg):[a-fA-F0-9]{24}$/))
    .default([]),
}).custom((value, helpers) => {
  if (!value.clearAll && (!Array.isArray(value.messageIds) || !value.messageIds.length)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "clear-all or selected-messages validation");

export const studentCourseGroupSendSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
});
