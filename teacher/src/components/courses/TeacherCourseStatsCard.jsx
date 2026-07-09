export default function TeacherCourseStatsCard({ title, value, subtitle, icon: Icon, tone = "teal" }) {
  const tones = {
    teal: "bg-[#00B8A9]/10 text-[#00B8A9]",
    purple: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    orange: "bg-[#F59E0B]/10 text-[#F59E0B]",
    green: "bg-[#10B981]/10 text-[#10B981]",
  };

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-black text-[#0F172A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
    </article>
  );
}
