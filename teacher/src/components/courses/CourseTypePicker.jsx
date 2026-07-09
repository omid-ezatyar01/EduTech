import { BookOpenCheck, Sparkles } from "lucide-react";

const COURSE_TYPE_OPTIONS = [
  {
    value: "general",
    icon: BookOpenCheck,
    labelFa: "کورس عمومی",
    labelEn: "General course",
    descriptionFa: "برای همه شاگردان قابل ثبت‌نام است.",
    descriptionEn: "Open for all students to enroll.",
  },
  {
    value: "special",
    icon: Sparkles,
    labelFa: "کورس ویژه",
    labelEn: "Special course",
    descriptionFa: "برای دوره‌های خاص، برجسته یا ظرفیت محدود.",
    descriptionEn: "For highlighted, focused, or limited-seat courses.",
  },
];

export default function CourseTypePicker({
  value = "general",
  onChange,
  language = "fa",
}) {
  const isFa = language === "fa";

  return (
    <div className="sm:col-span-2">
      <label className="mb-2 block text-xs font-bold text-slate-600">
        {isFa ? "نوع کورس" : "Course type"}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {COURSE_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-h-[88px] items-start gap-3 rounded-xl border p-3 text-start transition ${
                isSelected
                  ? "border-[#0B4FD8] bg-[#EFF6FF] text-[#0B4FD8] shadow-[0_10px_24px_rgba(11,79,216,0.14)]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-700 hover:border-[#BFDBFE] hover:bg-white"
              }`}
              aria-pressed={isSelected}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  isSelected ? "bg-white text-[#0B4FD8]" : "bg-white text-slate-500"
                }`}
              >
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">
                  {isFa ? option.labelFa : option.labelEn}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                  {isFa ? option.descriptionFa : option.descriptionEn}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
