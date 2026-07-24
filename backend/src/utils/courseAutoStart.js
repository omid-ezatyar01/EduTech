import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

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

  // Current course forms persist the exact scheduled instant. Only combine a
  // schedule time for legacy records that were saved at local midnight.
  if (
    startDate.getHours() !== 0 ||
    startDate.getMinutes() !== 0 ||
    startDate.getSeconds() !== 0
  ) {
    return startDate;
  }

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

// Kept as a compatibility export. Courses must now be started explicitly by
// their teacher, never by a read request or background sweep.
export const shouldAutoStartCourse = () => false;

export const deriveCourseLifecycleStatus = (course = {}, options = {}) => {
  if (!course) return "draft";
  if (course.classCancelledAt || String(course.status || "") === "cancelled") {
    return "canceled";
  }
  if (course.classEndedAt) return "completed";
  if (course.endRequest?.status === "pending") return "awaiting_completion";
  if (course.classStartedAt || course.actualStartedAt) return "in_progress";

  const publicationStatus = String(course.status || "");
  if (publicationStatus === "rejected") return "changes_requested";
  if (publicationStatus === "pending") return "pending_review";
  if (publicationStatus === "approved") return "approved";
  if (publicationStatus === "draft") return "draft";
  if (publicationStatus !== "published" || course.isPublished !== true) {
    return course.lifecycleStatus || "draft";
  }

  const now = options.now ? new Date(options.now) : new Date();
  const scheduledStartAt = resolveCourseScheduledStartAt(course);
  if (
    !scheduledStartAt ||
    Number.isNaN(now.getTime()) ||
    now < scheduledStartAt
  ) {
    return "enrollment_open";
  }

  const minimumStudentsToStart = Math.max(
    1,
    Number(course.minimumStudentsToStart || 1),
  );
  const activeStudentsCount = Math.max(
    0,
    Number(
      options.activeStudentsCount ??
        course.enrolledStudentsCount ??
        0,
    ),
  );
  return activeStudentsCount >= minimumStudentsToStart
    ? "ready_to_start"
    : "minimum_not_reached";
};

export const resolveNextCourseStartDate = (value = new Date()) => {
  const source = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(source.getTime())) return null;

  const next = new Date(source);
  if (next.getDate() < 15) {
    next.setDate(15);
  } else {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
  }
  return next;
};

const countActiveStudents = async (courseId, { now, session } = {}) => {
  const query = Enrollment.countDocuments({
    courseId,
    enrollmentStatus: { $in: ["active", "completed"] },
    accessStatus: "allowed",
    $or: [
      { accessExpiresAt: { $exists: false } },
      { accessExpiresAt: null },
      { accessExpiresAt: { $gt: now } },
    ],
  });
  if (session) query.session(session);
  return query;
};

export const ensureCourseAutoStarted = async (course = null, options = {}) => {
  if (!course) return course;
  const now = options.now ? new Date(options.now) : new Date();
  const courseId = course?._id || course?.id;
  if (!courseId) return course;

  const shouldCountStudents =
    String(course.status || "") === "published" &&
    course.isPublished === true &&
    !course.classStartedAt &&
    !course.classEndedAt &&
    !course.classCancelledAt;
  const activeStudentsCount = Number.isFinite(Number(options.activeStudentsCount))
    ? Math.max(0, Number(options.activeStudentsCount))
    : shouldCountStudents
      ? await countActiveStudents(courseId, { now, session: options.session })
      : Math.max(0, Number(course.enrolledStudentsCount || 0));
  const minimumStudentsToStart = Math.max(1, Number(course.minimumStudentsToStart || 1));
  const lifecycleStatus = deriveCourseLifecycleStatus(course, {
    now,
    activeStudentsCount,
  });
  const update = { lifecycleStatus };
  if (
    activeStudentsCount >= minimumStudentsToStart &&
    !course.minimumReachedAt
  ) {
    update.minimumReachedAt = now;
  }

  if (
    String(course.lifecycleStatus || "") !== lifecycleStatus ||
    update.minimumReachedAt
  ) {
    await Course.updateOne(
      { _id: courseId },
      { $set: update },
      options.session ? { session: options.session } : {},
    );
    course.lifecycleStatus = lifecycleStatus;
    if (update.minimumReachedAt) course.minimumReachedAt = now;
  }
  return course;
};
