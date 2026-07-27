import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router";
import TeacherAuthLayout from "../layouts/TeacherAuthLayout";
import TeacherAuthVisual from "../components/auth/TeacherAuthVisual";
import TeacherAuthInput from "../components/auth/TeacherAuthInput";
import TeacherPasswordInput from "../components/auth/TeacherPasswordInput";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import {
  requestTeacherPasswordReset,
  resetTeacherPassword,
  verifyTeacherPasswordResetOtp,
} from "../../services/authService";

const EMAIL_KEY = "edutech_teacher_reset_email";
const TOKEN_KEY = "edutech_teacher_reset_token";
const RESEND_AT_KEY = "edutech_teacher_reset_resend_at";
const DEFAULT_RESEND_SECONDS = 120;

const getRequestError = (error, fallback) =>
  String(error?.response?.data?.message || error?.message || fallback);

const clearRecoverySession = () => {
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(RESEND_AT_KEY);
};

export default function TeacherPasswordRecovery() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isFa = language === "fa";
  const step = location.pathname.endsWith("/verify-reset-otp")
    ? "verify"
    : location.pathname.endsWith("/reset-password")
      ? "reset"
      : "request";

  const [email, setEmail] = useState(
    () => sessionStorage.getItem(EMAIL_KEY) || "",
  );
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [resendReadyAt, setResendReadyAt] = useState(
    () => Number(sessionStorage.getItem(RESEND_AT_KEY)) || 0,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resetToken = sessionStorage.getItem(TOKEN_KEY) || "";
  const resendSeconds = Math.max(
    0,
    Math.ceil((resendReadyAt - nowMs) / 1000),
  );

  useEffect(() => {
    if (step !== "verify" || resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (!isComplete) return undefined;
    const timer = window.setTimeout(() => {
      navigate("/teacher/login", { replace: true });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [isComplete, navigate]);

  if (step === "verify" && !email) {
    return <Navigate to="/teacher/forgot-password" replace />;
  }
  if (step === "reset" && (!email || !resetToken)) {
    return <Navigate to="/teacher/forgot-password" replace />;
  }

  const copy = {
    request: {
      title: isFa ? "بازیابی رمز عبور" : "Reset your password",
      subtitle: isFa
        ? "ایمیل حساب استاد خود را وارد کنید. اگر حساب فعال باشد، کود شش‌رقمی برای شما ارسال می‌شود."
        : "Enter your teacher email. If an active account exists, we will send a six-digit code.",
      button: isFa ? "ارسال کود تایید" : "Send verification code",
    },
    verify: {
      title: isFa ? "کود ایمیل را وارد کنید" : "Enter the email code",
      subtitle: isFa
        ? `کود شش‌رقمی ارسال‌شده به ${email} را وارد کنید. کود پس از ۱۰ دقیقه منقضی می‌شود.`
        : `Enter the six-digit code sent to ${email}. It expires after 10 minutes.`,
      button: isFa ? "تایید کود" : "Verify code",
    },
    reset: {
      title: isFa ? "رمز عبور جدید" : "Create a new password",
      subtitle: isFa
        ? "رمز قوی با حداقل ۸ نویسه، حروف بزرگ و کوچک و یک عدد انتخاب کنید."
        : "Choose a strong password with at least 8 characters, uppercase, lowercase, and a number.",
      button: isFa ? "تغییر رمز عبور" : "Change password",
    },
  }[step];

  const handleRequest = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      setIsSubmitting(true);
      setError("");
      const data = await requestTeacherPasswordReset(normalizedEmail);
      const resendAfterSeconds = Math.max(
        DEFAULT_RESEND_SECONDS,
        Number(data?.resendAfterSeconds || 0),
      );
      const nextResendAt = Date.now() + resendAfterSeconds * 1000;
      sessionStorage.setItem(EMAIL_KEY, normalizedEmail);
      sessionStorage.setItem(RESEND_AT_KEY, String(nextResendAt));
      sessionStorage.removeItem(TOKEN_KEY);
      setEmail(normalizedEmail);
      setResendReadyAt(nextResendAt);
      navigate("/teacher/verify-reset-otp");
    } catch (requestError) {
      const rawMessage = getRequestError(requestError, "").toLowerCase();
      setError(
        rawMessage.includes("not registered as a teacher")
          ? isFa
            ? "این ایمیل به‌عنوان حساب استاد ثبت نشده است."
            : "This email is not registered as a teacher account."
          : getRequestError(
              requestError,
              isFa
                ? "ارسال کود انجام نشد. دوباره تلاش کنید."
                : "Unable to send the code. Please try again.",
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError(isFa ? "کود باید شش رقم باشد." : "The code must be 6 digits.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const data = await verifyTeacherPasswordResetOtp({ email, otp });
      sessionStorage.setItem(TOKEN_KEY, data.resetToken);
      navigate("/teacher/reset-password");
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          isFa
            ? "کود نادرست یا منقضی شده است."
            : "The code is incorrect or expired.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(isFa ? "رمزها یکسان نیستند." : "Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await resetTeacherPassword({
        email,
        resetToken,
        newPassword,
        confirmPassword,
      });
      clearRecoverySession();
      setIsComplete(true);
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          isFa
            ? "تغییر رمز عبور انجام نشد."
            : "Unable to reset your password.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError("");
      const data = await requestTeacherPasswordReset(email);
      const resendAfterSeconds = Math.max(
        DEFAULT_RESEND_SECONDS,
        Number(data?.resendAfterSeconds || 0),
      );
      const nextResendAt = Date.now() + resendAfterSeconds * 1000;
      sessionStorage.setItem(RESEND_AT_KEY, String(nextResendAt));
      setResendReadyAt(nextResendAt);
      setNowMs(Date.now());
    } catch (requestError) {
      setError(
        getRequestError(
          requestError,
          isFa ? "ارسال مجدد انجام نشد." : "Unable to resend the code.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitHandler =
    step === "request"
      ? handleRequest
      : step === "verify"
        ? handleVerify
        : handleReset;

  return (
    <TeacherAuthLayout
      language={language}
      isRTL={isRTL}
      onLanguageChange={setLanguage}
      showSecurityNote
    >
      <div className="flex w-full shrink-0 items-center lg:w-1/2">
        <div className="mx-auto w-full max-w-lg px-5 py-10 sm:px-10 lg:px-12">
          <button
            type="button"
            onClick={() => navigate("/teacher/login")}
            className="mb-8 inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-blue-700"
          >
            <ArrowLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
            {isFa ? "بازگشت به ورود" : "Back to login"}
          </button>

          {isComplete ? (
            <div className="py-12 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={32} />
              </span>
              <h1 className="mt-5 text-2xl font-black text-slate-950">
                {isFa ? "رمز عبور تغییر کرد" : "Password changed"}
              </h1>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {isFa
                  ? "اکنون به صفحه ورود منتقل می‌شوید."
                  : "You are being returned to the login page."}
              </p>
            </div>
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                {step === "request" ? (
                  <Mail size={23} />
                ) : step === "verify" ? (
                  <ShieldCheck size={23} />
                ) : (
                  <KeyRound size={23} />
                )}
              </span>
              <h1 className="mt-5 text-2xl font-black text-slate-950">
                {copy.title}
              </h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
                {copy.subtitle}
              </p>

              <div className="mt-6 flex gap-2" aria-label="Password reset progress">
                {["request", "verify", "reset"].map((item, index) => {
                  const currentIndex = ["request", "verify", "reset"].indexOf(step);
                  return (
                    <span
                      key={item}
                      className={`h-1.5 flex-1 rounded-full ${
                        index <= currentIndex ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>

              <form className="mt-7 space-y-5" onSubmit={submitHandler}>
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                ) : null}

                {step === "request" ? (
                  <TeacherAuthInput
                    label={isFa ? "ایمیل استاد" : "Teacher email"}
                    icon={Mail}
                    type="email"
                    name="teacher_reset_email"
                    autoComplete="email"
                    placeholder="teacher@edutech.study"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    isRTL={isRTL}
                  />
                ) : null}

                {step === "verify" ? (
                  <div>
                    <label className="px-1 text-sm font-bold text-slate-950">
                      {isFa ? "کود شش‌رقمی" : "Six-digit code"}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      dir="ltr"
                      className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center font-mono text-xl font-black tracking-[0.5em] text-slate-950 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="000000"
                    />
                    <button
                      type="button"
                      disabled={resendSeconds > 0 || isSubmitting}
                      onClick={handleResend}
                      className="mt-3 text-xs font-black text-blue-700 disabled:text-slate-400"
                    >
                      {resendSeconds > 0
                        ? isFa
                          ? `ارسال مجدد پس از ${resendSeconds} ثانیه`
                          : `Resend in ${resendSeconds}s`
                        : isFa
                          ? "ارسال مجدد کود"
                          : "Resend code"}
                    </button>
                  </div>
                ) : null}

                {step === "reset" ? (
                  <>
                    <TeacherPasswordInput
                      label={isFa ? "رمز عبور جدید" : "New password"}
                      icon={Lock}
                      name="teacher_new_password"
                      autoComplete="new-password"
                      placeholder={isFa ? "رمز قوی وارد کنید" : "Enter a strong password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      isRTL={isRTL}
                    />
                    <TeacherPasswordInput
                      label={isFa ? "تایید رمز عبور" : "Confirm password"}
                      icon={Lock}
                      name="teacher_confirm_password"
                      autoComplete="new-password"
                      placeholder={isFa ? "رمز را دوباره وارد کنید" : "Enter the password again"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      isRTL={isRTL}
                    />
                  </>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (step === "request" && !email.trim()) ||
                    (step === "verify" && otp.length !== 6) ||
                    (step === "reset" &&
                      (!newPassword || !confirmPassword))
                  }
                  className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-teal-500 px-5 text-sm font-black text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {copy.button}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <TeacherAuthVisual
        language={language}
        isRTL={isRTL}
        className={`hidden w-full shrink-0 lg:flex lg:w-1/2 ${
          isRTL ? "border-r" : "border-l"
        } border-slate-200`}
      />
    </TeacherAuthLayout>
  );
}
