import axios from "axios";
import Decimal from "decimal.js";
import fs from "fs/promises";
import path from "path";

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
  };
};

const ZERO_DECIMAL_CURRENCIES = new Set(["AFN", "IRR"]);
const SIX_DECIMAL_CURRENCIES = new Set(["USDT"]);
const DAILY_REFRESH_SYMBOLS = ["AFN", "IRR", "USDT"];
const KABUL_UTC_OFFSET_MINUTES = 270;
const PERSISTED_CACHE_PATH = path.resolve(process.cwd(), "cache", "exchange-rates.json");

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

const getCurrencyScale = (symbol) => {
  if (ZERO_DECIMAL_CURRENCIES.has(symbol)) return 0;
  if (SIX_DECIMAL_CURRENCIES.has(symbol)) return 6;
  return 2;
};

const getNextKabulNoonMs = (nowMs = Date.now()) => {
  const shiftedNow = new Date(nowMs + KABUL_UTC_OFFSET_MINUTES * 60 * 1000);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();
  const hour = shiftedNow.getUTCHours();
  const minute = shiftedNow.getUTCMinutes();
  const second = shiftedNow.getUTCSeconds();
  const millisecond = shiftedNow.getUTCMilliseconds();

  const useTomorrow =
    hour > 12 ||
    (hour === 12 && (minute > 0 || second > 0 || millisecond > 0));

  return Date.UTC(year, month, day + (useTomorrow ? 1 : 0), 12, 0, 0, 0)
    - KABUL_UTC_OFFSET_MINUTES * 60 * 1000;
};

const isFreshUntilKabulNoon = (cachedAt) => {
  if (!Number.isFinite(cachedAt)) return false;
  return Date.now() < getNextKabulNoonMs(cachedAt);
};

const getFreshCachedRate = (symbol, cacheTtlMs) => {
  const rate = cachedRates.get(symbol);
  const cachedAt = cachedAtBySymbol.get(symbol);
  if (
    Number.isFinite(rate) &&
    Number.isFinite(cachedAt) &&
    (isFreshUntilKabulNoon(cachedAt) || Date.now() - cachedAt < cacheTtlMs)
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
  const payload = {
    ratesBySymbol: Object.fromEntries(cachedRates.entries()),
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
    const ratesBySymbol = parsed?.ratesBySymbol || {};
    const savedAtBySymbol = parsed?.savedAtBySymbol || {};
    const sourceBySymbol = parsed?.sourceBySymbol || {};
    const lastKnownGood = parsed?.lastKnownGoodBySymbol || {};

    for (const [key, value] of Object.entries(ratesBySymbol)) {
      const symbol = String(key || "").trim().toUpperCase();
      const rate = Number(value);
      const cachedAt = Number(savedAtBySymbol?.[key] || savedAtBySymbol?.[symbol] || 0);
      if (!symbol || !Number.isFinite(rate) || rate <= 0) continue;
      if (!isFreshUntilKabulNoon(cachedAt)) continue;

      cachedRates.set(symbol, rate);
      cachedAtBySymbol.set(symbol, cachedAt);
      cachedSourceBySymbol.set(symbol, String(sourceBySymbol?.[key] || sourceBySymbol?.[symbol] || "persisted"));
    }

    for (const [key, value] of Object.entries(lastKnownGood)) {
      const symbol = String(key || "").trim().toUpperCase();
      const rate = Number(value);
      if (!symbol || !Number.isFinite(rate) || rate <= 0) continue;
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
    setCachedRate(symbol, rate, source);
    lastKnownGoodBySymbol.set(symbol, rate);
  }

  await persistCacheToDisk();
};

export const getUsdRateForCurrency = async (currency) => {
  await loadPersistentCacheIfNeeded();
  const symbol = String(currency || "AFN").trim().toUpperCase();
  const {
    cacheTtlMs,
    timeoutMs,
    fallbackRate,
    defaultRate,
    provider,
  } = getExchangeRateConfig();

  const cached = getFreshCachedRate(symbol, cacheTtlMs);
  if (cached) return cached;

  try {
    const refreshSymbols = provider === "currencyfreaks" ? DAILY_REFRESH_SYMBOLS : [symbol];
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

    if (Number.isFinite(lastKnownGood) && lastKnownGood > 0) {
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
  persistentCacheLoaded = false;
};
