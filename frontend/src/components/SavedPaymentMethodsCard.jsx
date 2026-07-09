import { Settings, CreditCard } from "lucide-react";

export default function SavedPaymentMethodsCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950 mb-5">
        روش‌های پرداخت ذخیره شده
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm border border-slate-100">
              <CreditCard size={20} />
            </div>
            <div>
              <p
                className="text-sm font-black text-slate-900 font-mono"
                dir="ltr"
              >
                **** 4242
              </p>
              <p className="text-[10px] font-bold text-slate-500">Visa</p>
            </div>
          </div>
          <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-black text-primary-700">
            اصلی
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-100 font-black text-xs font-serif italic">
            P
          </div>
          <div>
            <p className="text-xs font-black text-slate-900" dir="ltr">
              student@edutech.com
            </p>
            <p className="text-[10px] font-bold text-slate-500">PayPal</p>
          </div>
        </div>
      </div>
      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100">
        <Settings size={18} /> مدیریت روش‌های پرداخت
      </button>
    </div>
  );
}
