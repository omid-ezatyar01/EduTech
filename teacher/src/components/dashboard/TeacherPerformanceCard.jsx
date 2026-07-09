const bars = [
  { labelFa: "حضور", labelEn: "Attendance", value: 88 },
  { labelFa: "مشارکت", labelEn: "Engagement", value: 85 },
  { labelFa: "تحویل تمرین", labelEn: "Submissions", value: 82 },
];

export default function TeacherPerformanceCard({ language }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "عملکرد شاگردان" : "Student Performance"}
      </h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {language === "fa"
          ? "حضور و مشارکت شاگردان"
          : "Student attendance and participation"}
      </p>

      <div className="mt-4 space-y-3">
        {bars.map((bar) => (
          <div key={bar.labelFa}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{language === "fa" ? bar.labelFa : bar.labelEn}</span>
              <span>{bar.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-l from-[#8B5CF6] to-[#0B4FD8]"
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-[#10B981]/10 px-3 py-2 text-sm font-bold text-[#10B981]">
        {language === "fa" ? "میانگین مشارکت ۸۵٪" : "Average engagement 85%"}
      </div>
    </section>
  );
}
