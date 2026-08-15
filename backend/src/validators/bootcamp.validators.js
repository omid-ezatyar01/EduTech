import Joi from "joi";
import { objectId } from "./common.validators.js";

const localizedTitle = Joi.object({
  fa: Joi.string().trim().max(160).allow("").default(""),
  en: Joi.string().trim().max(160).allow("").default(""),
}).custom((value, helpers) =>
  value.fa || value.en ? value : helpers.message("At least one bootcamp title is required"),
);

const localizedDescription = Joi.object({
  fa: Joi.string().trim().max(1600).allow("").default(""),
  en: Joi.string().trim().max(1600).allow("").default(""),
}).default({ fa: "", en: "" });

const optionalDate = Joi.date().iso().allow(null, "");
const coverImage = Joi.string().trim().max(1000).allow("").custom((value, helpers) => {
  if (!value) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    if (["http:", "https:"].includes(new URL(value).protocol)) return value;
  } catch {
    // Use the common validation message below.
  }
  return helpers.message("Cover image must be an internal path or http(s) URL");
});

const fields = {
  title: localizedTitle,
  description: localizedDescription,
  teacherId: objectId,
  coverImage,
  status: Joi.string().valid("draft", "registration_open", "registration_closed", "in_progress", "completed", "cancelled"),
  minimumStudents: Joi.number().integer().min(1).max(2000),
  maximumStudents: Joi.number().integer().min(1).max(2000),
  registrationOpensAt: optionalDate,
  registrationClosesAt: optionalDate,
  plannedStartAt: optionalDate,
};

const validateLimits = (value, helpers) => {
  if (
    value.minimumStudents !== undefined &&
    value.maximumStudents !== undefined &&
    Number(value.minimumStudents) > Number(value.maximumStudents)
  ) {
    return helpers.message("Minimum students cannot exceed maximum students");
  }
  if (
    value.registrationOpensAt &&
    value.registrationClosesAt &&
    new Date(value.registrationClosesAt) <= new Date(value.registrationOpensAt)
  ) {
    return helpers.message("Registration closing time must be after opening time");
  }
  return value;
};

export const createBootcampSchema = Joi.object({
  ...fields,
  title: fields.title.required(),
  teacherId: fields.teacherId.required(),
  status: fields.status.default("draft"),
  minimumStudents: fields.minimumStudents.default(10),
  maximumStudents: fields.maximumStudents.default(100),
}).custom(validateLimits);

export const updateBootcampSchema = Joi.object(fields).min(1).custom(validateLimits);
export const bootcampIdParamsSchema = Joi.object({ id: objectId.required() });
export const bootcampSlugParamsSchema = Joi.object({
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).max(180).required(),
});

export const registerBootcampSchema = Joi.object({
  phone: Joi.string().trim().min(5).max(40).required(),
  country: Joi.string().trim().min(2).max(100).required(),
  experienceLevel: Joi.string().valid("beginner", "intermediate", "advanced").default("beginner"),
  motivation: Joi.string().trim().max(1000).allow("").default(""),
  preferredSchedule: Joi.string().trim().max(300).allow("").default(""),
  consent: Joi.boolean().valid(true).required(),
  source: Joi.string().trim().max(100).default("public_form"),
});
