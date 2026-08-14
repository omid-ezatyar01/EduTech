import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import mongoose from "mongoose";
import mockingoose from "mockingoose";

import Payment from "../src/models/Payment.js";
import { getStudentPayments } from "../src/controllers/paymentController.js";

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    json(body) {
      resolve(body);
      return this;
    },
  };
  handler(req, res, reject);
});

beforeEach(() => {
  mockingoose.resetAll();
});

test("student payment history includes terminal records without exposing gateway secrets", async () => {
  const studentId = new mongoose.Types.ObjectId();
  let paymentQuery = null;
  mockingoose(Payment).toReturn((query) => {
    paymentQuery = query.getQuery();
    return [{
      _id: new mongoose.Types.ObjectId(),
      studentId,
      courseId: new mongoose.Types.ObjectId(),
      status: "expired",
      paymentStatus: "failed",
      paymentMethod: "hesabpay",
      provider: "hesabpay",
      amount: 1050,
      gatewayAmount: 1050,
      currency: "USD",
      gatewayCurrency: "AFN",
      baseAmountUsdCents: 1500,
      paymentReference: "PAY-private-history",
      hesabPaymentUrl: "https://checkout.hesab.com/consumed-secret-session",
      rawCreateSessionResponse: { secret: "create-session-secret" },
      rawWebhookPayload: {
        signature: "verified-webhook-signature",
        timestamp: "1707719607",
      },
      rawVerificationPayload: { secret: "verification-secret" },
    }];
  }, "find");

  const response = await invoke(getStudentPayments, {
    user: { _id: studentId },
  });

  assert.equal(String(paymentQuery.studentId), String(studentId));
  assert.equal(paymentQuery.$or, undefined);
  assert.equal(response.success, true);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].status, "expired");
  assert.equal(response.data[0].paymentReference, "PAY-private-history");
  assert.equal(response.data[0].hesabPaymentUrl, undefined);
  assert.equal(response.data[0].providerUrl, undefined);
  assert.equal(response.data[0].rawCreateSessionResponse, undefined);
  assert.equal(response.data[0].rawWebhookPayload, undefined);
  assert.equal(response.data[0].rawVerificationPayload, undefined);
});
