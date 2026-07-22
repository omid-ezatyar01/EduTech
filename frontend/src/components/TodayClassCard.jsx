import { Video, Clock, CheckCircle2 } from "lucide-react";

export default function TodayClassCard({ course, language = "fa" }) {
  if (!course) {
    return (
      <div className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-black text-slate-950">
          {language === "fa" ? "صنف آنلاین امروز" : "Today's Online Class"}
        </h2>
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400">
            <Video size={22} />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {language === "fa"
              ? "امروز برای شما صنف آنلاین برنامه‌ریزی نشده است."
              : "No online class is scheduled for today."}
          </p>
        </div>
      </div>
    );
  }

  const hasLink = !!course.meetLink;
  const topic = course.description
    ? String(course.description).slice(0, 100)
    : language === "fa"
      ? "موضوع جلسه از طرف استاد مشخص می‌شود."
      : "The topic will be provided by the instructor.";
  const scheduleText =
    course.nextClass ||
    (language === "fa" ? "زمان جلسه به‌زودی اعلام می‌شود." : "Session time will be announced soon.");

  return (
    <div className="flex flex-col h-full rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-black text-slate-950">
        {language === "fa" ? "صنف آنلاین امروز" : "Today's Online Class"}
      </h2>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <Video size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">{course.title}</h3>
          <p className="text-sm font-semibold text-slate-500">
            {language === "fa" ? "استاد" : "Teacher"}: {course.teacher}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-800">
          {language === "fa" ? "موضوع" : "Topic"}: {topic}
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600">
          <Clock size={16} className="text-slate-400" />
          {scheduleText}
          <span className="ms-2 inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-xs font-black text-teal-700">
            {hasLink
              ? language === "fa"
                ? "لینک فعال است"
                : "Link is active"
              : language === "fa"
                ? "هنوز شروع نشده"
                : "Not started yet"}
          </span>
        </div>
      </div>

      <div className="mt-auto">
        {hasLink ? <a href={course.meetLink} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-teal-500 py-3.5 text-sm font-black text-white shadow-md transition-all hover:opacity-90"><Video size={18} />{language === "fa" ? "ورود به Google Meet" : "Join Google Meet"}</a> : <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-400"><Video size={18} />{language === "fa" ? "هنوز قابل ورود نیست" : "Not available yet"}</button>}
        {hasLink && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-teal-600">
            <CheckCircle2 size={14} />
            {language === "fa" ? "لینک صنف فعال است" : "Class link is active"}
          </p>
        )}
      </div>
    </div>
  );
}
