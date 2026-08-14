import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHostedPaymentStatusPath,
  forgetHostedPaymentAttempt,
  hostedPaymentStorageKey,
  rememberHostedPaymentAttempt,
  resolveHostedPaymentReturn,
} from "../src/utils/hostedPaymentReturn.js";

const makeStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

const studentA = { _id: "student-a", email: "student-a@example.test" };
const studentB = { _id: "student-b", email: "student-b@example.test" };

test("recovers a hosted attempt from the legacy orderId redirect for the same student", () => {
  const storage = makeStorage();
  rememberHostedPaymentAttempt({
    checkout: {
      provider: "HESABPAY",
      paymentAttemptId: "attempt-a",
      paymentReference: "PAY-a",
      orderId: "order-a",
    },
    courseId: "course-a",
    user: studentA,
    storage,
    nowMs: 1_000,
  });

  const resolved = resolveHostedPaymentReturn({
    searchParams: new URLSearchParams("orderId=order-a"),
    user: studentA,
    storage,
    nowMs: 2_000,
  });

  assert.deepEqual(resolved, {
    paymentAttemptId: "attempt-a",
    reference: "PAY-a",
    orderId: "order-a",
    source: "storage",
  });
});

test("never recovers another student's stored hosted attempt", () => {
  const storage = makeStorage();
  rememberHostedPaymentAttempt({
    checkout: {
      provider: "HESABPAY",
      paymentAttemptId: "attempt-a",
      paymentReference: "PAY-a",
      orderId: "order-a",
    },
    user: studentA,
    storage,
    nowMs: 1_000,
  });

  assert.deepEqual(
    resolveHostedPaymentReturn({
      searchParams: new URLSearchParams("orderId=order-a"),
      user: studentB,
      storage,
      nowMs: 2_000,
    }),
    {
      paymentAttemptId: "",
      reference: "",
      orderId: "order-a",
      source: "legacy-order",
    },
  );
});

test("explicit provider return identifiers take precedence over stored metadata", () => {
  const storage = makeStorage();
  rememberHostedPaymentAttempt({
    checkout: {
      provider: "HESABPAY",
      paymentAttemptId: "stored-attempt",
      orderId: "stored-order",
    },
    user: studentA,
    storage,
    nowMs: 1_000,
  });

  assert.deepEqual(
    resolveHostedPaymentReturn({
      searchParams: new URLSearchParams(
        "paymentAttemptId=returned-attempt&ref=returned-ref&orderId=returned-order",
      ),
      user: studentA,
      storage,
      nowMs: 2_000,
    }),
    {
      paymentAttemptId: "returned-attempt",
      reference: "returned-ref",
      orderId: "returned-order",
      source: "query",
    },
  );
});

test("recovers the latest same-student attempt when a provider strips return parameters", () => {
  const storage = makeStorage();
  rememberHostedPaymentAttempt({
    checkout: {
      provider: "HESABPAY",
      paymentAttemptId: "latest-attempt",
      paymentReference: "PAY-latest",
      orderId: "latest-order",
    },
    user: studentA,
    storage,
    nowMs: 5_000,
  });

  assert.deepEqual(
    resolveHostedPaymentReturn({
      searchParams: new URLSearchParams(),
      user: studentA,
      storage,
      nowMs: 6_000,
    }),
    {
      paymentAttemptId: "latest-attempt",
      reference: "PAY-latest",
      orderId: "",
      source: "storage",
    },
  );
});

test("successful completion removes only the matching student's attempt", () => {
  const storage = makeStorage();
  for (const [user, suffix] of [[studentA, "a"], [studentB, "b"]]) {
    rememberHostedPaymentAttempt({
      checkout: {
        provider: "HESABPAY",
        paymentAttemptId: `attempt-${suffix}`,
        paymentReference: `PAY-${suffix}`,
        orderId: `order-${suffix}`,
      },
      user,
      storage,
      nowMs: 1_000,
    });
  }

  forgetHostedPaymentAttempt({
    paymentAttemptId: "attempt-a",
    user: studentA,
    storage,
    nowMs: 2_000,
  });

  const remaining = JSON.parse(storage.getItem(hostedPaymentStorageKey));
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].paymentAttemptId, "attempt-b");
});

test("pending HesabPay resumes on the app status page, never its issued provider URL", () => {
  assert.equal(
    buildHostedPaymentStatusPath({
      paymentAttemptId: "attempt-a",
      paymentReference: "PAY-a",
      paymentUrl: "https://checkout.example.test/one-time-session",
    }),
    "/payment/success?paymentAttemptId=attempt-a",
  );
  assert.equal(
    buildHostedPaymentStatusPath({
      paymentReference: "PAY with spaces",
      paymentUrl: "https://checkout.example.test/one-time-session",
    }),
    "/payment/success?ref=PAY%20with%20spaces",
  );
});
