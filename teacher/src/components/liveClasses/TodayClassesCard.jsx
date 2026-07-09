const statusDot = {
  live: "bg-[#10B981]",
  scheduled: "bg-[#0B4FD8]",
};

export default function TodayClassesCard({ classes }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-[#0F172A]">صنف‌های امروز</h3>

      <div className="mt-4 space-y-3">
        {classes.map((item) => (
          <article key={item.id} className="rounded-xl border border-[#E2E8F0] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-[#0F172A]">{item.time}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot[item.status] || "bg-slate-300"}`} />
                {item.statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-800">{item.course}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.topic}</p>
          </article>
        ))}
      </div>

      <button type="button" className="mt-4 w-full rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#0B4FD8] hover:border-[#0B4FD8]">
        مشاهده همه
      </button>
    </section>
  );
}
