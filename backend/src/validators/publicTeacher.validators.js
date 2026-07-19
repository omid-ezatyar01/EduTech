import Joi from "joi";

const optionalFilterText = Joi.string().trim().min(1).max(100);

export const publicTeacherListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(60).default(12),
  search: Joi.string().trim().allow(""),
  language: optionalFilterText,
  expertise: optionalFilterText,
  teachingLevel: optionalFilterText,
  country: optionalFilterText,
  minExperience: Joi.number().integer().min(0).max(80),
  hasIntroVideo: Joi.boolean(),
  sortBy: Joi.string().valid("newest", "experience", "name").default("newest"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});
