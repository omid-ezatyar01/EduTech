const colorMap = {
  blue: {
    iconBg: "bg-[#DBEAFE]",
    iconText: "text-[#0B4FD8]",
    accent: "text-[#0B4FD8]",
  },
  green: {
    iconBg: "bg-[#DCFCE7]",
    iconText: "text-[#10B981]",
    accent: "text-[#10B981]",
  },
  orange: {
    iconBg: "bg-[#FEF3C7]",
    iconText: "text-[#F59E0B]",
    accent: "text-[#F59E0B]",
  },
  purple: {
    iconBg: "bg-[#EDE9FE]",
    iconText: "text-[#8B5CF6]",
    accent: "text-[#8B5CF6]",
  },
};

export default function TeacherStudentStatsCard({ title, value, subtitle, icon: Icon, color = "blue" }) {
  const palette = colorMap[color] || colorMap.blue;

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${palette.iconBg} ${palette.iconText}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className={`mt-3 text-xs font-semibold ${palette.accent}`}>{subtitle}</p>
    </article>
  );
}
