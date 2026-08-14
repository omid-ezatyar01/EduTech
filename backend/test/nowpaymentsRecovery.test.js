import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { afterEach, before, beforeEach } from "node:test";
import mockingoose from "mockingoose";
import mongoose from "mongoose";
import nock from "nock";

import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Order from "../src/models/Order.js";
import Payment from "../src/models/Payment.js";
import PaymentAttempt from "../src/models/PaymentAttempt.js";
import { nowPaymentsWebhook } from "../src/controllers/payment.controller.js";
import { getNowPaymentsPayment } from "../src/services/nowpayments.service.js";

process.env.NODE_ENV = "test";
process.env.NOWPAYMENTS_API_KEY = "test-nowpayments-key";
process.env.NOWPAYMENTS_IPN_SECRET = "test-nowpayments-secret";
process.env.NOWPAYMENTS_BASE_URL = "https://api.nowpayments.recovery.test";

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const sortKeysRecursive = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortKeysRecursive(value[key]);
    return result;
  }, {});
};

const signPayload = (payload) => crypto
  .createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET)
  .update(JSON.stringify(sortKeysRecursive(payload)))
  .digest("hex");

const makeAttempt = (overrides = {}) => new PaymentAttempt({
  _id: new mongoose.Types.ObjectId(),
  orderId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  courseId: new mongoose.Types.ObjectId(),
  paymentReference: "PAY-nowpayments-recovery",
  provider: "NOWPAYMENTS",
  method: "NOWPAYMENTS_CRYPTO",
  providerPaymentId: "np-123",
  baseAmountUsdCents: 1200,
  amount: "12.00",
  currency: "USDT",
  status: "PENDING",
  ...overrides,
});

before(() => {
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: () => {},
  });
});

beforeEach(() => {
  mockingoose.resetAll();
  nock.cleanAll();
  process.env.NOWPAYMENTS_IPN_SECRET = "test-nowpayments-secret";
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

afterEach(() => {
  nock.cleanAll();
});

test("NOWPayments provider status can be fetched to recover a missed IPN", async () => {
  nock("https://api.nowpayments.recovery.test")
    .get("/v1/payment/np-123")
    .reply(200, {
      payment_id: "np-123",
      order_id: "PAY-nowpayments-recovery",
      payment_status: "finished",
      pay_amount: 12,
    });

  const payment = await getNowPaymentsPayment("np-123");
  assert.equal(payment.payment_status, "finished");
  assert.equal(nock.isDone(), true);
});

test("a stale NOWPayments failure cannot downgrade an already successful attempt", async () => {
  const attempt = makeAttempt({ status: "SUCCEEDED" });
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  const payload = {
    payment_id: "np-123",
    order_id: "PAY-nowpayments-recovery",
    payment_status: "expired",
    pay_amount: 12,
  };
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": signPayload(payload) },
    body: payload,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.acknowledged, true);
  assert.match(res.body.message, /ignored/i);
  assert.equal(attempt.status, "SUCCEEDED");
});

test("a stale finished payload cannot downgrade a successful NOWPayments attempt on mismatched amounts", async () => {
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const attempt = makeAttempt({
    status: "SUCCEEDED",
    paidAt,
    verifiedAt: paidAt,
    legacyPaymentId: paymentId,
  });
  const payment = {
    _id: paymentId,
    studentId: attempt.userId,
    courseId: attempt.courseId,
    orderId: attempt.orderId,
    paymentAttemptId: attempt._id,
    baseAmountUsdCents: 1200,
    amount: 12,
    gatewayAmount: 12,
    currency: "USDT",
    gatewayCurrency: "USDT",
    provider: "nowpayments",
    paymentMethod: "nowpayments_crypto",
    status: "paid",
    paymentStatus: "paid",
    paymentReference: attempt.paymentReference,
    paidAt,
  };
  const order = {
    _id: attempt.orderId,
    userId: attempt.userId,
    courseId: attempt.courseId,
    status: "PAID",
    baseAmountUsdCents: 1200,
    paidAt,
  };
  const course = {
    _id: attempt.courseId,
    title: "NOWPayments replay course",
    status: "draft",
    lifecycleStatus: "draft",
    enrolledStudentsCount: 1,
  };
  const enrollment = {
    _id: enrollmentId,
    studentId: attempt.userId,
    courseId: attempt.courseId,
    paymentId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
    status: "active",
    paymentPlan: "monthly",
    lastRenewedAt: paidAt,
    accessStartsAt: paidAt,
    accessExpiresAt: new Date("2026-09-14T08:00:00.000Z"),
  };

  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(Enrollment).toReturn(enrollment, "findOne");
  mockingoose(Payment).toReturn(payment, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const payload = {
    payment_id: "np-123",
    order_id: "PAY-nowpayments-recovery",
    payment_status: "finished",
    pay_amount: 99,
    actually_paid: 1,
    pay_currency: "btc",
    price_amount: 999,
    price_currency: "eur",
    updated_at: "2026-08-20T08:00:00.000Z",
  };
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": signPayload(payload) },
    body: payload,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.acknowledged, true);
  assert.doesNotMatch(res.body.message, /manual review/i);
  assert.equal(attempt.status, "SUCCEEDED");
  assert.equal(attempt.paidAt.toISOString(), paidAt.toISOString());
});

test("a sparse finished payload cannot bypass an existing NOWPayments manual review", async () => {
  const attempt = makeAttempt({
    status: "MANUAL_REVIEW",
    note: "NOWPayments partial payment",
  });
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  const payload = {
    payment_id: "np-123",
    order_id: "PAY-nowpayments-recovery",
    payment_status: "finished",
  };
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": signPayload(payload) },
    body: payload,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.acknowledged, true);
  assert.match(res.body.message, /manual review/i);
  assert.equal(attempt.status, "MANUAL_REVIEW");
});

test("NOWPayments does not enroll a finished payment whose actual deposit is short", async () => {
  const attempt = makeAttempt();
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  const payload = {
    payment_id: "np-123",
    order_id: "PAY-nowpayments-recovery",
    payment_status: "finished",
    price_amount: 12,
    price_currency: "usd",
    pay_amount: 12,
    actually_paid: 11.5,
    pay_currency: "usdtbsc",
  };
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": signPayload(payload) },
    body: payload,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.acknowledged, true);
  assert.match(res.body.message, /manual review/i);
  assert.equal(attempt.status, "MANUAL_REVIEW");
});

test("NOWPayments asks the provider to retry when the local attempt is not ready", async () => {
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  const payload = {
    payment_id: "np-race",
    order_id: "PAY-not-saved-yet",
    payment_status: "finished",
    pay_amount: 12,
  };
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": signPayload(payload) },
    body: payload,
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
});

test("NOWPayments processing errors are not acknowledged as successful", async () => {
  process.env.NOWPAYMENTS_IPN_SECRET = "";
  const res = mockRes();

  await nowPaymentsWebhook({
    headers: { "x-nowpayments-sig": "invalid" },
    body: { payment_id: "np-123", payment_status: "finished" },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});
