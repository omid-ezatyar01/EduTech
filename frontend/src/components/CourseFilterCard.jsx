import { ChevronDown } from "lucide-react";

export default function CourseFilterCard({
  courses,
  selectedCourse,
  onChange,
  embedded = false,
}) {
  return (
    <div
      className={`${
        embedded
          ? "rounded-2xl border border-slate-100 bg-slate-50 p-4"
          : "rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
      }`}
    >
      <h3 className={`font-black text-slate-950 ${embedded ? "mb-3 text-base" : "mb-4 text-lg"}`}>
        فیلتر بر اساس کورس
      </h3>
      <div className="relative">
        <select
          value={selectedCourse}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
        >
          {courses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
    </div>
  );
}
