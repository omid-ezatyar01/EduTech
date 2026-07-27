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
  TOMAN: null,
  USDT: null,
};
const RATES_CACHE_KEY = "edutech_regional_rates_v2";
const LEGACY_RATES_CACHE_KEY = "edutech_regional_rates_v1";
const COUNTRY_CACHE_KEY = "edutech_regional_country_v1";
const COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalizePricingRegion = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["af", "afg", "afghanistan", "افغانستان"].includes(normalized)) return "afghanistan";
  if (["ir", "irn", "iran", "ایران"].includes(normalized)) return "iran";
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

function detectCountryFromBrowserSignals() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locales = Array.from(
      new Set([navigator.language, ...(navigator.languages || [])].filter(Boolean)),
    ).map((value) => String(value).toLowerCase());

    if (timezone === "Asia/Kabul" || locales.some((value) => value === "fa-af" || value === "ps-af")) {
      return {
        countryCode: "AF",
        countryName: "Afghanistan",
        provider: "browser",
      };
    }
    if (timezone === "Asia/Tehran" || locales.some((value) => value === "fa-ir")) {
      return {
        countryCode: "IR",
        countryName: "Iran",
        provider: "browser",
      };
    }
  } catch {
    // Browser signals are only a fallback when profile and network detection are unavailable.
  }

  return {
    countryCode: "INTL",
    countryName: "International",
    provider: "browser-fallback",
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

function getNextKabulRateRefreshMs(nowMs = Date.now()) {
  const offsetMinutes = 270;
  const shiftedNow = new Date(nowMs + offsetMinutes * 60 * 1000);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();
  for (const hour of [11, 13]) {
    const candidate =
      Date.UTC(year, month, day, hour, 0, 0, 0) -
      offsetMinutes * 60 * 1000;
    if (candidate > nowMs) return candidate;
  }
  return (
    Date.UTC(year, month, day + 1, 11, 0, 0, 0) -
    offsetMinutes * 60 * 1000
  );
}

function readCachedRates() {
  const cached = readCachedJson(RATES_CACHE_KEY);
  if (!cached || !cached.savedAt || !cached.rates) return null;
  const savedAt = Number(cached.savedAt);
  if (!Number.isFinite(savedAt) || Date.now() >= getNextKabulRateRefreshMs(savedAt)) return null;
  return cached.rates;
}

function readCachedCountry() {
  const cached = readCachedJson(COUNTRY_CACHE_KEY);
  if (!cached) return null;
  const savedAt = Number(cached.savedAt || 0);
  if (
    cached.manual ||
    !Number.isFinite(savedAt) ||
    Date.now() - savedAt >= COUNTRY_CACHE_TTL_MS
  ) {
    return null;
  }
  return {
    countryCode: cached.countryCode || "",
    countryName: cached.countryName || "",
    provider: cached.provider || "",
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
    };
  } catch {
    return null;
  }
}

export function RegionalPricingProvider({ children }) {
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_RATES_CACHE_KEY);
    } catch {
      // The versioned key already prevents an old official IRR rate from loading.
    }
  }, []);

  const cachedCountry = useMemo(() => readCachedCountry(), []);
  const profileCountry = useMemo(() => readStoredProfileCountry(), []);
  const browserCountry = useMemo(() => detectCountryFromBrowserSignals(), []);
  const cachedRates = useMemo(() => readCachedRates(), []);
  const initialCountry = profileCountry || cachedCountry || browserCountry;
  const [countryCode, setCountryCode] = useState(initialCountry.countryCode || "INTL");
  const [countryName, setCountryName] = useState(initialCountry.countryName || "International");
  const [countryProvider, setCountryProvider] = useState(initialCountry.provider || "browser-fallback");
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
        profileCountry
          ? Promise.resolve(profileCountry)
          : detectCountryFromProviders().then((result) =>
            result.countryCode ? result : cachedCountry || browserCountry),
      );

      tasks.push(
        cachedRates?.AFN != null
          ? Promise.resolve({
            __cached: true,
            rates: {
              AFN: cachedRates.AFN,
              IRR: cachedRates.IRR,
              TOMAN: cachedRates.TOMAN,
              USDT: cachedRates.USDT,
            },
          })
          : getUsdExchangeRates(),
      );

      const [countryResult, ratesResult] = await Promise.allSettled(tasks);

      if (!mounted) return;

      if (countryResult.status === "fulfilled") {
        const resolvedCountry = readStoredProfileCountry() || countryResult.value;
        setCountryCode(resolvedCountry.countryCode || "INTL");
        setCountryName(resolvedCountry.countryName || "International");
        setCountryProvider(resolvedCountry.provider || "browser-fallback");
        writeCachedJson(COUNTRY_CACHE_KEY, {
          countryCode: resolvedCountry.countryCode || "INTL",
          countryName: resolvedCountry.countryName || "International",
          provider: resolvedCountry.provider || "browser-fallback",
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
        TOMAN:
          ratesResult.status === "fulfilled"
            ? Number(ratesResult.value?.normalizedRates?.TOMAN || 0)
            : cachedRates?.TOMAN ?? null,
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
  }, [browserCountry, cachedCountry, cachedRates, profileCountry]);

  useEffect(() => {
    let active = true;
    const refreshAt = getNextKabulRateRefreshMs(Date.now()) + 1000;
    const timer = window.setTimeout(async () => {
      try {
        const result = await getUsdExchangeRates();
        if (!active) return;
        const nextRates = {
          AFN: Number(result?.rates?.AFN || 0) || null,
          IRR: Number(result?.rates?.IRR || 0) || null,
          TOMAN: Number(result?.normalizedRates?.TOMAN || 0) || null,
          USDT: Number(result?.rates?.USDT || 0) || null,
        };
        setRates(nextRates);
        writeCachedJson(RATES_CACHE_KEY, {
          rates: nextRates,
          savedAt: Date.now(),
        });
      } catch {
        // Keep the last known rates; checkout still verifies the amount server-side.
      }
    }, Math.max(1000, refreshAt - Date.now()));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [rates]);

  useEffect(() => {
    let active = true;
    const syncProfileCountry = async () => {
      const profile = readStoredProfileCountry();
      const detected = profile || await detectCountryFromProviders();
      if (!active) return;
      const nextCountry = detected.countryCode ? detected : browserCountry;
      setCountryCode(nextCountry.countryCode || "INTL");
      setCountryName(nextCountry.countryName || "International");
      setCountryProvider(nextCountry.provider || "browser-fallback");
      writeCachedJson(COUNTRY_CACHE_KEY, {
        ...nextCountry,
        savedAt: Date.now(),
      });
    };

    window.addEventListener("auth_change", syncProfileCountry);
    window.addEventListener("edutech_data_changed", syncProfileCountry);
    return () => {
      active = false;
      window.removeEventListener("auth_change", syncProfileCountry);
      window.removeEventListener("edutech_data_changed", syncProfileCountry);
    };
  }, [browserCountry]);

  const value = useMemo(() => {
    const displayCurrency = resolveDisplayCurrency(countryCode);
    const pricingRegion = normalizePricingRegion(countryCode);

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
          ? Number(rates.TOMAN || 0)
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
      displayCurrency,
      rates,
      status,
      formatRegionalPrice,
      formatCryptoUsdtLabel,
    };
  }, [countryCode, countryName, countryProvider, rates, status]);

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
        finalPriceUsd: finalPrice,
        originalPrice,
        originalPriceUsd: originalPrice,
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
    const dynamicFallback =
      usesInternationalPrice && pricingRegion !== "international";
    const fallbackRegular = dynamicFallback
      ? formatRegionalPrice(resolved.regularPrice, language)
      : null;
    const fallbackDiscount = dynamicFallback && resolved.discountedPrice != null
      ? formatRegionalPrice(resolved.discountedPrice, language)
      : null;
    const sourceCurrency = String(
      fallbackRegular?.currency ||
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
      dynamicFallback
        ? Number(fallbackRegular?.amount || 0)
        : getDisplayCurrencyAmount(resolved.regularPrice, sourceCurrency),
    );
    const discountedCandidate = dynamicFallback
      ? Number(fallbackDiscount?.amount || 0)
      : getDisplayCurrencyAmount(resolved.discountedPrice, sourceCurrency);
    const hasDiscount =
      discountedCandidate > 0 && discountedCandidate < regularPrice;
    const finalPrice =
      resolved.isFree ? 0 : hasDiscount ? discountedCandidate : regularPrice;
    const regularPriceUsd = dynamicFallback
      ? Number(resolved.regularPrice || 0)
      : Number(resolved.regularPriceUsd);
    const discountedPriceUsd = dynamicFallback
      ? Number(resolved.discountedPrice || 0)
      : Number(resolved.discountedPriceUsd);
    const finalPriceUsd =
      resolved.isFree
        ? 0
        : hasDiscount && discountedPriceUsd > 0
          ? discountedPriceUsd
          : regularPriceUsd > 0
            ? regularPriceUsd
            : null;
    const label = (amount) =>
      `${formatAmount(amount, currency, language)} ${getCurrencyLabel(currency, language)}`;

    return {
      pricingType: "regional",
      pricingRegion,
      resolvedRegion: usesInternationalPrice ? "international" : pricingRegion,
      currency,
      finalPrice,
      finalPriceUsd,
      originalPrice: hasDiscount ? regularPrice : 0,
      originalPriceUsd: hasDiscount && regularPriceUsd > 0 ? regularPriceUsd : 0,
      usdExchangeRate:
        dynamicFallback && regularPriceUsd > 0
          ? regularPrice / regularPriceUsd
          : Number(resolved.usdExchangeRate) || null,
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
