import { CalendarDays } from "lucide-react";
import { useMemo } from "react";
import {
  getCourseTodayParts,
  isAllowedCourseStartDate,
  parseCourseDateValue,
  toCourseDateKey,
} from "../../utils/courseStartDate";

const START_DATE_DAYS = [1, 15];

const parseMonthOptionValue = (value = "") => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
};

const buildMonthOptions = (selectedValue = "", language = "fa", timeZone = "") => {
  const today = getCourseTodayParts(timeZone);
  const selectedDate = parseCourseDateValue(selectedValue);
  const currentYear = today.year;
  const options = [];
  const seen = new Set();
  const formatterLocale = language === "fa" ? "fa-AF-u-ca-gregory" : "en-US";

  const addMonth = (year, month) => {
    const date = new Date(Date.UTC(year, month - 1, 1));
    const value = `${year}-${String(month).padStart(2, "0")}`;
    if (seen.has(value)) return;
    seen.add(value);
    options.push({
      value,
      label: date.toLocaleDateString(formatterLocale, {
        year: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
    });
  };

  if (
    selectedDate &&
    isAllowedCourseStartDate(selectedValue, timeZone) &&
    selectedDate.year === currentYear
  ) {
    addMonth(selectedDate.year, selectedDate.month);
  }

  for (let month = today.month; month <= 12; month += 1) {
    const hasAvailableDay = START_DATE_DAYS.some((day) => {
      const candidate = { year: currentYear, month, day };
      return toCourseDateKey(candidate) >= toCourseDateKey(today);
    });
    if (hasAvailableDay) addMonth(currentYear, month);
  }

  return options;
};

const formatFullDate = (value, language) => {
  const parts = parseCourseDateValue(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.toLocaleDateString(language === "fa" ? "fa-AF-u-ca-gregory" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

export default function CourseStartDatePicker({
  value = "",
  onChange,
  language = "fa",
  timeZone = "",
  disabled = false,
}) {
  const monthOptions = useMemo(
    () => buildMonthOptions(value, language, timeZone),
    [language, timeZone, value],
  );
  const selectedDate = parseCourseDateValue(value);
  const selectedMonthValue =
    selectedDate && isAllowedCourseStartDate(value, timeZone)
      ? `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}`
      : monthOptions[0]?.value || "";
  const selectedDay = selectedDate?.day || null;
  const today = getCourseTodayParts(timeZone);
  const isFa = language === "fa";

  const setMonth = (monthValue) => {
    const month = parseMonthOptionValue(monthValue);
    if (!month) {
      onChange("");
      return;
    }

    const preferredDay = START_DATE_DAYS.includes(selectedDay) ? selectedDay : START_DATE_DAYS[0];
    const nextDay =
      START_DATE_DAYS.find((day) => {
        const candidate = { year: month.year, month: month.month, day };
        return day === preferredDay && toCourseDateKey(candidate) >= toCourseDateKey(today);
      }) ||
      START_DATE_DAYS.find((day) => {
        const candidate = { year: month.year, month: month.month, day };
        return toCourseDateKey(candidate) >= toCourseDateKey(today);
      }) ||
      START_DATE_DAYS[START_DATE_DAYS.length - 1];

    onChange(
      `${month.year}-${String(month.month).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
    );
  };

  const setDay = (day) => {
    const month = parseMonthOptionValue(selectedMonthValue);
    if (!month) return;
    onChange(
      `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  };

  const selectedLabel = formatFullDate(value, language);

  return (
    <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 sm:col-span-2">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0B4FD8] shadow-sm">
          <CalendarDays size={18} />
        </span>
        <div className="min-w-0">
          <label className="block text-xs font-black text-[#1D4ED8]">
            {isFa ? "تاریخ شروع کورس" : "Course start date"}
          </label>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
            {isFa
              ? "ماه را انتخاب کنید، سپس فقط یکی از دو روز مجاز را بزنید."
              : "Choose a month, then select one of the two allowed start days."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={selectedMonthValue}
          onChange={(event) => setMonth(event.target.value)}
          disabled={disabled}
          className="h-11 w-full rounded-xl border border-[#BFDBFE] bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#0B4FD8] focus:ring-2 focus:ring-[#0B4FD8]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          required
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2 sm:w-48">
          {START_DATE_DAYS.map((day) => {
            const month = parseMonthOptionValue(selectedMonthValue);
            const candidate = month ? { year: month.year, month: month.month, day } : null;
            const candidateValue = candidate
              ? `${candidate.year}-${String(candidate.month).padStart(2, "0")}-${String(candidate.day).padStart(2, "0")}`
              : "";
            const isSelected = value === candidateValue;
            const isPast =
              candidate &&
              toCourseDateKey(candidate) < toCourseDateKey(today) &&
              !isSelected;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setDay(day)}
                disabled={disabled || isPast || !month}
                className={`h-11 rounded-xl border text-sm font-black transition ${
                  isSelected
                    ? "border-[#0B4FD8] bg-[#0B4FD8] text-white shadow-[0_10px_24px_rgba(11,79,216,0.24)]"
                    : "border-[#BFDBFE] bg-white text-[#0B4FD8] hover:border-[#0B4FD8] hover:bg-[#DBEAFE]"
                } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none`}
              >
                {String(day)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 min-h-6 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-slate-600">
        {selectedLabel
          ? isFa
            ? `انتخاب شده: ${selectedLabel}`
            : `Selected: ${selectedLabel}`
          : isFa
            ? "شروع کورس فقط در روز اول یا پانزدهم هر ماه مجاز است."
            : "Courses can start only on the 1st or 15th of each month."}
      </div>
    </div>
  );
}
