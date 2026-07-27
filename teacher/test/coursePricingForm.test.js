import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePriceInput,
  validateRegionalPricingForm,
} from "../src/utils/coursePricingForm.js";
import { formatUsdToLocalCalculation } from "../src/utils/currencyDisplay.js";

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

const regionalPrices = {
  international: {
    currency: "USD",
    regularPrice: "20",
    discountedPrice: "15",
    regularPriceUsd: 20,
    discountedPriceUsd: 15,
    usdExchangeRate: 1,
    isFree: false,
  },
  afghanistan: {
    currency: "AFN",
    regularPrice: 1_185,
    discountedPrice: 922.5,
    regularPriceUsd: 18,
    discountedPriceUsd: 14,
    usdExchangeRate: 65.833333,
    isFree: false,
    useInternationalPrice: false,
  },
  iran: {
    currency: "TOMAN",
    regularPrice: 0,
    discountedPrice: null,
    regularPriceUsd: null,
    discountedPriceUsd: null,
    usdExchangeRate: null,
    isFree: false,
    useInternationalPrice: true,
  },
};

test("regional prices may be lower than the international USD price", () => {
  assert.deepEqual(validateRegionalPricingForm(regionalPrices), {});
});

test("regional prices may be higher than the international USD price", () => {
  const errors = validateRegionalPricingForm({
    ...regionalPrices,
    afghanistan: {
      ...regionalPrices.afghanistan,
      regularPrice: 1_382.5,
      regularPriceUsd: 21,
      discountedPrice: 1_053.33,
      discountedPriceUsd: 16,
    },
  });

  assert.deepEqual(errors, {});
});

test("income calculation displays the saved AFN payment snapshot", () => {
  assert.equal(
    formatUsdToLocalCalculation(
      {
        baseRevenue: 20,
        sourcePriceAmount: 1_317.93,
        sourcePriceCurrency: "AFN",
        sourceExchangeRate: 65.8965,
      },
      "en",
    ),
    "20 USD × 65.8965 AFN/USD = 1,317.93 AFN",
  );
});

test("income calculation normalizes legacy IRR snapshots to toman", () => {
  assert.equal(
    formatUsdToLocalCalculation(
      {
        baseRevenue: 36.84,
        sourcePriceAmount: 70_000_000,
        sourcePriceCurrency: "IRR",
        sourceExchangeRate: 1_900_000,
      },
      "en",
    ),
    "36.84 USD × 190,000 TOMAN/USD = 7,000,000 TOMAN",
  );
});
