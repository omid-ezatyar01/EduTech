import {
  Eye,
  EyeOff,
  Home,
  MonitorPlay,
  MessageCircle,
  GraduationCap,
  Heart,
  Users,
  Clock,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export function AuthHeader({ dir }) {
  const logoSrc = "/logo.png";
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-[76px] max-w-[1536px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/">
            <img
              src={logoSrc}
              className="h-9 sm:h-10 lg:h-11 object-contain"
              alt="EduTech"
            />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-primary-700"
          >
            <Home size={18} />
            {dir === "ltr" ? "Back to Home" : "بازگشت به خانه"}
          </Link>
        </div>
      </header>
      <div className="h-[76px]" aria-hidden="true" />
    </>
  );
}

export function AuthInput({ label, icon: Icon, error, ...props }) {
  const baseClasses =
    "w-full rounded-xl border bg-slate-50 py-4 pe-4 ps-12 text-sm font-semibold outline-none transition focus:bg-white focus:ring-4";
  const stateClasses = error
    ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-100"
    : "border-slate-200 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:ring-primary-100";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-slate-800">{label}</label>
      <div className="relative flex items-center">
        <div className="absolute start-4 text-slate-400">
          <Icon size={20} className={error ? "text-red-400" : ""} />
        </div>
        <input className={`${baseClasses} ${stateClasses}`} {...props} />
      </div>
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}

export function SuccessModal({ isOpen, onClose, title, text, dir }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      dir={dir}
    >
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500 mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-950 mb-2">{title}</h2>
        <p className="text-sm font-semibold leading-6 text-slate-600 mb-6">
          {text}
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
        >
          {dir === "rtl" ? "ورود به داشبورد" : "Go to Dashboard"}
        </button>
      </div>
    </div>
  );
}

export function PasswordInput({ label, error, ...props }) {
  const [show, setShow] = useState(false);
  const baseClasses =
    "w-full rounded-xl border bg-slate-50 py-4 pe-12 ps-12 text-sm font-semibold outline-none transition focus:bg-white focus:ring-4";
  const stateClasses = error
    ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-100"
    : "border-slate-200 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:ring-primary-100";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-slate-800">{label}</label>
      <div className="relative flex items-center">
        <div className="absolute start-4 text-slate-400">
          <props.icon size={20} className={error ? "text-red-400" : ""} />
        </div>
        <input
          type={show ? "text" : "password"}
          className={`${baseClasses} ${stateClasses}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute end-4 text-slate-400 hover:text-slate-600 transition"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}

export function SocialButton({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-primary-600"
      {...props}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

export function AuthBenefitItem({ title, text }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-100">
        <div className="h-2 w-2 rounded-full bg-teal-400" />
      </div>
      <div>
        <h4 className="font-bold text-white">{title}</h4>
        <p className="mt-1 text-sm font-medium leading-6 text-primary-100">
          {text}
        </p>
      </div>
    </div>
  );
}

export function ComingSoonModal({ isOpen, onClose, title, text, dir }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      dir={dir}
    >
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
        >
          <X size={20} />
        </button>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 mb-4">
          <Clock size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-950 mb-2">{title}</h2>
        <p className="text-sm font-semibold leading-6 text-slate-600 mb-6">
          {text}
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
        >
          {dir === "rtl" ? "بستن" : "Close"}
        </button>
      </div>
    </div>
  );
}

export function TermsModal({
  isOpen,
  onClose,
  onAccept,
  title,
  body,
  acceptLabel,
  closeLabel,
  dir,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      dir={dir}
    >
      <div className="relative w-full max-w-xl animate-in zoom-in-95 rounded-[28px] bg-white p-6 shadow-2xl duration-200 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <FileText size={20} />
          </div>
          <h2 className="text-lg font-black text-slate-950 sm:text-xl">{title}</h2>
        </div>
        <div
          dir="ltr"
          className="max-h-[52vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700 sm:p-5"
        >
          <div dir={dir}>{body}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-xl bg-primary-600 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-primary-700"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthVisual({ title, subtitle, benefits, type = "login" }) {
  const isLogin = type === "login";
  const isRegister = type === "register";
  const isCompactAuth = isLogin || isRegister;

  return (
    <div
      className={`relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 lg:flex ${
        isCompactAuth ? "p-8 xl:p-10" : "p-10 xl:p-14"
      }`}
    >
      <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary-400/20 blur-3xl" />

      <div className="relative z-10 text-center xl:text-start">
        <h2
          className={`font-black text-white ${
            isCompactAuth ? "text-2xl xl:text-3xl" : "text-3xl xl:text-4xl"
          }`}
        >
          {title}
        </h2>
        <p
          className={`font-medium text-primary-100 ${
            isCompactAuth ? "mt-2 text-base" : "mt-3 text-lg"
          }`}
        >
          {subtitle}
        </p>
      </div>

      <div
        className={`relative z-10 mx-auto w-full ${
          isCompactAuth ? "my-7 max-w-[270px]" : "my-10 max-w-sm"
        }`}
      >
        <div className="relative aspect-square overflow-hidden rounded-full border-8 border-white/10 shadow-2xl">
          <img
            src="/hero-student.png"
            alt="Student"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Floating Badges based on type */}
        {type === "login" ? (
          <>
            <div className="absolute -left-6 top-20 inline-flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg animate-bounce duration-[3000ms]">
              <MonitorPlay className="text-primary-600" size={20} />
            </div>
            <div className="absolute -right-4 bottom-20 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-lg animate-bounce duration-[4000ms] delay-100">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs font-black text-slate-800">
                Google Meet
              </span>
            </div>
            <div className="absolute -bottom-8 left-10 inline-flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg animate-bounce duration-[3500ms] delay-200">
              <MessageCircle className="text-teal-500" size={20} />
            </div>
          </>
        ) : (
          <>
            <div className="absolute -left-4 top-10 inline-flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg animate-bounce duration-[3000ms]">
              <GraduationCap className="text-primary-600" size={24} />
            </div>
            <div className="absolute -right-6 bottom-24 inline-flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg animate-bounce duration-[4000ms] delay-100">
              <Heart className="text-pink-500" size={20} />
            </div>
            <div className="absolute -bottom-6 left-16 inline-flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg animate-bounce duration-[3500ms] delay-200">
              <Users className="text-teal-500" size={20} />
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 space-y-6">
        {benefits.map((benefit, idx) => (
          <AuthBenefitItem
            key={idx}
            title={benefit.title}
            text={benefit.text}
          />
        ))}
      </div>
    </div>
  );
}

export function StatsRow({ stats }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {stats.map((stat, idx) => (
        <div
          className="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_35px_rgba(15,23,42,0.03)]"
          key={idx}
        >
          <p className="text-2xl font-black text-primary-700 lg:text-3xl">
            {stat.value}
          </p>
          <p className="mt-2 text-xs font-bold text-slate-500 lg:text-sm">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
