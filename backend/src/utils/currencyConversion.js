const toFiniteNumber = (value, errorMessage) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(errorMessage);
  }
  return numeric;
};

export const assertPositiveFiniteRate = (
  value,
  errorMessage = "Invalid exchange rate",
) => {
  const rate = toFiniteNumber(value, errorMessage);
  if (rate <= 0) {
    throw new Error(errorMessage);
  }
  return rate;
};

export const normalizeUsdRateInToman = (usdRateInRial) =>
  assertPositiveFiniteRate(
    usdRateInRial,
    "Invalid USD to IRR rate",
  ) / 10;

export const tomanToUsd = (tomanAmount, usdRateInRial) => {
  const amount = toFiniteNumber(tomanAmount, "Invalid toman amount");
  if (amount < 0) {
    throw new Error("Invalid toman amount");
  }

  const rialRate = assertPositiveFiniteRate(
    usdRateInRial,
    "Invalid USD to IRR rate",
  );
  const usdRateInToman = normalizeUsdRateInToman(rialRate);
  const usdPrice = amount / usdRateInToman;

  if (process.env.CURRENCY_CONVERSION_DEBUG === "true") {
    console.debug("[currency-conversion]", {
      rawApiRateInRial: rialRate,
      normalizedRateInToman: usdRateInToman,
      teacherEnteredTomanAmount: amount,
      finalUsdResult: Number(usdPrice.toFixed(2)),
    });
  }

  return usdPrice;
};

export const usdToToman = (usdAmount, usdRateInRial) => {
  const amount = toFiniteNumber(usdAmount, "Invalid USD amount");
  if (amount < 0) {
    throw new Error("Invalid USD amount");
  }
  return (
    Math.round(amount * normalizeUsdRateInToman(usdRateInRial) * 100) / 100
  );
};
