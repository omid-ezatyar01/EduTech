import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPasswordInput from "../components/auth/TeacherPasswordInput";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { changeTeacherPassword } from "../../services/authService";
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

const normalizeDigitsOnly = (value = "") =>
  normalizeLocaleDigits(value).replace(/[^\d]/g, "");

const normalizeLimitedDigits = (value = "", maxLength = 16) =>
  normalizeDigitsOnly(value).slice(0, maxLength);

const normalizeIbanValue = (value = "") =>
  normalizeLocaleDigits(value).replace(/\s+/g, "").toUpperCase();

const ibanLengthByCountry = {
  AF: 24,
  IR: 26,
};

const isValidLuhnNumber = (value = "") => {
  const digits = normalizeDigitsOnly(value);
  if (!digits) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const isValidIbanChecksum = (value = "") => {
  const iban = normalizeIbanValue(value);
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) return false;

  const expectedLength = ibanLengthByCountry[iban.slice(0, 2)];
  if (expectedLength && iban.length !== expectedLength) return false;

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

const normalizeBankForm = (form = {}) => ({
  accountHolderName: String(form.accountHolderName || "").trim(),
  bankName: String(form.bankName || "").trim(),
  accountNumber: normalizeLimitedDigits(form.accountNumber || "", 16),
  cardNumber: normalizeLimitedDigits(form.cardNumber || "", 16),
  iban: normalizeIbanValue(form.iban || ""),
  note: String(form.note || "").trim(),
});

const validateBankForm = (form = {}, isFa = true) => {
  const normalized = normalizeBankForm(form);
  const hasAnyValue = Object.values(normalized).some(Boolean);

  if (!hasAnyValue) {
    return { ok: true, normalized };
  }

  if (normalized.accountHolderName.length < 3) {
    return {
      ok: false,
      message: isFa
        ? "نام صاحب حساب باید حداقل ۳ حرف داشته باشد."
        : "Account holder name must be at least 3 characters.",
    };
  }

  if (normalized.bankName.length < 2) {
    return {
      ok: false,
      message: isFa
        ? "نام بانک باید معتبر باشد."
        : "Bank name must be valid.",
    };
  }

  if (!normalized.cardNumber && !normalized.accountNumber && !normalized.iban) {
    return {
      ok: false,
      message: isFa
        ? "حداقل یکی از شماره کارت، شماره حساب یا IBAN را وارد کنید."
        : "Enter at least one card number, account number, or IBAN.",
    };
  }

  if (normalized.cardNumber) {
    if (normalized.cardNumber.length !== 16) {
      return {
        ok: false,
        message: isFa
          ? "شماره کارت باید دقیقاً ۱۶ رقم باشد."
          : "Card number must be exactly 16 digits.",
      };
    }
    if (!isValidLuhnNumber(normalized.cardNumber)) {
      return {
        ok: false,
        message: isFa
          ? "شماره کارت معتبر نیست."
          : "Card number is not valid.",
      };
    }
  }

  if (normalized.accountNumber) {
    if (normalized.accountNumber.length < 8 || normalized.accountNumber.length > 16) {
      return {
        ok: false,
        message: isFa
          ? "شماره حساب باید بین ۸ تا ۱۶ رقم باشد."
          : "Account number must be between 8 and 16 digits.",
      };
    }
  }

  if (normalized.iban && !isValidIbanChecksum(normalized.iban)) {
    return {
      ok: false,
      message: isFa ? "IBAN معتبر نیست." : "IBAN is not valid.",
    };
  }

  return { ok: true, normalized };
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
    const user = getAuthUser() || {};
    return {
      accountHolderName: user?.bankPaymentInfo?.accountHolderName || "",
      bankName: user?.bankPaymentInfo?.bankName || "",
      accountNumber: user?.bankPaymentInfo?.accountNumber || "",
      cardNumber: user?.bankPaymentInfo?.cardNumber || "",
      iban: user?.bankPaymentInfo?.iban || "",
      note: user?.bankPaymentInfo?.note || "",
    };
  });
  const [bankError, setBankError] = useState("");
  const [bankSuccess, setBankSuccess] = useState("");
  const [isSavingBankInfo, setIsSavingBankInfo] = useState(false);

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
    setBankForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleBankDigitsFieldChange = (key, value) => {
    handleBankFieldChange(key, normalizeLimitedDigits(value, 16));
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
        setBankForm({
          accountHolderName: response.user?.bankPaymentInfo?.accountHolderName || "",
          bankName: response.user?.bankPaymentInfo?.bankName || "",
          accountNumber: response.user?.bankPaymentInfo?.accountNumber || "",
          cardNumber: response.user?.bankPaymentInfo?.cardNumber || "",
          iban: response.user?.bankPaymentInfo?.iban || "",
          note: response.user?.bankPaymentInfo?.note || "",
        });
      }
      setBankSuccess(
        isFa
          ? "اطلاعات بانکی شما ذخیره شد."
          : "Your bank payment details were saved.",
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
                      ? "این معلومات هنگام انتخاب پرداخت بانکی به دانشجو نشان داده می‌شود."
                      : "This information is shown to students when they choose bank payment."}
                  </p>
                </div>
              </div>

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

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "نام صاحب حساب" : "Account holder name"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.accountHolderName}
                      onChange={(event) => handleBankFieldChange("accountHolderName", event.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
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
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "شماره حساب" : "Account number"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.accountNumber}
                      onChange={(event) => handleBankDigitsFieldChange("accountNumber", event.target.value)}
                      inputMode="numeric"
                      maxLength={16}
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-slate-700">
                      {isFa ? "شماره کارت" : "Card number"}
                    </span>
                    <input
                      type="text"
                      value={bankForm.cardNumber}
                      onChange={(event) => handleBankDigitsFieldChange("cardNumber", event.target.value)}
                      inputMode="numeric"
                      maxLength={16}
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-700">
                    {isFa ? "شماره شبا / IBAN" : "IBAN"}
                  </span>
                  <input
                    type="text"
                    value={bankForm.iban}
                    onChange={(event) => handleBankFieldChange("iban", event.target.value)}
                    dir="ltr"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-700">
                    {isFa ? "یادداشت برای دانشجو" : "Note for students"}
                  </span>
                  <textarea
                    value={bankForm.note}
                    onChange={(event) => handleBankFieldChange("note", event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                  />
                </label>

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
                      ? "ذخیره اطلاعات بانکی"
                      : "Save bank details"}
                </button>
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
