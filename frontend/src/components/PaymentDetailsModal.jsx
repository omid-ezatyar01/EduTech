import {
  X,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Undo2,
  ExternalLink,
} from "lucide-react";

export default function PaymentDetailsModal({
  isOpen,
  onClose,
  payment,
  onDownload,
  onResumePendingPayment,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    invoiceNumber: isFa ? "شماره فاکتور" : "Invoice Number",
    dateTime: isFa ? "تاریخ و زمان" : "Date & Time",
    description: isFa ? "شرح" : "Description",
    service: isFa ? "سرویس" : "Service",
    method: isFa ? "روش پرداخت" : "Payment Method",
    transactionId: isFa ? "شناسه تراکنش" : "Transaction ID",
    pendingHelp: isFa
      ? "برای تکمیل این پرداخت، به صفحه پرداخت برگردید."
      : "Return to the payment page to complete this payment.",
    hostedPendingHelp: isFa
      ? "این پرداخت هنوز در انتظار تایید است. برای ادامه، به صفحه پرداخت برگردید."
      : "This payment is still waiting for confirmation. Return to the payment page to continue.",
    trustWalletHelp: isFa
      ? "این روش پرداخت مستقیم به آدرس Trust Wallet فروشنده روی BSC (BEP20) انجام می‌شود."
      : "This method sends payment directly to the merchant Trust Wallet on BSC (BEP20).",
    pendingBanner: isFa
      ? "این پرداخت هنوز نهایی نشده است."
      : "This payment is not completed yet.",
    continuePayment: isFa ? "بازگشت به صفحه پرداخت" : "Back to payment page",
    downloadInvoice: isFa ? "دانلود فاکتور" : "Download Invoice",
  };

  if (!isOpen || !payment) return null;

  const getStatusIcon = (status) => {
    if (status === "success")
      return <CheckCircle2 size={32} className="text-green-500" />;
    if (status === "pending")
      return <Clock size={32} className="text-amber-500" />;
    if (status === "failed")
      return <XCircle size={32} className="text-red-500" />;
    return <Undo2 size={32} className="text-blue-500" />;
  };

  const isPendingPayment = payment.status === "pending";
  const canResumePendingPayment = Boolean(payment?.canResumePendingPayment);
  const infoRows = [
    { label: t.invoiceNumber, value: payment.invoice, mono: true },
    { label: t.dateTime, value: `${payment.date} - ${payment.time}` },
    { label: t.description, value: payment.service },
    { label: t.service, value: payment.service },
    { label: t.method, value: payment.method },
    { label: t.transactionId, value: payment.transactionId || "-", mono: true, ltr: true },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center py-4">
        <div className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="relative border-b border-slate-100 bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-6 sm:p-8">
            <button
              onClick={onClose}
              className={`absolute top-5 rounded-full bg-white p-2 text-slate-400 shadow-sm transition hover:bg-slate-100 hover:text-slate-600 ${
                isFa ? "right-5" : "left-5"
              }`}
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center justify-center">
              <div className="mb-4 rounded-full bg-white p-3 shadow-sm ring-4 ring-white/70">
                {getStatusIcon(payment.status)}
              </div>
              <h2 className="text-3xl font-black text-slate-950" dir="ltr">
                {payment.amount}
              </h2>
              <p className="mt-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow-sm">
                {payment.statusLabel}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm sm:p-6 md:p-8" dir={isFa ? "ltr" : "ltr"}>
            <div className="space-y-4" dir={isFa ? "rtl" : "ltr"}>
              <div className="grid gap-3">
                {infoRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                  >
                    <p className="text-[11px] font-black tracking-[0.12em] text-slate-400">
                      {row.label}
                    </p>
                    <p
                      dir={row.ltr ? "ltr" : isFa ? "rtl" : "ltr"}
                      className={`mt-2 break-all text-sm font-black text-slate-900 ${
                        row.mono ? "font-mono tracking-wide" : ""
                      }`}
                    >
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>

              {canResumePendingPayment ? (
                <div className="rounded-[24px] border border-primary-100 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fbff_100%)] p-4 shadow-sm">
                  {isPendingPayment ? (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-black text-amber-800">
                      {t.pendingBanner}
                    </div>
                  ) : null}
                  <p className="text-sm font-black text-slate-900">
                    {payment.supportsTxHashVerification || payment.isPendingHesabPay
                      ? t.pendingHelp
                      : t.hostedPendingHelp}
                  </p>
                  {payment.supportsTxHashVerification ? (
                    <>
                      <p className="mt-2 text-[11px] font-semibold leading-5 text-emerald-700">
                        {t.trustWalletHelp}
                      </p>
                    </>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => onResumePendingPayment?.(payment)}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-white px-4 text-sm font-black text-primary-700 transition hover:bg-primary-50"
                    >
                      <ExternalLink size={16} />
                      <span>{t.continuePayment}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/80 p-5 sm:p-6">
            <div className="flex gap-3">
              {payment.status === "success" ? (
                <button
                  onClick={() => {
                    onDownload(payment);
                    onClose();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700"
                >
                  <Download size={18} /> {t.downloadInvoice}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
