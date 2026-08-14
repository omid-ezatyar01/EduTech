import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { validateEnv } from "../src/config/env.js";

const originalEnv = { ...process.env };

const restoreEnvironment = () => {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
};

afterEach(restoreEnvironment);

const setPaymentEnvironment = (overrides = {}) => {
  Object.assign(process.env, {
    NODE_ENV: "development",
    MONGODB_URI: "mongodb://127.0.0.1:27017/edutech-test",
    JWT_SECRET: "test-secret-not-used-outside-env-validation",
    CLIENT_ORIGIN: "http://localhost:5173",
    COURSE_PUBLIC_ORIGIN: "",
    IRAN_MARKET_RATE_PROVIDER: "currencyapi",
    CURRENCYAPI_API_KEY: "",
    HESABPAY_API_KEY: "test-key",
    HESABPAY_BASE_URL: "https://api-sandbox.hesab.com",
    BACKEND_PUBLIC_URL: "http://localhost:5000",
    NOWPAYMENTS_API_KEY: "",
    NOWPAYMENTS_IPN_SECRET: "",
    NOWPAYMENTS_IPN_URL: "",
    BSC_RPC_URL: "",
    BSC_RECIPIENT_ADDRESS: "",
    BSC_USDT_CONTRACT_ADDRESS: "",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM_EMAIL: "",
    WEB_PUSH_VAPID_PUBLIC_KEY: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "",
    WEB_PUSH_CONTACT: "",
    ...overrides,
  });
};

test("live HesabPay cannot start with a localhost callback even in development", () => {
  setPaymentEnvironment({
    HESABPAY_BASE_URL: "https://api.hesab.com",
  });

  assert.throws(
    () => validateEnv(),
    /BACKEND_PUBLIC_URL must be a public https:\/\/ URL when live HesabPay is enabled/,
  );
});

test("live HesabPay accepts a public HTTPS backend callback origin", () => {
  setPaymentEnvironment({
    HESABPAY_BASE_URL: "https://api.hesab.com",
    BACKEND_PUBLIC_URL: "https://api.example.test",
  });

  const value = validateEnv();
  assert.equal(value.BACKEND_PUBLIC_URL, "https://api.example.test");
});

test("a keyed custom Hesab gateway cannot bypass the public callback guard", () => {
  setPaymentEnvironment({
    HESABPAY_BASE_URL: "https://hesab-gateway.example.test",
  });

  assert.throws(
    () => validateEnv(),
    /BACKEND_PUBLIC_URL must be a public https:\/\/ URL when live HesabPay is enabled/,
  );
});

test("sandbox HesabPay remains available for local development", () => {
  setPaymentEnvironment();

  const value = validateEnv();
  assert.equal(value.HESABPAY_BASE_URL, "https://api-sandbox.hesab.com");
});
