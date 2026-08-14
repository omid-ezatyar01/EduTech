import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import nock from "nock";

import {
  createPaymentSession,
  isValidHesabCheckoutUrl,
} from "../src/services/hesabpay.service.js";

beforeEach(() => {
  nock.cleanAll();
  process.env.HESABPAY_API_KEY = "hesab-session-test-key";
  process.env.HESABPAY_BASE_URL = "https://api.hesab.test";
});

afterEach(() => nock.cleanAll());

const sessionInput = {
  email: "student@example.com",
  userId: "68b000000000000000000001",
  currency: "AFN",
  amount: 1050,
  items: [{ id: "PAY-session-test", name: "Course", amount: 1050 }],
  redirectSuccessUrl: "https://student.example.test/payment/success",
  redirectFailureUrl: "https://student.example.test/payment/failure",
};

test("Hesab session rejects an id-only response instead of synthesizing a checkout URL", async () => {
  nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      success: true,
      status_code: 10,
      session_id: "session-without-provider-url",
    });

  await assert.rejects(
    () => createPaymentSession(sessionInput),
    (error) =>
      error?.provider === "HESABPAY" &&
      error?.status === 502 &&
      /valid HTTPS checkout URL/i.test(error?.message || ""),
  );
});

test("Hesab session rejects non-Hesab and non-HTTPS checkout URLs", async () => {
  for (const url of [
    "https://hesab.com.attacker.example/pay/session",
    "http://checkout.hesab.com/pay/session",
  ]) {
    nock("https://api.hesab.test")
      .post("/api/v1/payment/create-session")
      .reply(200, { success: true, status_code: 10, url });

    await assert.rejects(
      () => createPaymentSession(sessionInput),
      (error) => error?.provider === "HESABPAY" && error?.status === 502,
    );
  }
});

test("Hesab session accepts only an explicit successful response with an official HTTPS URL", async () => {
  const checkoutUrl = "https://developers.hesab.com/pay/session-123/en";
  nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session", (body) => (
      body.user_id === sessionInput.userId && body.currency === "AFN"
    ))
    .reply(200, {
      success: true,
      status_code: 10,
      data: {
        session_id: "session-123",
        url: checkoutUrl,
      },
    });

  const result = await createPaymentSession(sessionInput);
  assert.equal(result.payment_url, checkoutUrl);
  assert.equal(result.session_id, "session-123");
  assert.equal(isValidHesabCheckoutUrl(checkoutUrl), true);
});
