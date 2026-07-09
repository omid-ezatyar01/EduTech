import { ChevronLeft } from "lucide-react";

export default function AnnouncementsCard({ announcements }) {
  const colors = [
    "bg-primary-500",
    "bg-teal-500",
    "bg-amber-500",
    "bg-purple-500",
  ];

  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-black text-slate-950">اعلان‌ها</h2>

      <div className="flex flex-col gap-4">
        {announcements.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 relative">
            <div
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colors[idx % colors.length]}`}
            />
            <div>
              <p className="text-sm font-bold text-slate-800 leading-6">
                {item.text}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-auto pt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-primary-600 hover:text-primary-700 transition">
        مشاهده همه اعلان‌ها
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
