import { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { useNavigate } from "react-router";
import TeacherAuthInput from "./TeacherAuthInput";
import TeacherPasswordInput from "./TeacherPasswordInput";
import {
  PORTAL_CONFIG,
  saveAuth,
  clearAuth,
  getTeacherEntryPath,
} from "../../../services/portal.js";
import { getApiBase } from "../../../services/http.js";

export default function TeacherLoginForm({ language, isRTL }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    title: language === "fa" ? "ورود مدرس" : "Teacher Login",
    subtitle:
      language === "fa"
        ? "برای مدیریت کورس‌ها، شاگردان و صنف‌های زنده وارد حساب خود شوید."
        : "Sign in to manage your courses, students, and live classes.",
    email: language === "fa" ? "ایمیل" : "Email",
    emailPlaceholder:
      language === "fa" ? "ایمیل خود را وارد کنید" : "Enter your email",
    password: language === "fa" ? "رمز عبور" : "Password",
    passwordPlaceholder:
      language === "fa" ? "رمز عبور خود را وارد کنید" : "Enter your password",
    remember: language === "fa" ? "مرا به خاطر بسپار" : "Remember me",
    forgot:
      language === "fa" ? "رمز عبور را فراموش کرده‌اید؟" : "Forgot password?",
    login: language === "fa" ? "ورود به پنل مدرس" : "Login to Teacher Panel",
    loading: language === "fa" ? "در حال ورود" : "Signing in",
    required:
      language === "fa"
        ? "ایمیل و رمز عبور الزامی است"
        : "Email and password are required",
    invalid:
      language === "fa"
        ? "ایمیل یا رمز عبور اشتباه است"
        : "Invalid email or password",
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(t.required);
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}${PORTAL_CONFIG.loginEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw { response: { data } };
      }

      if (data.role !== PORTAL_CONFIG.role) {
        clearAuth();
        throw new Error("WRONG_ROLE");
      }

      saveAuth(data);
      navigate(getTeacherEntryPath(data), { replace: true });
    } catch (err) {
      if (err.message === "WRONG_ROLE") {
        setError(
          PORTAL_CONFIG.loginErrorMessage[language] ||
            PORTAL_CONFIG.loginErrorMessage["en"],
        );
      } else if (err.response) {
        const rawMsg = String(err.response.data?.message || "").toLowerCase();
        let friendlyMsg = t.invalid;

        if (rawMsg.includes("not allowed to login from teacher portal")) {
          friendlyMsg =
            PORTAL_CONFIG.loginErrorMessage[language] ||
            PORTAL_CONFIG.loginErrorMessage["en"];
        } else if (rawMsg.includes("verify your email")) {
          friendlyMsg =
            language === "fa"
              ? "لطفاً ایمیل خود را تایید کنید."
              : "Please verify your email before login.";
        } else if (rawMsg.includes("blocked")) {
          friendlyMsg =
            language === "fa"
              ? "حساب شما مسدود شده است."
              : "Your account has been blocked.";
        } else if (err.response.data?.message && language !== "fa") {
          friendlyMsg = err.response.data.message;
        }

        setError(friendlyMsg);
      } else {
        setError(
          language === "fa"
            ? "خطا در اتصال به سرور. لطفاً اینترنت خود را بررسی کنید."
            : "Server connection error. Please check your internet connection.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`flex h-full flex-col justify-start px-5 py-5 sm:px-8 sm:py-6 md:px-10 lg:justify-center lg:px-10 lg:py-8 xl:px-14 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="mx-auto w-full max-w-md pb-2">
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#0F172A]">{t.title}</h1>
          <p className="mt-3 font-medium text-slate-500">{t.subtitle}</p>
        </div>

        <form
          className={`mt-6 space-y-6 ${isRTL ? "text-right" : "text-left"}`}
          onSubmit={handleLogin}
          autoComplete="off"
        >
          {error ? (
            <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 p-4 text-sm font-bold text-[#EF4444]">
              {error}
            </div>
          ) : null}

          <TeacherAuthInput
            label={t.email}
            icon={Mail}
            type="email"
            name="teacher_login_email"
            autoComplete="off"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            isRTL={isRTL}
          />
          <TeacherPasswordInput
            label={t.password}
            icon={Lock}
            name="teacher_login_password"
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            isRTL={isRTL}
          />

          <div className="pt-5 flex flex-wrap items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#0B4FD8] focus:ring-[#0B4FD8]"
              />
              {t.remember}
            </label>
            <button
              type="button"
              onClick={() => navigate("/teacher/forgot-password")}
              className={`px-1 text-sm font-bold text-[#0B4FD8] transition hover:text-[#0B4FD8]/80 ${
                isRTL ? "text-right" : "text-left"
              }`}
            >
              {t.forgot}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B4FD8] to-[#00B8A9] text-base font-black text-white shadow-lg shadow-[#0B4FD8]/30 transition hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span>{t.loading}</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <LogIn className="h-5 w-5" /> {t.login}
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
