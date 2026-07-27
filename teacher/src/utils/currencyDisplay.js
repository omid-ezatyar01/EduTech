const normalizeCurrency = (currency = "USD") =>
  String(currency || "USD").trim().toUpperCase();

export const getDisplayCurrency = (currency = "USD") =>
  normalizeCurrency(currency) === "IRR" ? "TOMAN" : normalizeCurrency(currency);

export const getDisplayCurrencyAmount = (amount, currency = "USD") => {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric)) return 0;
  return normalizeCurrency(currency) === "IRR" ? numeric / 10 : numeric;
};

export const getDisplayCurrencyLabel = (currency = "USD", language = "fa") => {
  const normalized = getDisplayCurrency(currency);
  if (normalized === "TOMAN") return language === "fa" ? "تومان" : "TOMAN";
  if (normalized === "AFN") return language === "fa" ? "افغانی" : "AFN";
  if (normalized === "USD") return language === "fa" ? "دالر" : "USD";
  return normalized;
};

export const formatDisplayCurrencyAmount = (
  amount,
  currency = "USD",
  language = "fa",
  { maximumFractionDigits } = {},
) => {
  const displayCurrency = getDisplayCurrency(currency);
  const displayAmount = getDisplayCurrencyAmount(amount, currency);
  const defaultDigits = displayCurrency === "USDT" ? 6 : displayCurrency === "USD" ? 2 : 0;
  const digits = maximumFractionDigits ?? defaultDigits;
  const formatted = new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(displayAmount);

  return `${formatted} ${getDisplayCurrencyLabel(displayCurrency, language)}`;
};

export const formatUsdToLocalCalculation = (item = {}, language = "en") => {
  if (item.sourcePriceAmount === null || item.sourcePriceAmount === undefined) return "";

  const sourceCurrency = normalizeCurrency(item.sourcePriceCurrency || "USD");
  const displayCurrency = getDisplayCurrency(sourceCurrency);
  const localAmount = getDisplayCurrencyAmount(item.sourcePriceAmount, sourceCurrency);
  const usdAmount = Number(item.baseRevenue ?? item.totalRevenue ?? 0);
  const savedRate = getDisplayCurrencyAmount(item.sourceExchangeRate, sourceCurrency);
  const localLabel = formatDisplayCurrencyAmount(
    item.sourcePriceAmount,
    sourceCurrency,
    language,
    { maximumFractionDigits: 2 },
  );

  if (displayCurrency === "USD" || !(usdAmount > 0)) return localLabel;

  const effectiveRate =
    Number.isFinite(savedRate) && savedRate > 0
      ? savedRate
      : localAmount > 0
        ? localAmount / usdAmount
        : 0;
  if (!(effectiveRate > 0)) return localLabel;

  const locale = language === "fa" ? "fa-AF" : "en-US";
  const usdLabel = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(usdAmount);
  const rateLabel = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(effectiveRate);

  return `${usdLabel} USD × ${rateLabel} ${getDisplayCurrencyLabel(displayCurrency, language)}/USD = ${localLabel}`;
};

export const replaceIranRialTextForDisplay = (value = "") =>
  String(value || "").replace(
    /(-?\d[\d,]*(?:\.\d+)?)\s*IRR\b/gi,
    (_match, rawAmount) => {
      const numeric = Number(String(rawAmount).replaceAll(",", ""));
      if (!Number.isFinite(numeric)) return _match;
      return `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(numeric / 10)} TOMAN`;
    },
  );
