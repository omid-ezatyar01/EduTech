import {
  CalendarDays,
  Globe2,
  MonitorPlay,
} from "lucide-react";

export default function TeacherSidebar({ data, dir }) {
  const isRtl = dir === "rtl";

  return (
    <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
      {/* Quick Info */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
        <h3 className={`text-xl font-black text-slate-950 ${isRtl ? "text-right" : "text-left"}`}>
          {data.quickInfoTitle}
        </h3>
        <div className="mt-5 space-y-4">
          {data.quickInfo.map((info, idx) => {
            const icons = [Globe2, MonitorPlay, MonitorPlay, CalendarDays];
            const Icon = icons[idx];
            return (
              <div
                className={`flex items-center gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0 ${isRtl ? "flex-row-reverse text-right" : "text-left"}`}
                key={idx}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-500">
                    {info.label}
                  </p>
                  <p className="font-semibold text-slate-950">{info.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
