import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeUsdRateInToman,
  tomanToUsd,
  usdToToman,
} from "../src/utils/currencyConversion.js";

test("converts teacher-entered toman to USD using a raw IRR rate", () => {
  const usd = tomanToUsd(7_000_000, 1_900_000);

  assert.equal(normalizeUsdRateInToman(1_900_000), 190_000);
  assert.equal(usd.toFixed(2), "36.84");
});

test("converts USD back to the exact toman snapshot", () => {
  assert.equal(usdToToman(36.84, 1_900_000), 6_999_600);
});

test("rejects non-finite, zero, and negative conversion inputs", () => {
  assert.throws(() => tomanToUsd("not-a-number", 1_900_000), /Invalid toman amount/);
  assert.throws(() => tomanToUsd(-1, 1_900_000), /Invalid toman amount/);
  assert.throws(() => tomanToUsd(7_000_000, 0), /Invalid USD to IRR rate/);
  assert.throws(() => tomanToUsd(7_000_000, Number.POSITIVE_INFINITY), /Invalid USD to IRR rate/);
});
