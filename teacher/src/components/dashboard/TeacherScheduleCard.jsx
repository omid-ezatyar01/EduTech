const weeklyData = [
  { dayFa: "شنبه", dayEn: "Sat", classes: 2 },
  { dayFa: "یکشنبه", dayEn: "Sun", classes: 1 },
  { dayFa: "دوشنبه", dayEn: "Mon", classes: 2 },
  { dayFa: "سه‌شنبه", dayEn: "Tue", classes: 1 },
  { dayFa: "چهارشنبه", dayEn: "Wed", classes: 2 },
  { dayFa: "پنجشنبه", dayEn: "Thu", classes: 0 },
];

export default function TeacherScheduleCard({ language }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "برنامه هفتگی" : "Weekly Schedule"}
      </h3>

      <div className="mt-4 space-y-2">
        {weeklyData.map((item) => (
          <div
            key={item.dayFa}
            className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2"
          >
            <span className="text-sm font-bold text-slate-700">
              {language === "fa" ? item.dayFa : item.dayEn}
            </span>
            <span className="text-xs font-extrabold text-[#0B4FD8]">
              {item.classes} {language === "fa" ? "صنف" : "classes"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
