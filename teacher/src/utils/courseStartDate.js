const START_DATE_DAYS = [1, 15];

export const parseCourseDateValue = (value = "") => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

export const getCourseTodayParts = (timeZone = "") => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      ...(timeZone ? { timeZone } : {}),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
    };
  } catch {
    return getCourseTodayParts("");
  }
};

export const toCourseDateKey = ({ year, month, day } = {}) =>
  Number(year) * 10_000 + Number(month) * 100 + Number(day);

export const isAllowedCourseStartDate = (value = "", timeZone = "") => {
  const selected = parseCourseDateValue(value);
  if (!selected || !START_DATE_DAYS.includes(selected.day)) return false;
  const today = getCourseTodayParts(timeZone);
  return (
    selected.year === today.year &&
    toCourseDateKey(selected) >= toCourseDateKey(today)
  );
};
