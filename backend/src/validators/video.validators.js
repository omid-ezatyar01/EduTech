import Joi from "joi";
import { objectId } from "./common.validators.js";

const fields = {
  title: Joi.string().trim().max(80),
  url: Joi.string().trim().max(500),
  isPublished: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0).max(100000),
};

export const createVideoSchema = Joi.object({
  ...fields,
  title: fields.title.required(),
  url: fields.url.required(),
  isPublished: fields.isPublished.default(true),
  sortOrder: fields.sortOrder.default(0),
});

export const updateVideoSchema = Joi.object(fields).min(1);
export const videoIdParamSchema = Joi.object({ id: objectId.required() });

export const publicVideoQuerySchema = Joi.object({
  platform: Joi.string().valid("all", "youtube", "instagram").default("all"),
  sort: Joi.string().valid("popular", "newest", "trending").default("popular"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(12).default(6),
});

export const studentVideoQuerySchema = publicVideoQuerySchema.keys({
  feed: Joi.string().valid("following", "saved").required(),
});
