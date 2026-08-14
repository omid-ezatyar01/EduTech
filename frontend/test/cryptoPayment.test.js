import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCryptoPaymentAmount,
  trimCryptoAmountTrailingZeros,
} from "../src/utils/cryptoPayment.js";

test("direct BSC checkout displays the exact unique amount required by verification", () => {
  const payment = {
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    baseAmountUsdCents: 1500,
    amount: "15.054321",
  };

  assert.equal(resolveCryptoPaymentAmount(payment), "15.054321");
  assert.notEqual(resolveCryptoPaymentAmount(payment), "15");
});

test("crypto payment amounts retain meaningful precision and omit trailing zeros", () => {
  assert.equal(trimCryptoAmountTrailingZeros("12.340000"), "12.34");
  assert.equal(resolveCryptoPaymentAmount({ amount: "12.000000" }), "12");
});
