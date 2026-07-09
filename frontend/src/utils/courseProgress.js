const DAY_INDEX_BY_KEY = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  یکشنبه: 0,
  دوشنبه: 1,
  "سه شنبه": 2,
  "سه‌شنبه": 2,
  چهارشنبه: 3,
  "چهار شنبه": 3,
  پنجشنبه: 4,
  "پنج شنبه": 4,
  جمعه: 5,
  شنبه: 6,
  sunday_en: 0,
  monday_en: 1,
  tuesday_en: 2,
  wednesday_en: 3,
  thursday_en: 4,
  friday_en: 5,
  saturday_en: 6,
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeLocalizedDigits = (value) =>
  String(value || "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const normalizePersianText = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ");

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDayKey = (value) => {
  const raw = normalizePersianText(value);
  if (!raw) return "";
  return raw;
};

const dayToIndex = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, raw)) {
    return DAY_INDEX_BY_KEY[raw];
  }

  const normalized = normalizeDayKey(raw);
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, normalized)) {
    return DAY_INDEX_BY_KEY[normalized];
  }

  const compact = normalized.replace(/\s+/g, "");
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, compact)) {
    return DAY_INDEX_BY_KEY[compact];
  }

  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, upper)) {
    return DAY_INDEX_BY_KEY[upper];
  }

  return null;
};

const parseTimeToMinutes = (value) => {
  const match = normalizeLocalizedDigits(value)
    .trim()
    .replace(/\s+/g, " ")
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?(AM|PM|am|pm))?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const clampCourseProgressPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const resolveTimeline = (course = {}, scheduleRows = []) => {
  const startAt = parseDate(course?.startDate);
  if (!startAt) return null;

  const firstRow = scheduleRows[0] || {};
  const fallbackEndMinutes = parseTimeToMinutes(firstRow?.endTime) ?? 60;
  const weeks = Number(course?.durationWeeks || 0);

  if (Number.isFinite(weeks) && weeks > 0) {
    const end = new Date(startAt);
    end.setDate(end.getDate() + Math.max(1, Math.round(weeks)) * 7 - 1);
    const endMinutes = parseTimeToMinutes(firstRow?.endTime) ?? fallbackEndMinutes;
    const endHoursPart = Math.floor(endMinutes / 60);
    const endMinutesPart = endMinutes % 60;
    end.setHours(endHoursPart, endMinutesPart, 59, 999);
    return { startAt, endAt: end };
  }

  const explicitEndDate = parseDate(course?.endDate);
  if (!explicitEndDate) return null;
  return { startAt, endAt: explicitEndDate };
};

const countLessonsInRange = ({
  startAt,
  endAt,
  dayMap,
  capAt = null,
}) => {
  if (!startAt || !endAt || !dayMap.size) return 0;
  if (endAt < startAt) return 0;

  const rangeStart = startOfDay(startAt);
  const rangeEnd = startOfDay(endAt);
  let count = 0;

  for (
    let cursor = new Date(rangeStart);
    cursor.getTime() <= rangeEnd.getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const dayIndex = cursor.getDay();
    if (!dayMap.has(dayIndex)) continue;

    const endMinutes = dayMap.get(dayIndex);
    const lessonEnd = new Date(cursor);
    const safeMinutes = Number.isFinite(endMinutes) ? endMinutes : 23 * 60 + 59;
    lessonEnd.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 59, 999);

    if (lessonEnd < startAt) continue;
    if (lessonEnd > endAt) continue;
    if (capAt && lessonEnd > capAt) continue;
    count += 1;
  }

  return count;
};

export const calculateCourseProgressSnapshot = (course = {}, nowValue = new Date()) => {
  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  if (!scheduleRows.length) return null;

  const dayMap = new Map();
  scheduleRows.forEach((row) => {
    const dayIndex = dayToIndex(row?.day);
    if (dayIndex === null) return;
    const endMinutes = parseTimeToMinutes(row?.endTime);
    dayMap.set(dayIndex, endMinutes ?? 23 * 60 + 59);
  });

  if (!dayMap.size) return null;

  const timeline = resolveTimeline(course, scheduleRows);
  if (!timeline) return null;

  const { startAt, endAt } = timeline;
  const now = parseDate(nowValue) || new Date();

  const exactTotal = Number(course?.totalSessions || 0);
  const calculatedTotal = countLessonsInRange({ startAt, endAt, dayMap });
  const totalLessons =
    Number.isInteger(exactTotal) && exactTotal > 0
      ? Math.min(exactTotal, calculatedTotal)
      : calculatedTotal;
  if (totalLessons <= 0) return null;

  const completedLessons = Math.min(totalLessons, countLessonsInRange({
    startAt,
    endAt,
    dayMap,
    capAt: now,
  }));

  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((completedLessons / totalLessons) * 100)),
  );

  return {
    progressPercent,
    totalLessons,
    completedLessons,
    startAt,
    endAt,
  };
};

export const calculateCourseProgressPercent = (course = {}, fallback = null) => {
  const snapshot = calculateCourseProgressSnapshot(course);
  if (!snapshot) return fallback;
  return snapshot.progressPercent;
};

export const resolveEnrollmentProgressPercent = (
  enrollment = {},
  course = {},
  fallback = null,
) => {
  const directProgress = [
    enrollment?.progressPercent,
    enrollment?.progress,
    enrollment?.completionPercent,
    enrollment?.completionRate,
    course?.progressPercent,
    course?.progress,
  ];

  for (const candidate of directProgress) {
    const normalized = clampCourseProgressPercent(candidate);
    if (normalized !== null) return normalized;
  }

  const computedProgress = clampCourseProgressPercent(
    calculateCourseProgressPercent(course, null),
  );
  return computedProgress ?? fallback;
};

export const resolveStudentCourseProgressPercent = (
  enrollment = {},
  course = {},
  fallback = 0,
) => {
  const status = String(enrollment?.enrollmentStatus || "").toLowerCase();
  if (status === "completed") return 100;
  if (status === "cancelled" || status === "pending") return 0;

  const progress = resolveEnrollmentProgressPercent(enrollment, course, null);
  return progress ?? fallback;
};
