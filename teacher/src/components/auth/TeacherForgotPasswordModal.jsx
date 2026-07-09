import { useState } from "react";
import { X, Mail, CheckCircle } from "lucide-react";
import TeacherAuthInput from "./TeacherAuthInput";

export default function TeacherForgotPasswordModal({ isOpen, onClose, language, isRTL }) {
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const t = {
    title: language === "fa" ? "بازیابی رمز عبور" : "Recover Password",
    body:
      language === "fa"
        ? "ایمیل حساب مدرس خود را وارد کنید تا لینک بازیابی رمز عبور برای شما ارسال شود."
        : "Enter your teacher account email and we will send you a password recovery link.",
    sentTitle: language === "fa" ? "لینک ارسال شد!" : "Link Sent!",
    sentText:
      language === "fa"
        ? "لینک بازیابی رمز عبور به ایمیل شما ارسال شد."
        : "Password recovery link has been sent to your email.",
    ok: language === "fa" ? "متوجه شدم" : "Got it",
    send: language === "fa" ? "ارسال لینک بازیابی" : "Send Recovery Link",
    email: language === "fa" ? "ایمیل" : "Email",
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (email.trim()) {
      setIsSent(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 px-4 backdrop-blur-sm"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-center justify-between border-b border-[#E2E8F0] p-5 ${isRTL ? "" : "flex-row-reverse"}`}>
          <h2 className="text-xl font-black text-[#0F172A]">{t.title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`p-6 ${isRTL ? "text-right" : "text-left"}`}>
          {isSent ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981]/10 text-[#10B981]">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-black text-[#0F172A]">{t.sentTitle}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{t.sentText}</p>
              <button
                onClick={onClose}
                className="mt-8 w-full rounded-xl bg-[#0B4FD8] py-3 text-sm font-bold text-white hover:bg-[#0B4FD8]/90"
              >
                {t.ok}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="mb-6 text-sm font-medium leading-relaxed text-slate-600">{t.body}</p>
              <TeacherAuthInput
                label={t.email}
                icon={Mail}
                type="email"
                placeholder="teacher@edutech.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                isRTL={isRTL}
              />
              <button
                type="submit"
                className="mt-6 w-full rounded-xl bg-[#0B4FD8] py-3 text-sm font-bold text-white shadow-lg shadow-[#0B4FD8]/25 hover:bg-[#0B4FD8]/90 transition"
              >
                {t.send}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
