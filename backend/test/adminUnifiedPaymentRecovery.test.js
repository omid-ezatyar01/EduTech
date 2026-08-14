import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";
import mongoose from "mongoose";
import mockingoose from "mockingoose";

import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Order from "../src/models/Order.js";
import Payment from "../src/models/Payment.js";
import PaymentAttempt from "../src/models/PaymentAttempt.js";
import User from "../src/models/User.js";
import {
  rejectPaymentByAdmin,
  verifyPaymentByAdmin,
} from "../src/controllers/paymentController.js";

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    json(body) {
      resolve(body);
      return this;
    },
  };
  handler(req, res, reject);
});

const ids = () => ({
  adminId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  courseId: new mongoose.Types.ObjectId(),
  orderId: new mongoose.Types.ObjectId(),
  attemptId: new mongoose.Types.ObjectId(),
  paymentId: new mongoose.Types.ObjectId(),
  enrollmentId: new mongoose.Types.ObjectId(),
});

const unifiedPayment = ({ userId, courseId, orderId, attemptId, paymentId, paidAt }) => ({
  _id: paymentId,
  studentId: userId,
  courseId,
  orderId,
  paymentAttemptId: attemptId,
  baseAmountUsdCents: 1200,
  amount: 12,
  gatewayAmount: 12,
  currency: "USDT",
  gatewayCurrency: "USDT",
  provider: "bsc_direct",
  paymentMethod: "usdt_bsc_direct",
  status: "paid",
  paymentStatus: "paid",
  paymentReference: "PAY-admin-unified-recovery",
  paidAt,
});

const unifiedAttempt = ({ userId, courseId, orderId, attemptId, paymentId, paidAt }) => ({
  _id: attemptId,
  orderId,
  userId,
  courseId,
  legacyPaymentId: paymentId,
  status: "PENDING",
  provider: "BSC_DIRECT",
  method: "USDT_BSC_DIRECT",
  amount: "12.00",
  currency: "USDT",
  baseAmountUsdCents: 1200,
  paymentReference: "PAY-admin-unified-recovery",
  paidAt,
  save: async function save() { return this; },
});

before(() => {
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: () => {},
  });
});

beforeEach(() => {
  mockingoose.resetAll();
  mockingoose(PaymentAttempt).toReturn((query) => {
    const update = query.getUpdate();
    const claimToken = update?.$set?.completionClaimToken;
    if (!claimToken) return null;
    return {
      _id: query.getQuery()?._id,
      completionClaimToken: claimToken,
      completionClaimExpiresAt: update.$set.completionClaimExpiresAt,
    };
  }, "findOneAndUpdate");
});

test("admin verification requires a transaction ID for a unified hosted or crypto payment", async () => {
  const values = ids();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  mockingoose(Payment).toReturn(unifiedPayment({ ...values, paidAt }), "findOne");
  mockingoose(PaymentAttempt).toReturn(unifiedAttempt({ ...values, paidAt }), "findOne");

  await assert.rejects(
    invoke(verifyPaymentByAdmin, {
      params: { id: String(values.paymentId) },
      body: { transactionId: "   " },
      user: { _id: values.adminId },
    }),
    (error) => error?.statusCode === 400 && /transaction id is required/i.test(error.message),
  );
});

test("admin verification repairs an already-paid unified payment with no enrollment", async () => {
  const values = ids();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const transactionId = `0x${"a".repeat(64)}`;
  const payment = unifiedPayment({ ...values, paidAt });
  const attempt = unifiedAttempt({ ...values, paidAt });
  const order = {
    _id: values.orderId,
    userId: values.userId,
    courseId: values.courseId,
    status: "PAID",
    baseAmountUsdCents: 1200,
    paidAt,
  };
  const course = {
    _id: values.courseId,
    title: "Admin recovery course",
    status: "draft",
    enrolledStudentsCount: 0,
  };
  const enrollment = {
    _id: values.enrollmentId,
    studentId: values.userId,
    courseId: values.courseId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
  };

  mockingoose(Payment).toReturn(payment, "findOne");
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(Course).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");
  mockingoose(Course).toReturn(course, "findOneAndUpdate");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Enrollment).toReturn(enrollment, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");
  mockingoose(User).toReturn(null, "findOne");

  const response = await invoke(verifyPaymentByAdmin, {
    params: { id: String(values.paymentId) },
    body: { transactionId, note: "Provider receipt checked" },
    user: { _id: values.adminId },
  });

  assert.equal(response.success, true);
  assert.match(response.message, /enrollment activated/i);
  assert.equal(response.data.status, "paid");
  assert.equal(response.data.paymentStatus, "paid");
  assert.equal(response.data.transactionId, transactionId);
  assert.equal(response.data.transactionSignature, transactionId);
  assert.equal(String(response.data.enrollmentId), String(values.enrollmentId));
  assert.equal(String(response.data.verifiedBy), String(values.adminId));
  assert.equal(response.data.note, "Provider receipt checked");
});

test("admin verification cannot promote a second attempt over an existing paid enrollment", async () => {
  const values = ids();
  const originalPaymentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const payment = unifiedPayment({ ...values, paidAt });
  payment.enrollmentId = null;
  const attempt = unifiedAttempt({ ...values, paidAt });
  let enrollmentUpserts = 0;

  mockingoose(Payment).toReturn(payment, "findOne");
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn({
    _id: values.orderId,
    userId: values.userId,
    courseId: values.courseId,
    status: "PAID",
    baseAmountUsdCents: 1200,
    paidAt,
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: values.enrollmentId,
    studentId: values.userId,
    courseId: values.courseId,
    paymentId: originalPaymentId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
    lastRenewedAt: paidAt,
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return null;
  }, "findOneAndUpdate");

  await assert.rejects(
    invoke(verifyPaymentByAdmin, {
      params: { id: String(values.paymentId) },
      body: {
        transactionId: `0x${"b".repeat(64)}`,
        note: "Second transaction checked",
      },
      user: { _id: values.adminId },
    }),
    (error) => error?.statusCode === 409,
  );

  assert.equal(enrollmentUpserts, 0);
});

test("admin rejection resolves an ambiguous hosted attempt after provider review", async () => {
  const values = ids();
  let savedAttempt = null;
  let savedPayment = null;
  const payment = {
    ...unifiedPayment({ ...values, paidAt: null }),
    provider: "hesabpay",
    paymentMethod: "hesabpay",
    status: "pending",
    paymentStatus: "pending",
    note: "",
    save: async function save() { return this; },
  };
  const attempt = {
    ...unifiedAttempt({ ...values, paidAt: null }),
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    status: "MANUAL_REVIEW",
    issuanceState: "AMBIGUOUS",
    save: async function save() { return this; },
  };

  mockingoose(Payment).toReturn(payment, "findOne");
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(PaymentAttempt).toReturn((document) => {
    savedAttempt = document.toObject();
    return document;
  }, "save");
  mockingoose(Payment).toReturn((document) => {
    savedPayment = document.toObject();
    return document;
  }, "save");
  mockingoose(Enrollment).toReturn(null, "findOne");

  const response = await invoke(rejectPaymentByAdmin, {
    params: { id: String(values.paymentId) },
    body: { note: "Confirmed unpaid in the HesabPay dashboard" },
    user: { _id: values.adminId },
  });

  assert.equal(response.success, true);
  assert.equal(savedAttempt?.status, "FAILED");
  assert.equal(savedAttempt?.issuanceState, "DEFINITIVELY_FAILED");
  assert.match(savedAttempt?.note || "", /confirmed unpaid/i);
  assert.equal(savedPayment?.status, "failed");
  assert.equal(savedPayment?.paymentStatus, "failed");
});
