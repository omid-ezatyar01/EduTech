const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export default function WeeklyCalendarCard() {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-[#0F172A]">تقویم هفتگی</h3>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
        {weekDays.map((day, index) => (
          <div key={day + String(index)}>
            <p>{day}</p>
            <p className={`mt-1 grid h-8 place-items-center rounded-lg ${index === 3 ? "bg-[#0B4FD8] text-white" : "bg-[#F8FAFC] text-slate-700"}`}>
              {20 + index}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="rounded-xl border border-[#E2E8F0] p-2.5">
          <p className="font-bold text-slate-800">MERN Stack</p>
          <p className="text-slate-500">18:00 - 19:30</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] p-2.5">
          <p className="font-bold text-slate-800">Backend API</p>
          <p className="text-slate-500">20:00 - 21:30</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] p-2.5">
          <p className="font-bold text-slate-800">Python</p>
          <p className="text-slate-500">17:00 - 18:30</p>
        </div>
      </div>

      <button type="button" className="mt-4 w-full rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#0B4FD8] hover:border-[#0B4FD8]">
        مشاهده هفته کامل
      </button>
    </section>
  );
}
