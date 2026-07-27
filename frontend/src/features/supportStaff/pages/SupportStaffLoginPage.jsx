import { useState } from "react";
import { Eye, EyeOff, Headphones, LockKeyhole, Mail } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { loginSupportStaff } from "../services/supportStaffApi.js";
import {
  isSupportStaffAuthenticated,
  saveSupportStaffAuth,
} from "../services/supportStaffAuth.js";
import {
  SupportStaffLanguageProvider,
  SupportStaffLanguageToggle,
} from "../components/SupportStaffLanguage.jsx";
import { useSupportStaffLanguage } from "../services/supportStaffLanguageContext.js";

export default function SupportStaffLoginPage() {
  return (
    <SupportStaffLanguageProvider>
      <SupportStaffLoginContent />
    </SupportStaffLanguageProvider>
  );
}

function SupportStaffLoginContent() {
  const navigate = useNavigate();
  const { isFa } = useSupportStaffLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isSupportStaffAuthenticated()) {
    return <Navigate to="/support-team" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await loginSupportStaff({ email, password });
      saveSupportStaffAuth(user);
      navigate("/support-team", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_40%),radial-gradient(circle_at_bottom_right,#ccfbf1,transparent_35%),#f8fafc] p-4" dir={isFa ? "rtl" : "ltr"}>
      <div className="absolute end-4 top-4">
        <SupportStaffLanguageToggle />
      </div>
      <div className="w-full max-w-md rounded-[30px] border border-white/70 bg-white/95 p-7 shadow-2xl shadow-blue-950/10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#0B4FD8] to-[#00B8A9] text-white shadow-lg">
          <Headphones size={30} />
        </div>
        <h1 className="mt-5 text-center text-2xl font-black text-slate-950">
          {isFa ? "ورود تیم پشتیبانی" : "Support Team Login"}
        </h1>
        <p className="mt-2 text-center text-sm font-semibold text-slate-500">
          {isFa
            ? "با حساب کارمندی که ادمین ساخته است وارد شوید."
            : "Sign in with the staff account created by an administrator."}
        </p>
        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field icon={Mail} label={isFa ? "ایمیل" : "Email"} type="email" value={email} onChange={setEmail} />
          <Field
            icon={LockKeyhole}
            label={isFa ? "رمز عبور" : "Password"}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="text-slate-400 hover:text-slate-700"
                aria-label={
                  showPassword
                    ? isFa
                      ? "پنهان کردن رمز"
                      : "Hide password"
                    : isFa
                      ? "نمایش رمز"
                      : "Show password"
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <button disabled={loading} className="w-full rounded-xl bg-[#0B4FD8] px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-700 disabled:opacity-50">
            {loading
              ? isFa
                ? "در حال ورود…"
                : "Signing in…"
              : isFa
                ? "ورود به پشتیبانی"
                : "Sign in to support"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
          {isFa
            ? "حساب پشتیبانی به پنل ادمین دسترسی ندارد."
            : "Support staff accounts cannot access the admin dashboard."}
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type, trailing = null }) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      <span className="relative block">
        <Icon className="absolute start-3 top-3 text-slate-400" size={18} />
        <input
          required
          autoComplete={type === "password" ? "current-password" : "email"}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border border-slate-200 py-3 ps-10 text-sm outline-none focus:border-blue-500 ${trailing ? "pe-11" : "pe-3"}`}
        />
        {trailing ? (
          <span className="absolute end-3 top-3">{trailing}</span>
        ) : null}
      </span>
    </label>
  );
}
