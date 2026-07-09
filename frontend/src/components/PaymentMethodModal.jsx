import { Coins, CreditCard, Landmark, Sparkles, Store, X } from "lucide-react";
import { createPortal } from "react-dom";

export default function PaymentMethodModal({
  isOpen,
  onClose,
  onSelectHesabPay,
  onSelectNowPayments,
  language = "fa",
  courseTitle = "",
  hesabPayAmountLabel = "",
  cryptoAmountLabel = "",
  showAfghanistanOptions = false,
  isLoading = false,
}) {
  const isFa = language === "fa";
  if (!isOpen) return null;

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
    localExchange: isFa ? "صرافی محلی" : "Local Exchange",
    localExchangeNote: isFa
      ? "ویژه کاربران افغانستان"
      : "Available for Afghanistan users",
    bank: isFa ? "بانک" : "Bank",
    bankNote: isFa
      ? "ویژه کاربران افغانستان"
      : "Available for Afghanistan users",
    soon: isFa ? "به‌زودی" : "Soon",
    continue: isFa ? "ادامه" : "Continue",
    close: isFa ? "بستن" : "Close",
    loading: isFa ? "در حال آماده‌سازی" : "Preparing",
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-teal-400 to-amber-400" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
              <Sparkles size={14} />
              {t.title}
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{t.title}</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {t.subtitle}
            </p>
            {courseTitle ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
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

        <div className="space-y-4 px-6 py-6 sm:px-8">
          <button
            type="button"
            onClick={onSelectHesabPay}
            disabled={isLoading}
            className="flex w-full items-center justify-between rounded-2xl border border-primary-200 bg-primary-50 px-4 py-4 text-start transition hover:border-primary-300 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
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
            className="flex w-full items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-start transition hover:border-teal-300 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm">
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

          {showAfghanistanOptions ? (
            <>
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-start opacity-60 transition disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                    <Store size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">{t.localExchange}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {t.localExchangeNote}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-black text-slate-500">
                  {t.soon}
                </span>
              </button>

              <button
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-start opacity-60 transition disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">{t.bank}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {t.bankNote}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-black text-slate-500">
                  {t.soon}
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
