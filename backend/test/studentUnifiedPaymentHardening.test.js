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
  getStudentPaymentHistory,
  getStudentPaymentStatus,
  verifyDirectCryptoPayment,
} from "../src/controllers/payment.controller.js";

before(() => {
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: () => {},
  });
});

beforeEach(() => {
  mockingoose.resetAll();
  mockingoose(PaymentAttempt).toReturn((query) => ({
    _id: query.getQuery()?._id || new mongoose.Types.ObjectId(),
  }), "findOneAndUpdate");
  mockingoose(PaymentAttempt).toReturn({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1,
  }, "updateOne");
});

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const makeSucceededDirectAttempt = ({ userId, courseId, orderId, attemptId, paidAt }) => ({
  _id: attemptId,
  orderId,
  userId,
  courseId,
  legacyPaymentId: new mongoose.Types.ObjectId(),
  status: "SUCCEEDED",
  provider: "BSC_DIRECT",
  method: "USDT_BSC_DIRECT",
  amount: "15.000123",
  currency: "USDT",
  network: "BNB_CHAIN",
  baseAmountUsdCents: 1500,
  paymentReference: "PAY-succeeded-direct-repair",
  transactionSignature: `0x${"a".repeat(64)}`,
  providerUrl: "secret-provider-url",
  customerEmail: "secret@example.test",
  rawCreateSessionResponse: { qrPayload: "ethereum:public-qr", secret: "create-secret" },
  rawVerificationPayload: { secret: "verification-secret" },
  paidAt,
  verifiedAt: paidAt,
  save: async function save() { return this; },
});

const mockSucceededCompletion = ({ userId, courseId, orderId, attempt, paidAt }) => {
  const paymentId = attempt.legacyPaymentId;
  const enrollmentId = new mongoose.Types.ObjectId();
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId,
    courseId,
    status: "PAID",
    baseAmountUsdCents: 1500,
    paidAt,
  }, "findOne");
  mockingoose(Course).toReturn({
    _id: courseId,
    title: "Recovery course",
    enrolledStudentsCount: 0,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return {
      _id: enrollmentId,
      studentId: userId,
      courseId,
      paymentId,
      enrollmentStatus: "active",
      accessStatus: "allowed",
    };
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");
  mockingoose(User).toReturn(null, "findOne");

  return () => enrollmentUpserts;
};

test("direct status repairs a succeeded attempt and returns only the safe student DTO", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const attempt = makeSucceededDirectAttempt({ userId, courseId, orderId, attemptId, paidAt });
  const getEnrollmentUpserts = mockSucceededCompletion({
    userId,
    courseId,
    orderId,
    attempt,
    paidAt,
  });

  const res = mockRes();
  await getStudentPaymentStatus({
    params: { paymentAttemptId: String(attemptId) },
    user: { _id: userId },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(getEnrollmentUpserts(), 1);
  assert.equal(res.body.payment.status, "SUCCEEDED");
  assert.equal(res.body.payment.qrPayload, "ethereum:public-qr");
  assert.equal(res.body.payment.providerUrl, undefined);
  assert.equal(res.body.payment.customerEmail, undefined);
  assert.equal(res.body.payment.rawCreateSessionResponse, undefined);
  assert.equal(res.body.payment.rawVerificationPayload, undefined);
  assert.equal(res.body.payment.transactionSignature, undefined);
});

test("already-succeeded direct verification also repairs missing fulfillment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const attempt = makeSucceededDirectAttempt({ userId, courseId, orderId, attemptId, paidAt });
  const getEnrollmentUpserts = mockSucceededCompletion({
    userId,
    courseId,
    orderId,
    attempt,
    paidAt,
  });

  const res = mockRes();
  await verifyDirectCryptoPayment({
    params: { paymentAttemptId: String(attemptId) },
    body: { txHash: attempt.transactionSignature },
    user: { _id: userId },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(getEnrollmentUpserts(), 1);
  assert.equal(res.body.status, "SUCCEEDED");
  assert.equal(res.body.payment.providerUrl, undefined);
  assert.equal(res.body.payment.rawVerificationPayload, undefined);
});

test("student unified history includes terminal/manual/duplicate rows without gateway internals", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const course = new Course({ _id: courseId, title: "History course", price: 15, currency: "USD" });
  const statuses = ["FAILED", "EXPIRED", "MANUAL_REVIEW", "DUPLICATE_PAYMENT"];
  const attemptById = new Map();
  const payments = statuses.map((status, index) => {
    const attemptId = new mongoose.Types.ObjectId();
    const attempt = new PaymentAttempt({
      _id: attemptId,
      orderId,
      userId,
      courseId,
      paymentReference: `PAY-history-${status}`,
      provider: "BSC_DIRECT",
      method: "USDT_BSC_DIRECT",
      baseAmountUsdCents: 1500,
      amount: `15.000${index + 1}`,
      currency: "USDT",
      network: "BNB_CHAIN",
      status,
      transactionSignature: `0x${String(index + 1).repeat(64)}`,
      providerUrl: "secret-provider-url",
      rawWebhookPayload: { signature: "secret-webhook-signature" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    attemptById.set(String(attemptId), attempt);

    const payment = new Payment({
      _id: new mongoose.Types.ObjectId(),
      studentId: userId,
      courseId,
      orderId,
      paymentAttemptId: attemptId,
      paymentReference: attempt.paymentReference,
      baseAmountUsdCents: 1500,
      amount: 15,
      gatewayAmount: attempt.amount,
      currency: "USD",
      gatewayCurrency: "USDT",
      paymentMethod: "crypto",
      provider: "BSC_DIRECT",
      status: "pending",
      paymentStatus: "pending",
      rawCreateSessionResponse: { secret: "create-secret" },
      rawWebhookPayload: { signature: "secret-webhook-signature" },
    });
    payment.populated("paymentAttemptId", attemptId);
    payment.paymentAttemptId = attempt;
    payment.populated("courseId", courseId);
    payment.courseId = course;
    return payment;
  });

  mockingoose(Payment).toReturn(payments, "find");
  mockingoose(PaymentAttempt).toReturn(
    () => Array.from(attemptById.values()),
    "find",
  );
  mockingoose(Course).toReturn([course], "find");

  const res = mockRes();
  await getStudentPaymentHistory({ user: { _id: userId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payments.length, 4);
  const byAttemptStatus = new Map(
    res.body.payments.map((payment) => [payment.attemptStatus, payment]),
  );
  assert.equal(byAttemptStatus.get("FAILED")?.status, "failed");
  assert.equal(byAttemptStatus.get("EXPIRED")?.status, "expired");
  assert.equal(byAttemptStatus.get("MANUAL_REVIEW")?.status, "pending");
  assert.equal(byAttemptStatus.get("DUPLICATE_PAYMENT")?.status, "pending");
  assert.match(byAttemptStatus.get("DUPLICATE_PAYMENT")?.transactionSignature || "", /^0x/);
  for (const payment of res.body.payments) {
    assert.equal(payment.providerUrl, undefined);
    assert.equal(payment.hesabPaymentUrl, undefined);
    assert.equal(payment.rawCreateSessionResponse, undefined);
    assert.equal(payment.rawWebhookPayload, undefined);
    assert.equal(payment.rawVerificationPayload, undefined);
  }
});
