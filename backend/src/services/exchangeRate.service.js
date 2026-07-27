import axios from "axios";
import Decimal from "decimal.js";
import fs from "fs/promises";
import path from "path";
import {
  assertPositiveFiniteRate,
  normalizeUsdRateInToman,
} from "../utils/currencyConversion.js";
import { getNextExchangeRateRefreshAt } from "../utils/exchangeRateSchedule.js";

const getExchangeRateConfig = () => {
  const defaultRate = Number(process.env.HESABPAY_USD_TO_AFN_RATE || 70);
  return {
    defaultRate,
    cacheTtlMs: Number(
      process.env.CURRENCYFREAKS_CACHE_TTL_MS ||
        process.env.HESABPAY_EXCHANGE_RATE_CACHE_TTL_MS ||
        300000,
    ),
    timeoutMs: Number(
      process.env.CURRENCYFREAKS_TIMEOUT_MS ||
        process.env.HESABPAY_EXCHANGE_RATE_TIMEOUT_MS ||
        10000,
    ),
    fallbackRate: Number(process.env.HESABPAY_EXCHANGE_RATE_EMERGENCY_FALLBACK_RATE || defaultRate),
    provider: String(process.env.EXCHANGE_RATE_PROVIDER || "currencyfreaks").trim().toLowerCase(),
    currencyFreaksApiKey: String(process.env.CURRENCYFREAKS_API_KEY || "").trim(),
    currencyFreaksBaseUrl: String(process.env.CURRENCYFREAKS_BASE_URL || "https://api.currencyfreaks.com/v2.0").trim().replace(/\/+$/, ""),
    legacyRateUrl: process.env.HESABPAY_EXCHANGE_RATE_API_URL || "https://open.er-api.com/v6/latest/USD",
    iranMarketProvider: String(
      process.env.IRAN_MARKET_RATE_PROVIDER || "currencyapi",
    ).trim().toLowerCase(),
    iranMarketCacheTtlMs: Number(
      process.env.IRAN_MARKET_CACHE_TTL_MS || 86400000,
    ),
    currencyApiApiKey: String(process.env.CURRENCYAPI_API_KEY || "").trim(),
    currencyApiBaseUrl: String(
      process.env.CURRENCYAPI_BASE_URL || "https://api.currencyapi.com/v3",
    ).trim().replace(/\/+$/, ""),
    navasanApiKey: String(process.env.NAVASAN_API_KEY || "").trim(),
    navasanBaseUrl: String(
      process.env.NAVASAN_BASE_URL || "https://api.navasan.tech",
    ).trim().replace(/\/+$/, ""),
    navasanUsdField: String(
      process.env.NAVASAN_USD_FIELD || "usd_sell.value",
    ).trim(),
    navasanRateUnit: String(
      process.env.NAVASAN_RATE_UNIT || "toman",
    ).trim().toLowerCase(),
    iranMarketMinTomanRate: Number(
      process.env.IRAN_MARKET_MIN_USD_TO_TOMAN_RATE || 50000,
    ),
  };
};

const ZERO_DECIMAL_CURRENCIES = new Set(["AFN", "IRR"]);
const SIX_DECIMAL_CURRENCIES = new Set(["USDT"]);
// CurrencyFreaks returns Iran's official 42,000 IRR rate. IRR is deliberately
// excluded and fetched from the dedicated free-market provider instead.
const DAILY_REFRESH_SYMBOLS = ["USDT"];
const PERSISTED_CACHE_PATH = path.resolve(process.cwd(), "cache", "exchange-rates.json");
const PERSISTED_CACHE_VERSION = 3;
const IRAN_MARKET_SOURCES = new Set([
  "currencyapi_market",
  "navasan_free_market",
]);

let cachedRates = new Map();
let cachedAtBySymbol = new Map();
let cachedSourceBySymbol = new Map();
let lastKnownGoodBySymbol = new Map();
let inFlightRateRequests = new Map();
let persistentCacheLoaded = false;

const parseRate = (payload, symbol) => {
  const candidates = [
    payload?.rates?.[symbol],
    payload?.conversion_rates?.[symbol],
    payload?.data?.[symbol],
    payload?.result?.[symbol],
  ];

  for (const candidate of candidates) {
    const rate = Number(candidate);
    if (Number.isFinite(rate) && rate > 0) return rate;
  }

  return null;
};

const parseNumericRate = (value) => {
  const rate = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

export const parseIranMarketRate = (
  payload,
  {
    field = "data.IRR.value",
    unit = "toman",
    minimumTomanRate = 50000,
  } = {},
) => {
  const selectedValue = String(field || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => value?.[key], payload);
  const rawValue = selectedValue?.value ?? selectedValue;
  const providerRate = parseNumericRate(rawValue);
  if (!providerRate) {
    throw new Error(`Unable to parse Iran market rate field "${field}"`);
  }

  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (!["rial", "toman"].includes(normalizedUnit)) {
    throw new Error("NAVASAN_RATE_UNIT must be either rial or toman");
  }

  const tomanRate =
    normalizedUnit === "rial"
      ? normalizeUsdRateInToman(providerRate)
      : providerRate;
  assertPositiveFiniteRate(tomanRate, "Invalid free-market USD/TOMAN rate");

  const minimum = Number(minimumTomanRate);
  assertPositiveFiniteRate(
    minimum,
    "Invalid IRAN_MARKET_MIN_USD_TO_TOMAN_RATE",
  );
  if (tomanRate < minimum) {
    throw new Error(
      `Rejected USD/TOMAN rate ${tomanRate}; it is below the configured free-market minimum ${minimum}`,
    );
  }

  return {
    rawValue,
    providerRate,
    providerUnit: normalizedUnit,
    tomanRate,
    rialRate: tomanRate * 10,
  };
};

const getCurrencyScale = (symbol) => {
  if (ZERO_DECIMAL_CURRENCIES.has(symbol)) return 0;
  if (SIX_DECIMAL_CURRENCIES.has(symbol)) return 6;
  return 2;
};

const getFreshCachedRate = (
  symbol,
  cacheTtlMs,
  expireAtScheduledRefresh = false,
) => {
  const rate = cachedRates.get(symbol);
  const cachedAt = cachedAtBySymbol.get(symbol);
  const nowMs = Date.now();
  const scheduledExpiryMs =
    expireAtScheduledRefresh && Number.isFinite(cachedAt)
      ? getNextExchangeRateRefreshAt(new Date(cachedAt)).getTime()
      : Number.POSITIVE_INFINITY;
  if (
    Number.isFinite(rate) &&
    Number.isFinite(cachedAt) &&
    nowMs - cachedAt >= 0 &&
    nowMs - cachedAt < cacheTtlMs &&
    nowMs < scheduledExpiryMs
  ) {
    return {
      rate,
      source: cachedSourceBySymbol.get(symbol) || "cache",
      rateRetrievedAt: new Date(cachedAt),
    };
  }

  return null;
};

const setCachedRate = (symbol, rate, source) => {
  const now = Date.now();
  cachedRates.set(symbol, rate);
  cachedAtBySymbol.set(symbol, now);
  cachedSourceBySymbol.set(symbol, source);
};

const persistCacheToDisk = async () => {
  const cachedIrrRate = Number(cachedRates.get("IRR"));
  const payload = {
    version: PERSISTED_CACHE_VERSION,
    ratesBySymbol: Object.fromEntries(cachedRates.entries()),
    normalizedRates: {
      TOMAN:
        Number.isFinite(cachedIrrRate) && cachedIrrRate > 0
          ? normalizeUsdRateInToman(cachedIrrRate)
          : null,
    },
    savedAtBySymbol: Object.fromEntries(cachedAtBySymbol.entries()),
    sourceBySymbol: Object.fromEntries(cachedSourceBySymbol.entries()),
    lastKnownGoodBySymbol: Object.fromEntries(lastKnownGoodBySymbol.entries()),
  };

  try {
    await fs.mkdir(path.dirname(PERSISTED_CACHE_PATH), { recursive: true });
    await fs.writeFile(PERSISTED_CACHE_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.warn(`Unable to persist exchange rate cache: ${error?.message || error}`);
  }
};

const loadPersistentCacheIfNeeded = async () => {
  if (persistentCacheLoaded) return;
  persistentCacheLoaded = true;

  try {
    const raw = await fs.readFile(PERSISTED_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.version !== PERSISTED_CACHE_VERSION) {
      return;
    }
    const ratesBySymbol = parsed?.ratesBySymbol || {};
    const savedAtBySymbol = parsed?.savedAtBySymbol || {};
    const sourceBySymbol = parsed?.sourceBySymbol || {};
    const lastKnownGood = parsed?.lastKnownGoodBySymbol || {};
    const {
      cacheTtlMs,
      iranMarketCacheTtlMs,
      iranMarketMinTomanRate,
    } = getExchangeRateConfig();

    for (const [key, value] of Object.entries(ratesBySymbol)) {
      const symbol = String(key || "").trim().toUpperCase();
      const rate = Number(value);
      const cachedAt = Number(savedAtBySymbol?.[key] || savedAtBySymbol?.[symbol] || 0);
      const cachedSource = String(
        sourceBySymbol?.[key] || sourceBySymbol?.[symbol] || "persisted",
      );
      if (!symbol || !Number.isFinite(rate) || rate <= 0) continue;
      if (
        symbol === "IRR" &&
        (!IRAN_MARKET_SOURCES.has(cachedSource) ||
          normalizeUsdRateInToman(rate) < iranMarketMinTomanRate)
      ) {
        continue;
      }
      if (
        !Number.isFinite(cachedAt) ||
        Date.now() - cachedAt < 0 ||
        Date.now() - cachedAt >=
          (["AFN", "IRR", "USDT"].includes(symbol) &&
          getExchangeRateConfig().iranMarketProvider === "currencyapi"
            ? iranMarketCacheTtlMs
            : cacheTtlMs) ||
        (["AFN", "IRR", "USDT"].includes(symbol) &&
          getExchangeRateConfig().iranMarketProvider === "currencyapi" &&
          Date.now() >=
            getNextExchangeRateRefreshAt(new Date(cachedAt)).getTime())
      ) {
        continue;
      }

      cachedRates.set(symbol, rate);
      cachedAtBySymbol.set(symbol, cachedAt);
      cachedSourceBySymbol.set(symbol, cachedSource);
    }

    for (const [key, value] of Object.entries(lastKnownGood)) {
      const symbol = String(key || "").trim().toUpperCase();
      const rate = Number(value);
      if (!symbol || !Number.isFinite(rate) || rate <= 0) continue;
      if (
        symbol === "IRR" &&
        (!IRAN_MARKET_SOURCES.has(
          String(sourceBySymbol?.[key] || sourceBySymbol?.[symbol] || ""),
        ) ||
          normalizeUsdRateInToman(rate) < iranMarketMinTomanRate)
      ) {
        continue;
      }
      const savedAt = Number(
        savedAtBySymbol?.[key] || savedAtBySymbol?.[symbol] || 0,
      );
      if (
        symbol === "IRR" &&
        (!Number.isFinite(savedAt) ||
          Date.now() - savedAt < 0 ||
          Date.now() - savedAt >= iranMarketCacheTtlMs)
      ) {
        continue;
      }
      lastKnownGoodBySymbol.set(symbol, rate);
    }
  } catch {
    // No persisted cache exists yet.
  }
};

const getInFlightKey = (symbols = []) => (
  [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))]
    .sort()
    .join(",")
);

const fetchCurrencyFreaksRates = async (symbols, timeoutMs) => {
  const { currencyFreaksApiKey, currencyFreaksBaseUrl } = getExchangeRateConfig();
  if (!currencyFreaksApiKey) {
    throw new Error("CURRENCYFREAKS_API_KEY is not configured");
  }

  const client = axios.create({
    timeout: timeoutMs,
  });
  const response = await client.get(`${currencyFreaksBaseUrl}/rates/latest`, {
    headers: { Accept: "application/json" },
    params: {
      apikey: currencyFreaksApiKey,
      symbols: symbols.join(","),
    },
  });

  return response.data;
};

const fetchLegacyRates = async (timeoutMs) => {
  const { legacyRateUrl } = getExchangeRateConfig();
  const client = axios.create({
    timeout: timeoutMs,
  });
  const response = await client.get(legacyRateUrl, {
    headers: { Accept: "application/json" },
  });
  return response.data;
};

const fetchIranMarketRate = async (timeoutMs) => {
  const {
    iranMarketProvider,
    currencyApiApiKey,
    currencyApiBaseUrl,
    navasanApiKey,
    navasanBaseUrl,
    navasanUsdField,
    navasanRateUnit,
    iranMarketMinTomanRate,
  } = getExchangeRateConfig();

  if (!["currencyapi", "navasan"].includes(iranMarketProvider)) {
    throw new Error(
      `Unsupported IRAN_MARKET_RATE_PROVIDER "${iranMarketProvider}"`,
    );
  }

  let response;
  let selectedField;
  let providerUnit;
  let source;

  if (iranMarketProvider === "currencyapi") {
    if (!currencyApiApiKey) {
      throw new Error(
        "CURRENCYAPI_API_KEY is required for the Iran market exchange rate",
      );
    }
    const requestKey = "currencyapi:AFN,IRR,USDT";
    let requestPromise = inFlightRateRequests.get(requestKey);
    if (!requestPromise) {
      requestPromise = axios.get(`${currencyApiBaseUrl}/latest`, {
        timeout: timeoutMs,
        headers: {
          Accept: "application/json",
          apikey: currencyApiApiKey,
        },
        params: {
          base_currency: "USD",
          currencies: "AFN,IRR,USDT",
        },
      });
      inFlightRateRequests.set(requestKey, requestPromise);
    }
    try {
      response = await requestPromise;
    } finally {
      if (inFlightRateRequests.get(requestKey) === requestPromise) {
        inFlightRateRequests.delete(requestKey);
      }
    }
    selectedField = "data.IRR.value";
    providerUnit = "rial";
    source = "currencyapi_market";
  } else {
    if (!navasanApiKey) {
      throw new Error(
        "NAVASAN_API_KEY is required for the Iran free-market exchange rate",
      );
    }
    response = await axios.get(`${navasanBaseUrl}/latest/`, {
      timeout: timeoutMs,
      headers: { Accept: "application/json" },
      params: { api_key: navasanApiKey },
    });
    selectedField = navasanUsdField;
    providerUnit = navasanRateUnit;
    source = "navasan_free_market";
  }

  if (process.env.CURRENCY_CONVERSION_DEBUG === "true") {
    console.debug("[iran-market-rate:raw-response]", response.data);
  }

  const parsed = parseIranMarketRate(response.data, {
    field: selectedField,
    unit: providerUnit,
    minimumTomanRate: iranMarketMinTomanRate,
  });
  const afnRate =
    iranMarketProvider === "currencyapi"
      ? parseNumericRate(response.data?.data?.AFN?.value)
      : null;
  const usdtRate =
    iranMarketProvider === "currencyapi"
      ? parseNumericRate(response.data?.data?.USDT?.value)
      : null;
  if (iranMarketProvider === "currencyapi") {
    assertPositiveFiniteRate(afnRate, "Invalid USD/AFN exchange rate");
    assertPositiveFiniteRate(usdtRate, "Invalid USD/USDT exchange rate");
  }

  if (process.env.CURRENCY_CONVERSION_DEBUG === "true") {
    console.debug("[iran-market-rate:selected]", {
      selectedField,
      rawSelectedValue: parsed.rawValue,
      providerUnit: parsed.providerUnit,
      normalizedRateInToman: parsed.tomanRate,
      normalizedRateInRial: parsed.rialRate,
    });
  }

  return {
    ...parsed,
    selectedField,
    source,
    afnRate,
    usdtRate,
    providerUpdatedAt: response.data?.meta?.last_updated_at || null,
  };
};

const cacheMarketRates = async (marketRate) => {
  if (marketRate.afnRate) {
    setCachedRate("AFN", marketRate.afnRate, "currencyapi");
    lastKnownGoodBySymbol.set("AFN", marketRate.afnRate);
  }
  if (marketRate.usdtRate) {
    setCachedRate("USDT", marketRate.usdtRate, "currencyapi");
    lastKnownGoodBySymbol.set("USDT", marketRate.usdtRate);
  }
  setCachedRate("IRR", marketRate.rialRate, marketRate.source);
  lastKnownGoodBySymbol.set("IRR", marketRate.rialRate);
  await persistCacheToDisk();
};

export const refreshCurrencyApiRates = async ({
  reason = "manual",
} = {}) => {
  await loadPersistentCacheIfNeeded();
  const { iranMarketProvider, timeoutMs } = getExchangeRateConfig();
  if (iranMarketProvider !== "currencyapi") {
    throw new Error(
      "Scheduled exchange-rate refresh requires IRAN_MARKET_RATE_PROVIDER=currencyapi",
    );
  }

  const marketRate = await fetchIranMarketRate(timeoutMs);
  await cacheMarketRates(marketRate);
  console.info("[exchange-rate:refreshed]", {
    reason,
    afnPerUsd: marketRate.afnRate,
    irrPerUsd: marketRate.rialRate,
    tomanPerUsd: marketRate.tomanRate,
    usdtPerUsd: marketRate.usdtRate,
    providerUpdatedAt: marketRate.providerUpdatedAt,
  });
  return {
    AFN: marketRate.afnRate,
    IRR: marketRate.rialRate,
    TOMAN: marketRate.tomanRate,
    USDT: marketRate.usdtRate,
    providerUpdatedAt: marketRate.providerUpdatedAt,
  };
};

const resolveRatesPayload = async (symbols, timeoutMs, provider) => {
  const normalizedSymbols = [...new Set(
    (Array.isArray(symbols) ? symbols : [symbols])
      .map((symbol) => String(symbol || "").trim().toUpperCase())
      .filter(Boolean),
  )];
  const requestKey = `${provider}:${getInFlightKey(normalizedSymbols)}`;

  if (inFlightRateRequests.has(requestKey)) {
    return inFlightRateRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    if (provider === "currencyfreaks") {
      return fetchCurrencyFreaksRates(normalizedSymbols, timeoutMs);
    }
    return fetchLegacyRates(timeoutMs);
  })();

  inFlightRateRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRateRequests.delete(requestKey);
  }
};

const updateCachedRatesFromPayload = async (payload, symbols, provider) => {
  const normalizedSymbols = [...new Set(
    (Array.isArray(symbols) ? symbols : [symbols])
      .map((symbol) => String(symbol || "").trim().toUpperCase())
      .filter(Boolean),
  )];
  const source = provider === "currencyfreaks" ? "currencyfreaks" : "api";

  for (const symbol of normalizedSymbols) {
    const rate = parseRate(payload, symbol);
    if (!rate) continue;
    assertPositiveFiniteRate(rate, `Invalid USD/${symbol} exchange rate`);
    setCachedRate(symbol, rate, source);
    lastKnownGoodBySymbol.set(symbol, rate);
    if (
      symbol === "IRR" &&
      process.env.CURRENCY_CONVERSION_DEBUG === "true"
    ) {
      console.debug("[exchange-rate]", {
        rawApiRateInRial: rate,
        normalizedRateInToman: normalizeUsdRateInToman(rate),
        source,
      });
    }
  }

  await persistCacheToDisk();
};

export const getUsdRateForCurrency = async (currency) => {
  await loadPersistentCacheIfNeeded();
  const symbol = String(currency || "AFN").trim().toUpperCase();
  const {
    cacheTtlMs,
    iranMarketCacheTtlMs,
    timeoutMs,
    fallbackRate,
    defaultRate,
    provider,
  } = getExchangeRateConfig();

  const usesCurrencyApiRate =
    getExchangeRateConfig().iranMarketProvider === "currencyapi" &&
    ["AFN", "IRR", "USDT"].includes(symbol);
  const effectiveCacheTtlMs =
    usesCurrencyApiRate ? iranMarketCacheTtlMs : cacheTtlMs;
  const cached = getFreshCachedRate(
    symbol,
    effectiveCacheTtlMs,
    usesCurrencyApiRate,
  );
  if (cached) {
    if (symbol === "IRR") {
      return {
        ...cached,
        normalizedTomanRate: normalizeUsdRateInToman(cached.rate),
        selectedField:
          getExchangeRateConfig().iranMarketProvider === "currencyapi"
            ? "data.IRR.value"
            : getExchangeRateConfig().navasanUsdField,
      };
    }
    if (symbol === "AFN" && usesCurrencyApiRate) {
      return {
        ...cached,
        selectedField: "data.AFN.value",
      };
    }
    if (symbol === "USDT" && usesCurrencyApiRate) {
      return {
        ...cached,
        selectedField: "data.USDT.value",
      };
    }
    return cached;
  }

  try {
    if (usesCurrencyApiRate || symbol === "IRR") {
      const marketRate = await fetchIranMarketRate(timeoutMs);
      await cacheMarketRates(marketRate);
      if (symbol === "AFN") {
        return {
          rate: marketRate.afnRate,
          source: "currencyapi",
          selectedField: "data.AFN.value",
          providerUpdatedAt: marketRate.providerUpdatedAt,
          rateRetrievedAt: new Date(cachedAtBySymbol.get("AFN")),
        };
      }
      if (symbol === "USDT") {
        return {
          rate: marketRate.usdtRate,
          source: "currencyapi",
          selectedField: "data.USDT.value",
          providerUpdatedAt: marketRate.providerUpdatedAt,
          rateRetrievedAt: new Date(cachedAtBySymbol.get("USDT")),
        };
      }
      return {
        rate: marketRate.rialRate,
        normalizedTomanRate: marketRate.tomanRate,
        source: marketRate.source,
        selectedField: marketRate.selectedField,
        providerUpdatedAt: marketRate.providerUpdatedAt,
        rateRetrievedAt: new Date(cachedAtBySymbol.get("IRR")),
      };
    }

    const refreshSymbols =
      provider === "currencyfreaks"
        ? symbol === "AFN"
          ? ["AFN"]
          : DAILY_REFRESH_SYMBOLS
        : [symbol];
    const payload = await resolveRatesPayload(refreshSymbols, timeoutMs, provider);
    await updateCachedRatesFromPayload(payload, refreshSymbols, provider);
    const rate = parseRate(payload, symbol);
    if (!rate) {
      throw new Error(`Unable to parse USD/${symbol} exchange rate`);
    }
    return {
      rate,
      source: cachedSourceBySymbol.get(symbol) || (provider === "currencyfreaks" ? "currencyfreaks" : "api"),
      rateRetrievedAt: new Date(cachedAtBySymbol.get(symbol)),
    };
  } catch (error) {
    const lastKnownGood = lastKnownGoodBySymbol.get(symbol);
    const lastKnownAt = cachedAtBySymbol.get(symbol);
    const staleIrrFallback =
      symbol === "IRR" &&
      (!Number.isFinite(lastKnownAt) ||
        Date.now() - lastKnownAt < 0 ||
        Date.now() - lastKnownAt >= effectiveCacheTtlMs);

    if (
      Number.isFinite(lastKnownGood) &&
      lastKnownGood > 0 &&
      !staleIrrFallback
    ) {
      setCachedRate(symbol, lastKnownGood, "fallback");
      console.warn(`USD/${symbol} exchange rate cached fallback used: ${error?.message || error}`);
      return {
        rate: lastKnownGood,
        source: "fallback",
        rateRetrievedAt: new Date(cachedAtBySymbol.get(symbol)),
      };
    }

    if (symbol === "AFN") {
      const resolvedFallbackRate = fallbackRate || defaultRate;
      setCachedRate(symbol, resolvedFallbackRate, "fallback");
      console.warn(`USD/AFN exchange rate emergency fallback used: ${error?.message || error}`);
      return {
        rate: resolvedFallbackRate,
        source: "fallback",
        rateRetrievedAt: new Date(cachedAtBySymbol.get(symbol)),
      };
    }

    throw error;
  }
};

export const getUsdToAfnRate = async () => getUsdRateForCurrency("AFN");

export const getUsdRatesForCurrencies = async (currencies = []) => {
  const normalizedSymbols = [...new Set(
    (Array.isArray(currencies) ? currencies : [currencies])
      .map((currency) => String(currency || "").trim().toUpperCase())
      .filter(Boolean),
  )];
  const entries = await Promise.all(
    normalizedSymbols.map(async (symbol) => [symbol, await getUsdRateForCurrency(symbol)]),
  );
  return Object.fromEntries(entries);
};

export const quoteFromUsdCents = async (usdCents, currency) => {
  const symbol = String(currency || "AFN").trim().toUpperCase();
  const { rate, source, rateRetrievedAt } = await getUsdRateForCurrency(symbol);
  const decimalPlaces = getCurrencyScale(symbol);
  const amount = new Decimal(usdCents || 0)
    .div(100)
    .mul(rate)
    .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);

  return {
    amount: Decimal.max(amount, new Decimal(decimalPlaces === 0 ? 1 : 0)).toFixed(decimalPlaces),
    exchangeRate: new Decimal(rate).toFixed(8).replace(/\.?0+$/, ""),
    exchangeRateSource: source,
    rateRetrievedAt,
    currencyTo: symbol,
  };
};

export const quoteAfnFromUsdCents = async (usdCents) => {
  return quoteFromUsdCents(usdCents, "AFN");
};

export const __resetExchangeRateCacheForTests = () => {
  cachedRates = new Map();
  cachedAtBySymbol = new Map();
  cachedSourceBySymbol = new Map();
  lastKnownGoodBySymbol = new Map();
  inFlightRateRequests = new Map();
  // Unit tests must not silently reload a real on-disk rate after clearing the
  // in-memory cache; each test controls its provider response explicitly.
  persistentCacheLoaded = true;
};
