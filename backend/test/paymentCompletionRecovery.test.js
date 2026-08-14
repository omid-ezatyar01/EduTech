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
import { completePayment } from "../src/services/paymentCompletion.service.js";

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

test("a replay repairs enrollment after a verified attempt was saved before fulfillment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");

  const attempt = {
    _id: attemptId,
    orderId,
    userId,
    courseId,
    status: "SUCCEEDED",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-recovery-test",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  };
  const order = {
    _id: orderId,
    userId,
    courseId,
    status: "PAID",
    baseAmountUsdCents: 1500,
    paidAt,
  };
  const course = {
    _id: courseId,
    title: "Recovery course",
    enrolledStudentsCount: 0,
    save: async function save() { return this; },
  };
  const enrollment = {
    _id: enrollmentId,
    studentId: userId,
    courseId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
  };

  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Enrollment).toReturn(enrollment, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");
  mockingoose(User).toReturn(null, "findOne");

  const result = await completePayment({
    paymentAttemptId: attemptId,
    providerPaymentId: "hesab-transaction-recovery",
    paidAt,
    verifiedAt: paidAt,
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.alreadySucceeded, true);
  assert.equal(String(result.enrollment?._id), String(enrollmentId));
  assert.equal(String(result.payment?.enrollmentId), String(enrollmentId));
});

test("a duplicate webhook does not extend or reactivate access already linked to that payment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-06-01T08:00:00.000Z");
  const originalExpiry = new Date("2026-07-01T08:00:00.000Z");
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    status: "SUCCEEDED",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-no-renewal-on-replay",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  }, "findOne");
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
    title: "Completed monthly course",
    enrolledStudentsCount: 1,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId,
    enrollmentStatus: "pending",
    accessStatus: "blocked",
    status: "inactive",
    paymentPlan: "monthly",
    accessStartsAt: paidAt,
    accessExpiresAt: originalExpiry,
    lastRenewedAt: paidAt,
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return null;
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const result = await completePayment({
    paymentAttemptId: attemptId,
    providerPaymentId: "hesab-transaction-replayed",
    paidAt: new Date("2026-08-14T08:00:00.000Z"),
    verifiedAt: new Date("2026-08-14T08:00:00.000Z"),
  });

  assert.equal(result.alreadySucceeded, true);
  assert.equal(result.shouldSendEnrollmentEmail, false);
  assert.equal(enrollmentUpserts, 0);
  assert.equal(new Date(result.enrollment.accessExpiresAt).toISOString(), originalExpiry.toISOString());
  assert.equal(result.enrollment.accessStatus, "blocked");
});

test("a successful replay activates a partial enrollment already linked to the same payment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    legacyPaymentId: paymentId,
    status: "SUCCEEDED",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-partial-same-payment",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  }, "findOne");
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
    title: "Partial fulfillment recovery",
    enrolledStudentsCount: 1,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId,
    enrollmentStatus: "pending",
    accessStatus: "blocked",
    status: "inactive",
    lastRenewedAt: null,
    accessStartsAt: null,
    accessExpiresAt: null,
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return {
      _id: enrollmentId,
      studentId: userId,
      courseId,
      paymentId,
      enrollmentStatus: "active",
      accessStatus: "allowed",
      status: "active",
      paymentPlan: "monthly",
      accessStartsAt: paidAt,
      accessExpiresAt: new Date("2026-09-14T08:00:00.000Z"),
      lastRenewedAt: paidAt,
    };
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const result = await completePayment({ paymentAttemptId: attemptId, paidAt });

  assert.equal(result.alreadySucceeded, true);
  assert.equal(enrollmentUpserts, 1);
  assert.equal(result.enrollment.enrollmentStatus, "active");
  assert.equal(result.enrollment.accessStatus, "allowed");
  assert.equal(String(result.enrollment.paymentId), String(paymentId));
});

test("an old successful webhook cannot overwrite an enrollment linked to a newer payment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const oldAttemptId = new mongoose.Types.ObjectId();
  const oldPaymentId = new mongoose.Types.ObjectId();
  const newerPaymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const oldPaidAt = new Date("2026-06-01T08:00:00.000Z");
  const newerExpiry = new Date("2026-09-01T08:00:00.000Z");
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn({
    _id: oldAttemptId,
    orderId,
    userId,
    courseId,
    status: "SUCCEEDED",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-old-success-replay",
    paidAt: oldPaidAt,
    verifiedAt: oldPaidAt,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId,
    courseId,
    status: "PAID",
    baseAmountUsdCents: 1500,
    paidAt: oldPaidAt,
  }, "findOne");
  mockingoose(Course).toReturn({
    _id: courseId,
    title: "Renewed course",
    enrolledStudentsCount: 1,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId: newerPaymentId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
    status: "active",
    accessExpiresAt: newerExpiry,
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return null;
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({
    _id: oldPaymentId,
    enrollmentId,
  }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const result = await completePayment({
    paymentAttemptId: oldAttemptId,
    providerPaymentId: "old-provider-transaction",
    paidAt: new Date("2026-08-14T08:00:00.000Z"),
    verifiedAt: new Date("2026-08-14T08:00:00.000Z"),
  });

  assert.equal(result.alreadySucceeded, true);
  assert.equal(result.shouldSendEnrollmentEmail, false);
  assert.equal(enrollmentUpserts, 0);
  assert.equal(String(result.enrollment.paymentId), String(newerPaymentId));
  assert.equal(new Date(result.enrollment.accessExpiresAt).toISOString(), newerExpiry.toISOString());
});

test("a newer successful retry applies once over an older enrollment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const olderPaymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    legacyPaymentId: paymentId,
    status: "SUCCEEDED",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-newer-retry",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  }, "findOne");
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
    title: "Renewal recovery course",
    enrolledStudentsCount: 1,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId: olderPaymentId,
    enrollmentStatus: "pending",
    accessStatus: "blocked",
    status: "inactive",
    lastRenewedAt: new Date("2026-06-01T08:00:00.000Z"),
    accessExpiresAt: new Date("2026-07-01T08:00:00.000Z"),
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return {
      _id: enrollmentId,
      studentId: userId,
      courseId,
      paymentId,
      enrollmentStatus: "active",
      accessStatus: "allowed",
      lastRenewedAt: paidAt,
    };
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const result = await completePayment({ paymentAttemptId: attemptId, paidAt });

  assert.equal(result.alreadySucceeded, true);
  assert.equal(enrollmentUpserts, 1);
  assert.equal(String(result.enrollment.paymentId), String(paymentId));
});

test("a successful retry repairs a pending enrollment with no applied payment", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  let enrollmentUpserts = 0;

  mockingoose(PaymentAttempt).toReturn({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    legacyPaymentId: paymentId,
    status: "SUCCEEDED",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    amount: "15.000123",
    currency: "USDT",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-pending-enrollment-repair",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  }, "findOne");
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
    title: "Pending enrollment recovery",
    enrolledStudentsCount: 1,
    save: async function save() { return this; },
  }, "findOne");
  mockingoose(Enrollment).toReturn({
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId: null,
    enrollmentStatus: "pending",
    accessStatus: "blocked",
    status: "inactive",
  }, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    return {
      _id: enrollmentId,
      studentId: userId,
      courseId,
      paymentId,
      enrollmentStatus: "active",
      accessStatus: "allowed",
      lastRenewedAt: paidAt,
    };
  }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");

  const result = await completePayment({ paymentAttemptId: attemptId, paidAt });

  assert.equal(result.alreadySucceeded, true);
  assert.equal(enrollmentUpserts, 1);
  assert.equal(String(result.enrollment.paymentId), String(paymentId));
});

test("a concurrent completion lease never downgrades the same payment to duplicate", async () => {
  const attemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const attempt = new PaymentAttempt({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    paymentReference: "PAY-concurrent-completion-lease",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    status: "PENDING",
    completionClaimToken: "another-worker",
    completionClaimExpiresAt: new Date(Date.now() + 60_000),
  });

  mockingoose(PaymentAttempt).toReturn(null, "findOneAndUpdate");
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");

  await assert.rejects(
    () => completePayment({ paymentAttemptId: attemptId }),
    (error) => error?.code === "PAYMENT_COMPLETION_IN_PROGRESS",
  );
  assert.equal(attempt.status, "PENDING");
  assert.notEqual(attempt.status, "DUPLICATE_PAYMENT");
});

test("a completed fulfillment replay returns its durable payment and enrollment", async () => {
  const attemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const attempt = new PaymentAttempt({
    _id: attemptId,
    orderId,
    userId,
    courseId,
    legacyPaymentId: paymentId,
    paymentReference: "PAY-completed-fulfillment-replay",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    status: "SUCCEEDED",
    paidAt: new Date("2026-08-14T08:00:00.000Z"),
    fulfillmentCompletedAt: new Date("2026-08-14T08:00:01.000Z"),
  });
  const order = {
    _id: orderId,
    userId,
    courseId,
    status: "PAID",
  };
  const payment = {
    _id: paymentId,
    paymentAttemptId: attemptId,
    enrollmentId,
    status: "paid",
    paymentStatus: "paid",
  };
  const enrollment = {
    _id: enrollmentId,
    studentId: userId,
    courseId,
    paymentId,
    enrollmentStatus: "active",
    accessStatus: "allowed",
  };

  mockingoose(PaymentAttempt).toReturn(null, "findOneAndUpdate");
  mockingoose(PaymentAttempt).toReturn(attempt, "findOne");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(Payment).toReturn(payment, "findOne");
  mockingoose(Enrollment).toReturn(enrollment, "findOne");

  const result = await completePayment({ paymentAttemptId: attemptId });

  assert.equal(result.duplicate, false);
  assert.equal(result.alreadySucceeded, true);
  assert.equal(String(result.payment?._id), String(paymentId));
  assert.equal(String(result.enrollment?._id), String(enrollmentId));
});
