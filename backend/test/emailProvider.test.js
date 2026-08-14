import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { validateEnv } from "../src/config/env.js";
import { resolveEmailProvider, sendEduTechEmail } from "../src/utils/Email.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  globalThis.fetch = originalFetch;
});

const setBaseEnv = (overrides = {}) => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://127.0.0.1:27017/edutech-test",
    JWT_SECRET: "test-secret",
    CLIENT_ORIGIN: "http://localhost:5173",
    COURSE_PUBLIC_ORIGIN: "",
    HESABPAY_API_KEY: "",
    NOWPAYMENTS_API_KEY: "",
    BSC_RPC_URL: "",
    BSC_RECIPIENT_ADDRESS: "",
    BSC_USDT_CONTRACT_ADDRESS: "",
    WEB_PUSH_VAPID_PUBLIC_KEY: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "",
    WEB_PUSH_CONTACT: "",
    EMAIL_PROVIDER: "auto",
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM_EMAIL: "",
    ...overrides,
  });
};

test("auto email provider prefers Resend when an API key exists", () => {
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "auto", RESEND_API_KEY: "re_test" }), "resend");
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "auto", RESEND_API_KEY: "" }), "smtp");
});

test("explicit provider selection overrides auto detection", () => {
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "smtp", RESEND_API_KEY: "re_test" }), "smtp");
  assert.equal(resolveEmailProvider({ EMAIL_PROVIDER: "resend" }), "resend");
});

test("Resend configuration validates without SMTP settings", () => {
  setBaseEnv({
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "EduTech <info@example.com>",
  });

  const value = validateEnv();
  assert.equal(value.EMAIL_PROVIDER, "resend");
  assert.equal(value.SMTP_HOST, "");
});

test("Resend selection requires both API key and from address", () => {
  setBaseEnv({ EMAIL_PROVIDER: "resend" });

  assert.throws(
    () => validateEnv(),
    /RESEND_API_KEY is required.*RESEND_FROM_EMAIL is required/,
  );
});

test("transactional email is sent through the Resend API when selected", async () => {
  setBaseEnv({
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test_delivery",
    RESEND_FROM_EMAIL: "EduTech <info@example.com>",
  });

  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ id: "email_test_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await sendEduTechEmail({
    to: "student@example.com",
    subject: "Test message",
    heading: "Test",
    body: "Email provider test",
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  const body = JSON.parse(request.options.body);
  assert.equal(body.from, "EduTech <info@example.com>");
  assert.equal(body.to, "student@example.com");
  assert.equal(result.id, "email_test_123");
  assert.equal(result.messageId, "email_test_123");
});
