import Joi from "joi";
import { objectId } from "./common.validators.js";

export const paymentIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const paymentAttemptIdParamSchema = Joi.object({
  paymentAttemptId: objectId.required(),
});

export const paymentOrderIdParamSchema = Joi.object({
  orderId: objectId.required(),
});

export const courseIdParamSchema = Joi.object({
  courseId: objectId.required(),
});

export const paymentStatusParamSchema = Joi.object({
  reference: Joi.string().trim().min(8).required(),
});

export const checkoutSchema = Joi.object({
  courseId: objectId.required(),
  paymentMethod: Joi.string().valid("HESABPAY_HOSTED", "USDT_BSC_DIRECT").required(),
  pricingRegion: Joi.string().valid("afghanistan", "iran", "international"),
  couponCode: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]{2,31}$/).allow(""),
  restartExpired: Joi.boolean().default(false),
}).required();

export const submitBankTransferPaymentSchema = Joi.object({
  courseId: objectId.required(),
  countryCode: Joi.string().trim().uppercase().valid("AF", "IR").required(),
  couponCode: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]{2,31}$/).allow(""),
  senderAccount: Joi.string().trim().max(80).allow(""),
  note: Joi.string().trim().max(500).allow(""),
}).required();

export const bankTransferReviewSchema = Joi.object({
  note: Joi.string().trim().max(500).allow(""),
}).required();

export const verifyDirectCryptoSchema = Joi.object({
  txHash: Joi.string()
    .trim()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .required()
    .messages({
      "string.empty": "Transaction hash is required",
      "string.pattern.base": "Enter a valid blockchain transaction hash that starts with 0x",
      "any.required": "Transaction hash is required",
    }),
}).required();

export const verifyPaymentSchema = Joi.object({
  transactionId: Joi.string().trim().allow(""),
  note: Joi.string().trim().allow(""),
  paymentMethod: Joi.string().valid("cash", "bank_transfer", "hesabpay", "stripe", "paypal", "manual", "nowpayments_crypto"),
}).required();

export const rejectPaymentSchema = Joi.object({
  note: Joi.string().trim().min(3).required(),
});

export const adminPaymentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid("pending", "paid", "failed", "refunded", "cancelled"),
  search: Joi.string().trim().allow(""),
});

export const teacherBankTransferPaymentsQuerySchema = Joi.object({
  status: Joi.string().valid("pending_teacher_review", "approved_by_teacher", "rejected_by_teacher").allow(""),
});

export const teacherIncomeQuerySchema = Joi.object({
  month: Joi.string().trim().pattern(/^\d{4}-\d{2}$/).allow(""),
  courseId: objectId.allow(""),
  paymentPlan: Joi.string().valid("monthly", "whole_period").allow(""),
  payoutStatus: Joi.string().valid("paid", "unpaid").allow(""),
});

export const adminTeacherIncomeQuerySchema = Joi.object({
  month: Joi.string().trim().pattern(/^\d{4}-\d{2}$/).allow(""),
  teacherId: objectId.allow(""),
  courseId: objectId.allow(""),
  paymentPlan: Joi.string().valid("monthly", "whole_period").allow(""),
  payoutStatus: Joi.string().valid("paid", "unpaid").allow(""),
  search: Joi.string().trim().allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const updateTeacherIncomeSettlementSchema = Joi.object({
  teacherId: objectId.required(),
  courseId: objectId.required(),
  monthKey: Joi.string().trim().pattern(/^\d{4}-\d{2}$/).required(),
  cycleStartDay: Joi.number().integer().valid(1, 15).required(),
  status: Joi.string().valid("paid", "unpaid").required(),
  note: Joi.string().trim().allow(""),
}).required();
