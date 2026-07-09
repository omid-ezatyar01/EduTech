import { Calendar, ChevronLeft } from "lucide-react";

export default function UpcomingScheduleCard({ schedule }) {
  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950">تقسیم اوقات آینده</h2>
      </div>

      <div className="flex flex-col gap-3">
        {schedule.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-4 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Calendar size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-slate-900">
                {item.course}
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{item.date}</span>
                {item.time !== "-" && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{item.time}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-auto pt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-primary-600 hover:text-primary-700 transition">
        مشاهده تقویم کامل
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
