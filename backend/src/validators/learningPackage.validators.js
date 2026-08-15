import Joi from "joi";
import { objectId } from "./common.validators.js";

const localizedTitle = Joi.object({
  fa: Joi.string().trim().max(120).allow("").default(""),
  en: Joi.string().trim().max(120).allow("").default(""),
}).custom((value, helpers) =>
  value.fa || value.en ? value : helpers.message("At least one package title is required"),
);

const localizedDescription = Joi.object({
  fa: Joi.string().trim().max(1200).allow("").default(""),
  en: Joi.string().trim().max(1200).allow("").default(""),
}).default({ fa: "", en: "" });

const stepSchema = Joi.object({
  _id: objectId,
  title: localizedTitle.required(),
  description: localizedDescription,
  courses: Joi.array().items(objectId).max(20).unique().required(),
});

const fields = {
  title: localizedTitle,
  description: localizedDescription,
  coverImage: Joi.string()
    .trim()
    .max(500)
    .pattern(/^\/uploads\/learning-package-covers\/[\w.-]+\.webp$/)
    .allow(""),
  status: Joi.string().valid("draft", "published"),
  steps: Joi.array().items(stepSchema).min(1).max(20),
};

export const createLearningPackageSchema = Joi.object({
  ...fields,
  title: fields.title.required(),
  status: fields.status.default("draft"),
  steps: fields.steps.required(),
});

export const updateLearningPackageSchema = Joi.object(fields).min(1);
export const learningPackageIdParamsSchema = Joi.object({ id: objectId.required() });
export const learningPackageSlugParamsSchema = Joi.object({
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).max(180).required(),
});
