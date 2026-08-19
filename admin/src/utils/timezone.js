export const DEFAULT_TIME_ZONE = "Asia/Kabul";

const getTimeZoneParts = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const getTimeZoneOffsetMilliseconds = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) return 0;
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - date.getTime();
};

// datetime-local values have no timezone. Bootcamp administration always treats
// them as Kabul time, regardless of the administrator's device timezone.
export const formatDateTimeInputInZone = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = getTimeZoneParts(value, timeZone);
  if (!parts) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const dateTimeInputInZoneToIso = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0"] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let instant = localAsUtc;
  // Recalculate a few times so this remains correct for timezones with DST.
  for (let index = 0; index < 3; index += 1) {
    const nextInstant = localAsUtc - getTimeZoneOffsetMilliseconds(new Date(instant), timeZone);
    if (nextInstant === instant) break;
    instant = nextInstant;
  }
  return new Date(instant).toISOString();
};

export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

export const formatDateTimeInZone = (
  value,
  timeZone,
  language = "en",
) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  let zone = timeZone || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(date);
  } catch {
    zone = DEFAULT_TIME_ZONE;
  }
  return new Intl.DateTimeFormat(language === "fa" ? "fa-AF" : "en-US", {
    timeZone: zone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
