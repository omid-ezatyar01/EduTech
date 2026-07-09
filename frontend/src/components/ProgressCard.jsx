import { ChevronLeft } from "lucide-react";

export default function ProgressCard() {
  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-black text-slate-950">پیشرفت یادگیری</h2>

      <div className="flex flex-col items-center">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-50">
          <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
            <circle
              cx="64"
              cy="64"
              r="56"
              className="stroke-slate-100"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              className="stroke-primary-500"
              strokeWidth="12"
              fill="none"
              strokeDasharray="351.858"
              strokeDashoffset="204.077"
              strokeLinecap="round"
            />
          </svg>
          <div className="text-center">
            <span className="text-2xl font-black text-slate-900">42%</span>
            <p className="text-[10px] font-bold text-slate-500">
              میانگین پیشرفت
            </p>
          </div>
        </div>

        <div className="mt-6 w-full grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black text-slate-900">1</p>
            <p className="text-xs font-bold text-slate-500">کورس فعال</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black text-slate-900">0</p>
            <p className="text-xs font-bold text-slate-500">تکمیل شده</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black text-slate-900">18</p>
            <p className="text-xs font-bold text-slate-500">ساعت مطالعه</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black text-slate-900">4</p>
            <p className="text-xs font-bold text-slate-500">تمرین باقی‌مانده</p>
          </div>
        </div>
      </div>

      <button className="mt-auto pt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-primary-600 hover:text-primary-700 transition">
        گزارش کامل پیشرفت
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
