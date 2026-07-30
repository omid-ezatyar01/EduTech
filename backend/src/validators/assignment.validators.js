import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

const assignmentTypeSchema = Joi.string().valid("homework", "project", "quiz");
const assignmentStatusSchema = Joi.string().valid("draft", "published", "closed");

export const assignmentIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const assignmentSubmissionParamSchema = Joi.object({
  id: objectId.required(),
  studentId: objectId.required(),
});

export const assignmentListQuerySchema = paginationQuerySchema.keys({
  courseId: objectId,
  includeEnded: Joi.boolean().default(false),
  status: assignmentStatusSchema,
  type: assignmentTypeSchema,
  sortBy: Joi.string().valid("newest", "dueAt", "title").default("newest"),
});

export const assignmentSubmissionListQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("all", "missing", "submitted", "reviewed", "late").default("all"),
});

export const createAssignmentSchema = Joi.object({
  courseId: objectId.required(),
  title: Joi.string().trim().min(3).max(180).required(),
  description: Joi.string().trim().max(4000).allow(""),
  type: assignmentTypeSchema.default("homework"),
  dueAt: Joi.date().greater("now").required(),
  maxScore: Joi.number().min(1).max(1000).default(100),
  status: assignmentStatusSchema.default("draft"),
  allowLateSubmission: Joi.boolean().default(false),
  attachmentUrl: Joi.string().uri().allow(""),
});

export const updateAssignmentSchema = Joi.object({
  courseId: objectId,
  title: Joi.string().trim().min(3).max(180),
  description: Joi.string().trim().max(4000).allow(""),
  type: assignmentTypeSchema,
  dueAt: Joi.date(),
  maxScore: Joi.number().min(1).max(1000),
  status: assignmentStatusSchema,
  allowLateSubmission: Joi.boolean(),
  attachmentUrl: Joi.string().uri().allow(""),
}).min(1);

export const reviewAssignmentSubmissionSchema = Joi.object({
  score: Joi.number().min(0).max(1000).required(),
  feedback: Joi.string().trim().max(3000).allow(""),
});

export const submitAssignmentSchema = Joi.object({
  textAnswer: Joi.string().trim().max(5000).allow(""),
  attachmentUrl: Joi.string().uri().allow(""),
}).custom((value, helpers) => {
  const hasText = String(value?.textAnswer || "").trim().length > 0;
  const hasUrl = String(value?.attachmentUrl || "").trim().length > 0;
  if (!hasText && !hasUrl) {
    return helpers.error("any.invalid", {
      message: "Provide textAnswer or attachmentUrl",
    });
  }
  return value;
}).messages({
  "any.invalid": "{{#message}}",
});
