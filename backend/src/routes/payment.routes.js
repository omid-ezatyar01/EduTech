import express from "express";
import {
  approveTeacherBankTransferPayment,
  confirmStudentPaymentRedirect,
  createCheckout,
  createHesabPaySession,
  getCourseBankPaymentDetails,
  getTeacherBankTransferPayments,
  getUsdExchangeQuote,
  getUsdExchangeRates,
  getUsdToAfnQuote,
  getStudentPaymentHistory,
  getStudentPaymentStatus,
  getTeacherEarnings,
  hesabPayWebhook,
  nowPaymentsWebhook,
  rejectTeacherBankTransferPayment,
  submitBankTransferPayment,
  verifyDirectCryptoPayment,
} from "../controllers/payment.controller.js";
import { allowRoles, protect } from "../middlewares/authMiddleware.js";
import paymentProofUpload from "../middlewares/paymentProofUpload.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  bankTransferReviewSchema,
  checkoutSchema,
  courseIdParamSchema,
  paymentIdParamSchema,
  submitBankTransferPaymentSchema,
  teacherBankTransferPaymentsQuerySchema,
  teacherIncomeQuerySchema,
  paymentAttemptIdParamSchema,
  paymentStatusParamSchema,
  verifyDirectCryptoSchema,
} from "../validators/payment.validators.js";

const router = express.Router();

router.get("/exchange/quote", getUsdExchangeQuote);
router.get("/exchange/rates", getUsdExchangeRates);
router.get("/exchange/usd-afn", getUsdToAfnQuote);
router.get(
  "/payments/course-bank-details/:courseId",
  protect,
  allowRoles("student"),
  validateRequest(courseIdParamSchema, "params"),
  getCourseBankPaymentDetails,
);
router.post("/payments/checkout", protect, allowRoles("student"), validateRequest(checkoutSchema), createCheckout);
router.post(
  "/payments/bank-transfer/submit",
  protect,
  allowRoles("student"),
  paymentProofUpload.single("paymentProof"),
  validateRequest(submitBankTransferPaymentSchema),
  submitBankTransferPayment,
);
router.get("/payments/:paymentAttemptId/status", protect, allowRoles("student"), validateRequest(paymentAttemptIdParamSchema, "params"), getStudentPaymentStatus);
router.post(
  "/payments/:paymentAttemptId/verify-direct-crypto",
  protect,
  allowRoles("student"),
  validateRequest(paymentAttemptIdParamSchema, "params"),
  validateRequest(verifyDirectCryptoSchema),
  verifyDirectCryptoPayment,
);

// Public HesabPay webhook endpoint
router.post("/payments/hesabpay/webhook", hesabPayWebhook);
router.post("/payments/nowpayments/ipn", nowPaymentsWebhook);

// Student payment endpoints
router.post(
  "/student/payments/create-session",
  protect,
  allowRoles("student"),
  createHesabPaySession,
);
router.post(
  "/student/payments/checkout",
  protect,
  allowRoles("student"),
  validateRequest(checkoutSchema),
  createCheckout,
);
router.get(
  "/student/payments/status/:reference",
  protect,
  allowRoles("student"),
  validateRequest(paymentStatusParamSchema, "params"),
  getStudentPaymentStatus,
);
router.get(
  "/student/payments/:paymentAttemptId/status",
  protect,
  allowRoles("student"),
  validateRequest(paymentAttemptIdParamSchema, "params"),
  getStudentPaymentStatus,
);
router.post(
  "/student/payments/confirm-redirect/:reference",
  protect,
  allowRoles("student"),
  validateRequest(paymentStatusParamSchema, "params"),
  confirmStudentPaymentRedirect,
);
router.post(
  "/student/payments/confirm-redirect",
  protect,
  allowRoles("student"),
  confirmStudentPaymentRedirect,
);
router.get(
  "/student/payments/history",
  protect,
  allowRoles("student"),
  getStudentPaymentHistory,
);

// Teacher earnings
router.get(
  "/teacher/earnings",
  protect,
  allowRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(teacherIncomeQuerySchema, "query"),
  getTeacherEarnings,
);
router.get(
  "/teacher/bank-transfer-payments",
  protect,
  allowRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(teacherBankTransferPaymentsQuerySchema, "query"),
  getTeacherBankTransferPayments,
);
router.patch(
  "/teacher/bank-transfer-payments/:id/approve",
  protect,
  allowRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(paymentIdParamSchema, "params"),
  validateRequest(bankTransferReviewSchema),
  approveTeacherBankTransferPayment,
);
router.patch(
  "/teacher/bank-transfer-payments/:id/reject",
  protect,
  allowRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(paymentIdParamSchema, "params"),
  validateRequest(bankTransferReviewSchema),
  rejectTeacherBankTransferPayment,
);

export default router;
