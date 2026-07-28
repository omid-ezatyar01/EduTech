import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  KeyRound,
  Laptop,
  Languages,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import StudentLayout from "./StudentLayout";
import SettingsCategoryCard from "./SettingsCategoryCard";
import AccountSecurityModal from "./AccountSecurityModal";
import FrontendPageLoader from "./common/FrontendPageLoader.jsx";
import { getCurrentUser, updateCurrentUserProfile } from "../../services/authService.js";
import {
  clearAuth,
  getAuthUser,
  getLocalizedPortalPath,
} from "../../services/portal.js";

const DISPLAY_SCALES = { compact: "0.85", comfortable: "0.9", large: "1" };

const persistUser = (user) => {
  if (!user) return;
  localStorage.setItem("edutech_user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth_change"));
};

const requestMessage = (error, fallback) => String(error?.response?.data?.message || error?.message || fallback);

function PanelHeader({ icon: Icon, title, subtitle, tone = "bg-blue-50 text-primary-600" }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span>
      <div><h2 className="text-xl font-black text-slate-900">{title}</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-500">{subtitle}</p></div>
    </div>
  );
}

export default function Settings({ language = "fa" }) {
  const isFa = language === "fa";
  const Arrow = isFa ? ChevronLeft : ChevronRight;
  const [activeCategory, setActiveCategory] = useState("account");
  const [profile, setProfile] = useState(() => getAuthUser() || {});
  const [displayScale, setDisplayScale] = useState(() => localStorage.getItem("edutech-display-scale") || "comfortable");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSecurityModalOpen, setSecurityModalOpen] = useState(false);

  const text = useMemo(() => ({
    dashboard: isFa ? "داشبورد" : "Dashboard",
    settings: isFa ? "تنظیمات" : "Settings",
    subtitle: isFa ? "حساب، اعلان‌ها، حریم خصوصی و ترجیحات خود را از یک مکان مدیریت کنید." : "Manage your account, notifications, privacy, and preferences in one place.",
    saved: isFa ? "تغییرات با موفقیت ذخیره شد." : "Changes saved successfully.",
    retry: isFa ? "تلاش دوباره" : "Try again",
    loading: isFa ? "در حال دریافت تنظیمات حساب" : "Loading account settings",
    accountTitle: isFa ? "اطلاعات حساب" : "Account information",
    accountSubtitle: isFa ? "اطلاعات اصلی حساب شما؛ ویرایش کامل در صفحه پروفایل انجام می‌شود." : "Your primary account details; full editing is available on your profile.",
    editProfile: isFa ? "ویرایش پروفایل" : "Edit profile",
    fullName: isFa ? "نام کامل" : "Full name",
    email: isFa ? "ایمیل" : "Email",
    phone: isFa ? "شماره تماس" : "Phone",
    studentId: isFa ? "شناسه شاگرد" : "Student ID",
    notSet: isFa ? "ثبت نشده" : "Not set",
    securityTitle: isFa ? "امنیت و ورود" : "Security & login",
    securitySubtitle: isFa ? "رمز عبور حساب را مدیریت کنید و دسترسی خود را امن نگه دارید." : "Manage your password and keep account access secure.",
    passwordTitle: isFa ? "رمز عبور حساب" : "Account password",
    passwordText: isFa ? "برای امنیت بیشتر، از رمز قوی و متفاوت استفاده کنید." : "Use a strong password that you do not reuse elsewhere.",
    changePassword: isFa ? "تغییر رمز عبور" : "Change password",
    appearanceTitle: isFa ? "ظاهر و زبان" : "Appearance & language",
    appearanceSubtitle: isFa ? "زبان رابط کاربری و اندازه نمایش را انتخاب کنید." : "Choose the interface language and display size.",
    interfaceLanguage: isFa ? "زبان رابط کاربری" : "Interface language",
    displaySize: isFa ? "اندازه نمایش" : "Display size",
    compact: isFa ? "فشرده" : "Compact",
    comfortable: isFa ? "معمولی" : "Comfortable",
    large: isFa ? "بزرگ" : "Large",
    devicesTitle: isFa ? "دستگاه‌های متصل" : "Connected devices",
    devicesSubtitle: isFa ? "نشست فعلی حساب خود را بررسی و در صورت نیاز خارج شوید." : "Review your current account session and sign out when needed.",
    currentDevice: isFa ? "دستگاه فعلی" : "Current device",
    activeNow: isFa ? "همین حالا فعال" : "Active now",
    protectedSession: isFa ? "این نشست با توکن ورود محافظت می‌شود." : "This session is protected by your sign-in token.",
    signOut: isFa ? "خروج از این دستگاه" : "Sign out of this device",
    supportTitle: isFa ? "پشتیبانی" : "Support",
    supportSubtitle: isFa ? "برای سوال‌های حساب، پرداخت یا استفاده از پلتفرم با ما تماس بگیرید." : "Contact us for help with your account, payments, or the platform.",
    contactPage: isFa ? "رفتن به صفحه تماس" : "Open contact page",
    emailSupport: isFa ? "ارسال ایمیل به پشتیبانی" : "Email support",
  }), [isFa]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setProfile(user || {});
        persistUser(user);
      })
      .catch((loadError) => {
        if (active) setError(requestMessage(loadError, text.loading));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [text.loading]);

  const flash = (message = text.saved) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const saveProfilePreference = async (key, payload, rollback) => {
    setSaving(key);
    setError("");
    try {
      const result = await updateCurrentUserProfile(payload);
      if (result?.user) {
        setProfile(result.user);
        persistUser(result.user);
      }
      flash();
      return true;
    } catch (saveError) {
      rollback?.();
      setError(requestMessage(saveError, isFa ? "ذخیره تنظیمات ناموفق بود." : "Could not save settings."));
      return false;
    } finally {
      setSaving("");
    }
  };

  const changeLanguage = async (nextLanguage) => {
    if (nextLanguage !== "fa" && nextLanguage !== "en") return;
    localStorage.setItem("edutech-language", nextLanguage);
    window.dispatchEvent(new CustomEvent("edutech_language_change", { detail: { language: nextLanguage } }));
    await saveProfilePreference("language", { preferredLanguage: nextLanguage });
  };

  const changeDisplayScale = (nextScale) => {
    setDisplayScale(nextScale);
    localStorage.setItem("edutech-display-scale", nextScale);
    document.documentElement.style.setProperty("--app-scale", DISPLAY_SCALES[nextScale] || DISPLAY_SCALES.comfortable);
    flash();
  };

  const signOut = () => {
    clearAuth();
    window.location.replace(getLocalizedPortalPath("/login"));
  };

  const browserLabel = typeof navigator === "undefined" ? "Browser" : `${navigator.platform || "Web"} · ${/Firefox/i.test(navigator.userAgent) ? "Firefox" : /Edg/i.test(navigator.userAgent) ? "Edge" : /Chrome/i.test(navigator.userAgent) ? "Chrome" : /Safari/i.test(navigator.userAgent) ? "Safari" : "Browser"}`;

  const renderPanel = () => {
    if (activeCategory === "account") return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <PanelHeader icon={UserRound} title={text.accountTitle} subtitle={text.accountSubtitle} />
        <div className="p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[[text.fullName, profile.name], [text.email, profile.email], [text.phone, profile.phone], [text.studentId, profile.studentId]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-800" dir={label === text.email || label === text.phone ? "ltr" : undefined}>{value || text.notSet}</p></div>)}
          </div>
          <Link to="/student/profile" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-black text-white transition hover:bg-primary-700">{text.editProfile}<Arrow size={16} /></Link>
        </div>
      </section>
    );

    if (activeCategory === "security") return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><PanelHeader icon={ShieldCheck} title={text.securityTitle} subtitle={text.securitySubtitle} tone="bg-emerald-50 text-emerald-600" /><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-3 text-primary-600 shadow-sm"><KeyRound size={20} /></span><div><p className="font-black text-slate-900">{text.passwordTitle}</p><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{text.passwordText}</p></div></div><button type="button" onClick={() => setSecurityModalOpen(true)} className="h-11 shrink-0 rounded-xl bg-primary-600 px-5 text-sm font-black text-white">{text.changePassword}</button></div></div></section>
    );

    if (activeCategory === "appearance") return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><PanelHeader icon={Languages} title={text.appearanceTitle} subtitle={text.appearanceSubtitle} tone="bg-violet-50 text-violet-600" /><div className="space-y-6 p-5 sm:p-6"><div><p className="mb-3 text-sm font-black text-slate-800">{text.interfaceLanguage}</p><div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">{[["fa", "فارسی"], ["en", "English"]].map(([value, label]) => <button type="button" key={value} disabled={saving === "language"} onClick={() => changeLanguage(value)} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${language === value ? "bg-white text-primary-600 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div></div><div><p className="mb-3 text-sm font-black text-slate-800">{text.displaySize}</p><div className="grid grid-cols-3 gap-2">{["compact", "comfortable", "large"].map((value) => <button type="button" key={value} onClick={() => changeDisplayScale(value)} className={`rounded-xl border px-3 py-3 text-xs font-black transition sm:text-sm ${displayScale === value ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{text[value]}</button>)}</div></div></div></section>
    );

    if (activeCategory === "devices") return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><PanelHeader icon={Monitor} title={text.devicesTitle} subtitle={text.devicesSubtitle} tone="bg-cyan-50 text-cyan-600" /><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-3 text-emerald-600 shadow-sm"><Laptop size={21} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{text.currentDevice}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">{text.activeNow}</span></div><p className="mt-1 text-xs font-bold text-slate-600" dir="ltr">{browserLabel}</p><p className="mt-1 text-xs font-medium text-slate-500">{text.protectedSession}</p></div></div><button type="button" onClick={signOut} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-700"><LogOut size={15} />{text.signOut}</button></div></div></section>
    );

    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><PanelHeader icon={Mail} title={text.supportTitle} subtitle={text.supportSubtitle} tone="bg-teal-50 text-teal-600" /><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"><Link to="/contact" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 font-black text-slate-800 transition hover:border-primary-200 hover:bg-white hover:text-primary-700"><span className="flex items-center gap-3"><FileText size={19} />{text.contactPage}</span><Arrow size={16} /></Link><a href="mailto:support@edutech.study" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 font-black text-slate-800 transition hover:border-primary-200 hover:bg-white hover:text-primary-700"><span className="flex items-center gap-3"><Mail size={19} />{text.emailSupport}</span><ExternalLink size={16} /></a></div></section>
    );
  };

  return (
    <StudentLayout language={language}>
      <main className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500"><Link className="hover:text-primary-700" to="/student/dashboard">{text.dashboard}</Link><span>/</span><span className="text-primary-600">{text.settings}</span></div>
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{text.settings}</h1><p className="mt-2 text-sm font-medium leading-6 text-slate-500">{text.subtitle}</p></header>

        {error ? <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"><span>{error}</span><button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-rose-200">{text.retry}</button></div> : null}
        {notice ? <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} />{notice}</div> : null}

        {loading ? <FrontendPageLoader label={text.loading} /> : <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><SettingsCategoryCard active={activeCategory} setActive={setActiveCategory} language={language} /><div className="min-w-0">{renderPanel()}</div></div>}
      </main>

      <AccountSecurityModal isOpen={isSecurityModalOpen} onClose={() => setSecurityModalOpen(false)} onSuccess={flash} language={language} />
      {saving ? <div className="pointer-events-none fixed bottom-5 end-5 z-40 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white shadow-xl"><Loader2 size={15} className="animate-spin" />{isFa ? "در حال ذخیره…" : "Saving…"}</div> : null}
    </StudentLayout>
  );
}
