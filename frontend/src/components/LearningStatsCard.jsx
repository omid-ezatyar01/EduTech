import { BookOpen, ClipboardCheck, Clock, BarChart } from "lucide-react";

export default function LearningStatsCard({ stats, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    title: isFa ? "آمار یادگیری" : "Learning Statistics",
    enrolledCourses: isFa ? "کورس‌های ثبت‌نام شده" : "Enrolled Courses",
    completedAssignments: isFa ? "تمرین نهایی شده" : "Completed Assignments",
    learningHours: isFa ? "ساعت یادگیری" : "Learning Hours",
    averageProgress: isFa ? "میانگین پیشرفت" : "Average Progress",
  };

  const items = [
    {
      label: t.enrolledCourses,
      value: stats.enrolledCourses,
      icon: BookOpen,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: t.completedAssignments,
      value: stats.completedAssignments,
      icon: ClipboardCheck,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: t.learningHours,
      value: stats.learningHours,
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: t.averageProgress,
      value: `${stats.averageProgress}٪`,
      icon: BarChart,
      color: "text-teal-600 bg-teal-50",
    },
  ];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-5 text-lg font-black text-slate-950">{t.title}</h3>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center transition hover:border-slate-200"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl mb-3 shadow-sm bg-white ${item.color.split(" ")[0]}`}
            >
              <item.icon size={18} />
            </div>
            <span className="text-xl font-black text-slate-900" dir="ltr">
              {item.value}
            </span>
            <span className="mt-1 text-[10px] font-bold text-slate-500">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
