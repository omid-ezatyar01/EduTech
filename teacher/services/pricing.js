import { getApiBase, parseJsonResponse } from "./http";

const positiveFiniteRate = (value, label) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid ${label} exchange rate`);
  }
  return rate;
};

export const normalizeUsdRateInToman = (usdRateInRial) =>
  positiveFiniteRate(usdRateInRial, "USD to IRR") / 10;

export const localAmountFromUsd = (usdAmount, localPerUsd) => {
  const amount = Number(usdAmount);
  const rate = positiveFiniteRate(localPerUsd, "local currency");
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid USD amount");
  }
  return Math.round(amount * rate * 100) / 100;
};

export const usdAmountFromLocal = (localAmount, localPerUsd) => {
  const amount = Number(localAmount);
  const rate = positiveFiniteRate(localPerUsd, "local currency");
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid local amount");
  }
  return amount / rate;
};

export const getCoursePricingExchangeRates = async () => {
  const response = await fetch(`${getApiBase()}/exchange/rates`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  const rates = data?.rates || {};
  const afnPerUsd = positiveFiniteRate(rates.AFN, "USD to AFN");
  const rawIrrPerUsd = positiveFiniteRate(rates.IRR, "USD to IRR");
  const tomanPerUsd = positiveFiniteRate(
    data?.normalizedRates?.TOMAN ?? normalizeUsdRateInToman(rawIrrPerUsd),
    "USD to TOMAN",
  );

  if (
    import.meta.env.DEV ||
    import.meta.env.VITE_CURRENCY_CONVERSION_DEBUG === "true"
  ) {
    console.debug("[course-pricing-rate]", {
      rawApiRateInRial: rawIrrPerUsd,
      normalizedRateInToman: tomanPerUsd,
    });
  }

  return {
    afnPerUsd,
    rawIrrPerUsd,
    tomanPerUsd,
    source: String(data?.sources?.TOMAN || data?.source || ""),
    selectedField: String(data?.selectedFields?.IRR || ""),
    nextRefreshAt: data?.nextRefreshAt || null,
  };
};
