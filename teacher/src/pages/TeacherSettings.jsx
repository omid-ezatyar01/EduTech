import { useEffect, useMemo, useState } from "react";
import {
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
import {
  PORTAL_CONFIG,
  clearAuth,
  getAuthUser,
} from "../../services/portal";

const getRequestError = (error, fallback) =>
  String(error?.response?.data?.message || error?.message || fallback);

export default function TeacherSettings() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

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

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
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

            {isComplete ? (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
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
              <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
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
          </section>

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
      </div>
    </TeacherLayout>
  );
}
