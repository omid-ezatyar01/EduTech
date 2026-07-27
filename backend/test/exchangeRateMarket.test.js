import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import nock from "nock";

import {
  __resetExchangeRateCacheForTests,
  getUsdRateForCurrency,
  parseIranMarketRate,
  refreshCurrencyApiRates,
} from "../src/services/exchangeRate.service.js";

beforeEach(() => {
  nock.cleanAll();
  __resetExchangeRateCacheForTests();
  process.env.IRAN_MARKET_RATE_PROVIDER = "currencyapi";
  process.env.IRAN_MARKET_CACHE_TTL_MS = "86400000";
  process.env.CURRENCYAPI_API_KEY = "test-currencyapi-key";
  process.env.CURRENCYAPI_BASE_URL = "https://api.currencyapi.test/v3";
  process.env.IRAN_MARKET_MIN_USD_TO_TOMAN_RATE = "50000";
  process.env.CURRENCYFREAKS_TIMEOUT_MS = "2000";
});

afterEach(() => {
  nock.cleanAll();
});

test("selects CurrencyAPI data.IRR.value and caches it for the daily request budget", async () => {
  const scope = nock("https://api.currencyapi.test", {
    reqheaders: { apikey: "test-currencyapi-key" },
  })
    .get("/v3/latest")
    .query({ base_currency: "USD", currencies: "AFN,IRR,USDT" })
    .reply(200, {
      meta: {
        last_updated_at: "2026-07-26T23:59:59Z",
      },
      data: {
        AFN: {
          code: "AFN",
          value: 65.8965104928,
        },
        IRR: {
          code: "IRR",
          value: 1_375_372.4039216,
        },
        USDT: {
          code: "USDT",
          value: 1.0000603445,
        },
      },
    });

  const result = await getUsdRateForCurrency("IRR");
  const cachedResult = await getUsdRateForCurrency("IRR");
  const cachedAfnResult = await getUsdRateForCurrency("AFN");
  const cachedUsdtResult = await getUsdRateForCurrency("USDT");

  assert.equal(result.rate, 1_375_372.4039216);
  assert.equal(result.normalizedTomanRate, 137_537.24039216);
  assert.equal(result.selectedField, "data.IRR.value");
  assert.equal(result.source, "currencyapi_market");
  assert.equal(cachedResult.rate, result.rate);
  assert.equal(cachedAfnResult.rate, 65.8965104928);
  assert.equal(cachedAfnResult.source, "currencyapi");
  assert.equal(cachedUsdtResult.rate, 1.0000603445);
  assert.equal(cachedUsdtResult.source, "currencyapi");
  assert.equal(scope.isDone(), true);
});

test("normalizes a market provider value expressed in IRR", () => {
  const result = parseIranMarketRate(
    { usd_sell: { value: "1900000" } },
    { field: "usd_sell", unit: "rial", minimumTomanRate: 50000 },
  );

  assert.equal(result.rialRate, 1_900_000);
  assert.equal(result.tomanRate, 190_000);
});

test("rejects the old official 4,200 toman rate", () => {
  assert.throws(
    () =>
      parseIranMarketRate(
        { usd_sell: { value: "4200" } },
        { field: "usd_sell", unit: "toman", minimumTomanRate: 50000 },
      ),
    /below the configured free-market minimum/,
  );
});

test("a scheduled refresh bypasses a fresh cache and saves new values", async () => {
  const scope = nock("https://api.currencyapi.test", {
    reqheaders: { apikey: "test-currencyapi-key" },
  })
    .get("/v3/latest")
    .query({ base_currency: "USD", currencies: "AFN,IRR,USDT" })
    .reply(200, {
      meta: { last_updated_at: "2026-07-27T08:30:00Z" },
      data: {
        AFN: { code: "AFN", value: 66.25 },
        IRR: { code: "IRR", value: 1_400_000 },
        USDT: { code: "USDT", value: 1.0001 },
      },
    });

  const rates = await refreshCurrencyApiRates({ reason: "test_schedule" });

  assert.equal(rates.AFN, 66.25);
  assert.equal(rates.IRR, 1_400_000);
  assert.equal(rates.TOMAN, 140_000);
  assert.equal(rates.USDT, 1.0001);
  assert.equal(scope.isDone(), true);
});
