import { MessageCircle, Code, Palette, Calendar } from "lucide-react";

export default function WeeklyTimetable({ classes, onClassClick, language = "fa" }) {
  const isFa = language === "fa";
  const days = [
    "Saturday",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];
  const dayLabels = {
    Saturday: isFa ? "شنبه" : "Saturday",
    Sunday: isFa ? "یکشنبه" : "Sunday",
    Monday: isFa ? "دوشنبه" : "Monday",
    Tuesday: isFa ? "سه‌شنبه" : "Tuesday",
    Wednesday: isFa ? "چهارشنبه" : "Wednesday",
    Thursday: isFa ? "پنجشنبه" : "Thursday",
    Friday: isFa ? "جمعه" : "Friday",
  };
  const times = Array.from(
    new Set(
      (Array.isArray(classes) ? classes : [])
        .map((item) => String(item?.time || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => {
    const aStart = (a.match(/(\d{1,2}):(\d{2})/) || []).slice(1);
    const bStart = (b.match(/(\d{1,2}):(\d{2})/) || []).slice(1);
    const aMinutes = aStart.length ? Number(aStart[0]) * 60 + Number(aStart[1]) : Number.POSITIVE_INFINITY;
    const bMinutes = bStart.length ? Number(bStart[0]) * 60 + Number(bStart[1]) : Number.POSITIVE_INFINITY;
    return aMinutes - bMinutes;
  });

  const getTypeStyles = (type) => {
    switch (type) {
      case "english":
        return {
          bg: "bg-primary-50",
          border: "border-primary-200",
          text: "text-primary-700",
          Icon: MessageCircle,
        };
      case "mern":
        return {
          bg: "bg-teal-50",
          border: "border-teal-200",
          text: "text-teal-700",
          Icon: Code,
        };
      case "design":
        return {
          bg: "bg-purple-50",
          border: "border-purple-200",
          text: "text-purple-700",
          Icon: Palette,
        };
      default:
        return {
          bg: "bg-sky-50",
          border: "border-sky-200",
          text: "text-sky-700",
          Icon: Calendar,
        };
    }
  };

  return (
    <div className="flex h-[430px] flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Calendar size={24} />
        </div>
        <h2 className="text-xl font-black text-slate-950">
          {isFa ? "برنامه هفتگی" : "Weekly Timetable"}
        </h2>
      </div>

      {!times.length ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
          {isFa ? "هنوز برنامه هفتگی ثبت نشده است." : "No weekly timetable yet."}
        </div>
      ) : null}

      {times.length ? (
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 scrollbar-hide">
            <div className="min-w-[800px] overflow-hidden rounded-xl border border-slate-100">
              {/* Header Row */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50">
                <div className="border-e border-slate-100 p-4 text-center text-xs font-bold text-slate-400">
                  {isFa ? "ساعت" : "Time"}
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    className="last:border-e-0 border-e border-slate-100 p-4 text-center text-sm font-black text-slate-700"
                  >
                    {dayLabels[day]}
                  </div>
                ))}
              </div>

              {/* Time Rows */}
              {times.map((timeLabel, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center justify-center border-e border-slate-100 bg-slate-50/50 p-4 text-xs font-bold text-slate-500">
                    {timeLabel.split(" - ")[0]}
                  </div>

                  {days.map((day) => {
                    const classInSlot = classes.find(
                      (c) => c.day === day && c.time === timeLabel,
                    );

                    return (
                      <div
                        key={`${day}-${timeLabel}`}
                        className="last:border-e-0 flex min-h-[110px] items-stretch border-e border-slate-100 p-2"
                      >
                        {classInSlot ? (
                          <button
                            onClick={() => onClassClick(classInSlot)}
                            className={`w-full flex flex-col justify-between rounded-xl border p-3 text-start transition-transform hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${getTypeStyles(classInSlot.type).bg} ${getTypeStyles(classInSlot.type).border}`}
                          >
                            <div>
                              <div className="mb-2 flex items-center justify-between gap-1">
                                <span
                                  className={`rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-black ${getTypeStyles(classInSlot.type).text}`}
                                >
                                  {classInSlot.time.split(" - ")[0]}
                                </span>
                                {(() => {
                                  const Icon = getTypeStyles(classInSlot.type).Icon;
                                  return (
                                    <Icon
                                      size={14}
                                      className={
                                        getTypeStyles(classInSlot.type).text
                                      }
                                    />
                                  );
                                })()}
                              </div>
                              {classInSlot.teacherTime &&
                              classInSlot.teacherTime !== classInSlot.time ? (
                                <p className="mb-1 text-[9px] font-bold text-slate-500">
                                  {isFa ? "استاد: " : "Teacher: "}
                                  {classInSlot.teacherTime}
                                </p>
                              ) : null}
                              <h4
                                className={`text-xs font-black leading-tight ${getTypeStyles(classInSlot.type).text}`}
                              >
                                {classInSlot.course}
                              </h4>
                            </div>
                            <p
                              className={`mt-2 text-[10px] font-bold opacity-80 ${getTypeStyles(classInSlot.type).text}`}
                            >
                              {classInSlot.teacher}
                            </p>
                          </button>
                        ) : (
                          <div className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
