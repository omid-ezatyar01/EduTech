import assert from "node:assert/strict";
import test from "node:test";
import { normalizePriceInput } from "../src/utils/coursePricingForm.js";

test("price input supports normal typing and complete deletion", () => {
  assert.equal(normalizePriceInput("1"), "1");
  assert.equal(normalizePriceInput("10"), "10");
  assert.equal(normalizePriceInput(""), "");
});

test("price input accepts pasted and localized Toman values", () => {
  assert.equal(normalizePriceInput("700,000"), "700000");
  assert.equal(normalizePriceInput("۷۰۰٬۰۰۰"), "700000");
  assert.equal(normalizePriceInput("٧٠٠٠٠٠"), "700000");
});

test("price input preserves one decimal separator across mobile keyboards", () => {
  assert.equal(normalizePriceInput("1."), "1.");
  assert.equal(normalizePriceInput("۱٫۵"), "1.5");
  assert.equal(normalizePriceInput("1.2.3"), "1.23");
});

