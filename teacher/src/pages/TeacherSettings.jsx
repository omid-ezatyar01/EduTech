import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { getDisplayCurrency } from "../utils/currencyDisplay";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPasswordInput from "../components/auth/TeacherPasswordInput";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { changeTeacherPassword, getCurrentUser } from "../../services/authService";
import { updateTeacherProfile } from "../../services/teacherPortalService";
import {
  PORTAL_CONFIG,
  clearAuth,
  getAuthUser,
  saveAuthUser,
} from "../../services/portal";

const getRequestError = (error, fallback) =>
  String(error?.response?.data?.message || error?.message || fallback);

const normalizeLocaleDigits = (value = "") =>
  String(value || "").replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return char;
  });

const normalizeCardNumberValue = (value = "") =>
  normalizeLocaleDigits(value).replace(/[\s-]+/g, "");

const normalizeIbanValue = (value = "") =>
  normalizeLocaleDigits(value).replace(/\s+/g, "").toUpperCase();

const normalizeAccountNumberValue = (value = "") =>
  String(normalizeLocaleDigits(value || "")).trim().replace(/\s+/g, "");

const normalizeSwiftCodeValue = (value = "") =>
  String(normalizeLocaleDigits(value || "")).trim().replace(/\s+/g, "").toUpperCase();

const inferBankCountry = (form = {}) => {
  const explicitCountry = String(form.country || "").trim().toUpperCase();
  if (explicitCountry === "AF" || explicitCountry === "IR") return explicitCountry;

  const iban = normalizeIbanValue(form.iban || "");
  const currency = String(form.currency || "").trim().toUpperCase();
  const swiftCode = normalizeSwiftCodeValue(form.swiftCode || "");

  if (iban.startsWith("IR")) return "IR";
  if (currency === "IRR") return "IR";
  if (currency === "AFN") return "AF";
  if (swiftCode) return "AF";
  return "";
};

const isValidIranianSheba = (value = "") => {
  const iban = normalizeIbanValue(value);
  if (!/^IR\d{24}$/.test(iban)) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const char of rearranged) {
    const expanded = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of expanded) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
};

const normalizeBankForm = (form = {}) => {
  const country = inferBankCountry(form);
  const normalized = {
    country,
    accountHolderName: String(form.accountHolderName || "").trim(),
    bankName: String(form.bankName || "").trim(),
    accountNumber: normalizeAccountNumberValue(form.accountNumber || ""),
    cardNumber: normalizeCardNumberValue(form.cardNumber || ""),
    iban: normalizeIbanValue(form.iban || ""),
    swiftCode: normalizeSwiftCodeValue(form.swiftCode || ""),
    currency: String(form.currency || "").trim().toUpperCase(),
    paymentNote: String(form.paymentNote || form.note || "").trim(),
  };

  if (normalized.country === "AF") {
    normalized.iban = "";
  }

  if (!normalized.currency) {
    normalized.currency = normalized.country === "IR" ? "IRR" : normalized.country === "AF" ? "AFN" : "";
  }

  return normalized;
};

const validateBankForm = (form = {}, isFa = true) => {
  const normalized = normalizeBankForm(form);
  const hasAnyValue = Object.values(normalized).some(Boolean);

  if (!hasAnyValue) {
    return { ok: true, normalized };
  }

  if (!["AF", "IR"].includes(normalized.country)) {
    return {
      ok: false,
      message: isFa ? "انتخاب کشور الزامی است." : "Country is required.",
    };
  }

  if (!normalized.accountHolderName) {
    return {
      ok: false,
      message: isFa ? "نام صاحب حساب الزامی است." : "Account holder name is required.",
    };
  }

  if (!normalized.bankName) {
    return {
      ok: false,
      message: isFa ? "نام بانک الزامی است." : "Bank name is required.",
    };
  }

  if (normalized.country === "AF") {
    if (!normalized.accountNumber) {
      return {
        ok: false,
        message: isFa
          ? "شماره حساب برای بانک‌های افغانستان الزامی است."
          : "Account number is required for Afghanistan banks.",
      };
    }

    return { ok: true, normalized };
  }

  if (!normalized.cardNumber && !normalized.accountNumber && !normalized.iban) {
    return {
      ok: false,
      message: isFa
        ? "حداقل یکی از شماره کارت، شماره شبا یا شماره حساب را وارد کنید."
        : "Enter at least one card number, Shaba, or account number.",
    };
  }

  if (normalized.cardNumber && !/^\d{16}$/.test(normalized.cardNumber)) {
    return {
      ok: false,
      message: isFa
        ? "شماره کارت ایران باید دقیقاً ۱۶ رقم باشد."
        : "Iranian card number must be exactly 16 digits.",
    };
  }

  if (normalized.iban) {
    if (!/^IR\d{24}$/.test(normalized.iban)) {
      return {
        ok: false,
        message: isFa
          ? "شماره شبا باید با IR شروع شود و شامل ۲۴ رقم باشد."
          : "Shaba must start with IR and contain 24 digits.",
      };
    }
    if (!isValidIranianSheba(normalized.iban)) {
      return {
        ok: false,
        message: isFa ? "شماره شبا معتبر نیست." : "Shaba is not valid.",
      };
    }
  }

  return { ok: true, normalized };
};

const hasSavedBankPaymentInfo = (form = {}) =>
  Object.values(normalizeBankForm(form)).some(Boolean);

const getTeacherBankReviewState = (user = {}) => {
  const review = user?.bankPaymentReview || {};
  const pendingInfo = normalizeBankForm(review.pendingInfo || {});
  const approvedInfo = normalizeBankForm(user?.bankPaymentInfo || {});
  const status =
    review.status && review.status !== "not_submitted"
      ? review.status
      : hasSavedBankPaymentInfo(approvedInfo)
        ? "approved"
        : "not_submitted";
  return {
    status,
    reviewNote: String(review.reviewNote || ""),
    form: ["pending", "rejected"].includes(status) ? pendingInfo : approvedInfo,
  };
};

export default function TeacherSettings() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [bankForm, setBankForm] = useState(() => {
    return getTeacherBankReviewState(getAuthUser() || {}).form;
  });
  const [bankReview, setBankReview] = useState(() =>
    getTeacherBankReviewState(getAuthUser() || {}),
  );
  const [bankError, setBankError] = useState("");
  const [bankSuccess, setBankSuccess] = useState("");
  const [isSavingBankInfo, setIsSavingBankInfo] = useState(false);
  const [isBankFormLocked, setIsBankFormLocked] = useState(() =>
    getTeacherBankReviewState(getAuthUser() || {}).status !== "not_submitted",
  );

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || {
      name: "Teacher",
      email: "teacher@edutech.study",
      role: "teacher",
    };
  }, []);

  useEffect(() => {
    if (!isComplete) return undefined;
    const timer = window.setTimeout(() => {
      clearAuth({ notify: false });
      window.location.replace(PORTAL_CONFIG.loginPath);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [isComplete]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((freshUser) => {
        if (!active || !freshUser || freshUser.role !== "teacher") return;
        saveAuthUser(freshUser);
        const nextReview = getTeacherBankReviewState(freshUser);
        setBankReview(nextReview);
        setBankForm(nextReview.form);
        setIsBankFormLocked(nextReview.status !== "not_submitted");
      })
      .catch(() => {
        // Keep the locally cached profile available during a temporary network failure.
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(isFa ? "رمزهای جدید یکسان نیستند." : "New passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await changeTeacherPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsComplete(true);
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          isFa
            ? "تغییر رمز عبور انجام نشد. رمز فعلی را بررسی کنید."
            : "Unable to change the password. Check your current password.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBankFieldChange = (key, value) => {
    if (isBankFormLocked) return;
    setBankForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleBankCountryChange = (value) => {
    if (isBankFormLocked) return;
    const country = String(value || "").trim().toUpperCase();
    setBankError("");
    setBankForm((current) => ({
      ...current,
      country,
      currency: country === "IR" ? "IRR" : country === "AF" ? "AFN" : "",
      iban: country === "AF" ? "" : current.iban,
      swiftCode: country === "IR" ? "" : current.swiftCode,
    }));
  };

  const handleBankCardFieldChange = (value) => {
    handleBankFieldChange("cardNumber", normalizeCardNumberValue(value));
  };

  const handleBankInfoSubmit = async (event) => {
    event.preventDefault();
    setBankError("");
    setBankSuccess("");

    const validation = validateBankForm(bankForm, isFa);
    if (!validation.ok) {
      setBankError(validation.message);
      return;
    }

    try {
      setIsSavingBankInfo(true);
      const response = await updateTeacherProfile({
        bankPaymentInfo: validation.normalized,
      });
      if (response?.user) {
        saveAuthUser(response.user);
        const nextReview = getTeacherBankReviewState(response.user);
        setBankReview(nextReview);
        setBankForm(nextReview.form);
        setIsBankFormLocked(true);
      }
      setBankSuccess(
        isFa
          ? "اطلاعات بانکی برای بررسی مدیر ارسال شد."
          : "Your bank payment details were submitted for admin review.",
      );
    } catch (requestError) {
      setBankError(
        getRequestError(
          requestError,
          isFa
            ? "ذخیره معلومات بانکی انجام نشد."
            : "Unable to save bank payment details.",
        ),
      );
    } finally {
      setIsSavingBankInfo(false);
    }
  };

  return (
    <TeacherLayout
      teacher={teacher}
      language={language}
      onLanguageChange={setLanguage}
    >
      <div className={`mx-auto max-w-5xl ${isRTL ? "text-right" : "text-left"}`}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">
            {isFa ? "امنیت حساب" : "Account security"}
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">
            {isFa ? "تنظیمات" : "Settings"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {isFa
              ? "رمز عبور حساب استادی خود را از این بخش مدیریت کنید."
              : "Manage the password for your instructor account."}
          </p>
        </div>

        <div className="mt-7 space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                  <Landmark size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    {isFa ? "اطلاعات حساب بانکی" : "Bank payment details"}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {isFa
                      ? "فقط اطلاعات تأییدشده به دانشجو نشان داده می‌شود. هر ویرایش دوباره بررسی خواهد شد."
                      : "Only approved details are shown to students. Every edit requires a new review."}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {bankReview.status === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                    <Clock3 size={14} />
                    {isFa ? "در انتظار بررسی مدیر" : "Awaiting admin review"}
                  </span>
                ) : bankReview.status === "approved" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                    <CheckCircle2 size={14} />
                    {isFa ? "تأییدشده" : "Approved"}
                  </span>
                ) : bankReview.status === "rejected" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">
                    <AlertCircle size={14} />
                    {isFa ? "نیازمند اصلاح" : "Changes required"}
                  </span>
                ) : null}
                {isBankFormLocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBankError("");
                      setBankSuccess("");
                      setIsBankFormLocked(false);
                    }}
                    className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100"
                  >
                    {isFa ? "ویرایش اطلاعات بانکی" : "Edit bank details"}
                  </button>
                ) : null}
              </div>
              {bankReview.status === "rejected" && bankReview.reviewNote ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                  {isFa ? "دلیل رد مدیر: " : "Admin feedback: "}
                  {bankReview.reviewNote}
                </div>
              ) : null}
              {bankReview.status === "pending" &&
              hasSavedBankPaymentInfo(getAuthUser()?.bankPaymentInfo || {}) ? (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                  {isFa
                    ? "تا زمان تأیید این ویرایش، اطلاعات قبلی تأییدشده برای پرداخت فعال می‌ماند."
                    : "Your previously approved details remain active until this edit is approved."}
                </div>
              ) : null}

              <form className="mt-7 space-y-5" onSubmit={handleBankInfoSubmit}>
                {bankError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {bankError}
                  </div>
                ) : null}
                {bankSuccess ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    {bankSuccess}
                  </div>
                ) : null}

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-700">
                    {isFa ? "کشور" : "Country"}
                  </span>
                  <select
                    value={bankForm.country}
                    onChange={(event) => handleBankCountryChange(event.target.value)}
                    disabled={isBankFormLocked}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">{isFa ? "انتخاب کشور" : "Select country"}</option>
                    <option value="AF">{isFa ? "افغانستان" : "Afghanistan"}</option>
                    <option value="IR">{isFa ? "ایران" : "Iran"}</option>
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "نام صاحب حساب" : "Account holder name"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.accountHolderName}
                      onChange={(event) => handleBankFieldChange("accountHolderName", event.target.value)}
                      disabled={isBankFormLocked}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "نام بانک" : "Bank name"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.bankName}
                      onChange={(event) => handleBankFieldChange("bankName", event.target.value)}
                      disabled={isBankFormLocked}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "شماره حساب" : "Account number"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.accountNumber}
                      onChange={(event) => handleBankFieldChange("accountNumber", event.target.value)}
                      dir="ltr"
                      disabled={isBankFormLocked}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "شماره کارت" : "Card number"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.cardNumber}
                      onChange={(event) => handleBankCardFieldChange(event.target.value)}
                      inputMode="numeric"
                      dir="ltr"
                      disabled={isBankFormLocked}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                </div>

                {bankForm.country === "IR" ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                      {isFa
                        ? "حداقل یکی از شماره کارت، شماره شبا یا شماره حساب را وارد کنید."
                        : "Enter at least one card number, Shaba, or account number."}
                    </div>
                    <label className="space-y-2">
                      <span className="text-xs font-black text-slate-700">
                        {isFa ? "شماره شبا" : "Shaba / IBAN"}
                      </span>
                      <input
                        type="text"
                        value={bankForm.iban}
                        onChange={(event) => handleBankFieldChange("iban", event.target.value)}
                        dir="ltr"
                        placeholder="IRxxxxxxxxxxxxxxxxxxxxxxxx"
                        disabled={isBankFormLocked}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </label>
                  </>
                ) : null}

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-700">
                    {isFa ? "واحد پول" : "Currency"}
                  </span>
                  <input
                    type="text"
                    value={getDisplayCurrency(bankForm.currency || "")}
                    readOnly
                    disabled
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500 outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-700">
                    {isFa ? "یادداشت برای دانشجو" : "Note for students"}
                  </span>
                  <textarea
                    value={bankForm.paymentNote}
                    onChange={(event) => handleBankFieldChange("paymentNote", event.target.value)}
                    rows={4}
                    disabled={isBankFormLocked}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </label>

                {!isBankFormLocked ? (
                  <button
                    type="submit"
                    disabled={isSavingBankInfo}
                    className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-5 text-sm font-black text-white shadow-lg shadow-amber-700/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {isSavingBankInfo ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Landmark className="h-5 w-5" />
                    )}
                    {isSavingBankInfo
                      ? isFa
                        ? "در حال ذخیره..."
                        : "Saving details"
                      : isFa
                        ? "ارسال برای بررسی مدیر"
                        : "Submit for admin review"}
                  </button>
                ) : null}
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                  <KeyRound size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    {isFa ? "تغییر رمز عبور" : "Change password"}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {isFa
                      ? "پس از تغییر موفق، دوباره وارد حساب شوید."
                      : "After a successful change, you will sign in again."}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <div>
                  {isComplete ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                      <p className="mt-3 font-black text-emerald-900">
                        {isFa ? "رمز عبور تغییر کرد." : "Your password was changed."}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {isFa
                          ? "برای ورود دوباره به صفحه ورود منتقل می‌شوید."
                          : "Redirecting you to login for a fresh sign-in."}
                      </p>
                    </div>
                  ) : (
                    <form className="space-y-5" onSubmit={handleSubmit}>
                      {error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                          {error}
                        </div>
                      ) : null}

                      <TeacherPasswordInput
                        label={isFa ? "رمز عبور فعلی" : "Current password"}
                        icon={Lock}
                        name="current_password"
                        autoComplete="current-password"
                        placeholder={
                          isFa ? "رمز فعلی را وارد کنید" : "Enter your current password"
                        }
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        isRTL={isRTL}
                      />
                      <TeacherPasswordInput
                        label={isFa ? "رمز عبور جدید" : "New password"}
                        icon={Lock}
                        name="new_password"
                        autoComplete="new-password"
                        placeholder={
                          isFa ? "رمز قوی جدید وارد کنید" : "Enter a strong new password"
                        }
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        isRTL={isRTL}
                      />
                      <TeacherPasswordInput
                        label={isFa ? "تایید رمز عبور جدید" : "Confirm new password"}
                        icon={Lock}
                        name="confirm_new_password"
                        autoComplete="new-password"
                        placeholder={
                          isFa ? "رمز جدید را دوباره وارد کنید" : "Enter the new password again"
                        }
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        isRTL={isRTL}
                      />

                      <button
                        type="submit"
                        disabled={
                          isSubmitting ||
                          !currentPassword ||
                          !newPassword ||
                          !confirmPassword
                        }
                        className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-teal-500 px-5 text-sm font-black text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-5 w-5" />
                        )}
                        {isSubmitting
                          ? isFa
                            ? "در حال تغییر..."
                            : "Changing password"
                          : isFa
                            ? "تغییر رمز عبور"
                            : "Change password"}
                      </button>
                    </form>
                  )}
                </div>

                <aside className="rounded-3xl border border-slate-200 bg-[linear-gradient(145deg,#0F172A_0%,#172554_100%)] p-6 text-white shadow-sm">
                  <ShieldCheck className="h-9 w-9 text-teal-300" />
                  <h2 className="mt-5 text-lg font-black">
                    {isFa ? "رمز امن بسازید" : "Build a safer password"}
                  </h2>
                  <div className="mt-5 space-y-3 text-sm font-semibold leading-6 text-slate-300">
                    <p>{isFa ? "حداقل ۸ نویسه استفاده کنید." : "Use at least 8 characters."}</p>
                    <p>
                      {isFa
                        ? "حروف بزرگ، حروف کوچک و حداقل یک عدد داشته باشد."
                        : "Include uppercase, lowercase, and at least one number."}
                    </p>
                    <p>
                      {isFa
                        ? "رمز حساب‌های دیگر را دوباره استفاده نکنید."
                        : "Do not reuse a password from another account."}
                    </p>
                    <p>
                      {isFa
                        ? "بعد از تغییر، تمام نشست‌های قدیمی غیرفعال می‌شوند."
                        : "Changing it invalidates all older login sessions."}
                    </p>
                  </div>
                </aside>
              </div>
            </section>
        </div>
      </div>
    </TeacherLayout>
  );
}
