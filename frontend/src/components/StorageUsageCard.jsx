import { Folder } from "lucide-react";

export default function StorageUsageCard() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-black text-slate-950">
        فضای ذخیره‌سازی
      </h3>
      <div className="mb-2 flex items-center justify-between text-sm font-bold">
        <span className="text-slate-500">استفاده شده</span>
        <span className="text-slate-900">
          1.2 GB{" "}
          <span className="text-xs text-slate-400 font-semibold">از 5 GB</span>
        </span>
      </div>
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-600 to-teal-400"
          style={{ width: "24%" }}
        />
      </div>
      <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 hover:text-primary-600">
        <Folder size={18} />
        مدیریت فایل‌ها
      </button>
    </div>
  );
}
