import assert from "node:assert/strict";
import test from "node:test";

import { getNextExchangeRateRefreshAt } from "../src/utils/exchangeRateSchedule.js";

test("next Kabul refresh is 11:00 before the morning checkpoint", () => {
  assert.equal(
    getNextExchangeRateRefreshAt(
      new Date("2026-07-27T05:00:00.000Z"),
    ).toISOString(),
    "2026-07-27T06:30:00.000Z",
  );
});

test("next Kabul refresh is 13:00 after the 11:00 checkpoint", () => {
  assert.equal(
    getNextExchangeRateRefreshAt(
      new Date("2026-07-27T07:00:00.000Z"),
    ).toISOString(),
    "2026-07-27T08:30:00.000Z",
  );
});

test("next Kabul refresh rolls to tomorrow at 11:00 after 13:00", () => {
  assert.equal(
    getNextExchangeRateRefreshAt(
      new Date("2026-07-27T09:00:00.000Z"),
    ).toISOString(),
    "2026-07-28T06:30:00.000Z",
  );
});
