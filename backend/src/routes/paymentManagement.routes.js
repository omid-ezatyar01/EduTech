import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  getAdminPaymentById,
  getAdminPaymentsList,
  getStudentPayments,
  rejectPaymentByAdmin,
  verifyPaymentByAdmin,
} from "../controllers/paymentController.js";
import {
  getAdminTeacherIncomeLedger,
  updateTeacherIncomeSettlementStatus,
} from "../controllers/payment.controller.js";
import {
  adminTeacherIncomeQuerySchema,
  adminPaymentsQuerySchema,
  paymentIdParamSchema,
  rejectPaymentSchema,
  updateTeacherIncomeSettlementSchema,
  verifyPaymentSchema,
} from "../validators/payment.validators.js";

const router = express.Router();

router.get(
  "/admin/payments",
  protect,
  authorizeRoles("admin"),
  validateRequest(adminPaymentsQuerySchema, "query"),
  getAdminPaymentsList,
);
router.get(
  "/admin/payments/:id",
  protect,
  authorizeRoles("admin"),
  validateRequest(paymentIdParamSchema, "params"),
  getAdminPaymentById,
);
router.patch(
  "/admin/payments/:id/verify",
  protect,
  authorizeRoles("admin"),
  validateRequest(paymentIdParamSchema, "params"),
  validateRequest(verifyPaymentSchema),
  verifyPaymentByAdmin,
);
router.patch(
  "/admin/payments/:id/reject",
  protect,
  authorizeRoles("admin"),
  validateRequest(paymentIdParamSchema, "params"),
  validateRequest(rejectPaymentSchema),
  rejectPaymentByAdmin,
);

router.get(
  "/admin/teacher-income",
  protect,
  authorizeRoles("admin"),
  validateRequest(adminTeacherIncomeQuerySchema, "query"),
  getAdminTeacherIncomeLedger,
);

router.patch(
  "/admin/teacher-income/status",
  protect,
  authorizeRoles("admin"),
  validateRequest(updateTeacherIncomeSettlementSchema),
  updateTeacherIncomeSettlementStatus,
);

router.get("/student/payments", protect, authorizeRoles("student"), getStudentPayments);

export default router;
