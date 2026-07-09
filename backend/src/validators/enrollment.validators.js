import Joi from "joi";
import { objectId } from "./common.validators.js";

export const enrollCourseParamSchema = Joi.object({
  id: objectId.required(),
});

export const certificateIdParamSchema = Joi.object({
  certificateId: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^ED-\d{4}-[A-Z0-9]{3,12}$/)
    .required()
    .messages({
      "string.empty": "Certificate ID is required.",
      "string.pattern.base": "Please enter a valid certificate ID (example: ED-2026-6FB).",
      "any.required": "Certificate ID is required.",
    }),
});
