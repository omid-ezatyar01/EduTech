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

export const getDualTimeDetails = (
  startValue,
  endValue,
  teacherTimeZone,
  language = "fa",
) => {
  const teacherZone = isValidTimeZone(teacherTimeZone)
    ? teacherTimeZone
    : DEFAULT_TIME_ZONE;
  const localZone = getBrowserTimeZone();
  return {
    teacherZone,
    localZone,
    teacherDate: formatDateTimeInZone(startValue, teacherZone, language),
    localDate: formatDateTimeInZone(startValue, localZone, language),
    teacherRange: endValue
      ? formatTimeRangeInZone(startValue, endValue, teacherZone, language)
      : "",
    localRange: endValue
      ? formatTimeRangeInZone(startValue, endValue, localZone, language)
      : "",
  };
};
