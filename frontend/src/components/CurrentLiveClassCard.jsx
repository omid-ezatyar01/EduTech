import {
  Video,
  Clock,
  CalendarDays,
  MonitorPlay,
  CheckCircle2,
} from "lucide-react";

export default function CurrentLiveClassCard({ course, onJoin, language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    statusMessageFallback: isFa
      ? "لینک صنف هنوز فعال نشده است"
      : "The class link is not active yet",
    todayTopic: isFa ? "موضوع امروز" : "Today's topic",
    time: isFa ? "زمان" : "Time",
    date: isFa ? "تاریخ" : "Date",
    platform: isFa ? "پلتفرم" : "Platform",
    teacher: isFa ? "استاد" : "Teacher",
    join: isFa ? "ورود به صنف" : "Join the class",
    linkActive: isFa ? "لینک صنف فعال است" : "Class link is active",
  };
  const canJoin = Boolean(course.joinEnabled);
  const statusMessage = course.linkMessage || t.statusMessageFallback;

  return (
    <div className="flex flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      {/* Banner Area */}
      <div className="relative flex min-h-[140px] flex-col items-start justify-center bg-slate-900 p-6 text-white overflow-hidden sm:min-h-[160px] sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-600 opacity-50 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-teal-500 opacity-40 blur-3xl" />

        <span className="relative z-10 mb-4 inline-flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-black text-green-300 border border-green-500/30 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {course.statusLabel}
        </span>

        <h2 className="relative z-10 text-2xl font-black sm:text-3xl">
          {course.courseTitle}
        </h2>
        <p className="relative z-10 mt-2 text-sm font-semibold text-slate-300">
          {t.todayTopic}:{" "}
          <span className="font-bold text-white">{course.topic}</span>
        </p>
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.time}</p>
              <p className="font-black text-slate-900">{course.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm">
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.date}</p>
              <p className="font-black text-slate-900">{course.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-teal-600 shadow-sm">
              <MonitorPlay size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">{t.platform}</p>
              <p className="font-black text-slate-900">{course.platform}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            {course.teacherAvatar ? (
              <img
                src={course.teacherAvatar}
                alt={course.teacher}
                className="h-10 w-10 rounded-lg object-cover shadow-sm"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-200 text-xs font-black text-slate-700 shadow-sm">
                {(course.teacher || "T").trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-slate-500">{t.teacher}</p>
              <p className="font-black text-slate-900">{course.teacher}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8">
          <button
            type="button"
            disabled={!canJoin}
            onClick={() => {
              if (!canJoin) return;
              onJoin?.(course);
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-black transition-all ${
              canJoin
                ? "bg-gradient-to-r from-primary-600 to-teal-500 text-white shadow-[0_10px_30px_rgba(11,79,216,0.2)] hover:opacity-90 hover:-translate-y-0.5"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            <Video size={20} />
            {t.join}
          </button>
          <p
            className={`mt-4 flex items-center justify-center gap-1.5 text-xs font-bold ${canJoin ? "text-green-600" : "text-slate-500"}`}
          >
            <CheckCircle2 size={15} />{" "}
            {canJoin ? t.linkActive : statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
