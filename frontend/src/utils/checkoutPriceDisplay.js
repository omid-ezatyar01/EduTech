export const calculateRegionalUsdAmount = ({
  coursePricing,
  rates,
  fallbackUsdPrice = 0,
} = {}) => {
  const roundUsd = (value) => Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
  if (coursePricing?.pricingType !== "regional") {
    return roundUsd(fallbackUsdPrice);
  }

  if (Number(coursePricing?.finalPriceUsd) > 0) {
    return roundUsd(coursePricing.finalPriceUsd);
  }

  const amount = Math.max(0, Number(coursePricing?.finalPrice || 0));
  const currency = String(coursePricing?.currency || "USD").toUpperCase();
  if (currency === "USD" || currency === "USDT") return roundUsd(amount);
  if (currency === "AFN") {
    const afnPerUsd = Number(rates?.AFN || 0);
    return afnPerUsd > 0 ? roundUsd(amount / afnPerUsd) : 0;
  }
  if (currency === "TOMAN" || currency === "IRR") {
    const irrPerUsd = Number(rates?.IRR || 0);
    const amountInIrr = currency === "TOMAN" ? amount * 10 : amount;
    return irrPerUsd > 0 ? roundUsd(amountInIrr / irrPerUsd) : 0;
  }
  return 0;
};

export const calculateHesabPayAfnAmount = (options = {}) => {
  const currency = String(options?.coursePricing?.currency || "").toUpperCase();
  if (options?.coursePricing?.pricingType === "regional" && currency === "AFN") {
    return Math.round(Math.max(0, Number(options.coursePricing.finalPrice || 0)));
  }

  const usdAmount = calculateRegionalUsdAmount(options);
  const afnPerUsd = Number(options?.rates?.AFN || 0);
  return afnPerUsd > 0 ? Math.round(usdAmount * afnPerUsd) : 0;
};
