import { useMemo } from "react";
import {
  formatTimeZoneOffset,
  getBrowserTimeZone,
  getCountryTimeZoneGroups,
} from "../../utils/timezone";

export default function CourseTimeZonePicker({
  value,
  onChange,
  language = "fa",
  disabled = false,
}) {
  const baseGroups = useMemo(() => getCountryTimeZoneGroups(language), [language]);
  const groups = useMemo(
    () =>
      value && !baseGroups.some((group) => group.timezones.includes(value))
        ? [
            {
              code: "CURRENT",
              label: language === "fa" ? "منطقه زمانی فعلی کورس" : "Current course timezone",
              timezones: [value],
            },
            ...baseGroups,
          ]
        : baseGroups,
    [baseGroups, language, value],
  );
  const selectedGroup =
    groups.find((group) => group.timezones.includes(value)) ||
    groups.find((group) => group.timezones.includes(getBrowserTimeZone())) ||
    groups[0];
  const timezones = selectedGroup?.timezones || [];

  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-600">
        {language === "fa" ? "کشور و منطقه زمانی کورس" : "Course country and timezone"}
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={selectedGroup?.code || ""}
          onChange={(event) => {
            const nextGroup = groups.find(
              (group) => group.code === event.target.value,
            );
            if (nextGroup?.timezones?.[0]) onChange(nextGroup.timezones[0]);
          }}
          disabled={disabled}
          className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500"
        >
          {groups.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <select
          value={timezones.includes(value) ? value : timezones[0] || ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || !timezones.length}
          className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500"
          dir="ltr"
        >
          {timezones.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {formatTimeZoneOffset(timeZone, language)}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
        {language === "fa"
          ? `وقت پروفایل/دستگاه شما: ${formatTimeZoneOffset(getBrowserTimeZone(), language)}. شاگرد وقت استاد و وقت محل خود را هر دو می‌بیند.`
          : `Your profile/device time: ${formatTimeZoneOffset(getBrowserTimeZone(), language)}. Students see both teacher and local time.`}
      </p>
    </div>
  );
}
