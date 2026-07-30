import Joi from "joi";
import { objectId, paginationQuerySchema } from "./common.validators.js";

const code = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)
  .required();

const couponFields = {
  code,
  title: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(500).allow("").default(""),
  type: Joi.string().valid("percent", "fixed").required(),
  discountValue: Joi.number().positive().required(),
  minimumPurchaseUsd: Joi.number().min(0).max(100000).default(0),
  usageLimit: Joi.number().integer().min(1).max(1000000).allow(null).default(null),
  perUserLimit: Joi.number().integer().min(1).max(100).default(1),
  startsAt: Joi.date().iso().allow(null),
  expiresAt: Joi.date().iso().allow(null),
  status: Joi.string().valid("active", "inactive").default("active"),
  courseIds: Joi.array().items(objectId).unique().max(500).default([]),
};

const validateCouponLogic = (value, helpers) => {
  if (value.type === "percent" && value.discountValue > 90) {
    return helpers.message("Percentage coupons cannot exceed 90%");
  }
  if (
    value.startsAt &&
    value.expiresAt &&
    new Date(value.expiresAt) <= new Date(value.startsAt)
  ) {
    return helpers.message("Coupon expiry must be after its start date");
  }
  return value;
};

export const createCouponSchema = Joi.object(couponFields)
  .custom(validateCouponLogic)
  .required();

export const updateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
  title: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(500).allow(""),
  type: Joi.string().valid("percent", "fixed"),
  discountValue: Joi.number().positive(),
  minimumPurchaseUsd: Joi.number().min(0).max(100000),
  usageLimit: Joi.number().integer().min(1).max(1000000).allow(null),
  perUserLimit: Joi.number().integer().min(1).max(100),
  startsAt: Joi.date().iso().allow(null),
  expiresAt: Joi.date().iso().allow(null),
  status: Joi.string().valid("active", "inactive"),
  courseIds: Joi.array().items(objectId).unique().max(500),
})
  .min(1)
  .custom(validateCouponLogic)
  .required();

export const adminCouponsQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid("active", "inactive", "scheduled", "expired", "used_up", ""),
  type: Joi.string().valid("percent", "fixed", ""),
});

export const couponIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const validateCouponSchema = Joi.object({
  code,
  courseId: objectId.required(),
  pricingRegion: Joi.string().valid("afghanistan", "iran", "international"),
}).required();
