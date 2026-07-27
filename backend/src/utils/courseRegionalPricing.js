import { getUsdRatesForCurrencies } from "../services/exchangeRate.service.js";
import {
  assertPositiveFiniteRate,
  normalizeUsdRateInToman,
  tomanToUsd,
} from "./currencyConversion.js";

export const COURSE_PRICING_TYPES = ["single", "regional"];
export const COURSE_PRICING_REGIONS = ["afghanistan", "iran", "international"];

const REGION_CONFIG = {
  afghanistan: { currency: "AFN" },
  iran: { currency: "TOMAN" },
  international: { currency: "USD" },
};

const roundAmount = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
};

export const normalizePricingRegion = (value = "", fallback = "international") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["af", "afg", "afghanistan", "افغانستان"].includes(normalized)) return "afghanistan";
  if (["ir", "irn", "iran", "ایران"].includes(normalized)) return "iran";
  if (["international", "global", "other", "intl"].includes(normalized)) return "international";
  return fallback;
};

export const getPricingRegionForCountry = (country = "") =>
  normalizePricingRegion(country, "international");

export const resolveStudentPricingRegion = ({
  profileCountry = "",
  detectedRegion = "",
} = {}) => {
  const storedCountry = String(profileCountry || "").trim();
  if (storedCountry) {
    return getPricingRegionForCountry(storedCountry);
  }
  return normalizePricingRegion(detectedRegion, "international");
};

const normalizeRegionPrice = (region, value = {}) => {
  const config = REGION_CONFIG[region];
  const isFree = Boolean(value?.isFree);
  const useInternationalPrice =
    region !== "international" && Boolean(value?.useInternationalPrice);
  const regularPrice = isFree || useInternationalPrice
    ? 0
    : roundAmount(Math.max(0, Number(value?.regularPrice || 0)));
  const rawDiscount = Number(value?.discountedPrice);
  const discountedPrice =
    !isFree &&
    !useInternationalPrice &&
    Number.isFinite(rawDiscount) &&
    rawDiscount > 0
      ? roundAmount(rawDiscount)
      : null;
  const rawRegularPriceUsd = Number(value?.regularPriceUsd);
  const rawDiscountedPriceUsd = Number(value?.discountedPriceUsd);
  const rawUsdExchangeRate = Number(value?.usdExchangeRate);
  const regularPriceUsd =
    isFree || useInternationalPrice
      ? null
      : region === "international"
        ? roundAmount(regularPrice)
        : rawRegularPriceUsd > 0
          ? roundAmount(rawRegularPriceUsd)
          : null;
  const discountedPriceUsd =
    discountedPrice == null
      ? null
      : region === "international"
        ? roundAmount(discountedPrice)
        : rawDiscountedPriceUsd > 0
          ? roundAmount(rawDiscountedPriceUsd)
          : null;
  const usdExchangeRate =
    isFree || useInternationalPrice
      ? null
      : region === "international"
        ? 1
        : rawUsdExchangeRate > 0
          ? roundAmount(rawUsdExchangeRate, 6)
          : null;

  return {
    currency: config.currency,
    regularPrice,
    discountedPrice,
    regularPriceUsd,
    discountedPriceUsd,
    usdExchangeRate,
    isFree,
    ...(region !== "international" ? { useInternationalPrice } : {}),
  };
};

export const normalizeRegionalPrices = (prices = {}) =>
  Object.fromEntries(
    COURSE_PRICING_REGIONS.map((region) => [
      region,
      normalizeRegionPrice(region, prices?.[region]),
    ]),
  );

export const validateRegionalPrices = (prices = {}) => {
  const normalized = normalizeRegionalPrices(prices);
  const errors = {};

  for (const region of COURSE_PRICING_REGIONS) {
    const row = normalized[region];
    const inputRow = prices?.[region] || {};
    const disabled = region !== "international" && row.useInternationalPrice;
    if (disabled || row.isFree) continue;
    if (Number(inputRow.regularPrice) < 0) {
      errors[`${region}.regularPrice`] = "Regular price cannot be negative";
    }
    if (
      inputRow.discountedPrice !== "" &&
      inputRow.discountedPrice != null &&
      Number(inputRow.discountedPrice) < 0
    ) {
      errors[`${region}.discountedPrice`] =
        "Discounted price cannot be negative";
    }
    if (!(row.regularPrice > 0)) {
      errors[`${region}.regularPrice`] ||=
        region === "international"
          ? "International regular price is required"
          : "Regular price is required";
    }
    if (
      row.discountedPrice != null &&
      (!(row.discountedPrice >= 0) || row.discountedPrice >= row.regularPrice)
    ) {
      errors[`${region}.discountedPrice`] =
        "Discounted price must be lower than the regular price";
    }
    if (
      region !== "international" &&
      (!(row.regularPriceUsd > 0) || !(row.usdExchangeRate > 0))
    ) {
      errors[`${region}.regularPriceUsd`] =
        "Saved USD base and exchange rate must be valid";
    }
    if (
      region !== "international" &&
      row.regularPriceUsd > 0 &&
      row.usdExchangeRate > 0 &&
      Math.abs(
        roundAmount(row.regularPrice / row.usdExchangeRate) -
        row.regularPriceUsd
      ) > 0.01
    ) {
      errors[`${region}.regularPriceUsd`] =
        "Saved USD base does not match the regional price";
    }
    if (
      region !== "international" &&
      row.discountedPrice != null &&
      (!(row.discountedPriceUsd > 0) ||
        Math.abs(
          roundAmount(row.discountedPrice / row.usdExchangeRate) -
          row.discountedPriceUsd
        ) > 0.01)
    ) {
      errors[`${region}.discountedPriceUsd`] =
        "Saved discounted USD base does not match the regional discount";
    }
  }

  return { prices: normalized, errors, valid: Object.keys(errors).length === 0 };
};

export const validateRegionalMinimumPrices = (
  prices = {},
  minimumPriceUsd = 0,
) => {
  const normalized = normalizeRegionalPrices(prices);
  const minimum = Math.max(0, Number(minimumPriceUsd) || 0);
  const errors = {};

  if (!(minimum > 0)) {
    return { prices: normalized, errors, valid: true };
  }

  for (const region of COURSE_PRICING_REGIONS) {
    const row = normalized[region];
    if (
      row.isFree ||
      (region !== "international" && row.useInternationalPrice)
    ) {
      continue;
    }

    const regularPriceUsd =
      region === "international"
        ? Number(row.regularPrice)
        : Number(row.regularPriceUsd);
    const discountedPriceUsd =
      row.discountedPrice == null
        ? null
        : region === "international"
          ? Number(row.discountedPrice)
          : Number(row.discountedPriceUsd);

    if (!Number.isFinite(regularPriceUsd) || regularPriceUsd < minimum) {
      errors[`${region}.regularPrice`] =
        `${region} regular price must be at least ${minimum} USD`;
    }
    if (
      discountedPriceUsd !== null &&
      (!Number.isFinite(discountedPriceUsd) ||
        discountedPriceUsd < minimum)
    ) {
      errors[`${region}.discountedPrice`] =
        `${region} discounted price must be at least ${minimum} USD`;
    }
  }

  return {
    prices: normalized,
    errors,
    valid: Object.keys(errors).length === 0,
  };
};

export const resolveCourseRegionalPrice = (course = {}, requestedRegion = "international") => {
  if (String(course?.pricingType || "single") !== "regional" || !course?.prices) {
    const regularPrice = Math.max(0, Number(course?.discountPrice || 0) > Number(course?.price || 0)
      ? Number(course.discountPrice)
      : Number(course?.price || 0));
    const candidateDiscount = Number(course?.discountPrice || 0);
    const discountedPrice =
      candidateDiscount > 0 && candidateDiscount < regularPrice
        ? candidateDiscount
        : null;
    return {
      pricingType: "single",
      region: "international",
      requestedRegion: normalizePricingRegion(requestedRegion),
      currency: String(course?.currency || "USD").toUpperCase(),
      regularPrice,
      discountedPrice,
      finalPrice: Boolean(course?.isFree) ? 0 : discountedPrice ?? regularPrice,
      isFree: Boolean(course?.isFree) || regularPrice <= 0,
      usesInternationalPrice: false,
    };
  }

  const prices = normalizeRegionalPrices(course.prices);
  const region = normalizePricingRegion(requestedRegion);
  const requested = prices[region];
  const usesInternationalPrice =
    region !== "international" &&
    (requested.useInternationalPrice || (!requested.isFree && requested.regularPrice <= 0));
  const resolvedRegion = usesInternationalPrice ? "international" : region;
  const resolved = prices[resolvedRegion];
  const finalPrice = resolved.isFree
    ? 0
    : resolved.discountedPrice ?? resolved.regularPrice;

  return {
    pricingType: "regional",
    region: resolvedRegion,
    requestedRegion: region,
    currency: resolved.currency,
    regularPrice: resolved.regularPrice,
    discountedPrice: resolved.discountedPrice,
    regularPriceUsd: resolved.regularPriceUsd,
    discountedPriceUsd: resolved.discountedPriceUsd,
    finalPriceUsd:
      resolved.isFree
        ? 0
        : resolved.discountedPrice != null
          ? resolved.discountedPriceUsd
          : resolved.regularPriceUsd,
    usdExchangeRate: resolved.usdExchangeRate,
    finalPrice,
    isFree: resolved.isFree || finalPrice <= 0,
    usesInternationalPrice,
  };
};

export const convertRegionalPriceToUsdCents = async (resolvedPrice) => {
  if (!resolvedPrice || resolvedPrice.isFree || Number(resolvedPrice.finalPrice || 0) <= 0) {
    return 0;
  }

  const amount = Number(resolvedPrice.finalPrice);
  const currency = String(resolvedPrice.currency || "USD").toUpperCase();
  const savedUsdAmount = Number(resolvedPrice.finalPriceUsd);
  if (savedUsdAmount > 0) return Math.round(savedUsdAmount * 100);
  if (currency === "USD") return Math.round(amount * 100);

  const quoteCurrency = currency === "TOMAN" ? "IRR" : currency;
  const rates = await getUsdRatesForCurrencies([quoteCurrency]);
  let rate;
  try {
    rate = assertPositiveFiniteRate(
      rates?.[quoteCurrency]?.rate,
      `Unable to resolve ${quoteCurrency} exchange rate`,
    );
  } catch {
    throw new Error(`Unable to resolve ${quoteCurrency} exchange rate`);
  }

  const usdAmount =
    currency === "TOMAN" ? tomanToUsd(amount, rate) : amount / rate;
  return Math.round(usdAmount * 100);
};

export const resolveCourseCheckoutPricing = async (course, requestedRegion) => {
  const regionalPrice = resolveCourseRegionalPrice(course, requestedRegion);
  const baseAmountUsdCents = await convertRegionalPriceToUsdCents(regionalPrice);
  return { regionalPrice, baseAmountUsdCents };
};

export const resolveRegionalDisplaySnapshot = async ({
  resolvedPrice,
  requestedRegion = "international",
  baseAmountUsdCents = 0,
} = {}) => {
  const region = normalizePricingRegion(requestedRegion);
  const baseUsd = Number(baseAmountUsdCents || 0) / 100;
  const targetCurrency =
    region === "afghanistan" ? "AFN" : region === "iran" ? "TOMAN" : "USD";

  if (
    region !== "international" &&
    String(resolvedPrice?.currency || "").toUpperCase() !== targetCurrency
  ) {
    const quoteCurrency = targetCurrency === "TOMAN" ? "IRR" : "AFN";
    const rates = await getUsdRatesForCurrencies([quoteCurrency]);
    const rateRow = rates?.[quoteCurrency] || {};
    const rawRate = Number(rateRow.rate || 0);
    if (!(rawRate > 0)) {
      throw new Error(`Unable to resolve ${targetCurrency} display rate`);
    }
    return buildRegionalDisplaySnapshot({
      resolvedPrice,
      requestedRegion: region,
      baseAmountUsdCents,
      rate: rawRate,
      rateSource: rateRow.source || "exchange_rate_service",
      rateRetrievedAt: rateRow.rateRetrievedAt || new Date(),
    });
  }

  return buildRegionalDisplaySnapshot({
    resolvedPrice,
    requestedRegion: region,
    baseAmountUsdCents,
  });
};

export const buildRegionalDisplaySnapshot = ({
  resolvedPrice,
  requestedRegion = "international",
  baseAmountUsdCents = 0,
  rate = null,
  rateSource = "exchange_rate_service",
  rateRetrievedAt = null,
} = {}) => {
  const region = normalizePricingRegion(requestedRegion);
  const baseUsd = Number(baseAmountUsdCents || 0) / 100;
  if (region === "international") {
    return {
      amount: baseUsd,
      currency: "USD",
      exchangeRate: 1,
      exchangeRateSource: "usd_base",
      rateRetrievedAt: new Date(),
    };
  }

  const targetCurrency = region === "afghanistan" ? "AFN" : "TOMAN";
  if (
    String(resolvedPrice?.currency || "").toUpperCase() === targetCurrency &&
    Number(resolvedPrice?.finalPrice || 0) > 0
  ) {
    return {
      amount: Number(resolvedPrice.finalPrice),
      currency: targetCurrency,
      exchangeRate:
        baseUsd > 0
          ? roundAmount(Number(resolvedPrice.finalPrice) / baseUsd, 6)
          : Number(resolvedPrice.usdExchangeRate || 0) || null,
      exchangeRateSource: "teacher_regional_price_snapshot",
      rateRetrievedAt: null,
    };
  }

  let rawRate;
  try {
    rawRate = assertPositiveFiniteRate(
      rate,
      `Unable to resolve ${targetCurrency} display rate`,
    );
  } catch {
    throw new Error(`Unable to resolve ${targetCurrency} display rate`);
  }
  const displayRate =
    targetCurrency === "TOMAN" ? normalizeUsdRateInToman(rawRate) : rawRate;
  return {
    amount: Math.round(baseUsd * displayRate),
    currency: targetCurrency,
    exchangeRate: roundAmount(displayRate, 6),
    exchangeRateSource: rateSource,
    rateRetrievedAt: rateRetrievedAt || new Date(),
  };
};
