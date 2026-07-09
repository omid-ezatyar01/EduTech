import { ClipboardList, ChevronLeft } from "lucide-react";

export default function AssignmentsCard({ assignments }) {
  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-black text-slate-950">تمرین‌ها</h2>

      <div className="flex flex-col gap-4">
        {assignments.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                item.status === "ارسال شده"
                  ? "bg-teal-50 text-teal-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <ClipboardList size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">
                {item.title}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {item.deadline || "ارسال شده"}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black ${
                item.status === "ارسال شده"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      <button className="mt-auto pt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-primary-600 hover:text-primary-700 transition">
        مشاهده همه تمرین‌ها
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
