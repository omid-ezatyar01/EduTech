import assert from "node:assert/strict";
import test from "node:test";

import {
  extractBankPaymentSubmission,
  hasUsableBankPaymentInfo,
  isValidIranianSheba,
  normalizeBankPaymentInfo,
  validateAndNormalizeBankPaymentInfo,
} from "../src/utils/bankPaymentInfo.js";

test("teacher profile submission without bank fields does not create a bank review submission", () => {
  const result = extractBankPaymentSubmission({
    name: "Teacher Name",
    teacherApplication: JSON.stringify({ professionalTitle: "English teacher" }),
    teacherApplicationAction: "submit_for_review",
  });

  assert.equal(result.submitted, false);
  assert.equal(result.value, undefined);
});

test("bank review submission is detected only when bank details are explicitly sent", () => {
  const result = extractBankPaymentSubmission({
    bankPaymentInfo: JSON.stringify({
      country: "IR",
      accountHolderName: "Omid Ezatyar",
      bankName: "Melli",
      cardNumber: "6037997512345678",
    }),
    bankCountry: "IR",
  });

  assert.equal(result.submitted, true);
  assert.equal(result.value.country, "IR");
  assert.equal(result.value.cardNumber, "6037997512345678");
});

test("Afghanistan bank info saves successfully without IBAN", () => {
  const result = validateAndNormalizeBankPaymentInfo({
    country: "AF",
    accountHolderName: "Omid Ezatyar",
    bankName: "AIB",
    accountNumber: "6569650000408109",
    iban: "",
  });

  assert.equal(result.country, "AF");
  assert.equal(result.accountNumber, "6569650000408109");
  assert.equal(result.iban, "");
  assert.equal(result.currency, "AFN");
});

test("Iran bank info saves successfully with only a valid 16-digit card number", () => {
  const result = validateAndNormalizeBankPaymentInfo({
    country: "IR",
    accountHolderName: "Omid Ezatyar",
    bankName: "Melli",
    cardNumber: "6037 9975-1234 5678",
  });

  assert.equal(result.country, "IR");
  assert.equal(result.cardNumber, "6037997512345678");
  assert.equal(result.currency, "IRR");
});

test("Iran bank info requires at least one of card number, Shaba, or account number", () => {
  const result = validateAndNormalizeBankPaymentInfo({
    country: "IR",
    accountHolderName: "Omid Ezatyar",
    bankName: "Melli",
    cardNumber: "",
    accountNumber: "",
    iban: "",
  });

  assert.deepEqual(result, {
    error: "حداقل یکی از شماره کارت، شماره شبا یا شماره حساب را وارد کنید.",
  });
});

test("Iran bank info rejects invalid Shaba values", () => {
  const result = validateAndNormalizeBankPaymentInfo({
    country: "IR",
    accountHolderName: "Omid Ezatyar",
    bankName: "Melli",
    iban: "1111",
  });

  assert.deepEqual(result, {
    error: "شماره شبا باید با IR شروع شود و شامل ۲۴ رقم باشد.",
  });
});

test("Changing country from Iran to Afghanistan clears the old Shaba before validation", () => {
  const normalized = normalizeBankPaymentInfo({
    country: "AF",
    accountHolderName: "Omid Ezatyar",
    bankName: "AIB",
    accountNumber: "6569650000408109",
    iban: "IR062960000000100324200001",
  });

  assert.equal(normalized.iban, "");

  const result = validateAndNormalizeBankPaymentInfo(normalized);
  assert.equal(result.country, "AF");
  assert.equal(result.iban, "");
});

test("usable bank info detection supports both Afghanistan and Iran", () => {
  assert.equal(hasUsableBankPaymentInfo({
    country: "AF",
    accountHolderName: "Omid Ezatyar",
    bankName: "AIB",
    accountNumber: "6569650000408109",
  }), true);

  assert.equal(hasUsableBankPaymentInfo({
    country: "IR",
    accountHolderName: "Omid Ezatyar",
    bankName: "Melli",
    cardNumber: "6037997512345678",
  }), true);
});

test("Iranian Shaba checksum validator accepts a valid sample", () => {
  assert.equal(isValidIranianSheba("IR062960000000100324200001"), true);
});
