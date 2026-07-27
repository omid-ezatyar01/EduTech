import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Mail, Lock, User, Phone } from "lucide-react";
import {
  AuthHeader,
  AuthInput,
  PasswordInput,
  SocialButton,
  AuthVisual,
  SuccessModal,
  TermsModal,
} from "../components/AuthComponents.jsx";

import {
  exchangeStudentGoogleAuth,
  getRegisterOtpStatus,
  getStudentGoogleAuthUrl,
  registerUser,
  resendRegisterOtp,
  verifyRegisterOtp,
} from "../../services/authService.js";
import { PORTAL_CONFIG, saveAuth, clearAuth } from "../../services/portal.js";
import { legalContent } from "../data/legalContent.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const BLOCKED_OTP_STATUSES = ["suppressed", "bounced", "failed", "complained"];

const pageData = {
  fa: {
    visual: {
      title: "به جمع ما بپیوندید!",
      subtitle: "حساب کاربری خود را ایجاد کنید",
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
      title: "ایجاد حساب کاربری",
      subtitle: "اطلاعات خود را وارد کنید",
      fields: {
        name: "نام",
        lastName: "نام خانوادگی",
        email: "ایمیل",
        phone: "شماره تماس",
        password: "رمز عبور",
        confirm: "تایید رمز عبور",
      },
      placeholders: {
        name: "نام خود را وارد کنید",
        lastName: "نام خانوادگی خود را وارد کنید",
        email: "example@email.com",
        phone: "+93 000 000 0000",
        password: "رمز عبور خود را وارد کنید",
        confirm: "رمز عبور را دوباره وارد کنید",
      },
      terms: "من شرایط و قوانین را خوانده و می‌پذیرم",
      termsAction: "شرایط استفاده",
      privacyAction: "حریم خصوصی",
      and: "و",
      submit: "ثبت‌نام",
      or: "یا",
      social: { google: "ثبت‌نام با Google" },
      security: "اطلاعات شما محفوظ و امن است",
      switchText: "قبلاً حساب کاربری دارید؟",
      switchLink: "وارد شوید",
      otpTitle: "تایید ایمیل",
      otpSubtitle: "کد تایید ارسال شده به ایمیل خود را وارد کنید",
      otpField: "کد تایید (۶ رقم)",
      otpPlaceholder: "123456",
      otpSubmit: "تایید و ورود",
      otpBack: "بازگشت به ثبت‌نام",
      otpResend: "ارسال دوباره کد",
      otpResending: "در حال ارسال دوباره",
      otpChangeEmail: "تغییر ایمیل",
      otpSent: "کد تایید ارسال شد.",
      otpDeliveryProblem: "We could not send OTP to this email. Please check your email address or use another email.",
    },
    comingSoon: {
      title: "به زودی!",
      text: "این ویژگی در حال توسعه است و به زودی در دسترس قرار می‌گیرد.",
    },
    success: {
      title: "ثبت‌نام موفق!",
      text: "حساب کاربری شما با موفقیت تایید و ایجاد شد.",
    },
  },
  en: {
    visual: {
      title: "Join Our Community!",
      subtitle: "Create your student account",
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
      title: "Create Account",
      subtitle: "Enter your information",
      fields: {
        name: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone Number",
        password: "Password",
        confirm: "Confirm Password",
      },
      placeholders: {
        name: "Enter your first name",
        lastName: "Enter your last name",
        email: "example@email.com",
        phone: "+93 700 000 000",
        password: "Enter your password",
        confirm: "Re-enter your password",
      },
      terms: "I have read and accept the",
      termsAction: "Terms of Service",
      privacyAction: "Privacy Policy",
      and: "and",
      submit: "Register",
      or: "or",
      social: {
        google: "Register with Google",
      },
      security: "Your information is safe and secure",
      switchText: "Already have an account?",
      switchLink: "Login",
      otpTitle: "Verify Email",
      otpSubtitle: "Enter the verification code sent to your email",
      otpField: "Verification Code (6 digits)",
      otpPlaceholder: "123456",
      otpSubmit: "Verify & Login",
      otpBack: "Back to Register",
      otpResend: "Resend OTP",
      otpResending: "Resending",
      otpChangeEmail: "Change Email",
      otpSent: "OTP sent successfully.",
      otpDeliveryProblem: "We could not send OTP to this email. Please check your email address or use another email.",
    },
    comingSoon: {
      title: "Coming Soon!",
      text: "This feature is under development and will be available soon.",
    },
    success: {
      title: "Registration Successful!",
      text: "Your account has been successfully verified and created.",
    },
  },
};

export default function RegisterPage({ language = "fa" }) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("register");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({}); // For more granular error display
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpDelivery, setOtpDelivery] = useState({
    emailStatus: "",
    emailStatusReason: "",
    canVerify: true,
  });
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState(null);
  const navigate = useNavigate();
  const didHandleGoogleResultRef = useRef(false);

  const dir = language === "fa" ? "rtl" : "ltr";
  const data = pageData[language] || pageData["fa"];
  const localizedLegal = legalContent[language] || legalContent.fa;
  const activeLegal = legalModalType ? localizedLegal[legalModalType] : null;
  const isOtpDeliveryBlocked = BLOCKED_OTP_STATUSES.includes(
    String(otpDelivery.emailStatus || "").toLowerCase(),
  );
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

  const showOtpDeliveryProblem = (statusData = {}) => {
    setOtpDelivery({
      emailStatus: statusData.emailStatus || "failed",
      emailStatusReason: statusData.emailStatusReason || "",
      canVerify: false,
    });
    setError(data.form.otpDeliveryProblem);
  };

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
            ? "ثبت‌نام با Google انجام نشد."
            : "Google sign-up failed."),
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
                  ? "ثبت‌نام با Google ناموفق بود."
                  : "Google sign-up failed."),
          );
          clearQueryString();
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [language, navigate]);

  useEffect(() => {
    if (step !== "otp" || !email) return undefined;
    let mounted = true;

    const checkStatus = async () => {
      try {
        const status = await getRegisterOtpStatus(email);
        if (!mounted) return;
        setOtpDelivery({
          emailStatus: status.emailStatus || "",
          emailStatusReason: status.emailStatusReason || "",
          canVerify: status.canVerify !== false,
        });
        if (BLOCKED_OTP_STATUSES.includes(String(status.emailStatus || "").toLowerCase())) {
          setError(data.form.otpDeliveryProblem);
        }
      } catch {
        // Keep the OTP form usable if status polling briefly fails.
      }
    };

    checkStatus();
    const timer = window.setInterval(checkStatus, 6000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [data.form.otpDeliveryProblem, email, step]);

  if (isAuthenticated || isHandlingGoogleCallback || isLoading) {
    return (
      <FrontendPageLoader
        label={language === "fa" ? "در حال انتقال" : "Redirecting"}
        fullScreen
        className="border-0 bg-slate-50"
      />
    );
  }

  const handleGoogleRegister = async () => {
    try {
      setError("");
      setIsGoogleLoading(true);
      const response = await getStudentGoogleAuthUrl("register");
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans" dir={dir}>
      <AuthHeader dir={dir} />

      <main className="flex flex-1 items-start px-3 py-2 sm:px-6 sm:py-5 lg:items-center lg:px-8 lg:py-8 xl:py-10">
        <div className="mx-auto w-full max-w-[1140px]">
          {/* Main Auth Card */}
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:rounded-[32px] lg:grid lg:min-h-[560px] lg:grid-cols-[1.35fr_1fr] xl:min-h-[610px]">
            <AuthVisual
              title={data.visual.title}
              subtitle={data.visual.subtitle}
              benefits={data.visual.benefits}
              type="register"
            />

            {/* Form Section */}
            <div className="p-4 sm:p-8 md:p-10 lg:order-first lg:flex lg:h-full lg:flex-col lg:justify-center lg:p-10 xl:p-12">
              {step === "register" ? (
                <>
                  <h1 className="text-center text-3xl font-black text-slate-950">
                    {data.form.title}
                  </h1>

                  {error && (
                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
                      {error}
                    </div>
                  )}

                  <form
                    className="mt-4 space-y-5 sm:mt-8 sm:space-y-6"
                    autoComplete="off"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError("");
                      setFieldErrors({});

                      // Client-side validation
                      if (
                        !name ||
                        !lastName ||
                        !email ||
                        !phone ||
                        !password ||
                        !confirmPassword
                      ) {
                        setError(
                          language === "fa"
                            ? "همه فیلدها الزامی هستند"
                            : "All fields are required",
                        );
                        return;
                      }
                      if (password !== confirmPassword) {
                        setError(
                          language === "fa"
                            ? "رمز عبور با تایید رمز عبور مطابقت ندارد"
                            : "Passwords do not match",
                        );
                        setFieldErrors((prev) => ({
                          ...prev,
                          password:
                            language === "fa"
                              ? "رمز عبور مطابقت ندارد"
                              : "Passwords do not match",
                          confirmPassword:
                            language === "fa"
                              ? "رمز عبور مطابقت ندارد"
                              : "Passwords do not match",
                        }));
                        return;
                      }
                      if (!termsAccepted) {
                        setError(
                          language === "fa"
                            ? "لطفاً شرایط و قوانین را بپذیرید"
                            : "Please accept the terms and conditions",
                        );
                        return;
                      }

                      setIsLoading(true);

                      try {
                        const userData = {
                          name,
                          lastName,
                          email,
                          phone,
                          password,
                          confirmPassword,
                        };
                        const registerResponse = await registerUser(userData);

                        // Move to OTP step on success
                        setOtpDelivery({
                          emailStatus: registerResponse?.emailStatus || "sent",
                          emailStatusReason: registerResponse?.emailStatusReason || "",
                          canVerify: registerResponse?.canVerify !== false,
                        });
                        setStep("otp");
                        setOtp("");
                        setError("");
                      } catch (err) {
                        if (err.response) {
                          const errorCode = String(
                            err.response.data?.code || "",
                          ).toUpperCase();
                          const rawMsg =
                            err.response.data?.message?.toLowerCase() || "";
                          let friendlyMsg =
                            language === "fa"
                              ? "خطا در ثبت‌نام رخ داد."
                              : "Registration failed.";

                          if (
                            BLOCKED_OTP_STATUSES.includes(
                              String(err.response.data?.emailStatus || "").toLowerCase(),
                            )
                          ) {
                            friendlyMsg = data.form.otpDeliveryProblem;
                          } else if (errorCode === "EMAIL_ALREADY_REGISTERED") {
                            friendlyMsg =
                              language === "fa"
                                ? "این ایمیل قبلاً در سیستم ثبت شده است."
                                : "This email is already registered.";
                          } else if (
                            rawMsg.includes("email") &&
                            (rawMsg.includes("exist") ||
                              rawMsg.includes("duplicate") ||
                              rawMsg.includes("already"))
                          ) {
                            friendlyMsg =
                              language === "fa"
                                ? "این ایمیل قبلاً در سیستم ثبت شده است."
                                : "This email is already registered.";
                          } else if (
                            rawMsg.includes("password") ||
                            rawMsg.includes("weak") ||
                            rawMsg.includes("short")
                          ) {
                            friendlyMsg =
                              language === "fa"
                                ? "رمز عبور ضعیف است. لطفاً حداقل ۶ کاراکتر وارد کنید."
                                : "Password is too weak. Please use at least 6 characters.";
                          } else if (
                            rawMsg.includes("invalid") ||
                            rawMsg.includes("validation") ||
                            rawMsg.includes("required")
                          ) {
                            friendlyMsg =
                              language === "fa"
                                ? "اطلاعات وارد شده نامعتبر است."
                                : "Invalid information provided.";
                          } else if (
                            err.response.data?.message &&
                            language !== "fa"
                          ) {
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
                    }}
                  >
                    <AuthInput
                      label={data.form.fields.name}
                      placeholder={data.form.placeholders.name}
                      icon={User}
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((prev) => ({ ...prev, name: "" }));
                        }
                      }}
                      error={fieldErrors.name}
                    />
                    <AuthInput
                      label={data.form.fields.lastName}
                      placeholder={data.form.placeholders.lastName}
                      icon={User}
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (error) setError("");
                        if (fieldErrors.lastName) {
                          setFieldErrors((prev) => ({ ...prev, lastName: "" }));
                        }
                      }}
                      error={fieldErrors.lastName}
                    />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <AuthInput
                        label={data.form.fields.email}
                        placeholder={data.form.placeholders.email}
                        icon={Mail}
                        type="email"
                        value={email}
                        autoComplete="off"
                        onChange={(e) => setEmail(e.target.value)}
                        error={fieldErrors.email}
                        disabled={step === "otp"}
                      />
                      <AuthInput
                        label={data.form.fields.phone}
                        placeholder={data.form.placeholders.phone}
                        icon={Phone}
                        type="text"
                        value={phone}
                        dir="ltr"
                        style={{
                          textAlign: language === "fa" ? "right" : "left",
                          paddingRight: language === "fa" ? "3rem" : undefined,
                        }}
                        autoComplete="off"
                        onChange={(e) => setPhone(e.target.value)}
                        error={fieldErrors.phone}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <PasswordInput
                        label={data.form.fields.password}
                        placeholder={data.form.placeholders.password}
                        icon={Lock}
                        value={password}
                        autoComplete="new-password"
                        onChange={(e) => setPassword(e.target.value)}
                        error={fieldErrors.password}
                      />
                      <PasswordInput
                        label={data.form.fields.confirm}
                        placeholder={data.form.placeholders.confirm}
                        icon={Lock}
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={fieldErrors.confirmPassword}
                      />
                    </div>

                    <div className="pt-5 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold leading-6 text-slate-700 sm:text-sm">
                        <label htmlFor="terms" className="cursor-pointer">
                          {data.form.terms}
                        </label>
                        <button
                          type="button"
                          onClick={() => setLegalModalType("terms")}
                          className="font-black text-primary-700 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-800"
                        >
                          {data.form.termsAction}
                        </button>
                        <span className="text-slate-500">{data.form.and}</span>
                        <button
                          type="button"
                          onClick={() => setLegalModalType("privacy")}
                          className="font-black text-primary-700 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-800"
                        >
                          {data.form.privacyAction}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-4 h-14 w-full rounded-xl bg-primary-600 text-base font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700"
                    >
                      {isLoading
                        ? language === "fa"
                          ? "در حال ثبت‌نام و ارسال کد تایید"
                          : "Registering and sending verification code"
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
                      onClick={handleGoogleRegister}
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
                      to="/login"
                      className="font-black text-primary-600 hover:underline"
                    >
                      {data.form.switchLink}
                    </Link>
                  </p>
                </>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h1 className="text-center text-3xl font-black text-slate-950">
                    {data.form.otpTitle}
                  </h1>
                  <p className="mt-2 text-center font-medium text-slate-500">
                    {data.form.otpSubtitle}
                  </p>
                  <p
                    className="mt-1 text-center font-bold text-primary-600"
                    dir="ltr"
                  >
                    {email}
                  </p>
                  {otpDelivery.emailStatus ? (
                    <p className="mt-2 text-center text-xs font-black uppercase tracking-wide text-slate-400">
                      {otpDelivery.emailStatus}
                    </p>
                  ) : null}

                  {error && (
                    <div
                      className={`mt-6 rounded-xl border p-4 text-sm font-bold ${
                        error === data.form.otpSent
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-600"
                      }`}
                    >
                      {error}
                    </div>
                  )}

                  <form
                    className="mt-8 space-y-5"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError("");

                      if (isOtpDeliveryBlocked) {
                        setError(data.form.otpDeliveryProblem);
                        return;
                      }

                      if (!otp || otp.length !== 6) {
                        setError(
                          language === "fa"
                            ? "کد تایید باید ۶ رقم باشد"
                            : "OTP must be 6 digits",
                        );
                        return;
                      }

                      setIsLoading(true);

                      try {
                        const response = await verifyRegisterOtp({
                          email,
                          otp,
                        });

                        if (response.role !== PORTAL_CONFIG.role) {
                          clearAuth();
                          throw new Error("WRONG_ROLE");
                        }

                        saveAuth(response);
                        setIsSuccessModalOpen(true);
                      } catch (err) {
                        if (err.message === "WRONG_ROLE") {
                          setError(
                            PORTAL_CONFIG.loginErrorMessage[language] ||
                              PORTAL_CONFIG.loginErrorMessage["en"],
                          );
                        } else if (err.response) {
                          const rawMsg =
                            err.response.data?.message?.toLowerCase() || "";
                          let friendlyMsg =
                            language === "fa"
                              ? "خطا در تایید کد."
                              : "Verification failed.";

                          if (
                            rawMsg.includes("invalid") ||
                            rawMsg.includes("wrong") ||
                            rawMsg.includes("incorrect")
                          ) {
                            friendlyMsg =
                              language === "fa"
                                ? "کد تایید وارد شده نادرست است."
                                : "The verification code is incorrect.";
                          } else if (rawMsg.includes("expire")) {
                            friendlyMsg =
                              language === "fa"
                                ? "کد تایید منقضی شده است. لطفاً دوباره ثبت‌نام کنید."
                                : "The verification code has expired. Please register again.";
                          } else if (
                            BLOCKED_OTP_STATUSES.includes(
                              String(err.response.data?.emailStatus || "").toLowerCase(),
                            )
                          ) {
                            friendlyMsg = data.form.otpDeliveryProblem;
                            showOtpDeliveryProblem(err.response.data || {});
                          } else if (
                            err.response.data?.message &&
                            language !== "fa"
                          ) {
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
                    }}
                  >
                    <AuthInput
                      label={data.form.otpField}
                      placeholder={data.form.otpPlaceholder}
                      icon={Lock}
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      disabled={isOtpDeliveryBlocked}
                      dir="ltr"
                      style={{
                        letterSpacing: "0.25em",
                        fontSize: "1.25rem",
                        textAlign: "center",
                      }}
                    />

                    <button
                      type="submit"
                      disabled={isLoading || isOtpDeliveryBlocked}
                      className="mt-4 h-14 w-full rounded-xl bg-primary-600 text-base font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700"
                    >
                      {isLoading
                        ? language === "fa"
                          ? "در حال بررسی کد تایید"
                          : "Verifying code"
                        : data.form.otpSubmit}
                    </button>

                    <button
                      type="button"
                      disabled={isLoading || isResendingOtp || isOtpDeliveryBlocked}
                      onClick={async () => {
                        setError("");
                        setIsResendingOtp(true);
                        try {
                          const response = await resendRegisterOtp(email);
                          setOtpDelivery({
                            emailStatus: response?.emailStatus || "sent",
                            emailStatusReason: response?.emailStatusReason || "",
                            canVerify: response?.canVerify !== false,
                          });
                          if (
                            BLOCKED_OTP_STATUSES.includes(
                              String(response?.emailStatus || "").toLowerCase(),
                            )
                          ) {
                            showOtpDeliveryProblem(response || {});
                          } else {
                            setOtp("");
                            setError(data.form.otpSent);
                          }
                        } catch (err) {
                          const payload = err.response?.data || {};
                          if (
                            BLOCKED_OTP_STATUSES.includes(
                              String(payload.emailStatus || "").toLowerCase(),
                            )
                          ) {
                            showOtpDeliveryProblem(payload);
                          } else {
                            setError(payload.message || data.form.otpDeliveryProblem);
                          }
                        } finally {
                          setIsResendingOtp(false);
                        }
                      }}
                      className="mt-2 h-12 w-full rounded-xl border border-primary-200 bg-primary-50 text-sm font-black text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResendingOtp ? data.form.otpResending : data.form.otpResend}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep("register");
                        setOtp("");
                        setError("");
                        setOtpDelivery({ emailStatus: "", emailStatusReason: "", canVerify: true });
                      }}
                      className="mt-2 h-14 w-full rounded-xl bg-slate-100 text-base font-black text-slate-700 transition hover:bg-slate-200"
                    >
                      {isOtpDeliveryBlocked ? data.form.otpChangeEmail : data.form.otpBack}
                    </button>
                  </form>
                </div>
              )}
              <p className="mt-6 text-center text-xs font-semibold text-slate-500">
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
      <TermsModal
        isOpen={Boolean(activeLegal)}
        onClose={() => setLegalModalType(null)}
        onAccept={() => {
          setTermsAccepted(true);
          setLegalModalType(null);
          if (error) setError("");
        }}
        title={activeLegal?.title || ""}
        body={
          activeLegal ? (
            <div className="space-y-4">
              <p className="text-xs font-bold text-primary-700">{activeLegal.updatedAt}</p>
              <p className="text-sm font-bold text-slate-800">{activeLegal.subtitle}</p>
              <p className="text-sm leading-7 text-slate-700">{activeLegal.intro}</p>
              <div className="space-y-3">
                {activeLegal.sections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <h3 className="text-sm font-black text-slate-900">{section.title}</h3>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
        acceptLabel={language === "fa" ? "می‌پذیرم" : "I Accept"}
        closeLabel={language === "fa" ? "بستن" : "Close"}
        dir={dir}
      />
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          navigate(PORTAL_CONFIG.dashboardPath);
        }}
        title={data.success.title}
        text={data.success.text}
        dir={dir}
      />
    </div>
  );
}
