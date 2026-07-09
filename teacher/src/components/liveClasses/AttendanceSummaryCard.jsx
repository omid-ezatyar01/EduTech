const items = [
  { label: "حضور عالی", value: 72, color: "#10B981" },
  { label: "غیبت", value: 28, color: "#EF4444" },
];

export default function AttendanceSummaryCard() {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-[#0F172A]">خلاصه حضور</h3>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div
          className="relative h-32 w-32 rounded-full"
          style={{ background: "conic-gradient(#10B981 0deg 259.2deg, #EF4444 259.2deg 360deg)" }}
        >
          <div className="absolute inset-4 grid place-items-center rounded-full bg-white">
            <p className="text-center text-xs font-bold text-slate-600">
              نرخ حضور کلی
              <span className="mt-1 block text-xl font-black text-[#0F172A]">72%</span>
            </p>
          </div>
        </div>

        <div className="w-full space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-2.5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </p>
              <p className="font-bold text-slate-900">{item.value}%</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
