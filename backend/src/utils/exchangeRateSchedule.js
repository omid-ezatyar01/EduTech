const KABUL_UTC_OFFSET_MINUTES = 270;
export const EXCHANGE_RATE_REFRESH_HOURS_KABUL = [11, 13];

export const getNextExchangeRateRefreshAt = (now = new Date()) => {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Invalid scheduler date");
  }

  const shiftedNow = new Date(
    nowMs + KABUL_UTC_OFFSET_MINUTES * 60 * 1000,
  );
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();

  for (const hour of EXCHANGE_RATE_REFRESH_HOURS_KABUL) {
    const candidateMs =
      Date.UTC(year, month, day, hour, 0, 0, 0) -
      KABUL_UTC_OFFSET_MINUTES * 60 * 1000;
    if (candidateMs > nowMs) {
      return new Date(candidateMs);
    }
  }

  return new Date(
    Date.UTC(
      year,
      month,
      day + 1,
      EXCHANGE_RATE_REFRESH_HOURS_KABUL[0],
      0,
      0,
      0,
    ) -
      KABUL_UTC_OFFSET_MINUTES * 60 * 1000,
  );
};
