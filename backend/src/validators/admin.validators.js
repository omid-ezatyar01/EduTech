import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

export const adminEntityIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const adminUsersQuerySchema = paginationQuerySchema.keys({
  role: Joi.string().valid("student", "teacher", "admin"),
  status: Joi.string().valid("active", "blocked", "pending_verification"),
  isEmailVerified: Joi.string().valid("true", "false", ""),
});

export const adminTeachersQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("active", "blocked", "pending_verification"),
});

export const adminTeacherBankReviewsQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("pending", "approved", "rejected", "not_submitted", ""),
});

export const adminTeacherBankReviewDecisionSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),
  note: Joi.string().trim().max(1000).allow("").default(""),
}).custom((value, helpers) => {
  if (value.decision === "rejected" && !String(value.note || "").trim()) {
    return helpers.message("A rejection reason is required");
  }
  return value;
});

export const adminCertificatesQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("approved", "rejected", ""),
});

export const adminCertificateDecisionSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),
  reason: Joi.string().trim().max(1000).allow("").default(""),
});

export const adminPlatformSettingsSchema = Joi.object({
  teacherDeductionPercentage: Joi.number().min(0).max(100).required(),
  minTeacherCoursePrice: Joi.number().min(0).max(10000).required(),
  globalCourseDiscountPercentage: Joi.number().min(0).max(100).required(),
});

export const adminTelegramSettingsSchema = Joi.object({
  autoPostCourses: Joi.boolean().required(),
  autoPostTeachers: Joi.boolean().required(),
  autoPostEvents: Joi.boolean().required(),
});

export const adminTelegramPostsQuerySchema = paginationQuerySchema.keys({
  limit: Joi.number().integer().min(1).max(100).default(50),
});
