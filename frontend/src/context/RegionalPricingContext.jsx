import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getUsdExchangeRates } from "../../services/paymentGateway.js";
import {
  getDisplayCurrency,
  getDisplayCurrencyAmount,
  getDisplayCurrencyLabel,
} from "../utils/currencyDisplay.js";

const RegionalPricingContext = createContext(null);

const DEFAULT_RATES = {
  AFN: null,
  IRR: null,
  USDT: null,
};
const RATES_CACHE_KEY = "edutech_regional_rates_v1";
const COUNTRY_CACHE_KEY = "edutech_regional_country_v1";

const normalizePricingRegion = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["af", "afghanistan"].includes(normalized)) return "afghanistan";
  if (["ir", "iran"].includes(normalized)) return "iran";
  return "international";
};

const countryCodeForPricingRegion = (region) => {
  if (region === "afghanistan") return "AF";
  if (region === "iran") return "IR";
  return "INTL";
};

const resolveDisplayCurrency = (countryCode = "") => {
  const normalized = String(countryCode || "").trim().toUpperCase();
  if (normalized === "AF") return "AFN";
  if (normalized === "IR") return "TOMAN";
  return "USD";
};

const getFractionDigits = (currency) => {
  if (currency === "AFN" || currency === "IRR" || currency === "TOMAN") return 0;
  if (currency === "USDT") return 6;
  return 2;
};

const getCurrencyLabel = (currency, language = "fa") => {
  const normalized = String(currency || "USD").toUpperCase();

  if (normalized === "USDT") {
    return "USDT";
  }

  return getDisplayCurrencyLabel(normalized, language);
};

const formatAmount = (amount, currency, language = "fa") => {
  const locale = language === "fa" ? "fa-AF" : "en-US";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: getFractionDigits(currency),
  }).format(Number(amount || 0));
};

async function detectCountryFromProviders() {
  const providers = [
    {
      name: "ipwho.is",
      url: "https://ipwho.is/",
      parse: (data) => ({
        ok: data.success !== false && Boolean(data.country_code),
        countryCode: (data.country_code || "").toUpperCase(),
        countryName: data.country || "",
      }),
    },
    {
      name: "ipapi.co",
      url: "https://ipapi.co/json/",
      parse: (data) => ({
        ok: !data.error && Boolean(data.country_code),
        countryCode: (data.country_code || "").toUpperCase(),
        countryName: data.country_name || "",
      }),
    },
    {
      name: "freeipapi",
      url: "https://freeipapi.com/api/json",
      parse: (data) => ({
        ok: Boolean(data.countryCode),
        countryCode: (data.countryCode || "").toUpperCase(),
        countryName: data.countryName || "",
      }),
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      const data = await response.json();
      const parsed = provider.parse(data);
      if (!response.ok || !parsed.ok) continue;
      return {
        countryCode: parsed.countryCode,
        countryName: parsed.countryName,
        provider: provider.name,
      };
    } catch {
      // Try the next provider.
    }
  }

  return {
    countryCode: "",
    countryName: "",
    provider: "",
  };
}

function readCachedJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage issues and continue with runtime state.
  }
}

function getNextKabulNoonMs(nowMs = Date.now()) {
  const offsetMinutes = 270;
  const shiftedNow = new Date(nowMs + offsetMinutes * 60 * 1000);
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
    - offsetMinutes * 60 * 1000;
}

function readCachedRates() {
  const cached = readCachedJson(RATES_CACHE_KEY);
  if (!cached || !cached.savedAt || !cached.rates) return null;
  const savedAt = Number(cached.savedAt);
  if (!Number.isFinite(savedAt) || Date.now() >= getNextKabulNoonMs(savedAt)) return null;
  return cached.rates;
}

function readCachedCountry() {
  const cached = readCachedJson(COUNTRY_CACHE_KEY);
  if (!cached) return null;
  return {
    countryCode: cached.countryCode || "",
    countryName: cached.countryName || "",
    provider: cached.provider || "",
    manual: Boolean(cached.manual),
  };
}

function readStoredProfileCountry() {
  try {
    const user = JSON.parse(localStorage.getItem("edutech_user") || "null");
    const country = String(user?.country || "").trim();
    if (!country) return null;
    const region = normalizePricingRegion(country);
    return {
      countryCode: countryCodeForPricingRegion(region),
      countryName: country,
      provider: "profile",
      manual: false,
    };
  } catch {
    return null;
  }
}

export function RegionalPricingProvider({ children }) {
  const cachedCountry = useMemo(() => readCachedCountry(), []);
  const profileCountry = useMemo(() => readStoredProfileCountry(), []);
  const cachedRates = useMemo(() => readCachedRates(), []);
  const [countryCode, setCountryCode] = useState(cachedCountry?.countryCode || "");
  const [countryName, setCountryName] = useState(cachedCountry?.countryName || "");
  const [countryProvider, setCountryProvider] = useState(cachedCountry?.provider || "");
  const [isManualRegion, setIsManualRegion] = useState(Boolean(cachedCountry?.manual));
  const [rates, setRates] = useState(() => ({
    ...DEFAULT_RATES,
    ...(cachedRates || {}),
  }));
  const [status, setStatus] = useState(cachedRates || cachedCountry ? "ready" : "loading");

  useEffect(() => {
    let mounted = true;

    const loadPricingContext = async () => {
      if (!cachedRates) {
        setStatus("loading");
      }

      const tasks = [];

      tasks.push(
        cachedCountry?.manual
          ? Promise.resolve(cachedCountry)
          : profileCountry
            ? Promise.resolve(profileCountry)
            : detectCountryFromProviders(),
      );

      tasks.push(
        cachedRates?.AFN != null
          ? Promise.resolve({
            __cached: true,
            rates: {
              AFN: cachedRates.AFN,
              IRR: cachedRates.IRR,
              USDT: cachedRates.USDT,
            },
          })
          : getUsdExchangeRates(),
      );

      const [countryResult, ratesResult] = await Promise.allSettled(tasks);

      if (!mounted) return;

      if (countryResult.status === "fulfilled") {
        setCountryCode(countryResult.value.countryCode || "");
        setCountryName(countryResult.value.countryName || "");
        setCountryProvider(countryResult.value.provider || "");
        writeCachedJson(COUNTRY_CACHE_KEY, {
          countryCode: countryResult.value.countryCode || "",
          countryName: countryResult.value.countryName || "",
          provider: countryResult.value.provider || "",
          manual: Boolean(countryResult.value.manual),
          savedAt: Date.now(),
        });
      }

      const nextRates = {
        AFN:
          ratesResult.status === "fulfilled"
            ? Number(ratesResult.value?.rates?.AFN || 0)
            : cachedRates?.AFN ?? null,
        IRR:
          ratesResult.status === "fulfilled"
            ? Number(ratesResult.value?.rates?.IRR || 0)
            : cachedRates?.IRR ?? null,
        USDT:
          ratesResult.status === "fulfilled"
            ? Number(ratesResult.value?.rates?.USDT || 0)
            : cachedRates?.USDT ?? null,
      };

      setRates(nextRates);
      writeCachedJson(RATES_CACHE_KEY, {
        rates: nextRates,
        savedAt: Date.now(),
      });

      setStatus("ready");
    };

    loadPricingContext();

    return () => {
      mounted = false;
    };
  }, [cachedCountry, cachedRates, profileCountry]);

  const value = useMemo(() => {
    const displayCurrency = resolveDisplayCurrency(countryCode);
    const pricingRegion = normalizePricingRegion(countryCode);

    const setPricingRegion = (nextRegion) => {
      const normalizedRegion = normalizePricingRegion(nextRegion);
      const nextCountryCode = countryCodeForPricingRegion(normalizedRegion);
      const nextCountryName =
        normalizedRegion === "afghanistan"
          ? "Afghanistan"
          : normalizedRegion === "iran"
            ? "Iran"
            : "International";
      setCountryCode(nextCountryCode);
      setCountryName(nextCountryName);
      setCountryProvider("manual");
      setIsManualRegion(true);
      writeCachedJson(COUNTRY_CACHE_KEY, {
        countryCode: nextCountryCode,
        countryName: nextCountryName,
        provider: "manual",
        manual: true,
        savedAt: Date.now(),
      });
    };

    const formatRegionalPrice = (amountUsd, language = "fa") => {
      const numericAmount = Number(amountUsd || 0);

      if (displayCurrency === "USD") {
        return {
          amount: numericAmount,
          currency: "USD",
          label: `${formatAmount(numericAmount, "USD", language)} ${getCurrencyLabel("USD", language)}`,
        };
      }

      const rate =
        displayCurrency === "TOMAN"
          ? Number(rates.IRR || 0) / 10
          : Number(rates[displayCurrency] || 0);
      const convertedAmount = rate > 0 ? numericAmount * rate : numericAmount;

      return {
        amount: convertedAmount,
        currency: displayCurrency,
        label: `${formatAmount(convertedAmount, displayCurrency, language)} ${getCurrencyLabel(displayCurrency, language)}`,
      };
    };

    const formatCryptoUsdtLabel = (amountUsd, language = "fa") => {
      const numericAmount = Number(amountUsd || 0);
      const prefix = language === "fa" ? "پرداخت رمزارزی:" : "Crypto payment:";

      return `${prefix} ${formatAmount(numericAmount, "USDT", language)} ${getCurrencyLabel("USDT", language)}`;
    };

    return {
      countryCode,
      countryName,
      countryProvider,
      pricingRegion,
      isManualRegion,
      setPricingRegion,
      displayCurrency,
      rates,
      status,
      formatRegionalPrice,
      formatCryptoUsdtLabel,
    };
  }, [countryCode, countryName, countryProvider, isManualRegion, rates, status]);

  return (
    <RegionalPricingContext.Provider value={value}>
      {children}
    </RegionalPricingContext.Provider>
  );
}

export function useRegionalPricing() {
  const context = useContext(RegionalPricingContext);
  if (!context) {
    throw new Error("useRegionalPricing must be used within RegionalPricingProvider.");
  }
  return context;
}

export function useCourseRegionalPrice(course = {}, language = "fa") {
  const context = useRegionalPricing();
  const {
    pricingRegion,
    formatRegionalPrice,
  } = context;

  return useMemo(() => {
    if (String(course?.pricingType || "single") !== "regional" || !course?.prices) {
      const finalPrice = Number(course?.price || 0);
      const originalCandidate = Number(course?.discountPrice || 0);
      const originalPrice =
        originalCandidate > finalPrice ? originalCandidate : 0;
      return {
        pricingType: "single",
        pricingRegion,
        currency: formatRegionalPrice(finalPrice, language).currency,
        finalPrice,
        originalPrice,
        finalLabel: formatRegionalPrice(finalPrice, language).label,
        originalLabel: originalPrice
          ? formatRegionalPrice(originalPrice, language).label
          : "",
        isFree: Boolean(course?.isFree) || finalPrice <= 0,
        usesInternationalPrice: false,
      };
    }

    const requested = course.prices?.[pricingRegion] || {};
    const usesInternationalPrice =
      pricingRegion !== "international" &&
      (Boolean(requested.useInternationalPrice) ||
        (!requested.isFree && !(Number(requested.regularPrice) > 0)));
    const resolved =
      usesInternationalPrice
        ? course.prices?.international || {}
        : requested;
    const sourceCurrency = String(
      resolved.currency ||
      (pricingRegion === "afghanistan"
        ? "AFN"
        : pricingRegion === "iran"
          ? "TOMAN"
          : "USD"),
    ).toUpperCase();
    const currency = getDisplayCurrency(sourceCurrency);
    const regularPrice = Math.max(
      0,
      getDisplayCurrencyAmount(resolved.regularPrice, sourceCurrency),
    );
    const discountedCandidate = getDisplayCurrencyAmount(
      resolved.discountedPrice,
      sourceCurrency,
    );
    const hasDiscount =
      discountedCandidate > 0 && discountedCandidate < regularPrice;
    const finalPrice =
      resolved.isFree ? 0 : hasDiscount ? discountedCandidate : regularPrice;
    const label = (amount) =>
      `${formatAmount(amount, currency, language)} ${getCurrencyLabel(currency, language)}`;

    return {
      pricingType: "regional",
      pricingRegion,
      resolvedRegion: usesInternationalPrice ? "international" : pricingRegion,
      currency,
      finalPrice,
      originalPrice: hasDiscount ? regularPrice : 0,
      finalLabel: resolved.isFree ? (language === "fa" ? "رایگان" : "Free") : label(finalPrice),
      originalLabel: hasDiscount ? label(regularPrice) : "",
      isFree: Boolean(resolved.isFree) || finalPrice <= 0,
      usesInternationalPrice,
    };
  }, [course, formatRegionalPrice, language, pricingRegion]);
}

export function useRegionalCoursePrice(amountUsd, language = "fa") {
  const { formatRegionalPrice } = useRegionalPricing();
  return useMemo(
    () => formatRegionalPrice(amountUsd, language).label,
    [amountUsd, formatRegionalPrice, language],
  );
}

export function useCryptoUsdtQuoteLabel(amountUsd, language = "fa") {
  const { formatCryptoUsdtLabel } = useRegionalPricing();
  return useMemo(
    () => formatCryptoUsdtLabel(amountUsd, language),
    [amountUsd, formatCryptoUsdtLabel, language],
  );
}
