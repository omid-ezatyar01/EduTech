import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { getApiBase, parseJsonResponse } from "../../services/http.js";

const DEFAULT_RESEND_SECONDS = 120;

const postResetRequest = async (path, body) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse(response);
};

export default function AdminPasswordRecoveryModal({ initialEmail = "", onClose }) {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState(() => String(initialEmail || "").trim().toLowerCase());
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step !== "verify" || resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds, step]);

  const requestCode = async ({ isResend = false } = {}) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your administrator email.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const data = await postResetRequest("/auth/admin/password-reset/request", {
        email: normalizedEmail,
      });
      setEmail(normalizedEmail);
      setOtp("");
      setResetToken("");
      setResendSeconds(Math.max(DEFAULT_RESEND_SECONDS, Number(data?.resendAfterSeconds || 0)));
      if (!isResend) setStep("verify");
    } catch (requestError) {
      const message = String(requestError?.message || "");
      setError(message || "Unable to send the verification code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError("The verification code must contain 6 digits.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const data = await postResetRequest("/auth/admin/password-reset/verify", { email, otp });
      setResetToken(String(data?.resetToken || ""));
      setStep("reset");
    } catch (requestError) {
      setError(String(requestError?.message || "The code is incorrect or expired."));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(newPassword)) {
      setError("Use at least 8 characters with uppercase, lowercase, and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await postResetRequest("/auth/admin/password-reset/reset", {
        email,
        resetToken,
        newPassword,
        confirmPassword,
      });
      setStep("complete");
    } catch (requestError) {
      setError(String(requestError?.message || "Unable to reset your password."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (step === "request") requestCode();
    else if (step === "verify") verifyCode();
    else if (step === "reset") resetPassword();
  };

  const stepIndex = ["request", "verify", "reset"].indexOf(step);
  const title = step === "request"
    ? "Reset admin password"
    : step === "verify"
      ? "Verify your email"
      : step === "reset"
        ? "Create a new password"
        : "Password changed";
  const subtitle = step === "request"
    ? "Enter the email address of your active administrator account."
    : step === "verify"
      ? `Enter the six-digit code sent to ${email}. The code expires after 10 minutes.`
      : step === "reset"
        ? "Choose a strong password you have not used for this account."
        : "Your administrator password was reset successfully. You can now sign in.";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="admin-reset-title">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200" aria-label="Close password recovery">
          <X size={19} />
        </button>

        {step === "complete" ? (
          <div className="px-2 py-10 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={32} /></span>
            <h2 id="admin-reset-title" className="mt-5 text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">{subtitle}</p>
            <button type="button" onClick={onClose} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-black text-white">
              <ArrowLeft size={17} /> Back to login
            </button>
          </div>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
              {step === "request" ? <Mail size={23} /> : step === "verify" ? <ShieldCheck size={23} /> : <KeyRound size={23} />}
            </span>
            <h2 id="admin-reset-title" className="mt-5 pe-12 text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">{subtitle}</p>
            <div className="mt-6 flex gap-2" aria-label="Password recovery progress">
              {[0, 1, 2].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= stepIndex ? "bg-violet-600" : "bg-slate-200"}`} />)}
            </div>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

              {step === "request" ? (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Admin email</span>
                  <span className="relative mt-2 block">
                    <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@edutech.study" className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                  </span>
                </label>
              ) : null}

              {step === "verify" ? (
                <div>
                  <label className="text-sm font-bold text-slate-700">Six-digit code</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center font-mono text-xl font-black tracking-[0.45em] outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                  <button type="button" disabled={resendSeconds > 0 || submitting} onClick={() => requestCode({ isResend: true })} className="mt-3 text-xs font-black text-violet-700 disabled:text-slate-400">
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                  </button>
                </div>
              ) : null}

              {step === "reset" ? (
                <>
                  {[{ label: "New password", value: newPassword, setter: setNewPassword }, { label: "Confirm password", value: confirmPassword, setter: setConfirmPassword }].map((field) => (
                    <label key={field.label} className="block">
                      <span className="text-sm font-bold text-slate-700">{field.label}</span>
                      <span className="relative mt-2 block">
                        <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required value={field.value} onChange={(event) => field.setter(event.target.value)} className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 ps-11 pe-11 text-sm font-semibold outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                        <button type="button" onClick={() => setShowPasswords((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPasswords ? "Hide passwords" : "Show passwords"}>{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </span>
                    </label>
                  ))}
                  <p className="text-xs font-semibold leading-6 text-slate-500">At least 8 characters, including uppercase, lowercase, and a number.</p>
                </>
              ) : null}

              <button type="submit" disabled={submitting || (step === "request" && !email.trim()) || (step === "verify" && otp.length !== 6) || (step === "reset" && (!newPassword || !confirmPassword))} className="flex min-h-13 h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-cyan-500 px-5 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {step === "request" ? "Send verification code" : step === "verify" ? "Verify code" : "Change password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
