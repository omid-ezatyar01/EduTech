import { DateTime } from "luxon";
import ApiError from "../utils/ApiError.js";

const DAY_INDEX = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

const parseTime = (timeValue = "") => {
  const text = String(timeValue || "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) {
    throw new ApiError(400, "startTime must be in HH:mm format");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ApiError(400, "startTime is invalid");
  }

  return { hour, minute };
};

const normalizeDaySet = (days = []) => {
  const normalized = (Array.isArray(days) ? days : []).map((item) =>
    String(item || "").trim().toUpperCase(),
  );

  if (!normalized.length) {
    throw new ApiError(400, "daysOfWeek cannot be empty");
  }

  const dayIndices = new Set();
  normalized.forEach((day) => {
    const idx = DAY_INDEX[day];
    if (!idx) {
      throw new ApiError(400, `Invalid dayOfWeek: ${day}`);
    }
    dayIndices.add(idx);
  });

  return dayIndices;
};

const generateForMonth = ({ month, dayIndices, hour, minute, durationMinutes, timezone }) => {
  const monthValue = String(month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthValue)) {
    throw new ApiError(400, "month must be in YYYY-MM format");
  }

  const monthStart = DateTime.fromISO(`${monthValue}-01T00:00:00`, { zone: timezone });
  if (!monthStart.isValid) {
    throw new ApiError(400, "month is invalid");
  }

  const monthEnd = monthStart.endOf("month");
  const sessions = [];

  for (let cursor = monthStart.startOf("day"); cursor <= monthEnd; cursor = cursor.plus({ days: 1 })) {
    if (!dayIndices.has(cursor.weekday)) continue;

    const start = cursor.set({ hour, minute, second: 0, millisecond: 0 });
    const end = start.plus({ minutes: durationMinutes });

    sessions.push({
      startAt: start.toUTC().toJSDate(),
      endAt: end.toUTC().toJSDate(),
      localStartAt: start.toISO(),
      localEndAt: end.toISO(),
    });
  }

  return sessions;
};

const generateForRange = ({
  startDate,
  rangeDays,
  dayIndices,
  hour,
  minute,
  durationMinutes,
  timezone,
}) => {
  const base = startDate
    ? DateTime.fromISO(String(startDate), { zone: timezone })
    : DateTime.now().setZone(timezone);

  if (!base.isValid) {
    throw new ApiError(400, "startDate is invalid");
  }

  if (!Number.isFinite(rangeDays) || rangeDays < 1 || rangeDays > 180) {
    throw new ApiError(400, "rangeDays must be between 1 and 180");
  }

  const startOfDay = base.startOf("day");
  const end = startOfDay.plus({ days: rangeDays - 1 }).endOf("day");

  const sessions = [];
  for (let cursor = startOfDay; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    if (!dayIndices.has(cursor.weekday)) continue;

    const start = cursor.set({ hour, minute, second: 0, millisecond: 0 });
    const finish = start.plus({ minutes: durationMinutes });

    sessions.push({
      startAt: start.toUTC().toJSDate(),
      endAt: finish.toUTC().toJSDate(),
      localStartAt: start.toISO(),
      localEndAt: finish.toISO(),
    });
  }

  return sessions;
};

export const generateDatesForMonth = ({
  month,
  daysOfWeek,
  startTime,
  durationMinutes,
  timezone,
  rangeDays,
  startDate,
}) => {
  const normalizedTimezone = String(timezone || process.env.APP_TIMEZONE || "Asia/Kabul");
  const dayIndices = normalizeDaySet(daysOfWeek);
  const { hour, minute } = parseTime(startTime);

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 720) {
    throw new ApiError(400, "durationMinutes must be between 1 and 720");
  }

  if (Number.isFinite(Number(rangeDays)) && Number(rangeDays) > 0) {
    return generateForRange({
      startDate,
      rangeDays: Number(rangeDays),
      dayIndices,
      hour,
      minute,
      durationMinutes: duration,
      timezone: normalizedTimezone,
    });
  }

  return generateForMonth({
    month,
    dayIndices,
    hour,
    minute,
    durationMinutes: duration,
    timezone: normalizedTimezone,
  });
};
