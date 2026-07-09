export default function StudentPerformanceCard({ stats = {} }) {
  const totalStudents = Number(stats.totalStudents || 0);
  const activeStudents = Number(stats.activeStudents || 0);
  const followupStudents = Number(stats.followupStudents || 0);
  const excellentStudents = Math.max(totalStudents - activeStudents - followupStudents, 0);

  const safePercent = (value) => (totalStudents > 0 ? Math.round((value / totalStudents) * 100) : 0);

  const legendItems = [
    { label: "ممتاز", value: excellentStudents, percentage: safePercent(excellentStudents), color: "#8B5CF6", bg: "bg-[#EDE9FE]" },
    { label: "فعال", value: activeStudents, percentage: safePercent(activeStudents), color: "#10B981", bg: "bg-[#DCFCE7]" },
    { label: "نیازمند پیگیری", value: followupStudents, percentage: safePercent(followupStudents), color: "#F59E0B", bg: "bg-[#FEF3C7]" },
  ];

  const excellentArc = safePercent(excellentStudents) * 3.6;
  const activeArc = excellentArc + safePercent(activeStudents) * 3.6;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-base font-extrabold text-slate-900">عملکرد شاگردان</h3>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{
            background: `conic-gradient(#8B5CF6 0deg ${excellentArc}deg, #10B981 ${excellentArc}deg ${activeArc}deg, #F59E0B ${activeArc}deg 360deg)`,
          }}
        >
          <div className="absolute inset-4 grid place-items-center rounded-full bg-white">
            <div className="text-center">
              <p className="text-xl font-black text-slate-900">{totalStudents}</p>
              <p className="text-xs text-slate-500">کل شاگردان</p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-2">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${item.bg}`} style={{ backgroundColor: item.color }} />
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              </div>
              <p className="text-sm font-bold text-slate-900">
                {item.value} <span className="text-xs text-slate-500">({item.percentage}%)</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
