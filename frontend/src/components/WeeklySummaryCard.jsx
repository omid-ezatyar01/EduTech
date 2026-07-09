import { GraduationCap, Video, ClipboardList, Hourglass } from "lucide-react";

const ICON_MAP = {
  graduation: GraduationCap,
  video: Video,
  list: ClipboardList,
  pending: Hourglass,
};

const DEFAULT_STATS = [
  { value: "0", label: "صنف این هفته", icon: "graduation", color: "text-primary-600" },
  { value: "0", label: "صنف امروز", icon: "video", color: "text-teal-600" },
  { value: "0", label: "صنف‌های آینده", icon: "list", color: "text-purple-600" },
  { value: "0", label: "در انتظار", icon: "pending", color: "text-amber-600" },
];

export default function WeeklySummaryCard({ stats = DEFAULT_STATS, language = "fa" }) {
  const isFa = language === "fa";
  const rows = Array.isArray(stats) && stats.length ? stats : DEFAULT_STATS;

  return (
    <div className="h-full w-full rounded-[24px] border border-slate-200 bg-white p-7 shadow-sm">
      <h3 className="mb-6 text-xl font-black text-slate-950">
        {isFa ? "خلاصه هفته" : "Week Summary"}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {rows.map((stat, idx) => {
          const Icon = ICON_MAP[stat.icon] || GraduationCap;
          return (
          <div
            key={idx}
            className="flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              <Icon size={18} className={stat.color || "text-primary-600"} />
            </div>
            <span className="text-xl font-black text-slate-900">
              {stat.value}
            </span>
            <span className="mt-1 text-[10px] font-bold text-slate-500">
              {stat.label}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
