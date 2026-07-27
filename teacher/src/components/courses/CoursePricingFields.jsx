import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoursePricingExchangeRates,
  localAmountFromUsd,
  usdAmountFromLocal,
} from "../../../services/pricing";
import {
  normalizePriceInput,
  REGION_DEFINITIONS,
} from "../../utils/coursePricingForm";

const INITIAL_RATE_STATE = {
  afnPerUsd: 0,
  rawIrrPerUsd: 0,
  tomanPerUsd: 0,
  loading: true,
  error: false,
};

const formatAmount = (value, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
const toUsdSnapshot = (value, rate) => {
  try {
    return Math.round(usdAmountFromLocal(value, rate) * 100) / 100;
  } catch {
    return null;
  }
};

const ratesAreValid = (rates = {}) =>
  Number.isFinite(rates.afnPerUsd) &&
  Number.isFinite(rates.rawIrrPerUsd) &&
  Number.isFinite(rates.tomanPerUsd) &&
  rates.afnPerUsd > 0 &&
  rates.rawIrrPerUsd > 0 &&
  rates.tomanPerUsd > 0;

export default function CoursePricingFields({
  priceMode = "single",
  regionalPrices,
  onPriceModeChange,
  onRegionalPricesChange,
  errors = {},
  language = "en",
  disabled = false,
  minimumPriceUsd = 0,
}) {
  const isFa = language === "fa";
  const normalizedMinimumPriceUsd = Math.max(0, Number(minimumPriceUsd) || 0);
  const [rateState, setRateState] = useState(INITIAL_RATE_STATE);

  const loadRates = useCallback(async () => {
    setRateState((current) => ({ ...current, loading: true, error: false }));
    try {
      const rates = await getCoursePricingExchangeRates();
      if (!ratesAreValid(rates)) {
        throw new Error("Invalid exchange rates");
      }
      setRateState({ ...rates, loading: false, error: false });
    } catch {
      setRateState((current) => ({ ...current, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    if (priceMode !== "regional") {
      return undefined;
    }

    let cancelled = false;
    getCoursePricingExchangeRates()
      .then((rates) => {
        if (!ratesAreValid(rates)) {
          throw new Error("Invalid exchange rates");
        }
        if (!cancelled) {
          setRateState({ ...rates, loading: false, error: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateState((current) => ({ ...current, loading: false, error: true }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [priceMode]);

  useEffect(() => {
    if (
      priceMode !== "regional" ||
      !(rateState.afnPerUsd > 0) ||
      !(rateState.tomanPerUsd > 0)
    ) {
      return;
    }

    let changed = false;
    const nextPrices = { ...regionalPrices };
    for (const [region, rate] of [
      ["afghanistan", rateState.afnPerUsd],
      ["iran", rateState.tomanPerUsd],
    ]) {
      const row = regionalPrices?.[region] || {};
      if (row.isFree || row.useInternationalPrice) continue;
      const nextRow = { ...row };
      if (Number(row.regularPrice) > 0 && !(Number(row.regularPriceUsd) > 0)) {
        const regularPriceUsd = toUsdSnapshot(row.regularPrice, rate);
        if (regularPriceUsd > 0) {
          if (
            region === "iran" &&
            (import.meta.env.DEV ||
              import.meta.env.VITE_CURRENCY_CONVERSION_DEBUG === "true")
          ) {
            console.debug("[legacy-course-pricing-conversion]", {
              rawApiRateInRial: rateState.rawIrrPerUsd,
              normalizedRateInToman: rate,
              teacherEnteredTomanAmount: Number(row.regularPrice),
              finalUsdResult: Number(regularPriceUsd.toFixed(2)),
            });
          }
          nextRow.regularPriceUsd = regularPriceUsd;
          nextRow.usdExchangeRate = rate;
          changed = true;
        }
      }
      if (
        Number(row.discountedPrice) > 0 &&
        !(Number(row.discountedPriceUsd) > 0)
      ) {
        const discountedPriceUsd = toUsdSnapshot(row.discountedPrice, rate);
        if (discountedPriceUsd > 0) {
          nextRow.discountedPriceUsd = discountedPriceUsd;
          nextRow.usdExchangeRate = rate;
          changed = true;
        }
      }
      nextPrices[region] = nextRow;
    }
    if (changed) onRegionalPricesChange(nextPrices);
  }, [
    onRegionalPricesChange,
    priceMode,
    rateState.afnPerUsd,
    rateState.rawIrrPerUsd,
    rateState.tomanPerUsd,
    regionalPrices,
  ]);

  const updateRegion = (region, patch) => {
    onRegionalPricesChange({
      ...regionalPrices,
      [region]: { ...regionalPrices?.[region], ...patch },
    });
  };

  const internationalDefinition = REGION_DEFINITIONS.find(
    ({ key }) => key === "international",
  );
  const localDefinitions = REGION_DEFINITIONS.filter(
    ({ key }) => key !== "international",
  );

  return (
    <section className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h4 className="text-sm font-black text-slate-950">
          {isFa ? "قیمت‌گذاری کورس" : "Course Pricing"}
        </h4>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
          {isFa
            ? "یک قیمت برای همه تعیین کنید یا قیمت دالری پایه و قیمت‌های محلی را مشخص نمایید."
            : "Use one price everywhere, or set a required USD base with optional local prices."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        {[
          ["single", isFa ? "قیمت واحد" : "Single Price"],
          ["regional", isFa ? "قیمت منطقه‌ای" : "Regional Pricing"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onPriceModeChange(value)}
            className={`rounded-lg px-3 py-2.5 text-xs font-black transition ${
              priceMode === value
                ? "bg-white text-primary-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>

      {priceMode === "regional" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs font-semibold leading-5 text-blue-900">
            <span className="font-black">
              {isFa ? "چگونه کار می‌کند: " : "How it works: "}
            </span>
            {isFa
              ? "ابتدا قیمت پایه را به دالر تعیین کنید. سپس برای افغانستان و ایران همان قیمت را استفاده کنید یا قیمت محلی جداگانه وارد نمایید."
              : "First set the USD fallback. Then let Afghanistan and Iran use that price or add a local override."}
          </div>
          {normalizedMinimumPriceUsd > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-bold leading-5 text-amber-900">
              {isFa
                ? `حداقل تعیین‌شده توسط مدیر ${normalizedMinimumPriceUsd.toLocaleString("fa-AF")} دالر است. قیمت اصلی و هر قیمت تخفیف‌خوردهٔ پولی در تمام مناطق باید معادل همین مبلغ یا بیشتر باشد.`
                : `The administrator minimum is ${normalizedMinimumPriceUsd.toLocaleString("en-US")} USD. Every paid regular and discounted price in every region must equal this amount or more.`}
            </div>
          ) : null}

          <RegionCard
            definition={internationalDefinition}
            row={regionalPrices?.international || {}}
            updateRegion={updateRegion}
            errors={errors}
            isFa={isFa}
            disabled={disabled}
            isInternational
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div>
              <p className="text-xs font-black text-slate-800">
                {isFa ? "۲. قیمت‌های محلی" : "2. Local prices"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {isFa
                  ? "قیمت را به دالر وارد کنید؛ مبلغ دقیق افغانی یا تومان در زیر آن نمایش داده می‌شود."
                  : "Enter each override in USD; its exact AFN or toman amount appears below."}
              </p>
            </div>
            <ExchangeRateStatus
              rateState={rateState}
              isFa={isFa}
              onRetry={loadRates}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {localDefinitions.map((definition) => (
              <RegionCard
                key={definition.key}
                definition={definition}
                row={regionalPrices?.[definition.key] || {}}
                updateRegion={updateRegion}
                errors={errors}
                isFa={isFa}
                disabled={disabled}
                usdRate={
                  definition.key === "afghanistan"
                    ? rateState.afnPerUsd
                    : rateState.tomanPerUsd
                }
                rawIrrPerUsd={rateState.rawIrrPerUsd}
                internationalPrices={regionalPrices?.international || {}}
                ratesLoading={rateState.loading}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RegionCard({
  definition,
  row,
  updateRegion,
  errors,
  isFa,
  disabled,
  isInternational = false,
  usdRate = 0,
  internationalPrices = {},
  ratesLoading = false,
  rawIrrPerUsd = 0,
}) {
  const { key, currency, labelEn, labelFa } = definition;
  const usesFallback = !isInternational && Boolean(row.useInternationalPrice);
  const fieldsDisabled =
    disabled ||
    usesFallback ||
    Boolean(row.isFree) ||
    (!isInternational && !(usdRate > 0));
  const internationalPriceLabel = isFa ? "استفاده از قیمت دالری" : "Use USD fallback";
  const internationalRegularUsd = Number(internationalPrices.regularPrice);
  const internationalDiscountedUsd =
    internationalPrices.discountedPrice === "" ||
    internationalPrices.discountedPrice === null
      ? null
      : Number(internationalPrices.discountedPrice);
  const updatePrice = (field, value) => {
    const usdField =
      field === "regularPrice" ? "regularPriceUsd" : "discountedPriceUsd";
    if (isInternational) {
      updateRegion(key, {
        [field]: value,
        [usdField]: value === "" ? null : Number(value),
        usdExchangeRate: 1,
      });
      return;
    }

    let localSnapshot = "";
    let usdSnapshot = null;
    try {
      if (value !== "") {
        usdSnapshot = Number(value);
        localSnapshot = localAmountFromUsd(usdSnapshot, usdRate);
      }
    } catch {
      // Saving remains disabled by form validation until a valid rate exists.
    }

    if (
      key === "iran" &&
      value !== "" &&
      (import.meta.env.DEV ||
        import.meta.env.VITE_CURRENCY_CONVERSION_DEBUG === "true")
    ) {
      console.debug("[course-pricing-conversion]", {
        rawApiRateInRial: rawIrrPerUsd,
        normalizedRateInToman: usdRate,
        teacherEnteredUsdAmount: usdSnapshot,
        finalTomanAmount: localSnapshot,
      });
    }

    updateRegion(key, {
      [field]: localSnapshot,
      [usdField]: usdSnapshot,
      usdExchangeRate: usdRate > 0 ? usdRate : row.usdExchangeRate,
    });
  };
  const updateFallbackPreference = (useInternationalPrice) => {
    if (useInternationalPrice) {
      updateRegion(key, { useInternationalPrice: true });
      return;
    }

    const regularPriceUsd =
      Number.isFinite(internationalRegularUsd) && internationalRegularUsd > 0
        ? internationalRegularUsd
        : null;
    const discountedPriceUsd =
      Number.isFinite(internationalDiscountedUsd) &&
      internationalDiscountedUsd > 0
        ? internationalDiscountedUsd
        : null;

    updateRegion(key, {
      useInternationalPrice: false,
      regularPriceUsd,
      discountedPriceUsd,
      regularPrice:
        regularPriceUsd && usdRate > 0
          ? localAmountFromUsd(regularPriceUsd, usdRate)
          : "",
      discountedPrice:
        discountedPriceUsd && usdRate > 0
          ? localAmountFromUsd(discountedPriceUsd, usdRate)
          : "",
      usdExchangeRate: usdRate > 0 ? usdRate : null,
    });
  };

  return (
    <article
      className={`rounded-2xl border p-3.5 ${
        isInternational
          ? "border-primary-200 bg-primary-50/40"
          : usesFallback
            ? "border-slate-200 bg-slate-50/70"
            : "border-emerald-200 bg-emerald-50/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${
                isInternational
                  ? "bg-primary-600 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {isInternational ? "1" : "2"}
            </span>
            <h5 className="text-sm font-black text-slate-900">
              {isFa ? labelFa : labelEn}
            </h5>
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
            {isInternational
              ? isFa
                ? "قیمت پایه و جایگزین برای تمام کشورها"
                : "Required base and fallback for every country"
              : usesFallback
                ? isFa
                  ? "قیمت محلی از مبنای دالری و نرخ روز محاسبه می‌شود."
                  : "The local price follows the USD base and current exchange rate."
                : isFa
                  ? `قیمت اختصاصی را به دالر وارد کنید؛ معادل ${currency} هنگام ذخیره ثابت می‌ماند`
                  : `Enter the custom price in USD; its saved ${currency} equivalent remains fixed`}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm ring-1 ring-slate-200">
          {currency}
        </span>
      </div>

      {!isInternational ? (
        <label
          className={`mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${
            usesFallback
              ? "border-primary-200 bg-white text-primary-800"
              : "border-slate-200 bg-white/80 text-slate-700"
          }`}
        >
          <span>
            <span className="block text-xs font-black">{internationalPriceLabel}</span>
            <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
              {isFa
                ? "بدون نیاز به وارد کردن قیمت محلی"
                : "No local amount needs to be entered"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={usesFallback}
            disabled={disabled || row.isFree || !(usdRate > 0)}
            onChange={(event) =>
              updateFallbackPreference(event.target.checked)
            }
            className="h-4 w-4 shrink-0 accent-primary-600"
          />
        </label>
      ) : null}

      {usesFallback ? (
        <FallbackPriceSummary
          prices={internationalPrices}
          currency={currency}
          usdRate={usdRate}
          ratesLoading={ratesLoading}
          isFa={isFa}
        />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PriceInput
            label={isFa ? "قیمت اصلی" : "Regular price"}
            currency={isInternational ? currency : "USD"}
            value={
              isInternational
                ? row.regularPrice ?? ""
                : row.regularPriceUsd ?? ""
            }
            disabled={fieldsDisabled}
            onChange={(value) => updatePrice("regularPrice", value)}
            error={errors[`${key}.regularPrice`]}
            localCurrency={isInternational ? null : currency}
            localEquivalent={isInternational ? null : row.regularPrice}
            ratesLoading={ratesLoading}
            isFa={isFa}
          />
          <PriceInput
            label={isFa ? "قیمت تخفیف‌خورده (اختیاری)" : "Discounted price (optional)"}
            currency={isInternational ? currency : "USD"}
            value={
              isInternational
                ? row.discountedPrice ?? ""
                : row.discountedPriceUsd ?? ""
            }
            disabled={fieldsDisabled}
            onChange={(value) => updatePrice("discountedPrice", value)}
            error={errors[`${key}.discountedPrice`]}
            localCurrency={isInternational ? null : currency}
            localEquivalent={isInternational ? null : row.discountedPrice}
            ratesLoading={ratesLoading}
            isFa={isFa}
          />
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(row.isFree)}
          disabled={disabled}
          onChange={(event) =>
            updateRegion(key, {
              isFree: event.target.checked,
              ...(!isInternational && event.target.checked
                ? { useInternationalPrice: false }
                : {}),
            })
          }
          className="h-4 w-4 accent-emerald-600"
        />
        {isFa ? "رایگان برای این منطقه" : "Free for this region"}
      </label>
      {!isInternational && !usesFallback && Number(row.usdExchangeRate) > 0 ? (
        <p className="mt-2 text-[10px] font-bold text-slate-500">
          {isFa ? "مبنای ذخیره‌شده:" : "Saved pricing basis:"} 1 USD ={" "}
          {formatAmount(Number(row.usdExchangeRate), currency === "TOMAN" ? 0 : 2)} {currency}
        </p>
      ) : null}
    </article>
  );
}

function FallbackPriceSummary({ prices, currency, usdRate, ratesLoading, isFa }) {
  const regularUsd = Number(prices.regularPrice);
  const discountedUsd =
    prices.discountedPrice === "" || prices.discountedPrice === null
      ? null
      : Number(prices.discountedPrice);
  const effectiveUsd =
    discountedUsd !== null && Number.isFinite(discountedUsd)
      ? discountedUsd
      : regularUsd;
  const hasUsdPrice = Number.isFinite(effectiveUsd) && effectiveUsd > 0;

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary-200 bg-primary-50/60 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-primary-700">
        {isFa ? "قیمت استفاده‌شده" : "Price students will use"}
      </p>
      {prices.isFree ? (
        <p className="mt-1 text-sm font-black text-emerald-700">
          {isFa ? "رایگان" : "Free"}
        </p>
      ) : hasUsdPrice ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-black text-slate-900">
            ${formatAmount(effectiveUsd)} USD
          </span>
          {usdRate > 0 ? (
            <span className="text-[11px] font-bold text-slate-500">
              ≈ {formatAmount(effectiveUsd * usdRate, 0)} {currency}
            </span>
          ) : null}
          <span className="w-full text-[10px] font-semibold text-primary-700">
            {isFa
              ? "مبلغ محلی با نرخ جدید سیستم خودکار به‌روز می‌شود."
              : "The local amount updates automatically with the system rate."}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-[11px] font-bold text-amber-700">
          {isFa
            ? "ابتدا قیمت بین‌المللی را وارد کنید."
            : "Enter the International USD price first."}
        </p>
      )}
      {ratesLoading ? (
        <p className="mt-1 text-[10px] font-semibold text-slate-500">
          {isFa ? "در حال دریافت نرخ تبدیل..." : "Loading local conversion…"}
        </p>
      ) : null}
    </div>
  );
}

function ExchangeRateStatus({ rateState, isFa, onRetry }) {
  const summary = useMemo(() => {
    if (rateState.loading) {
      return isFa ? "در حال دریافت نرخ ارز..." : "Loading exchange rates…";
    }
    if (rateState.error) {
      return isFa ? "نرخ ارز در دسترس نیست" : "Rates unavailable";
    }
    if (rateState.afnPerUsd > 0 && rateState.tomanPerUsd > 0) {
      return `1 USD = ${formatAmount(rateState.afnPerUsd)} AFN · ${formatAmount(
        rateState.tomanPerUsd,
        0,
      )} TOMAN`;
    }
    return "";
  }, [isFa, rateState]);

  if (!summary) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black ${
        rateState.error
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span>{summary}</span>
      {rateState.error ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900"
        >
          <RefreshCw className="h-3 w-3" />
          {isFa ? "تلاش دوباره" : "Retry"}
        </button>
      ) : null}
    </div>
  );
}

function PriceInput({
  label,
  currency,
  value,
  onChange,
  disabled,
  error,
  localCurrency = null,
  localEquivalent = null,
  ratesLoading = false,
  isFa = false,
}) {
  return (
    <label className="block text-[11px] font-bold text-slate-600">
      {label}
      <div className="relative mt-1">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          pattern="[0-9]*[.]?[0-9]*"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(normalizePriceInput(event.target.value))}
          className={`h-10 w-full rounded-xl border bg-white ps-3 pe-16 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            error
              ? "border-rose-400 focus:ring-2 focus:ring-rose-100"
              : "border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-black text-slate-400">
          {currency}
        </span>
      </div>
      {error ? (
        <span className="mt-1 block text-[10px] font-bold text-rose-600">{error}</span>
      ) : null}
      {!disabled && localCurrency ? (
        <span className="mt-1 block min-h-4 text-[10px] font-bold text-slate-500">
          {ratesLoading
            ? isFa
              ? "در حال محاسبه مبلغ محلی..."
              : "Calculating local equivalent…"
            : localEquivalent !== null && localEquivalent !== ""
              ? `= ${formatAmount(Number(localEquivalent), 2)} ${localCurrency} ${isFa ? "(مبلغ دقیق ذخیره‌شده)" : "(exact saved amount)"}`
              : isFa
                ? "مبلغ دالری را وارد کنید تا معادل محلی نمایش داده شود."
                : "Enter a USD amount to see its local equivalent."}
        </span>
      ) : null}
    </label>
  );
}
