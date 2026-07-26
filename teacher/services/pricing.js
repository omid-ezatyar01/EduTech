import { getApiBase, parseJsonResponse } from "./http";

export const getCoursePricingExchangeRates = async () => {
  const response = await fetch(`${getApiBase()}/exchange/rates`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  const rates = data?.rates || {};

  return {
    afnPerUsd: Number(rates.AFN || 0),
    tomanPerUsd: Number(rates.IRR || 0) / 10,
    source: String(data?.source || ""),
    nextRefreshAt: data?.nextRefreshAt || null,
  };
};
