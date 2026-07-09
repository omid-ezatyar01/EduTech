import { ChevronLeft } from "lucide-react";

export default function MyCoursesCard({ courses }) {
  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950">کورس‌های من</h2>
      </div>

      <div className="flex flex-col gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="rounded-xl border border-slate-100 p-4 transition hover:border-primary-100 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">{course.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500">
                  <img
                    src={`https://ui-avatars.com/api/?name=${course.teacher}&background=random`}
                    alt={course.teacher}
                    className="h-5 w-5 rounded-full"
                  />
                  {course.teacher}
                </div>
              </div>
              {course.status === "فعال" ? (
                <span className="text-xs font-black text-primary-600">
                  {course.progress}%
                </span>
              ) : (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                  {course.status}
                </span>
              )}
            </div>

            {course.status === "فعال" && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-teal-400"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600">
                {course.status === "فعال"
                  ? `صنف بعدی: ${course.nextClass}`
                  : "در انتظار تایید مدیریت"}
              </p>
              <button className="flex items-center text-xs font-black text-primary-600 hover:text-primary-700 transition">
                {course.status === "فعال" ? "داشبورد کورس" : "جزئیات ثبت‌نام"}
                <ChevronLeft size={14} className="ms-1" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
