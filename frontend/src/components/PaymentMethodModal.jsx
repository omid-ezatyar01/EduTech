import { Coins, CreditCard, Landmark, MapPin, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useRegionalPricing } from "../context/RegionalPricingContext.jsx";

export default function PaymentMethodModal({
  isOpen,
  onClose,
  onSelectHesabPay,
  onSelectNowPayments,
  onSelectBank,
  language = "fa",
  courseTitle = "",
  hesabPayAmountLabel = "",
  cryptoAmountLabel = "",
  bankOptionCountryCode = "",
  isBankPaymentAvailable = true,
  isLoading = false,
  isBankLoading = false,
}) {
  const isFa = language === "fa";
  const { pricingRegion, setPricingRegion } = useRegionalPricing();
  if (!isOpen) return null;
  const normalizedCountryCode = String(bankOptionCountryCode || "").trim().toUpperCase();
  const showBankOption =
    isBankPaymentAvailable &&
    (normalizedCountryCode === "AF" || normalizedCountryCode === "IR");
  const bankCountryLabel =
    normalizedCountryCode === "AF"
      ? isFa
        ? "افغانستان"
        : "Afghanistan"
      : normalizedCountryCode === "IR"
        ? isFa
          ? "ایران"
          : "Iran"
        : "";

  const t = {
    title: isFa ? "روش پرداخت را انتخاب کنید" : "Choose a payment method",
    subtitle: isFa
      ? "برای ادامه، یکی از روش‌های پرداخت را انتخاب کنید."
      : "Pick a payment option to continue.",
    course: isFa ? "کورس" : "Course",
    card: isFa ? "پرداخت از طریق HesabPay (Visa / MasterCard)" : "Pay with HesabPay (Visa / MasterCard)",
    cardNote: isFa
      ? "مبلغ کورس قبل از انتقال به پورتال، از دالر به افغانی تبدیل می‌شود."
      : "The course amount is converted from USD to AFN before redirecting to the portal.",
    cryptoGateway: isFa ? "پرداخت دالری روی شبکه BSC (BEP20)" : "Dollar payment on BSC (BEP20)",
    cryptoGatewayNote: isFa ? "پرداخت به واحد دالر" : "Pay in USD value",
    bank: isFa ? "بانک" : "Bank",
    bankNote: isFa
      ? `ویژه کاربران ${bankCountryLabel || "ایران"}`
      : `Available for ${bankCountryLabel || "Iran"} users`,
    soon: isFa ? "به‌زودی" : "Soon",
    continue: isFa ? "ادامه" : "Continue",
    close: isFa ? "بستن" : "Close",
    loading: isFa ? "در حال آماده‌سازی" : "Preparing",
    loadingBank: isFa ? "در حال دریافت" : "Loading",
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-teal-400 to-amber-400" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">{t.title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              {t.subtitle}
            </p>
            {courseTitle ? (
              <p className="mt-2 line-clamp-1 text-xs font-bold text-slate-500">
                {t.course}: <span className="text-slate-700">{courseTitle}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label={t.close}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-primary-600" />
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-black text-slate-800">
                  {isFa ? "منطقه قیمت‌گذاری شما" : "Your pricing region"}
                </label>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                  {isFa
                    ? "اگر تشخیص خودکار درست نیست، پیش از پرداخت منطقه را تغییر دهید."
                    : "If automatic detection is incorrect, change the region before checkout."}
                </p>
                <select
                  value={pricingRegion}
                  onChange={(event) => setPricingRegion(event.target.value)}
                  disabled={isLoading || isBankLoading}
                  className="mt-2 h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-primary-500"
                >
                  <option value="afghanistan">{isFa ? "افغانستان (AFN)" : "Afghanistan (AFN)"}</option>
                  <option value="iran">{isFa ? "ایران (تومان)" : "Iran (Toman)"}</option>
                  <option value="international">{isFa ? "بین‌المللی (USD)" : "International (USD)"}</option>
                </select>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={onSelectHesabPay}
            disabled={isLoading}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-start transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <CreditCard size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">{t.card}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {hesabPayAmountLabel || t.cardNote}
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-primary-700">
              {isLoading ? t.loading : isFa ? "انتخاب" : "Select"}
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectNowPayments}
            disabled={isLoading}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-start transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Coins size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">{t.cryptoGateway}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {cryptoAmountLabel || t.cryptoGatewayNote}
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-teal-700">
              {isLoading ? t.loading : isFa ? "انتخاب" : "Select"}
            </span>
          </button>

          {showBankOption ? (
            <>
              <button
                type="button"
                onClick={onSelectBank}
                disabled={isLoading || isBankLoading}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-start transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">{t.bank}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {t.bankNote}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-black text-amber-700">
                  {isBankLoading ? t.loadingBank : isFa ? "انتخاب" : "Select"}
                </span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
