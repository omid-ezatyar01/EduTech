export const REGION_DEFINITIONS = [
  { key: "international", currency: "USD", labelEn: "International", labelFa: "بین‌المللی" },
  { key: "afghanistan", currency: "AFN", labelEn: "Afghanistan", labelFa: "افغانستان" },
  { key: "iran", currency: "TOMAN", labelEn: "Iran", labelFa: "ایران" },
];

export const createEmptyRegionalPrices = () => ({
  afghanistan: { currency: "AFN", regularPrice: "", discountedPrice: "", isFree: false, useInternationalPrice: true },
  iran: { currency: "TOMAN", regularPrice: "", discountedPrice: "", isFree: false, useInternationalPrice: true },
  international: { currency: "USD", regularPrice: "", discountedPrice: "", isFree: false },
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
          isFree,
          ...(key !== "international"
            ? { useInternationalPrice: Boolean(row.useInternationalPrice) }
            : {}),
        },
      ];
    }),
  );
