import assert from "node:assert/strict";
import test from "node:test";

import { expireStalePendingPaymentAttempts } from "../src/utils/paymentAttemptMigration.js";

test("startup migration expires only stale, unverified pending attempts", async () => {
  const calls = [];
  const collection = {
    updateMany: async (...args) => {
      calls.push(args);
      return { matchedCount: 2, modifiedCount: 2 };
    },
  };
  const now = new Date("2026-08-14T12:00:00.000Z");

  const result = await expireStalePendingPaymentAttempts(collection, now);

  assert.equal(result.modifiedCount, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], {
    status: "PENDING",
    expiresAt: { $lt: now },
    paidAt: null,
    verifiedAt: null,
  });
  assert.deepEqual(calls[0][1], {
    $set: {
      status: "EXPIRED",
      updatedAt: now,
    },
  });
});

test("startup migration requires a MongoDB collection", async () => {
  await assert.rejects(
    expireStalePendingPaymentAttempts(null),
    /payment attempts collection is required/,
  );
});
