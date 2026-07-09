import { CreditCard, Clock, ChevronLeft } from "lucide-react";

export default function PaymentsCard({ payments }) {
  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-black text-slate-950">پرداخت‌ها</h2>

      <div className="flex flex-col gap-4">
        {payments.map((item, idx) => {
          const isPaid = item.status === "پرداخت شده";
          const Icon = isPaid ? CreditCard : Clock;
          return (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isPaid
                      ? "bg-green-50 text-green-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {item.amount}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {item.title}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black ${
                  isPaid
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {item.status}
              </span>
            </div>
          );
        })}
      </div>

      <button className="mt-auto pt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-primary-600 hover:text-primary-700 transition">
        مدیریت پرداخت‌ها
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
