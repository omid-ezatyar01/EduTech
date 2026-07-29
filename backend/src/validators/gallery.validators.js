import Joi from "joi";
import { objectId } from "./common.validators.js";

const persianTitle = Joi.object({
  fa: Joi.string().trim().min(1).max(160).required(),
});

const category = Joi.string()
  .trim()
  .lowercase()
  .max(60)
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const fields = {
  title: persianTitle,
  category,
  image: Joi.string().trim().max(1000),
  status: Joi.string().valid("draft", "published"),
};

export const createGalleryImageSchema = Joi.object({
  ...fields,
  category: category.required(),
  image: fields.image.required(),
  status: fields.status.default("published"),
});

export const updateGalleryImageSchema = Joi.object(fields).min(1);

export const createGalleryCategorySchema = Joi.object({
  name: category.required(),
});

export const galleryImageIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const publicGalleryQuerySchema = Joi.object({
  category: category.allow("all").default("all"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(48),
});

export const adminGalleryQuerySchema = Joi.object({
  category: category.allow("all").default("all"),
  status: Joi.string().valid("all", "draft", "published").default("all"),
});
