const toneMap = {
  orange: { bg: "bg-[#FEF3C7]", text: "text-[#F59E0B]" },
  blue: { bg: "bg-[#DBEAFE]", text: "text-[#0B4FD8]" },
  green: { bg: "bg-[#DCFCE7]", text: "text-[#10B981]" },
  purple: { bg: "bg-[#EDE9FE]", text: "text-[#8B5CF6]" },
};

export default function TeacherLiveClassStatsCard({ title, value, subtitle, icon: Icon, tone = "blue" }) {
  const color = toneMap[tone] || toneMap.blue;

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-[#0F172A]">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${color.bg} ${color.text}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className={`mt-3 text-xs font-semibold ${color.text}`}>{subtitle}</p>
    </article>
  );
}
