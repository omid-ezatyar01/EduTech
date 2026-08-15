import Joi from "joi";
import { objectId } from "./common.validators.js";

const localizedText = Joi.object({
  fa: Joi.string().trim().max(180).allow("").default(""),
  en: Joi.string().trim().max(180).allow("").default(""),
});

const destinationLink = Joi.string()
  .trim()
  .max(2048)
  .allow("")
  .custom((value, helpers) => {
    if (!value) return value;
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    try {
      if (["http:", "https:"].includes(new URL(value).protocol)) return value;
    } catch {
      // The validation error below provides one consistent client message.
    }
    return helpers.message({ custom: "Link must be an internal path or a valid http(s) URL" });
  });

const fields = {
  mediaType: Joi.string().valid("image"),
  mediaUrl: Joi.string().trim().max(1000),
  linkUrl: destinationLink,
  title: localizedText,
  altText: localizedText,
  status: Joi.string().valid("active", "inactive"),
  sortOrder: Joi.number().integer().min(0).max(10000),
  displayDurationSeconds: Joi.number().min(3).max(30),
};

export const createHeroMediaSchema = Joi.object({
  ...fields,
  mediaType: fields.mediaType.required(),
  mediaUrl: fields.mediaUrl.required(),
  status: fields.status.default("active"),
  sortOrder: fields.sortOrder.default(0),
  displayDurationSeconds: fields.displayDurationSeconds.default(6),
});

export const updateHeroMediaSchema = Joi.object(fields).min(1);
export const heroMediaIdParamSchema = Joi.object({ id: objectId.required() });
