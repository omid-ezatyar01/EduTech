import { useState } from "react";
import {
  ShieldCheck,
  Users,
  Lock,
  BarChart3,
  Settings,
  Mail,
  Eye,
  EyeOff,
  BookOpen,
  CreditCard,
  LogIn,
} from "lucide-react";
import { PORTAL_CONFIG, saveAuth, clearAuth } from "../../services/portal.js";
import { getApiBase } from "../../services/http.js";

const pageData = {
  en: {
    badge: "Admin Panel",
    title: "Admin Login",
    subtitle: "Log in with your admin account to manage all platform sections.",
    fields: {
      email: "Admin Email",
      password: "Password",
    },
    placeholders: {
      email: "admin@edutech.com",
      password: "Enter your password",
    },
    remember: "Remember me",
    submit: "Login to Admin Panel",
    loading: "در حال ورود...",
    footerInfo: "Access restricted to authorized admins only",
    illustration: {
      title: "EduTech Admin Panel",
      subtitle:
        "Full control over users, courses, payments, and educational reports in one place.",
      features: [
        { title: "User Management", color: "text-cyan-400" },
        { title: "Course Management", color: "text-violet-400" },
        { title: "Financial Management", color: "text-blue-400" },
        { title: "Reports & Analytics", color: "text-emerald-400" },
      ],
    },
  },
};

const adminLogoSrc = `${import.meta.env.BASE_URL}logo.png`;

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const dir = "ltr";
  const data = pageData.en;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setIsLoading(true);
    const apiBase = getApiBase();

    try {
      const response = await fetch(
        `${apiBase}${PORTAL_CONFIG.loginEndpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw { response: { data } };
      }

      if (data.role !== PORTAL_CONFIG.role) {
        clearAuth();
        throw new Error("WRONG_ROLE");
      }

      saveAuth(data);
    } catch (err) {
      if (err.message === "WRONG_ROLE") {
        setError(PORTAL_CONFIG.loginErrorMessage.en);
      } else if (err.response) {
        const rawMsg = err.response.data?.message?.toLowerCase() || "";
        let friendlyMsg = "Login failed";

        if (
          rawMsg.includes("invalid") ||
          rawMsg.includes("credential") ||
          rawMsg.includes("password") ||
          rawMsg.includes("not found")
        ) {
          friendlyMsg = "Invalid email or password.";
        } else if (err.response.data?.message) {
          friendlyMsg = err.response.data.message;
        }

        setError(friendlyMsg);
      } else {
        setError(
          `Cannot connect to API (${apiBase}). Start backend server or set VITE_API_URL in admin/.env.`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans"
      dir={dir}
    >
      <div className="flex w-full max-w-[1200px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] lg:flex-row">
        {/* Form Section */}
        <div className="flex w-full flex-col justify-center p-8 sm:p-12 lg:w-1/2 xl:p-16">
          <div className="mx-auto w-full max-w-md">
            {/* Logo & Badge */}
            <div className="mb-8 flex flex-col items-start gap-4">
              <img
                src={adminLogoSrc}
                alt="EduTech Logo"
                className="h-10 w-auto object-contain"
              />
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{data.badge}</span>
              </div>
            </div>

            {/* Titles */}
            <h1 className="text-3xl font-black text-slate-900">{data.title}</h1>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
              {data.subtitle}
            </p>

            {/* Form */}
            <form className="mt-10 space-y-5" onSubmit={handleLogin}>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {data.fields.email}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-4 ps-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    placeholder={data.placeholders.email}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  {data.fields.password}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-4 ps-11 pe-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                    placeholder={data.placeholders.password}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-4 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  {data.remember}
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-base font-black text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/30 disabled:pointer-events-none disabled:opacity-70"
              >
                {isLoading ? (
                  <span>{data.loading}</span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn size={20} />
                    {data.submit}
                  </span>
                )}
              </button>
            </form>

            <p className="mt-10 text-center text-xs font-bold text-slate-400">
              {data.footerInfo}
            </p>
          </div>
        </div>

        {/* Illustration Section (Hidden on Mobile) */}
        <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-center p-12 xl:p-16">
          {/* Background Gradients */}
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-violet-600/30 blur-[100px]" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-cyan-500/20 blur-[100px]" />
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />

          <div className="relative z-10">
            {/* Abstract Icons Art */}
            <div className="relative mx-auto mb-16 h-48 w-full max-w-sm">
              <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-gradient-to-tr from-violet-500 to-cyan-400 shadow-2xl shadow-cyan-500/20">
                <ShieldCheck size={48} className="text-white" />
              </div>
              <div className="absolute left-[15%] top-[10%] flex animate-[bounce_3s_infinite] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <Users size={28} className="text-cyan-300" />
              </div>
              <div className="absolute bottom-[10%] right-[15%] flex animate-[bounce_4s_infinite] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <BarChart3 size={28} className="text-violet-300" />
              </div>
              <div className="absolute bottom-[20%] left-[20%] flex animate-[pulse_3s_infinite] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                <Settings size={20} className="text-slate-300" />
              </div>
            </div>

            <h2 className="text-4xl font-black leading-tight text-white">
              {data.illustration.title}
            </h2>
            <p className="mt-4 text-lg font-medium leading-relaxed text-slate-300">
              {data.illustration.subtitle}
            </p>

            {/* Features Grid */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                {
                  icon: Users,
                  title: data.illustration.features[0].title,
                  color: data.illustration.features[0].color,
                },
                {
                  icon: BookOpen,
                  title: data.illustration.features[1].title,
                  color: data.illustration.features[1].color,
                },
                {
                  icon: CreditCard,
                  title: data.illustration.features[2].title,
                  color: data.illustration.features[2].color,
                },
                {
                  icon: BarChart3,
                  title: data.illustration.features[3].title,
                  color: data.illustration.features[3].color,
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10"
                >
                  <feature.icon
                    className={`h-8 w-8 ${feature.color}`}
                    strokeWidth={1.5}
                  />
                  <h3 className="mt-4 text-base font-bold text-white">
                    {feature.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
