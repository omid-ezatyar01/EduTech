import { BookOpen, Users, Video, BarChart } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    titleFa: "مدیریت کورس‌ها",
    titleEn: "Course Management",
    textFa: "ایجاد، ویرایش و مدیریت کورس‌های آموزشی",
    textEn: "Create, edit, and manage educational courses",
  },
  {
    icon: Users,
    titleFa: "مدیریت شاگردان",
    titleEn: "Student Management",
    textFa: "مدیریت شاگردان و پیگیری پیشرفت آن‌ها",
    textEn: "Manage students and track their progress",
  },
  {
    icon: Video,
    titleFa: "برگزاری صنف آنلاین",
    titleEn: "Live Classes",
    textFa: "برگزاری صنف‌های آنلاین با کیفیت بالا",
    textEn: "Run high-quality online classes",
  },
  {
    icon: BarChart,
    titleFa: "گزارش‌های آموزشی",
    titleEn: "Teaching Reports",
    textFa: "گزارش‌ها و آمار دقیق از فعالیت‌های آموزشی",
    textEn: "Detailed reports and teaching analytics",
  },
];

export default function TeacherAuthVisual({ className = "", language, isRTL }) {
  return (
    <div
      className={`relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-10 ${className}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#0B4FD8]/20 blur-[100px]" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#00B8A9]/20 blur-[100px]" />

      <div
        className={`relative z-10 mx-auto w-full max-w-lg ${isRTL ? "text-right" : "text-left"}`}
      >
        <h1 className="text-center text-4xl font-black leading-tight text-white">
          {language === "fa" ? "پنل مدرس" : "Teacher Portal"}{" "}
          <span className="bg-gradient-to-l from-[#00B8A9] to-[#0B4FD8] bg-clip-text text-transparent">
            EduTech
          </span>
        </h1>
        <p className="mt-4 text-center text-lg font-medium text-slate-300">
          {language === "fa"
            ? "مدیریت کورس‌ها، شاگردان، صنف‌های آنلاین و تکالیف در یک مکان"
            : "Manage courses, students, live classes, and assignments in one place"}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4">
          {features.map((item) => (
            <div
              key={item.titleFa}
              className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:bg-white/10"
            >
              <div className="mb-3 inline-flex rounded-lg bg-white/10 p-2 text-[#00B8A9]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black text-white">
                {language === "fa" ? item.titleFa : item.titleEn}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {language === "fa" ? item.textFa : item.textEn}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-300">
            {language === "fa" ? "پنل مدرس" : "Teacher Panel"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-300">
            Google Meet
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-300">
            {language === "fa" ? "مدیریت آموزش" : "Education Management"}
          </span>
        </div>
      </div>
    </div>
  );
}
