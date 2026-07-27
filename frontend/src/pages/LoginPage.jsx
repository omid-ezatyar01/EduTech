import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Mail, Lock } from "lucide-react";
import {
  AuthHeader,
  AuthInput,
  PasswordInput,
  SocialButton,
  AuthVisual,
} from "../components/AuthComponents.jsx";

import { PORTAL_CONFIG, saveAuth, clearAuth } from "../../services/portal.js";
import { consumeAuthNotice } from "../../services/portal.js";
import { getApiBase } from "../../services/http.js";
import {
  exchangeStudentGoogleAuth,
  getStudentGoogleAuthUrl,
} from "../../services/authService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const pageData = {
  fa: {
    visual: {
      title: "خوش آمدید دوباره!",
      subtitle: "به حساب کاربری خود وارد شوید",
      benefits: [
        {
          title: "کلاس‌های آنلاین و تعاملی",
          text: "یادگیری مستقیم با استادان از طریق Google Meet",
        },
        {
          title: "دسترسی به داشبورد شخصی",
          text: "برنامه درسی، تکالیف و لینک کلاس‌ها در یک مکان",
        },
        {
          title: "سرتیفیکیت معتبر",
          text: "بعد از تکمیل کورس، سرتیفیکیت دریافت کنید",
        },
      ],
    },
    form: {
      title: "ورود به حساب کاربری",
      subtitle: "ایمیل و رمز عبور خود را وارد کنید",
      fields: { email: "ایمیل", password: "رمز عبور" },
      placeholders: {
        email: "example@email.com",
        password: "رمز عبور خود را وارد کنید",
      },
      remember: "مرا به خاطر بسپار",
      forgot: "رمز عبور را فراموش کرده‌اید؟",
      submit: "ورود به حساب",
      or: "یا",
      social: { google: "ورود با Google" },
      security: "اطلاعات شما محفوظ و امن است",
      switchText: "هنوز حساب کاربری ندارید؟",
      switchLink: "همین حالا ثبت‌نام کنید",
    },
    comingSoon: {
      title: "به زودی!",
      text: "این ویژگی در حال توسعه است و به زودی در دسترس قرار می‌گیرد.",
    },
  },
  en: {
    visual: {
      title: "Welcome Back!",
      subtitle: "Login to your account",
      benefits: [
        {
          title: "Live Interactive Classes",
          text: "Learn directly with instructors through Google Meet",
        },
        {
          title: "Personal Dashboard Access",
          text: "Schedule, assignments, and class links in one place",
        },
        {
          title: "Valid Certificate",
          text: "Receive a certificate after completing your course",
        },
      ],
    },
    form: {
      title: "Login to Your Account",
      subtitle: "Enter your email and password",
      fields: { email: "Email", password: "Password" },
      placeholders: {
        email: "example@email.com",
        password: "Enter your password",
      },
      remember: "Remember me",
      forgot: "Forgot password?",
      submit: "Login",
      or: "or",
      social: { google: "Login with Google" },
      security: "Your information is safe and secure",
      switchText: "Don’t have an account?",
      switchLink: "Register now",
    },
    comingSoon: {
      title: "Coming Soon!",
      text: "This feature is under development and will be available soon.",
    },
  },
};

export default function LoginPage({ language = "fa" }) {
  const dir = language === "fa" ? "rtl" : "ltr";
  const data = pageData[language] || pageData["fa"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const didHandleGoogleResultRef = useRef(false);
  const queryParams =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const isAuthenticated =
    typeof window !== "undefined" &&
    localStorage.getItem("edutech_auth") === "true";
  const isHandlingGoogleCallback =
    queryParams.get("googleAuth") === "success" && Boolean(queryParams.get("exchange"));

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(PORTAL_CONFIG.dashboardPath, { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (didHandleGoogleResultRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get("googleAuth");
    const exchangeToken = params.get("exchange");
    const message = params.get("message");

    const clearQueryString = () => {
      window.history.replaceState({}, "", window.location.pathname);
    };

    const scheduleError = (nextError) => {
      window.setTimeout(() => {
        setError(nextError);
      }, 0);
    };

    if (googleAuth === "error") {
      didHandleGoogleResultRef.current = true;
      scheduleError(
        message ||
          (language === "fa"
            ? "ورود با Google انجام نشد."
            : "Google sign-in failed."),
      );
      clearQueryString();
      return;
    }

    if (googleAuth === "success" && exchangeToken) {
      didHandleGoogleResultRef.current = true;
      (async () => {
        setIsLoading(true);
        try {
          const result = await exchangeStudentGoogleAuth(exchangeToken);
          if (result.role !== PORTAL_CONFIG.role) {
            clearAuth();
            throw new Error("WRONG_ROLE");
          }
          saveAuth(result);
          clearQueryString();
          navigate(PORTAL_CONFIG.dashboardPath, { replace: true });
        } catch (err) {
          setError(
            err.message === "WRONG_ROLE"
              ? PORTAL_CONFIG.loginErrorMessage[language] ||
                PORTAL_CONFIG.loginErrorMessage.en
              : message ||
                (language === "fa"
                  ? "ورود با Google ناموفق بود."
                  : "Google sign-in failed."),
          );
          clearQueryString();
        } finally {
          setIsLoading(false);
        }
      })();
      return;
    }

    const authNotice = consumeAuthNotice();
    const isUnauthorizedNotice =
      /not[_\s-]?authorized|unauthorized|not[_\s-]?authenticated/i.test(
        String(authNotice || ""),
      );
    if (authNotice && !isUnauthorizedNotice) {
      scheduleError(authNotice);
    }
  }, [language, navigate]);

  if (isAuthenticated || isHandlingGoogleCallback || isLoading) {
    return (
      <FrontendPageLoader
        label={language === "fa" ? "در حال انتقال" : "Redirecting"}
        fullScreen
        className="border-0 bg-slate-50"
      />
    );
  }

  const handleGoogleLogin = async () => {
    try {
      setError("");
      setIsGoogleLoading(true);
      const response = await getStudentGoogleAuthUrl("login");
      const url = response?.data?.url || response?.url || "";
      if (!url) {
        throw new Error("Google OAuth URL is missing");
      }
      window.location.href = url;
    } catch {
      setError(
        language === "fa"
          ? "امکان اتصال به Google وجود ندارد."
          : "Unable to connect to Google.",
      );
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError(
        language === "fa"
          ? "ایمیل و رمز عبور الزامی است"
          : "Email and password are required",
      );
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = getApiBase();
      const response = await fetch(`${apiUrl}${PORTAL_CONFIG.loginEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
      navigate(PORTAL_CONFIG.dashboardPath);
    } catch (err) {
      if (err.message === "WRONG_ROLE") {
        setError(
          PORTAL_CONFIG.loginErrorMessage[language] ||
            PORTAL_CONFIG.loginErrorMessage["en"],
        );
      } else if (err.response) {
        const rawMsg = err.response.data?.message?.toLowerCase() || "";
        let friendlyMsg =
          language === "fa" ? "خطا در ورود به حساب کاربری" : "Login failed";

        if (
          rawMsg.includes("invalid") ||
          rawMsg.includes("credential") ||
          rawMsg.includes("password") ||
          rawMsg.includes("not found")
        ) {
          friendlyMsg =
            language === "fa"
              ? "ایمیل یا رمز عبور نادرست است."
              : "Invalid email or password.";
        } else if (rawMsg.includes("verify") || rawMsg.includes("verified")) {
          friendlyMsg =
            language === "fa"
              ? "لطفاً ابتدا ایمیل خود را تایید کنید."
              : "Please verify your email first.";
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
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 font-sans" dir={dir}>
      <AuthHeader dir={dir} />

      <main className="flex flex-1 items-center px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-8 xl:py-10">
        <div className="mx-auto w-full max-w-[1140px]">
          {/* Main Auth Card */}
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:rounded-[32px] lg:grid lg:min-h-[560px] lg:grid-cols-[1.35fr_1fr] xl:min-h-[610px]">
            <AuthVisual
              title={data.visual.title}
              subtitle={data.visual.subtitle}
              benefits={data.visual.benefits}
              type="login"
            />

            {/* Form Section */}
            <div className="p-4 sm:p-8 md:p-10 lg:order-first lg:flex lg:h-full lg:flex-col lg:justify-between lg:p-10 xl:p-12">
              <h1 className="mt-2 text-center text-2xl font-black text-slate-950 sm:mt-0 sm:text-3xl">
                {data.form.title}
              </h1>

              <form
                className="mt-4 space-y-5 sm:mt-8 sm:space-y-6"
                onSubmit={handleLogin}
                autoComplete="off"
              >
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
                    {error}
                  </div>
                )}

                <AuthInput
                  label={data.form.fields.email}
                  placeholder={data.form.placeholders.email}
                  icon={Mail}
                  type="email"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                />
                <PasswordInput
                  label={data.form.fields.password}
                  placeholder={data.form.placeholders.password}
                  icon={Lock}
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="pt-5 flex items-center justify-between gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    {data.form.remember}
                  </label>
                  <a
                    href="#"
                    className="text-sm font-bold text-primary-600 hover:text-primary-700"
                  >
                    {data.form.forgot}
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-4 h-14 w-full rounded-xl bg-primary-600 text-base font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {isLoading
                    ? language === "fa"
                      ? "در حال ورود"
                      : "Logging in"
                    : data.form.submit}
                </button>
              </form>

              <div className="my-5 flex items-center gap-4 before:h-px before:flex-1 before:bg-slate-100 after:h-px after:flex-1 after:bg-slate-100">
                <span className="text-sm font-bold text-slate-400">
                  {data.form.or}
                </span>
              </div>

              <div className="space-y-3">
                <SocialButton
                  icon={Mail}
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading
                    ? language === "fa"
                      ? "در حال انتقال"
                      : "Redirecting"
                    : data.form.social.google}
                </SocialButton>
              </div>

              <p className="mt-4 text-center text-sm font-semibold text-slate-600">
                {data.form.switchText}{" "}
                <Link
                  to="/register"
                  className="font-black text-primary-600 hover:underline"
                >
                  {data.form.switchLink}
                </Link>
              </p>
              <p className="mt-3 text-center text-sm font-semibold text-slate-600">
                {language === "fa"
                  ? "عضو تیم پشتیبانی هستید؟"
                  : "Are you a support team member?"}{" "}
                <Link
                  to="/support/login"
                  className="font-black text-[#0B4FD8] hover:underline"
                >
                  {language === "fa"
                    ? "ورود تیم پشتیبانی"
                    : "Support team login"}
                </Link>
              </p>
              <p className="mt-4 text-center text-xs font-semibold text-slate-500">
                {language === "fa" ? "توسعه داده شده توسط " : "Developed by "}
                <a
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="cursor-default text-primary-700"
                >
                  {language === "fa" ? "شرکت برنامه نویسی بودا" : "Boda Software Development Company"}
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
