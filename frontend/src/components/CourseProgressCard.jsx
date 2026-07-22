import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export default function CourseProgressCard({ course, language = "fa" }) {
  const isActive = course.status === "active";
  const isCompleted = course.status === "completed";
  const isPending = !isActive && !isCompleted;
  const Arrow = language === "fa" ? ArrowLeft : ArrowRight;
  const statusClass = isActive
    ? "bg-teal-50 text-teal-700"
    : isCompleted
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  const statusLabel = isActive
    ? language === "fa"
      ? "فعال"
      : "Active"
    : isCompleted
      ? language === "fa"
        ? "تکمیل شده"
        : "Completed"
      : language === "fa"
        ? "در انتظار تایید"
        : "Pending";

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] transition hover:border-primary-100 hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <h3 className="text-lg font-black text-slate-900">{course.title}</h3>
      <p className="mt-1 text-sm font-bold text-slate-500">
        {language === "fa" ? "استاد" : "Teacher"}: {course.teacher}
      </p>

      <div className="mb-5 mt-5 flex-1">
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <span className="text-slate-700">
            {language === "fa" ? "پیشرفت کورس" : "Course Progress"}
          </span>
          <span className="text-primary-600">{course.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-1000"
            style={{ width: `${course.progress}%` }}
          />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          <Clock size={16} className="text-slate-400" />
          <span>
            {isPending
              ? language === "fa"
                ? "وضعیت: "
                : "Status: "
              : isCompleted
                ? language === "fa"
                  ? "وضعیت کورس: "
                  : "Course status: "
                : language === "fa"
                  ? "جلسه بعدی: "
                  : "Next Session: "}
            {course.nextClass}
          </span>
        </div>
      </div>
      <Link
        to={course.courseLink || "/student/courses"}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-4 text-xs font-black text-primary-700 transition hover:border-primary-200 hover:bg-primary-100"
      >
        {isCompleted
          ? language === "fa" ? "مشاهده کورس" : "View course"
          : language === "fa" ? "ادامه یادگیری" : "Continue learning"}
        <Arrow size={15} />
      </Link>
    </div>
  );
}
