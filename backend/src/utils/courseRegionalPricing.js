import { getUsdRatesForCurrencies } from "../services/exchangeRate.service.js";

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

  return {
    currency: config.currency,
    regularPrice,
    discountedPrice,
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
    const disabled = region !== "international" && row.useInternationalPrice;
    if (disabled || row.isFree) continue;
    if (!(row.regularPrice > 0)) {
      errors[`${region}.regularPrice`] =
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
  }

  return { prices: normalized, errors, valid: Object.keys(errors).length === 0 };
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
  if (currency === "USD") return Math.round(amount * 100);

  const quoteCurrency = currency === "TOMAN" ? "IRR" : currency;
  const rates = await getUsdRatesForCurrencies([quoteCurrency]);
  const rate = Number(rates?.[quoteCurrency]?.rate || 0);
  if (!(rate > 0)) {
    throw new Error(`Unable to resolve ${quoteCurrency} exchange rate`);
  }

  const amountInQuoteCurrency = currency === "TOMAN" ? amount * 10 : amount;
  return Math.round((amountInQuoteCurrency / rate) * 100);
};

export const resolveCourseCheckoutPricing = async (course, requestedRegion) => {
  const regionalPrice = resolveCourseRegionalPrice(course, requestedRegion);
  const baseAmountUsdCents = await convertRegionalPriceToUsdCents(regionalPrice);
  return { regionalPrice, baseAmountUsdCents };
};
