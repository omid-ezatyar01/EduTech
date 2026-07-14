import { Copy, Landmark, ReceiptText, UserRound, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

const copyToClipboard = async (value = "") => {
  const text = String(value || "").trim();
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

function DetailRow({ label, value, onCopy, copyLabel }) {
  if (!String(value || "").trim()) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900" dir="ltr">
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
        >
          <Copy size={14} />
          {copyLabel}
        </button>
      </div>
    </div>
  );
}

export default function BankPaymentDetailsModal({
  isOpen,
  onClose,
  details = null,
  language = "fa",
}) {
  const isFa = language === "fa";
  const [copiedKey, setCopiedKey] = useState("");

  if (!isOpen || !details) return null;

  const t = {
    title: isFa ? "اطلاعات پرداخت بانکی" : "Bank payment details",
    subtitle: isFa
      ? "این اطلاعات را برای انتقال بانکی استفاده کنید."
      : "Use these details for the bank transfer.",
    course: isFa ? "کورس" : "Course",
    teacher: isFa ? "مدرس" : "Teacher",
    accountHolderName: isFa ? "نام صاحب حساب" : "Account holder",
    bankName: isFa ? "نام بانک" : "Bank name",
    accountNumber: isFa ? "شماره حساب" : "Account number",
    cardNumber: isFa ? "شماره کارت" : "Card number",
    iban: isFa ? "شماره شبا / IBAN" : "IBAN",
    note: isFa ? "راهنما" : "Note",
    copy: copiedKey ? (isFa ? "کپی شد" : "Copied") : isFa ? "کپی" : "Copy",
    close: isFa ? "بستن" : "Close",
  };

  const bankPaymentInfo = details?.bankPaymentInfo || {};

  const handleCopy = async (key, value) => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? "" : current));
    }, 1600);
  };

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        dir={isFa ? "rtl" : "ltr"}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <Landmark size={14} />
              {t.title}
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{t.title}</h2>
            <p className="mt-2 text-sm font-medium text-slate-600">{t.subtitle}</p>
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

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2 text-slate-500">
                <ReceiptText size={16} />
                <span className="text-xs font-black uppercase tracking-wide">{t.course}</span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-950">{details?.course?.title || "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2 text-slate-500">
                <UserRound size={16} />
                <span className="text-xs font-black uppercase tracking-wide">{t.teacher}</span>
              </div>
              <p className="mt-2 text-sm font-black text-slate-950">{details?.teacher?.name || "-"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <DetailRow
              label={t.accountHolderName}
              value={bankPaymentInfo.accountHolderName}
              onCopy={() => handleCopy("accountHolderName", bankPaymentInfo.accountHolderName)}
              copyLabel={copiedKey === "accountHolderName" ? t.copy : isFa ? "کپی" : "Copy"}
            />
            <DetailRow
              label={t.bankName}
              value={bankPaymentInfo.bankName}
              onCopy={() => handleCopy("bankName", bankPaymentInfo.bankName)}
              copyLabel={copiedKey === "bankName" ? t.copy : isFa ? "کپی" : "Copy"}
            />
            <DetailRow
              label={t.accountNumber}
              value={bankPaymentInfo.accountNumber}
              onCopy={() => handleCopy("accountNumber", bankPaymentInfo.accountNumber)}
              copyLabel={copiedKey === "accountNumber" ? t.copy : isFa ? "کپی" : "Copy"}
            />
            <DetailRow
              label={t.cardNumber}
              value={bankPaymentInfo.cardNumber}
              onCopy={() => handleCopy("cardNumber", bankPaymentInfo.cardNumber)}
              copyLabel={copiedKey === "cardNumber" ? t.copy : isFa ? "کپی" : "Copy"}
            />
            <DetailRow
              label={t.iban}
              value={bankPaymentInfo.iban}
              onCopy={() => handleCopy("iban", bankPaymentInfo.iban)}
              copyLabel={copiedKey === "iban" ? t.copy : isFa ? "کپی" : "Copy"}
            />
          </div>

          {String(bankPaymentInfo.note || "").trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
                {t.note}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
                {bankPaymentInfo.note}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
