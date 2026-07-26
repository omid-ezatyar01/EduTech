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
