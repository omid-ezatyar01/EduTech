import Joi from "joi";
import { objectId } from "./common.validators.js";

const optionalObjectId = Joi.alternatives().try(objectId, Joi.valid("", null));

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().trim().allow(""),
  parent: optionalObjectId,
  isActive: Joi.boolean().default(true),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().trim().allow(""),
  parent: optionalObjectId,
  isActive: Joi.boolean(),
}).min(1);

export const categoryIdParamSchema = Joi.object({
  id: objectId.required(),
});
