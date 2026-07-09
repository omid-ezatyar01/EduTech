import { formatProgressLabel } from "../../utils/courseProgress";

export default function TeacherCoursesCard({ courses = [], language }) {
  return (
    <section className="flex h-[360px] w-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0F172A]">
        {language === "fa" ? "کورس‌های من" : "My Courses"}
      </h3>

      {courses.length ? (
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pe-1">
          {courses.map((course) => (
            <div key={course.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <p className="font-bold text-slate-700">{course.title}</p>
                <p className="font-extrabold text-[#0B4FD8]" dir="ltr">
                  {course.progressLabel || formatProgressLabel(course.progress, language)}
                </p>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9]"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-slate-500">
          {language === "fa" ? "هیچ کورسی برای نمایش وجود ندارد." : "There are no courses to show yet."}
        </p>
      )}
    </section>
  );
}
