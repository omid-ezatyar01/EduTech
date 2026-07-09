import { Shield, Lock } from "lucide-react";

export default function QuickSecurityCard({ onOpenModal, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "امنیت سریع" : "Quick Security",
    twoFactor: isFa ? "احراز هویت دو مرحله‌ای" : "Two-Factor Authentication",
    active: isFa ? "فعال" : "Active",
    subtitle: isFa
      ? "برای امنیت بیشتر حساب شما فعال است."
      : "Enabled for stronger account security.",
    manageSecurity: isFa ? "مدیریت امنیت حساب" : "Manage Account Security",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
          <Shield className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{t.title}</h3>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-900">
            {t.twoFactor}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">
            {t.active}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          {t.subtitle}
        </p>
      </div>
      <button
        onClick={onOpenModal}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
      >
        <Lock className="h-4 w-4" />
        {t.manageSecurity}
      </button>
    </div>
  );
}
