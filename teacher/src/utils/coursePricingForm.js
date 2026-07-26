export const REGION_DEFINITIONS = [
  { key: "international", currency: "USD", labelEn: "International", labelFa: "بین‌المللی" },
  { key: "afghanistan", currency: "AFN", labelEn: "Afghanistan", labelFa: "افغانستان" },
  { key: "iran", currency: "TOMAN", labelEn: "Iran", labelFa: "ایران" },
];

export const createEmptyRegionalPrices = () => ({
  afghanistan: { currency: "AFN", regularPrice: "", discountedPrice: "", regularPriceUsd: null, discountedPriceUsd: null, usdExchangeRate: null, isFree: false, useInternationalPrice: true },
  iran: { currency: "TOMAN", regularPrice: "", discountedPrice: "", regularPriceUsd: null, discountedPriceUsd: null, usdExchangeRate: null, isFree: false, useInternationalPrice: true },
  international: { currency: "USD", regularPrice: "", discountedPrice: "", regularPriceUsd: null, discountedPriceUsd: null, usdExchangeRate: 1, isFree: false },
});

export const regionalPricesFromCourse = (course = {}) => {
  const defaults = createEmptyRegionalPrices();
  return Object.fromEntries(
    REGION_DEFINITIONS.map(({ key, currency }) => {
      const saved = course?.prices?.[key] || {};
      return [
        key,
        {
          ...defaults[key],
          ...saved,
          currency,
          regularPrice:
            saved.regularPrice === null || saved.regularPrice === undefined
              ? ""
              : String(saved.regularPrice),
          discountedPrice:
            saved.discountedPrice === null || saved.discountedPrice === undefined
              ? ""
              : String(saved.discountedPrice),
          regularPriceUsd:
            saved.regularPriceUsd === null || saved.regularPriceUsd === undefined
              ? null
              : Number(saved.regularPriceUsd),
          discountedPriceUsd:
            saved.discountedPriceUsd === null || saved.discountedPriceUsd === undefined
              ? null
              : Number(saved.discountedPriceUsd),
          usdExchangeRate:
            saved.usdExchangeRate === null || saved.usdExchangeRate === undefined
              ? (key === "international" ? 1 : null)
              : Number(saved.usdExchangeRate),
          isFree: Boolean(saved.isFree),
          ...(key !== "international"
            ? { useInternationalPrice: Boolean(saved.useInternationalPrice) }
            : {}),
        },
      ];
    }),
  );
};

export const validateRegionalPricingForm = (
  prices = {},
  { minInternationalPrice = 0, language = "en" } = {},
) => {
  const isFa = language === "fa";
  const errors = {};
  for (const { key } of REGION_DEFINITIONS) {
    const row = prices?.[key] || {};
    if (key !== "international" && row.useInternationalPrice) continue;
    if (row.isFree) continue;
    const regularPrice = Number(row.regularPrice);
    const discountedPrice =
      row.discountedPrice === "" || row.discountedPrice === null
        ? null
        : Number(row.discountedPrice);
    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      errors[`${key}.regularPrice`] =
        key === "international"
          ? isFa ? "قیمت بین‌المللی الزامی است." : "International price is required."
          : isFa ? "قیمت اصلی الزامی است." : "Regular price is required.";
    } else if (key === "international" && regularPrice < minInternationalPrice) {
      errors[`${key}.regularPrice`] = isFa
        ? `قیمت بین‌المللی باید حداقل ${minInternationalPrice} دالر باشد.`
        : `International price must be at least ${minInternationalPrice} USD.`;
    }
    if (!Number.isFinite(regularPrice) || regularPrice < 0) {
      errors[`${key}.regularPrice`] = isFa
        ? "قیمت نمی‌تواند منفی باشد."
        : "Price cannot be negative.";
    }
    if (
      discountedPrice !== null &&
      (!Number.isFinite(discountedPrice) ||
        discountedPrice < 0 ||
        discountedPrice >= regularPrice)
    ) {
      errors[`${key}.discountedPrice`] = isFa
        ? "قیمت تخفیف‌خورده باید کمتر از قیمت اصلی باشد."
        : "Discounted price must be lower than the regular price.";
    }
    if (
      key !== "international" &&
      (!Number.isFinite(Number(row.regularPriceUsd)) ||
        !(Number(row.regularPriceUsd) > 0) ||
        !(Number(row.usdExchangeRate) > 0))
    ) {
      errors[`${key}.regularPrice`] = isFa
        ? "برای ذخیره قیمت، ابتدا نرخ ارز و مبنای دالری باید آماده شود."
        : "Wait for the exchange rate and saved USD base before saving.";
    }
    if (
      key !== "international" &&
      discountedPrice !== null &&
      !(Number(row.discountedPriceUsd) > 0)
    ) {
      errors[`${key}.discountedPrice`] = isFa
        ? "مبنای دالری قیمت تخفیف‌خورده هنوز آماده نیست."
        : "The discounted USD base is not ready yet.";
    }
  }
  return errors;
};

export const buildRegionalPricesPayload = (prices = {}) =>
  Object.fromEntries(
    REGION_DEFINITIONS.map(({ key, currency }) => {
      const row = prices?.[key] || {};
      const disabled = key !== "international" && Boolean(row.useInternationalPrice);
      const isFree = Boolean(row.isFree);
      return [
        key,
        {
          currency,
          regularPrice: disabled || isFree ? 0 : Number(row.regularPrice || 0),
          discountedPrice:
            disabled || isFree || row.discountedPrice === ""
              ? null
              : Number(row.discountedPrice),
          regularPriceUsd:
            disabled || isFree
              ? null
              : key === "international"
                ? Number(row.regularPrice || 0)
                : Number(row.regularPriceUsd || 0) || null,
          discountedPriceUsd:
            disabled || isFree || row.discountedPrice === ""
              ? null
              : key === "international"
                ? Number(row.discountedPrice)
                : Number(row.discountedPriceUsd || 0) || null,
          usdExchangeRate:
            disabled || isFree
              ? null
              : key === "international"
                ? 1
                : Number(row.usdExchangeRate || 0) || null,
          isFree,
          ...(key !== "international"
            ? { useInternationalPrice: Boolean(row.useInternationalPrice) }
            : {}),
        },
      ];
    }),
  );
