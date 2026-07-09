import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const JS_DAY_TO_KEY = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export default function MonthlyCalendarCard({ classDays = [], language = "fa" }) {
  const isFa = language === "fa";
  const daysOfWeek = isFa
    ? ["ش", "ی", "د", "س", "چ", "پ", "ج"]
    : ["S", "M", "T", "W", "T", "F", "S"];
  const [monthOffset, setMonthOffset] = useState(0);

  const currentMonthDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(isFa ? "fa-AF-u-ca-persian" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(currentMonthDate);
  }, [currentMonthDate, isFa]);

  const classDaySet = useMemo(
    () => new Set((Array.isArray(classDays) ? classDays : []).filter(Boolean)),
    [classDays],
  );

  const { emptyCount, monthDays } = useMemo(() => {
    const firstDay = startOfMonth(currentMonthDate);
    const startOffset = isFa ? (firstDay.getDay() + 1) % 7 : firstDay.getDay();
    const totalDays = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() + 1,
      0,
    ).getDate();

    const rows = Array.from({ length: totalDays }, (_, i) => {
      const dayNumber = i + 1;
      const dayDate = new Date(
        currentMonthDate.getFullYear(),
        currentMonthDate.getMonth(),
        dayNumber,
      );
      const dayLabel = JS_DAY_TO_KEY[dayDate.getDay()] || "";
      return {
        dayNumber,
        dayLabel,
      };
    });

    return {
      emptyCount: startOffset,
      monthDays: rows,
    };
  }, [currentMonthDate, isFa]);

  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === currentMonthDate.getFullYear() &&
    now.getMonth() === currentMonthDate.getMonth();

  return (
    <div className="flex h-[430px] flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-black text-slate-950">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setMonthOffset((prev) => prev - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setMonthOffset((prev) => prev + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-7 gap-x-1 gap-y-4 overflow-hidden text-center text-sm">
        {daysOfWeek.map((day, i) => (
          <div key={i} className="text-xs font-bold text-slate-400">
            {day}
          </div>
        ))}

        {Array.from({ length: emptyCount }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {monthDays.map((item) => {
          const isToday = isCurrentMonth && item.dayNumber === now.getDate();
          const hasEvent = classDaySet.has(item.dayLabel);

          return (
            <div
              key={item.dayNumber}
              className="group flex h-10 cursor-pointer flex-col items-center justify-start"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                  isToday
                    ? "bg-primary-600 text-white shadow-md"
                    : "text-slate-700 group-hover:bg-slate-100"
                }`}
              >
                {item.dayNumber}
              </span>
              {hasEvent ? (
                <div className="mt-1 flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
