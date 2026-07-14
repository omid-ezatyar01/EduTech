import {
  CheckCircle2,
  Copy,
  Landmark,
  ReceiptText,
  UploadCloud,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

const MAX_PAYMENT_PROOF_BYTES = 300 * 1024;
const ALLOWED_PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function DetailRow({ label, value, onCopy, copyLabel, tone = "slate", showCopy = true }) {
  if (!String(value || "").trim()) return null;

  const toneClass = {
    slate: "border-slate-200 bg-white",
    emerald: "border-slate-200 bg-slate-50",
    amber: "border-slate-200 bg-slate-50",
  }[tone] || "border-slate-200 bg-white";

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 break-words text-sm font-black text-slate-950 sm:text-[15px]" dir="ltr">
            {value}
          </p>
        </div>
        {showCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Copy size={14} />
            {copyLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function BankPaymentDetailsModal({
  isOpen,
  onClose,
  details = null,
  language = "fa",
  onSubmitProof = null,
  isSubmittingProof = false,
}) {
  const isFa = language === "fa";
  const [copiedKey, setCopiedKey] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [note, setNote] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  if (!isOpen || !details) return null;

  const t = {
    title: isFa ? "اطلاعات پرداخت بانکی" : "Bank payment details",
    subtitle: isFa
      ? "جزئیات حساب را کپی کنید، انتقال را انجام دهید و بعد رسید را برای مدرس بفرستید."
      : "Copy the account details, complete the transfer, then send the proof to the teacher.",
    course: isFa ? "کورس" : "Course",
    teacher: isFa ? "مدرس" : "Teacher",
    country: isFa ? "کشور" : "Country",
    currency: isFa ? "واحد پول" : "Currency",
    accountHolderName: isFa ? "نام صاحب حساب" : "Account holder",
    bankName: isFa ? "نام بانک" : "Bank name",
    accountNumber: isFa ? "شماره حساب" : "Account number",
    cardNumber: isFa ? "شماره کارت" : "Card number",
    iban: isFa ? "شماره شبا" : "Shaba / IBAN",
    note: isFa ? "راهنما" : "Note",
    senderAccount: isFa ? "شماره حساب / کارت فرستنده" : "Sender account / card number",
    uploadLabel: isFa ? "عکس رسید پرداخت" : "Payment proof image",
    uploadHint: isFa ? "فقط عکس رسید با فرمت JPG، PNG یا WEBP و کمتر از ۳۰۰ کیلوبایت را انتخاب کنید." : "Choose a JPG, PNG, or WEBP proof image smaller than 300 KB.",
    studentNote: isFa ? "یادداشت شما" : "Your note",
    transferGuideTitle: isFa ? "راهنمای پرداخت" : "Payment guide",
    transferGuide: isFa
      ? "بعد از انتقال بانکی، رسید را همین‌جا بفرستید تا مدرس پرداخت شما را تایید کند."
      : "After the bank transfer, send the receipt here so the teacher can approve your payment.",
    selectedFile: isFa ? "فایل انتخاب‌شده" : "Selected file",
    chooseFile: isFa ? "انتخاب فایل" : "Choose file",
    fileReady: isFa ? "رسید آماده ارسال است" : "Receipt is ready to send",
    submit: isFa ? "ارسال رسید برای مدرس" : "Send proof to teacher",
    submitting: isFa ? "در حال ارسال..." : "Submitting...",
    submitSuccess: isFa
      ? "رسید پرداخت برای مدرس ارسال شد. بعد از تایید، به کورس اضافه می‌شوید."
      : "Payment proof was sent to the teacher. You will be added after approval.",
    waitingReview: isFa
      ? "رسید قبلی شما هنوز در انتظار بررسی مدرس است. تا وقتی رد نشود، ارسال دوباره ممکن نیست."
      : "Your previous payment proof is still waiting for teacher review. You cannot submit again until it is rejected.",
    alreadyApproved: isFa
      ? "این پرداخت قبلاً توسط مدرس تایید شده است."
      : "This payment has already been approved by the teacher.",
    rejectedCanRetry: isFa
      ? "رسید قبلی شما رد شده است. می‌توانید رسید جدید بفرستید."
      : "Your previous payment proof was rejected. You can send a new one.",
    copy: copiedKey ? (isFa ? "کپی شد" : "Copied") : isFa ? "کپی" : "Copy",
    close: isFa ? "بستن" : "Close",
  };

  const bankPaymentInfo = details?.bankPaymentInfo || {};
  const submissionState = details?.submissionState || {};
  const submissionStatus = String(submissionState.status || "none").trim();
  const canSubmitProof = Boolean(onSubmitProof) && submissionState.canResubmit !== false;
  const bankCountry = String(bankPaymentInfo.country || (String(bankPaymentInfo.iban || "").startsWith("IR") ? "IR" : "")).toUpperCase();
  const countryLabel = bankCountry === "AF"
    ? (isFa ? "افغانستان" : "Afghanistan")
    : bankCountry === "IR"
      ? (isFa ? "ایران" : "Iran")
      : "";
  const selectedFileName = paymentProof instanceof File ? paymentProof.name : "";

  const handleCopy = async (key, value) => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? "" : current));
    }, 1600);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!onSubmitProof) return;
    if (!canSubmitProof) {
      setSubmitError(
        submissionStatus === "approved" ? t.alreadyApproved : t.waitingReview,
      );
      return;
    }
    if (!(paymentProof instanceof File)) {
      setSubmitError(
        isFa ? "لطفاً اسکرین‌شات یا فایل رسید را انتخاب کنید." : "Please select a payment proof file.",
      );
      return;
    }

    try {
      await onSubmitProof({
        senderAccount,
        note,
        paymentProof,
      });
      setSubmitSuccess(t.submitSuccess);
      setSenderAccount("");
      setNote("");
      setPaymentProof(null);
    } catch (error) {
      setSubmitError(String(error?.message || (isFa ? "ارسال رسید انجام نشد." : "Unable to submit payment proof.")));
    }
  };

  const handlePaymentProofChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setPaymentProof(null);
      return;
    }

    if (!ALLOWED_PAYMENT_PROOF_TYPES.has(String(nextFile.type || "").toLowerCase())) {
      setPaymentProof(null);
      setSubmitError(
        isFa ? "فقط فایل عکس JPG، PNG یا WEBP قابل قبول است." : "Only JPG, PNG, or WEBP proof images are allowed.",
      );
      event.target.value = "";
      return;
    }

    if (Number(nextFile.size || 0) > MAX_PAYMENT_PROOF_BYTES) {
      setPaymentProof(null);
      setSubmitError(
        isFa ? "حجم عکس رسید باید کمتر از ۳۰۰ کیلوبایت باشد." : "Proof image size must be smaller than 300 KB.",
      );
      event.target.value = "";
      return;
    }

    setSubmitError("");
    setPaymentProof(nextFile);
  };

  const content = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="edutech-scrollbar relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-y-auto overflow-x-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:rounded-[28px]"
        dir="ltr"
      >
        <div
          className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]"
          dir={isFa ? "rtl" : "ltr"}
        >
          <div className="border-b border-slate-200 bg-slate-50/60 lg:min-h-0 lg:border-b-0 lg:border-e">
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                  <Landmark size={14} />
                  {t.title}
                </div>
                <h2 className="mt-3 text-xl font-black text-slate-950 sm:text-2xl">{t.title}</h2>
                <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-slate-600">
                  {t.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:h-[calc(92vh-96px)] lg:overflow-y-auto lg:px-8 lg:edutech-scrollbar">
              <div className="rounded-[20px] border border-slate-200 bg-white p-4 sm:rounded-[24px]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <ReceiptText size={16} />
                      <span className="text-xs font-black uppercase tracking-wide">{t.course}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-950">{details?.course?.title || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <UserRound size={16} />
                      <span className="text-xs font-black uppercase tracking-wide">{t.teacher}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-slate-950">{details?.teacher?.name || "-"}</p>
                  </div>
                </div>

              <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4 sm:rounded-[20px]">
                  <div className="flex items-center gap-2 text-slate-700">
                    <WalletCards size={16} />
                    <p className="text-xs font-black uppercase tracking-wide">{t.transferGuideTitle}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                    {submissionStatus === "pending_review"
                      ? t.waitingReview
                      : submissionStatus === "approved"
                        ? t.alreadyApproved
                        : submissionStatus === "rejected"
                          ? t.rejectedCanRetry
                          : t.transferGuide}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label={t.country}
                  value={countryLabel}
                  showCopy={false}
                  tone="slate"
                />
                <DetailRow
                  label={t.currency}
                  value={bankPaymentInfo.currency}
                  showCopy={false}
                />
                <DetailRow
                  label={t.accountHolderName}
                  value={bankPaymentInfo.accountHolderName}
                  onCopy={() => handleCopy("accountHolderName", bankPaymentInfo.accountHolderName)}
                  copyLabel={copiedKey === "accountHolderName" ? t.copy : isFa ? "کپی" : "Copy"}
                  tone="slate"
                  showCopy={false}
                />
                <DetailRow
                  label={t.bankName}
                  value={bankPaymentInfo.bankName}
                  onCopy={() => handleCopy("bankName", bankPaymentInfo.bankName)}
                  copyLabel={copiedKey === "bankName" ? t.copy : isFa ? "کپی" : "Copy"}
                  showCopy={false}
                />
              </div>

              <div className="mt-4 grid gap-3">
                <DetailRow
                  label={t.accountNumber}
                  value={bankPaymentInfo.accountNumber}
                  onCopy={() => handleCopy("accountNumber", bankPaymentInfo.accountNumber)}
                  copyLabel={copiedKey === "accountNumber" ? t.copy : isFa ? "کپی" : "Copy"}
                  tone="slate"
                />
                <DetailRow
                  label={t.cardNumber}
                  value={bankPaymentInfo.cardNumber}
                  onCopy={() => handleCopy("cardNumber", bankPaymentInfo.cardNumber)}
                  copyLabel={copiedKey === "cardNumber" ? t.copy : isFa ? "کپی" : "Copy"}
                  tone="slate"
                />
                <DetailRow
                  label={t.iban}
                  value={bankPaymentInfo.iban}
                  onCopy={() => handleCopy("iban", bankPaymentInfo.iban)}
                  copyLabel={copiedKey === "iban" ? t.copy : isFa ? "کپی" : "Copy"}
                />
              </div>

              {String(bankPaymentInfo.paymentNote || bankPaymentInfo.note || "").trim() ? (
                <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4 sm:rounded-[20px]">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {t.note}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                    {bankPaymentInfo.paymentNote || bankPaymentInfo.note}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 bg-white">
            <div className="edutech-scrollbar h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
              {onSubmitProof ? (
                <form className="flex h-full min-h-[320px] flex-col rounded-[20px] border border-slate-200 bg-slate-50/50 p-4 sm:rounded-[24px] sm:p-5" onSubmit={handleSubmit}>
                  <div>
                    <p className="text-base font-black text-slate-950">
                    {isFa ? "بعد از انتقال، رسید را برای مدرس بفرستید" : "After transfer, send the proof to the teacher"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {canSubmitProof ? t.uploadHint : submissionStatus === "approved" ? t.alreadyApproved : t.waitingReview}
                    </p>
                  </div>

                  <div className="mt-5 flex-1 space-y-4">
                    {!canSubmitProof ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                        {submissionStatus === "approved" ? t.alreadyApproved : t.waitingReview}
                      </div>
                    ) : null}
                    {submitError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {submitError}
                      </div>
                    ) : null}
                    {submitSuccess ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                        {submitSuccess}
                      </div>
                    ) : null}

                    <label className="block space-y-2">
                      <span className="text-xs font-black text-slate-700">{t.senderAccount}</span>
                      <input
                        type="text"
                        value={senderAccount}
                        onChange={(event) => setSenderAccount(event.target.value)}
                        disabled={!canSubmitProof || isSubmittingProof}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        dir="ltr"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-black text-slate-700">{t.uploadLabel}</span>
                      <div className="mt-2 rounded-[18px] border border-dashed border-slate-300 bg-white p-4 sm:rounded-[20px]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
                              <UploadCloud size={20} />
                            </span>
                            <div>
                              <p className="text-sm font-black text-slate-950">
                                {selectedFileName || t.uploadLabel}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {selectedFileName ? t.fileReady : t.uploadHint}
                              </p>
                            </div>
                          </div>

                          <div className="relative shrink-0 self-start md:self-auto">
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                              onChange={handlePaymentProofChange}
                              disabled={!canSubmitProof || isSubmittingProof}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            />
                            <span className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-xs font-black ${
                              canSubmitProof
                                ? "border-slate-200 bg-white text-slate-700"
                                : "border-slate-200 bg-slate-100 text-slate-400"
                            }`}>
                              {t.chooseFile}
                            </span>
                          </div>
                        </div>

                        {selectedFileName ? (
                          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                            <CheckCircle2 size={14} />
                            <span className="truncate">
                              {t.selectedFile}: {selectedFileName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-black text-slate-700">{t.studentNote}</span>
                      <textarea
                        rows={4}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={!canSubmitProof || isSubmittingProof}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={!canSubmitProof || isSubmittingProof}
                        className="inline-flex h-13 min-h-[52px] w-full items-center justify-center rounded-[16px] border border-slate-900 bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {!canSubmitProof
                          ? submissionStatus === "approved"
                            ? (isFa ? "قبلاً تایید شده" : "Already approved")
                            : (isFa ? "در انتظار بررسی مدرس" : "Waiting for teacher review")
                          : isSubmittingProof
                            ? t.submitting
                            : t.submit}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
