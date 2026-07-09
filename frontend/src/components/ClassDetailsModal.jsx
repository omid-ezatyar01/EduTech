import { X, CalendarDays, Clock, UserRound, BookOpen } from "lucide-react";

export default function ClassDetailsModal({
  isOpen,
  onClose,
  classData,
  language = "fa",
}) {
  const isFa = language === "fa";
  const dayLabels = {
    Saturday: isFa ? "شنبه" : "Saturday",
    Sunday: isFa ? "یکشنبه" : "Sunday",
    Monday: isFa ? "دوشنبه" : "Monday",
    Tuesday: isFa ? "سه‌شنبه" : "Tuesday",
    Wednesday: isFa ? "چهارشنبه" : "Wednesday",
    Thursday: isFa ? "پنجشنبه" : "Thursday",
    Friday: isFa ? "جمعه" : "Friday",
  };
  if (!isOpen || !classData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-black text-slate-950 mb-6">
          {isFa ? "جزئیات صنف" : "Class Details"}
        </h2>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <BookOpen size={20} className="text-primary-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-500">
                {isFa ? "کورس" : "Course"}
              </p>
              <p className="font-black text-slate-900">{classData.course}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <UserRound size={20} className="text-teal-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-500">
                {isFa ? "استاد" : "Teacher"}
              </p>
              <p className="font-black text-slate-900">{classData.teacher}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <CalendarDays size={18} className="text-purple-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-500">
                  {isFa ? "روز/تاریخ" : "Day/Date"}
                </p>
                <p className="font-bold text-slate-900 text-sm">
                  {dayLabels[classData.day || classData.date] ||
                    classData.day ||
                    classData.date}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-500">
                  {isFa ? "زمان" : "Time"}
                </p>
                <p className="font-bold text-slate-900 text-sm">
                  {classData.time}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
        >
          {isFa ? "بستن" : "Close"}
        </button>
      </div>
    </div>
  );
}
