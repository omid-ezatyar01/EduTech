import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import mongoose from "mongoose";
import mockingoose from "mockingoose";

import Payment from "../src/models/Payment.js";
import PaymentAttempt from "../src/models/PaymentAttempt.js";
import { syncLegacyPaymentRecord } from "../src/services/paymentSync.service.js";

beforeEach(() => {
  mockingoose.resetAll();
});

test("duplicate attempts stay out of paid revenue and preserve enrollment linkage", async () => {
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  mockingoose(Payment).toReturn({
    _id: paymentId,
    enrollmentId,
    status: "paid",
    paymentStatus: "paid",
  }, "findOne");
  mockingoose(PaymentAttempt).toReturn({ acknowledged: true }, "findOne");

  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    status: "DUPLICATE_PAYMENT",
    method: "HESABPAY_HOSTED",
    provider: "HESABPAY",
    amount: "1050",
    currency: "AFN",
    baseAmountUsdCents: 1500,
    paymentReference: "PAY-duplicate-non-revenue",
    save: async function save() { return this; },
  };
  const order = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    courseId: new mongoose.Types.ObjectId(),
    baseAmountUsdCents: 1500,
  };

  const result = await syncLegacyPaymentRecord({ order, attempt, course: null });

  assert.equal(result.status, "pending");
  assert.equal(result.paymentStatus, "pending");
  assert.equal(String(result.enrollmentId), String(enrollmentId));
});

test("expired attempts use a schema-valid failed paymentStatus", async () => {
  mockingoose(Payment).toReturn(null, "findOne");
  mockingoose(Payment).toReturn({
    _id: new mongoose.Types.ObjectId(),
  }, "create");

  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    status: "EXPIRED",
    method: "USDT_BSC_DIRECT",
    provider: "BSC_DIRECT",
    amount: "12.000123",
    currency: "USDT",
    baseAmountUsdCents: 1200,
    paymentReference: "PAY-expired-sync",
    save: async function save() { return this; },
  };
  const order = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    courseId: new mongoose.Types.ObjectId(),
    baseAmountUsdCents: 1200,
  };

  const result = await syncLegacyPaymentRecord({ order, attempt, course: null });

  assert.equal(result.status, "expired");
  assert.equal(result.paymentStatus, "failed");
});
