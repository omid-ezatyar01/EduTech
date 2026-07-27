import { refreshCurrencyApiRates } from "./exchangeRate.service.js";
import { getNextExchangeRateRefreshAt } from "../utils/exchangeRateSchedule.js";

let schedulerTimer = null;
let refreshRunning = false;

export const runScheduledExchangeRateRefresh = async () => {
  if (refreshRunning) return { skipped: true };
  refreshRunning = true;
  try {
    const rates = await refreshCurrencyApiRates({
      reason: "kabul_11_and_13_schedule",
    });
    return { skipped: false, rates };
  } catch (error) {
    console.warn(
      `Scheduled exchange-rate refresh failed: ${error?.message || error}`,
    );
    return {
      skipped: false,
      error: error?.message || String(error),
    };
  } finally {
    refreshRunning = false;
  }
};

const scheduleNextRefresh = () => {
  const nextRefreshAt = getNextExchangeRateRefreshAt();
  const delayMs = Math.max(1000, nextRefreshAt.getTime() - Date.now());
  schedulerTimer = setTimeout(async () => {
    await runScheduledExchangeRateRefresh();
    scheduleNextRefresh();
  }, delayMs);
  schedulerTimer.unref?.();
  console.info(
    `[exchange-rate:scheduler] next CurrencyAPI refresh at ${nextRefreshAt.toISOString()}`,
  );
  return schedulerTimer;
};

export const startExchangeRateScheduler = () => {
  if (schedulerTimer) return schedulerTimer;
  return scheduleNextRefresh();
};

export const stopExchangeRateScheduler = () => {
  if (!schedulerTimer) return;
  clearTimeout(schedulerTimer);
  schedulerTimer = null;
};
