import { Mail, Phone, Lock, Shield } from "lucide-react";

export default function AccountInfoCard({
  user,
  onSecuritySettings,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "اطلاعات حساب" : "Account Information",
    email: isFa ? "ایمیل" : "Email",
    phone: isFa ? "شماره موبایل" : "Mobile Number",
    password: isFa ? "رمز عبور" : "Password",
    manageSecurity: isFa ? "مدیریت امنیت حساب" : "Manage Account Security",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-6 text-lg font-black text-slate-950">{t.title}</h3>

      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.email}</p>
              <p
                className="text-sm font-black text-slate-900 mt-0.5 font-mono"
                dir="ltr"
              >
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.phone}</p>
              <p
                className="text-sm font-black text-slate-900 mt-0.5 font-mono"
                dir="ltr"
              >
                {user.phone}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
              <Lock size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.password}</p>
              <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
                ••••••••••
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onSecuritySettings}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 hover:text-primary-600"
      >
        <Shield size={18} /> {t.manageSecurity}
      </button>
    </div>
  );
}
