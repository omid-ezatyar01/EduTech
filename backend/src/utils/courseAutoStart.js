import Course from "../models/Course.js";

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
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const normalizeLocalizedDigits = (value = "") =>
  String(value)
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const normalizePersianText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ");

const dayToIndex = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, raw)) return DAY_INDEX_BY_KEY[raw];

  const normalized = normalizePersianText(raw);
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, normalized)) {
    return DAY_INDEX_BY_KEY[normalized];
  }

  const compact = normalized.replace(/\s+/g, "");
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, compact)) {
    return DAY_INDEX_BY_KEY[compact];
  }

  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DAY_INDEX_BY_KEY, upper)) return DAY_INDEX_BY_KEY[upper];
  return null;
};

const parseTimeToParts = (value = "") => {
  const match = normalizeLocalizedDigits(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
};

export const resolveCourseScheduledStartAt = (course = {}) => {
  const startDate = course?.startDate ? new Date(course.startDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;

  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  const matchingRows = scheduleRows
    .filter((row) => dayToIndex(row?.day) === startDate.getDay())
    .map((row) => ({ row, parts: parseTimeToParts(row?.startTime) }))
    .filter((item) => item.parts);

  if (!matchingRows.length) {
    return startDate;
  }

  matchingRows.sort((left, right) =>
    (left.parts.hours * 60 + left.parts.minutes) - (right.parts.hours * 60 + right.parts.minutes),
  );

  const scheduledStartAt = new Date(startDate);
  scheduledStartAt.setHours(
    matchingRows[0].parts.hours,
    matchingRows[0].parts.minutes,
    0,
    0,
  );
  return scheduledStartAt;
};

export const shouldAutoStartCourse = (course = {}, options = {}) => {
  if (!course) return false;
  if (course.classStartedAt || course.classEndedAt || course.classCancelledAt) return false;
  if (String(course.status || "") !== "published" || course.isPublished !== true) return false;

  const scheduledStartAt = resolveCourseScheduledStartAt(course);
  if (!scheduledStartAt) return false;

  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime()) || now < scheduledStartAt) return false;

  const minimumStudentsToStart = Math.max(1, Number(course.minimumStudentsToStart || 1));
  const enrolledStudentsCount = Math.max(
    0,
    Number(options.activeStudentsCount ?? course.enrolledStudentsCount ?? 0),
  );

  return enrolledStudentsCount >= minimumStudentsToStart;
};

export const ensureCourseAutoStarted = async (course = null, options = {}) => {
  if (!course || !shouldAutoStartCourse(course, options)) {
    return course;
  }

  const startedAt = options.now ? new Date(options.now) : new Date();
  const courseId = course?._id || course?.id;
  if (!courseId) return course;

  await Course.findOneAndUpdate(
    {
      _id: courseId,
      classStartedAt: null,
      classEndedAt: null,
      classCancelledAt: null,
      status: "published",
      isPublished: true,
    },
    {
      $set: {
        classStartedAt: startedAt,
      },
    },
    options.session ? { session: options.session } : undefined,
  );

  course.classStartedAt = startedAt;
  return course;
};
