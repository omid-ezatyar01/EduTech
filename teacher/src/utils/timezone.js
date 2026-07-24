import countryTimezones from "../data/countryTimezones.generated.json";

export const DEFAULT_TIME_ZONE = "Asia/Kabul";

export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

export const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return Boolean(timeZone);
  } catch {
    return false;
  }
};

export const getCountryTimeZoneGroups = (language = "fa") =>
  [
    {
      code: "ZZ",
      label: language === "fa" ? "زمان هماهنگ جهانی" : "Universal time",
      timezones: ["UTC"],
    },
    ...countryTimezones.map((country) => ({
      code: country.code,
      label: language === "fa" ? country.nameFa || country.nameEn : country.nameEn,
      timezones: country.timezones,
    })),
  ];

const getZonedParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const zonedDateTimeToUtc = (dateValue, timeValue, timeZone = DEFAULT_TIME_ZONE) => {
  const dateMatch = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timeValue || "").match(/^(\d{2}):(\d{2})$/);
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  if (!dateMatch || !timeMatch) return null;

  const desiredUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  let instant = desiredUtc;

  // Two passes account for offsets that change across daylight-saving boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = getZonedParts(new Date(instant), zone);
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant += desiredUtc - representedUtc;
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
};

export const addDaysToDateValue = (dateValue, days) => {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

export const formatTimeZoneOffset = (timeZone, language = "fa", at = new Date()) => {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  try {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value;
    const localizedOffset = language === "fa"
      ? String(offset || "").replace("GMT", "UTC")
      : offset;
    return localizedOffset ? `${zone} (${localizedOffset})` : zone;
  } catch {
    return zone;
  }
};

export const formatDateTimeInZone = (
  value,
  timeZone,
  language = "fa",
  options = {},
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const zone = isValidTimeZone(timeZone) ? timeZone : getBrowserTimeZone();
  return new Intl.DateTimeFormat(language === "fa" ? "fa-AF" : "en-US", {
    timeZone: zone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
};

export const formatTimeRangeInZone = (
  startValue,
  endValue,
  timeZone,
  language = "fa",
) => {
  const formatTime = (value) =>
    formatDateTimeInZone(value, timeZone, language, {
      year: undefined,
      month: undefined,
      day: undefined,
    });
  return `${formatTime(startValue)} – ${formatTime(endValue)}`;
};
