import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentRecoveryPath,
  resolvePaymentHistoryStatus,
} from "../src/utils/paymentHistory.js";

test("keeps duplicate and manual-review attempts distinct from successful payments", () => {
  assert.equal(
    resolvePaymentHistoryStatus({
      status: "paid",
      paymentAttemptId: { _id: "attempt-duplicate", status: "DUPLICATE_PAYMENT" },
    }),
    "duplicate_payment",
  );
  assert.equal(
    resolvePaymentHistoryStatus({
      paymentStatus: "pending",
      attemptStatus: "MANUAL_REVIEW",
    }),
    "manual_review",
  );
});

test("locally expired pending attempts are presented as expired", () => {
  assert.equal(
    resolvePaymentHistoryStatus(
      { status: "pending", expiresAt: "2026-08-14T10:00:00.000Z" },
      Date.parse("2026-08-14T10:00:01.000Z"),
    ),
    "expired",
  );
});

test("expired direct-BSC attempts reopen only the in-app transaction verifier", () => {
  assert.equal(
    buildPaymentRecoveryPath({
      status: "expired",
      paymentMethod: "usdt_bsc_direct",
      paymentAttemptId: "attempt/bsc",
      paymentUrl: "https://provider.example.test/consumed-session",
    }),
    "/payment/crypto?attemptId=attempt%2Fbsc",
  );
});

test("HesabPay recovery never reopens its one-time provider URL", () => {
  assert.equal(
    buildPaymentRecoveryPath({
      status: "pending",
      paymentMethod: "hesabpay",
      paymentAttemptId: "attempt-hesab",
      paymentUrl: "https://checkout.example.test/one-time-session",
    }),
    "/payment/success?paymentAttemptId=attempt-hesab",
  );
  assert.equal(
    buildPaymentRecoveryPath({
      status: "expired",
      paymentMethod: "hesabpay",
      paymentAttemptId: "attempt-hesab",
      paymentUrl: "https://checkout.example.test/one-time-session",
    }),
    "",
  );
});
