import assert from "node:assert/strict";
import test from "node:test";

import PaymentAttempt from "../src/models/PaymentAttempt.js";

test("PaymentAttempt enforces one active checkout per order", () => {
  const activeIndex = PaymentAttempt.schema.indexes().find(
    ([, options]) => options?.name === "one_active_attempt_per_order",
  );

  assert.ok(activeIndex);
  assert.deepEqual(activeIndex[0], { orderId: 1 });
  assert.equal(activeIndex[1].unique, true);
  assert.deepEqual(
    activeIndex[1].partialFilterExpression,
    { status: { $in: ["PENDING", "MANUAL_REVIEW"] } },
  );
});
