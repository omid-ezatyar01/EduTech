import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";

import {
  requestStudentPasswordReset,
  resetStudentPassword,
  verifyStudentPasswordResetOtp,
} from "../../services/authService.js";
import {
  AuthHeader,
  AuthInput,
  AuthVisual,
  PasswordInput,
} from "../components/AuthComponents.jsx";

const STORAGE_KEY = "edutech_student_password_recovery";
const RESEND_SECONDS = 120;

const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const saveSession = (value) => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.message || error?.message || fallback);

export default function StudentPasswordRecoveryPage({ language = "fa" }) {
  const isFa = language === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const navigate = useNavigate();
  const initialSession = readSession();
  const [step, setStep] = useState(initialSession.resetToken ? "reset" : initialSession.email ? "verify" : "request");
  const [email, setEmail] = useState(initialSession.email || "");
  const [resetToken, setResetToken] = useState(initialSession.resetToken || "");
  const [resendAt, setResendAt] = useState(Number(initialSession.resendAt) || 0);
  const [now, setNow] = useState(() => Date.now());
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const resendRemaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (step !== "verify" || resendRemaining <= 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendRemaining, step]);

  useEffect(() => {
    if (!complete) return undefined;
    const timer = window.setTimeout(() => navigate("/login", { replace: true }), 1600);
    return () => window.clearTimeout(timer);
  }, [complete, navigate]);

  const requestCode = async (address) => {
    const data = await requestStudentPasswordReset(address);
    const nextResendAt = Date.now() + Math.max(RESEND_SECONDS, Number(data?.resendAfterSeconds || 0)) * 1000;
    setResendAt(nextResendAt);
    setNow(Date.now());
    saveSession({ email: address, resendAt: nextResendAt });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "request") {
        const normalizedEmail = email.trim().toLowerCase();
        await requestCode(normalizedEmail);
        setEmail(normalizedEmail);
        setStep("verify");
      } else if (step === "verify") {
        if (!/^\d{6}$/.test(otp)) throw new Error(isFa ? "کود باید شش رقم باشد." : "The code must be 6 digits.");
        const data = await verifyStudentPasswordResetOtp({ email, otp });
        setResetToken(data.resetToken);
        saveSession({ email, resetToken: data.resetToken });
        setStep("reset");
      } else {
        if (newPassword !== confirmPassword) throw new Error(isFa ? "رمزهای عبور یکسان نیستند." : "Passwords do not match.");
        await resetStudentPassword({ email, resetToken, newPassword, confirmPassword });
        sessionStorage.removeItem(STORAGE_KEY);
        setComplete(true);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, isFa ? "عملیات انجام نشد. دوباره تلاش کنید." : "The request failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy || resendRemaining > 0) return;
    setError("");
    setBusy(true);
    try {
      await requestCode(email);
    } catch (requestError) {
      setError(getErrorMessage(requestError, isFa ? "ارسال مجدد انجام نشد." : "Unable to resend the code."));
    } finally {
      setBusy(false);
    }
  };

  const content = {
    request: {
      title: isFa ? "بازیابی رمز عبور" : "Reset your password",
      subtitle: isFa ? "ایمیل حساب دانش‌آموزی خود را وارد کنید تا کود تایید برای شما ارسال شود." : "Enter your student email and we will send you a verification code.",
      button: isFa ? "ارسال کود تایید" : "Send verification code",
    },
    verify: {
      title: isFa ? "کود تایید را وارد کنید" : "Enter the verification code",
      subtitle: isFa ? `کود شش‌رقمی ارسال‌شده به ${email} را وارد کنید.` : `Enter the six-digit code sent to ${email}.`,
      button: isFa ? "تایید کود" : "Verify code",
    },
    reset: {
      title: isFa ? "رمز عبور جدید" : "Create a new password",
      subtitle: isFa ? "رمز باید حداقل ۸ نویسه و شامل حروف بزرگ، کوچک و عدد باشد." : "Use at least 8 characters with uppercase, lowercase, and a number.",
      button: isFa ? "تغییر رمز عبور" : "Change password",
    },
  }[step];

  const visual = {
    title: isFa ? "حساب خود را بازیابی کنید" : "Recover your account",
    subtitle: isFa ? "با تایید ایمیل، رمز عبور جدید بسازید" : "Verify your email and create a new password",
    benefits: [
      { title: isFa ? "کود امن ایمیل" : "Secure email code", text: isFa ? "کود تایید تنها ده دقیقه اعتبار دارد" : "Your verification code expires after ten minutes" },
      { title: isFa ? "محافظت از حساب" : "Account protection", text: isFa ? "پس از تغییر رمز، نشست‌های قبلی باطل می‌شوند" : "Previous sessions are revoked after the reset" },
    ],
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 font-sans" dir={dir}>
      <AuthHeader dir={dir} language={language} />
      <main className="flex flex-1 items-center px-3 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:grid lg:min-h-[560px] lg:grid-cols-[1.15fr_1fr]">
          <AuthVisual {...visual} />
          <section className="p-5 sm:p-9 lg:order-first lg:flex lg:flex-col lg:justify-center lg:p-12">
            <Link to="/login" className="mb-7 text-sm font-black text-primary-600 hover:text-primary-700">
              {isFa ? "بازگشت به صفحه ورود" : "Back to login"}
            </Link>
            {complete ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={54} />
                <h1 className="mt-5 text-2xl font-black text-slate-950">{isFa ? "رمز عبور تغییر کرد" : "Password changed"}</h1>
                <p className="mt-3 font-semibold text-slate-500">{isFa ? "در حال انتقال به صفحه ورود…" : "Returning to the login page…"}</p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  {step === "request" ? <Mail /> : step === "verify" ? <ShieldCheck /> : <KeyRound />}
                </div>
                <h1 className="mt-5 text-2xl font-black text-slate-950 sm:text-3xl">{content.title}</h1>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">{content.subtitle}</p>
                <div className="mt-6 flex gap-2">{["request", "verify", "reset"].map((item, index) => <span key={item} className={`h-1.5 flex-1 rounded-full ${index <= ["request", "verify", "reset"].indexOf(step) ? "bg-primary-600" : "bg-slate-200"}`} />)}</div>
                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
                  {step === "request" ? <AuthInput label={isFa ? "ایمیل" : "Email"} icon={Mail} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" /> : null}
                  {step === "verify" ? <div><label className="text-sm font-bold text-slate-800">{isFa ? "کود شش‌رقمی" : "Six-digit code"}</label><input className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center font-mono text-xl font-black tracking-[0.5em] outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /><button type="button" onClick={handleResend} disabled={busy || resendRemaining > 0} className="mt-3 text-xs font-black text-primary-600 disabled:text-slate-400">{resendRemaining > 0 ? (isFa ? `ارسال مجدد پس از ${resendRemaining} ثانیه` : `Resend in ${resendRemaining}s`) : (isFa ? "ارسال مجدد کود" : "Resend code")}</button></div> : null}
                  {step === "reset" ? <><PasswordInput label={isFa ? "رمز عبور جدید" : "New password"} icon={Lock} required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><PasswordInput label={isFa ? "تکرار رمز عبور" : "Confirm password"} icon={Lock} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></> : null}
                  <button disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 text-sm font-black text-white transition hover:bg-primary-700 disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={20} /> : null}{content.button}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
