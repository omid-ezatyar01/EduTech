import assert from "node:assert/strict";
import test from "node:test";

import {
  getDirectCryptoTransactionTimeError,
  shouldPenalizeDirectCryptoVerificationFailure,
} from "../src/utils/directCryptoVerification.js";

test("a BSC payment mined in the checkout creation second is not rejected", () => {
  assert.equal(
    getDirectCryptoTransactionTimeError({
      blockTimestamp: new Date("2026-08-14T08:00:00.000Z"),
      attemptCreatedAt: new Date("2026-08-14T08:00:00.850Z"),
      attemptExpiresAt: new Date("2026-08-14T09:00:00.850Z"),
    }),
    "",
  );
});

test("BSC transaction window rejects genuinely old and late payments", () => {
  assert.equal(
    getDirectCryptoTransactionTimeError({
      blockTimestamp: new Date("2026-08-14T07:59:59.000Z"),
      attemptCreatedAt: new Date("2026-08-14T08:00:00.850Z"),
      attemptExpiresAt: new Date("2026-08-14T09:00:00.850Z"),
    }),
    "TX_OLDER_THAN_PAYMENT_REQUEST",
  );
  assert.equal(
    getDirectCryptoTransactionTimeError({
      blockTimestamp: new Date("2026-08-14T09:00:01.000Z"),
      attemptCreatedAt: new Date("2026-08-14T08:00:00.850Z"),
      attemptExpiresAt: new Date("2026-08-14T09:00:00.850Z"),
    }),
    "TX_MINED_AFTER_PAYMENT_EXPIRY",
  );
});

test("temporary chain states do not consume the permanent verification limit", () => {
  assert.equal(shouldPenalizeDirectCryptoVerificationFailure("TX_NOT_FOUND"), false);
  assert.equal(shouldPenalizeDirectCryptoVerificationFailure("INSUFFICIENT_CONFIRMATIONS"), false);
  assert.equal(shouldPenalizeDirectCryptoVerificationFailure("EXPLORER_UNAVAILABLE"), false);
  assert.equal(shouldPenalizeDirectCryptoVerificationFailure("INCORRECT_AMOUNT"), true);
  assert.equal(shouldPenalizeDirectCryptoVerificationFailure("WRONG_RECIPIENT"), true);
});
