export const DEFAULT_TIME_ZONE = "Asia/Kabul";

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
