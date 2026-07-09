import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export const usdCentsToDecimal = (usdCents) => {
  const cents = new Decimal(usdCents || 0);
  return cents.div(100);
};

export const normalizeUsdToCents = (amount) => {
  if (amount === null || amount === undefined || amount === "") return 0;
  const cents = new Decimal(amount).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return Number(cents.toString());
};

export const formatUsdCents = (usdCents) => usdCentsToDecimal(usdCents).toFixed(2);

export const convertUsdCentsToAfn = (usdCents, exchangeRate) => {
  const usd = usdCentsToDecimal(usdCents);
  if (usd.lte(0)) return "0";
  const afn = usd.mul(new Decimal(exchangeRate)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return Decimal.max(afn, new Decimal(1)).toFixed(0);
};

export const convertUsdCentsToUsdt = (usdCents) => usdCentsToDecimal(usdCents).toFixed(6);

export const formatTrimmedDecimal = (value, decimalPlaces = 6) => {
  try {
    return new Decimal(value || 0)
      .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
      .toFixed(decimalPlaces)
      .replace(/(\.\d*?[1-9])0+$/u, "$1")
      .replace(/\.0+$/u, "");
  } catch {
    return "0";
  }
};

export const roundUpDecimalAmount = (value, decimalPlaces = 2) => {
  try {
    return new Decimal(value || 0).toDecimalPlaces(decimalPlaces, Decimal.ROUND_UP).toFixed(decimalPlaces);
  } catch {
    return new Decimal(0).toFixed(decimalPlaces);
  }
};

export const decimalAmountEquals = (left, right, decimalPlaces = 6) => {
  try {
    return new Decimal(left || 0).toFixed(decimalPlaces) === new Decimal(right || 0).toFixed(decimalPlaces);
  } catch {
    return false;
  }
};

export const decimalToNumber = (value) => {
  try {
    return Number(new Decimal(value || 0).toString());
  } catch {
    return 0;
  }
};
