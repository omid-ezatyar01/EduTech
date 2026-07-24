import { DateTime } from "luxon";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { createCalendarEventWithMeet } from "../services/googleCalendar.service.js";
import {
  enqueueSessionCalendarRemoval,
  enqueueSessionCalendarSync,
  syncTeacherCalendarEvent,
} from "../services/studentCalendarSync.service.js";
import { generateDatesForMonth } from "../services/sessionGenerator.service.js";
import {
  expireEnrollmentIfNeeded,
  isEnrollmentExpired,
} from "../utils/courseAccess.js";
import { getEligibleCourseRatingPrompts } from "../utils/courseRatings.js";
import { publishLiveSessionStarted } from "../services/courseNotification.service.js";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kabul";
const LINK_VISIBLE_BEFORE_MINUTES = Number.parseInt(
  process.env.MEET_LINK_VISIBLE_BEFORE_MINUTES || "0",
  10,
);
const LINK_CLOSE_AFTER_START_MINUTES = Number.parseInt(
  process.env.MEET_LINK_DISABLE_AFTER_START_MINUTES || "10",
  10,
);

const runCalendarTask = (task, label) => {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.warn(`${label}: ${error.message}`);
      });
  });
};

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const hasAllowedEnrollmentAccess = (enrollment = {}) =>
  ["active", "completed"].includes(String(enrollment?.enrollmentStatus || "")) &&
  String(enrollment?.accessStatus || "") === "allowed" &&
  !isEnrollmentExpired(enrollment);

const getOwnedTeacherCourseIds = async (teacherId) =>
  Course.find(teacherCourseFilter(teacherId)).distinct("_id");

export const deriveSessionStatus = (session, now = new Date()) => {
  if (!session) return "scheduled";
  if (
    ["cancelled", "completed", "rescheduled", "missed", "delayed"].includes(
      session.status,
    )
  ) {
    return session.status;
  }
  if (session.status === "live") return "live";

  const start = new Date(session.startAt);
  const end = new Date(session.endAt);

  if (Number.isFinite(end.getTime()) && now >= end) return "missed";
  const readyAt = Number.isFinite(start.getTime())
    ? new Date(start.getTime() - 15 * 60 * 1000)
    : null;
  if (readyAt && now >= readyAt) return "ready";
  return "scheduled";
};

const attendanceStatsFromRows = (rows = []) => {
  return rows.reduce(
    (acc, row) => {
      const status = normalizeAttendanceStatus(row.status);
      if (status === "present") acc.present += 1;
      if (status === "absent") acc.absent += 1;
      return acc;
    },
    { present: 0, absent: 0 },
  );
};

const normalizeAttendanceStatus = (status) => {
  if (status === "late") return "present";
  if (status === "present") return "present";
  return "absent";
};

const getObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  if (typeof value.toString === "function") return value.toString();
  return String(value);
};

const getAttendanceStudentId = (row = {}) => getObjectIdString(row.studentId || row.student || row.userId);

const emptyAttendanceStats = () => ({ present: 0, absent: 0 });

const mergeAttendanceStats = (target, source = {}) => {
  target.present += Number(source.present || 0);
  target.absent += Number(source.absent || 0);
  return target;
};

const buildSessionDateFilter = (query = {}) => {
  if (!query.dateFrom && !query.dateTo) return null;
  const filter = {};
  if (query.dateFrom) filter.$gte = new Date(query.dateFrom);
  if (query.dateTo) filter.$lte = new Date(query.dateTo);
  return filter;
};

const toDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getJoinWindowMeta = (session) => {
  const startDate = toDate(session?.startAt);
  if (!startDate) {
    return {
      openAt: null,
      closeAt: null,
      visibleBeforeMinutes: LINK_VISIBLE_BEFORE_MINUTES,
      closeAfterStartMinutes: LINK_CLOSE_AFTER_START_MINUTES,
    };
  }

  const openAt = new Date(startDate.getTime() - LINK_VISIBLE_BEFORE_MINUTES * 60 * 1000);
  const closeAt = new Date(startDate.getTime() + LINK_CLOSE_AFTER_START_MINUTES * 60 * 1000);

  return {
    openAt,
    closeAt,
    visibleBeforeMinutes: LINK_VISIBLE_BEFORE_MINUTES,
    closeAfterStartMinutes: LINK_CLOSE_AFTER_START_MINUTES,
  };
};

const computeLinkAvailability = (session, now = new Date()) => {
  const status = deriveSessionStatus(session, now);
  const window = getJoinWindowMeta(session);

  if (session?.platform === "physical") {
    return {
      available: false,
      reason: "physical_session",
      message: "This class is physical and does not provide a live link.",
      status,
      ...window,
    };
  }

  if (session?.status === "cancelled") {
    return {
      available: false,
      reason: "cancelled",
      message: "This session has been cancelled.",
      status,
      ...window,
    };
  }

  if (session?.status === "completed") {
    return {
      available: false,
      reason: "completed",
      message: "This session has ended.",
      status,
      ...window,
    };
  }

  if (session?.status !== "live") {
    return {
      available: false,
      reason: "awaiting_teacher",
      message: "The teacher has not started this session yet.",
      status,
      ...window,
    };
  }

  if (!window.openAt || !window.closeAt) {
    return {
      available: false,
      reason: "invalid_schedule",
      message: "Session time is invalid.",
      status,
      ...window,
    };
  }

  if (!session?.meetingLink) {
    return {
      available: false,
      reason: "missing_link",
      message: "Session link is not available.",
      status,
      ...window,
    };
  }

  return {
    available: true,
    reason: "ok",
    message: "Live link is available.",
    status,
    ...window,
  };
};

const isAttendanceClosed = (session, now = new Date()) => {
  if (!session || session.status === "cancelled") return false;
  if (session.status === "completed") return true;
  return false;
};

const finalizeSessionAttendance = async (session, now = new Date()) => {
  if (!isAttendanceClosed(session, now)) return session;

  const { closeAt } = getJoinWindowMeta(session);
  const attendanceRows = Array.isArray(session.attendance) ? session.attendance : [];
  const markedStudentIds = new Set(attendanceRows.map((row) => getAttendanceStudentId(row)).filter(Boolean));
  const courseForAccess =
    session.courseId && typeof session.courseId === "object" && "price" in session.courseId
      ? session.courseId
      : await Course.findById(session.courseId?._id || session.courseId).select("isFree price startDate");
  const enrollments = await Enrollment.find({
    courseId: session.courseId?._id || session.courseId,
    enrollmentStatus: { $in: ["active", "completed"] },
  })
    .select("studentId enrollmentStatus accessStatus accessExpiresAt status");

  for (const enrollment of enrollments) {
    await expireEnrollmentIfNeeded(enrollment, courseForAccess);
  }

  let changed = false;
  attendanceRows.forEach((row) => {
    if (normalizeAttendanceStatus(row.status) !== "present" || !row.joinedAt || row.leftAt || !closeAt) {
      return;
    }

    row.leftAt = closeAt;
    changed = true;
  });

  enrollments.filter(hasAllowedEnrollmentAccess).forEach((enrollment) => {
    const studentId = enrollment?.studentId;
    if (!studentId || markedStudentIds.has(String(studentId))) return;

    session.attendance.push({
      studentId,
      status: "absent",
      markedBy: session.teacherId,
    });
    markedStudentIds.add(String(studentId));
    changed = true;
  });

  if (changed) {
    await session.save();
  }

  return session;
};

const finalizeSessionsAttendance = async (sessions = [], now = new Date()) => {
  await Promise.all((Array.isArray(sessions) ? sessions : []).map((session) => finalizeSessionAttendance(session, now)));
  return sessions;
};

const mapTeacherSession = (session) => {
  const row = typeof session.toObject === "function" ? session.toObject() : session;
  const status = deriveSessionStatus(row);
  const attendanceRows = Array.isArray(row.attendance) ? row.attendance : [];
  const stats = attendanceStatsFromRows(attendanceRows);
  const linkWindow = getJoinWindowMeta(row);

  return {
    _id: row._id,
    title: row.title,
    description: row.description || "",
    platform: row.platform,
    timezone: row.timezone || APP_TIMEZONE,
    meetingLink: row.meetingLink || "",
    googleEventId: row.googleEventId || "",
    googleCalendarId: row.googleCalendarId || "",
    startAt: row.startAt,
    endAt: row.endAt,
    sessionNumber: row.sessionNumber || null,
    actualStartedAt: row.actualStartedAt || null,
    actualEndedAt: row.actualEndedAt || null,
    status,
    persistedStatus: row.status,
    notifyStudents: Boolean(row.notifyStudents),
    reminderEnabled: Boolean(row.reminderEnabled),
    autoAttendance: Boolean(row.autoAttendance),
    autoGenerated: Boolean(row.autoGenerated),
    cancelReason: row.cancelReason || "",
    attendanceStats: stats,
    attendanceCount: attendanceRows.length,
    joinWindow: {
      openAt: linkWindow.openAt,
      closeAt: linkWindow.closeAt,
      visibleBeforeMinutes: linkWindow.visibleBeforeMinutes,
      closeAfterStartMinutes: linkWindow.closeAfterStartMinutes,
    },
    course: row.courseId
      ? {
          _id: row.courseId._id || row.courseId,
          title: row.courseId.title || "",
          classEndedAt: row.courseId.classEndedAt || null,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const mapStudentSession = (session, enrollmentStatus, accessAllowed) => {
  const row = typeof session.toObject === "function" ? session.toObject() : session;
  const status = deriveSessionStatus(row);
  const teacherProfile = row?.courseId?.teacher || row?.courseId?.createdBy || {};
  const availability = computeLinkAvailability(row);

  return {
    _id: row._id,
    title: row.title,
    description: row.description || "",
    platform: row.platform,
    timezone: row.timezone || APP_TIMEZONE,
    meetingLink: accessAllowed && availability.available ? row.meetingLink || "" : "",
    startAt: row.startAt,
    endAt: row.endAt,
    sessionNumber: row.sessionNumber || null,
    actualStartedAt: row.actualStartedAt || null,
    actualEndedAt: row.actualEndedAt || null,
    status,
    enrollmentStatus,
    accessAllowed,
    joinEnabled: accessAllowed && availability.available,
    linkAvailability: {
      available: accessAllowed && availability.available,
      reason: accessAllowed ? availability.reason : "not_enrolled",
      message: accessAllowed ? availability.message : "You do not have active enrollment.",
      openAt: availability.openAt,
      closeAt: availability.closeAt,
      serverTime: new Date(),
    },
    course: row.courseId
      ? {
          _id: row.courseId._id || row.courseId,
          title: row.courseId.title || "",
          teacherName: teacherProfile.name || "",
          meetingType: row.courseId.meetingType || "google_meet",
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const mapStudentAttendanceSession = (session, studentId, enrollmentStatus = "active") => {
  const row = typeof session.toObject === "function" ? session.toObject() : session;
  const status = deriveSessionStatus(row);
  const attendanceRows = Array.isArray(row.attendance) ? row.attendance : [];
  const normalizedStudentId = getObjectIdString(studentId);
  const record = attendanceRows.find((item) => getAttendanceStudentId(item) === normalizedStudentId) || null;
  const attendanceStatus = record?.status
    ? normalizeAttendanceStatus(record.status)
    : status === "completed" ? "absent" : "not_marked";
  const teacherProfile = row?.courseId?.teacher || row?.courseId?.createdBy || {};

  return {
    _id: row._id,
    title: row.title,
    startAt: row.startAt,
    endAt: row.endAt,
    status,
    enrollmentStatus,
    attendanceStatus,
    note: record?.note || "",
    joinedAt: record?.joinedAt || null,
    leftAt: record?.leftAt || null,
    course: row.courseId
      ? {
          _id: row.courseId._id || row.courseId,
          title: row.courseId.title || "",
          teacherName: teacherProfile.name || "",
        }
      : null,
  };
};

const assertTeacherOwnsCourse = async (teacherId, courseId) => {
  const course = await Course.findOne({
    _id: courseId,
    ...teacherCourseFilter(teacherId),
  }).select("_id title teacher teacherId createdBy classEndedAt");

  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  return course;
};

const assertTeacherCanManageCourse = (course) => {
  if (course?.classEndedAt) {
    throw new ApiError(400, "Ended courses cannot be managed by teacher");
  }
};

const assertCoursePermission = async (user, courseId) => {
  if (!user?._id) {
    throw new ApiError(401, "Not authorized");
  }

  let course = null;
  if (user.role === "admin") {
    course = await Course.findById(courseId).select("_id title teacher teacherId createdBy");
  } else if (user.role === "teacher") {
    course = await assertTeacherOwnsCourse(user._id, courseId);
  } else {
    throw new ApiError(403, "Not authorized for this resource");
  }

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  return course;
};

const getTeacherSessionById = async (teacherId, sessionId) => {
  const session = await LiveSession.findOne({
    _id: sessionId,
    teacherId,
  }).populate("courseId", "title isFree price startDate classEndedAt");

  if (!session) {
    throw new ApiError(404, "Live session not found");
  }

  return session;
};

const getSessionAndEnrollmentForStudent = async (studentId, sessionId) => {
  const session = await LiveSession.findById(sessionId).populate("courseId", "title meetingType isFree price startDate");
  if (!session) {
    throw new ApiError(404, "Live session not found");
  }

  const enrollment = await Enrollment.findOne({
    studentId,
    courseId: session.courseId,
  }).select("enrollmentStatus accessStatus accessExpiresAt status");

  await expireEnrollmentIfNeeded(enrollment, session.courseId);

  return { session, enrollment };
};

const ensureSessionSlotIsUnique = async ({ courseId, startAt, excludeId }) => {
  const query = {
    courseId,
    startAt: new Date(startAt),
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const duplicate = await LiveSession.findOne(query).select("_id");
  if (duplicate) {
    throw new ApiError(409, "A session already exists for this course at the same start time");
  }
};

const courseScheduleToGeneratorPayload = (course, overrides = {}) => {
  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  if (!scheduleRows.length) {
    throw new ApiError(400, "Course schedule is empty. Set teaching days/time first.");
  }

  const dayMap = {
    saturday: "SATURDAY",
    sunday: "SUNDAY",
    monday: "MONDAY",
    tuesday: "TUESDAY",
    wednesday: "WEDNESDAY",
    thursday: "THURSDAY",
    friday: "FRIDAY",
  };

  const uniqueDays = [];
  scheduleRows.forEach((row) => {
    const key = String(row?.day || "").trim().toLowerCase();
    const normalized = dayMap[key] || String(row?.day || "").trim().toUpperCase();
    if (!normalized) return;
    if (!uniqueDays.includes(normalized)) {
      uniqueDays.push(normalized);
    }
  });

  const firstRow = scheduleRows[0] || {};
  const startTime = String(overrides.startTime || firstRow.startTime || "").trim();
  const endTime = String(firstRow.endTime || "").trim();

  let durationMinutes = Number(overrides.durationMinutes || 0);
  if (!durationMinutes && /^\d{1,2}:\d{2}$/.test(startTime) && /^\d{1,2}:\d{2}$/.test(endTime)) {
    const [sh, sm] = startTime.split(":").map((v) => Number(v));
    const [eh, em] = endTime.split(":").map((v) => Number(v));
    const startTotal = sh * 60 + sm;
    const endTotal = eh * 60 + em;
    const diff = endTotal - startTotal;
    if (diff > 0) durationMinutes = diff;
  }

  return {
    daysOfWeek: uniqueDays,
    startTime,
    durationMinutes: durationMinutes || 60,
  };
};

const buildSessionTitle = (course, payload = {}) => {
  const custom = String(payload?.title || "").trim();
  if (custom) return custom;
  return `${course?.title || "Course"} Live Session`;
};

export const createTeacherLiveSession = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  const teacherId = req.user._id;

  const course = await assertTeacherOwnsCourse(teacherId, payload.courseId);
  assertTeacherCanManageCourse(course);
  await ensureSessionSlotIsUnique({ courseId: payload.courseId, startAt: payload.startAt });

  let meetingLink = payload.meetingLink || "";
  let googleEventId = "";
  const googleCalendarId = payload.calendarId || "primary";

  if (payload.platform === "google_meet" && payload.autoGenerateMeet) {
    const event = await createCalendarEventWithMeet({
      userId: teacherId,
      calendarId: googleCalendarId,
      title: payload.title || buildSessionTitle(course, payload),
      description: payload.description || "",
      startTime: new Date(payload.startAt).toISOString(),
      endTime: new Date(payload.endAt).toISOString(),
      timezone: payload.timezone || APP_TIMEZONE,
    });

    meetingLink = event.meetLink;
    googleEventId = event.eventId;
  }

  const existingSessionCount = await LiveSession.countDocuments({
    courseId: payload.courseId,
  });
  const draft = {
    courseId: payload.courseId,
    teacherId,
    title: payload.title,
    description: payload.description || "",
    platform: payload.platform || "google_meet",
    timezone: payload.timezone || APP_TIMEZONE,
    meetingLink,
    googleEventId,
    googleCalendarId: googleEventId ? googleCalendarId : "",
    startAt: payload.startAt,
    endAt: payload.endAt,
    status: payload.status || "scheduled",
    sessionNumber: Math.max(
      1,
      Number(payload.sessionNumber || existingSessionCount + 1),
    ),
    notifyStudents: payload.notifyStudents ?? true,
    reminderEnabled: payload.reminderEnabled ?? true,
    autoAttendance: payload.autoAttendance ?? false,
    createdBy: teacherId,
  };

  draft.status = deriveSessionStatus(draft);
  const session = await LiveSession.create(draft);
  runCalendarTask(
    () => enqueueSessionCalendarSync(session._id),
    "Failed to enqueue student calendars for new session",
  );

  const populated = await LiveSession.findById(session._id).populate("courseId", "title");
  return res.status(201).json(
    new ApiResponse({
      message: "Live session created successfully",
      data: mapTeacherSession(populated),
    }),
  );
});

export const getTeacherLiveSessions = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const ownedCourseIds = await getOwnedTeacherCourseIds(teacherId);

  if (!ownedCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher live sessions fetched successfully",
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      }),
    );
  }

  const filter = { teacherId, courseId: { $in: ownedCourseIds } };
  if (req.query.courseId) {
    const requestedCourseId = String(req.query.courseId);
    const isOwnedCourse = ownedCourseIds.some((courseId) => String(courseId) === requestedCourseId);
    if (!isOwnedCourse) {
      return res.json(
        new ApiResponse({
          message: "Teacher live sessions fetched successfully",
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        }),
      );
    }
    filter.courseId = req.query.courseId;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.startAt = {};
    if (req.query.dateFrom) filter.startAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.startAt.$lte = new Date(req.query.dateTo);
  }

  const [sessions, total] = await Promise.all([
    LiveSession.find(filter)
      .populate("courseId", "title")
      .sort({ startAt: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LiveSession.countDocuments(filter),
  ]);

  return res.json(
    new ApiResponse({
      message: "Teacher live sessions fetched successfully",
      data: sessions.map(mapTeacherSession),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }),
  );
});

export const getTeacherLiveSessionById = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  return res.json(
    new ApiResponse({
      message: "Live session fetched successfully",
      data: mapTeacherSession(session),
    }),
  );
});

export const updateTeacherLiveSession = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const session = await getTeacherSessionById(teacherId, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  const payload = { ...req.body };

  if (payload.courseId) {
    const nextCourse = await assertTeacherOwnsCourse(teacherId, payload.courseId);
    assertTeacherCanManageCourse(nextCourse);
    session.courseId = payload.courseId;
  }

  const fields = [
    "title",
    "description",
    "platform",
    "meetingLink",
    "timezone",
    "startAt",
    "endAt",
    "status",
    "notifyStudents",
    "reminderEnabled",
    "autoAttendance",
  ];

  fields.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      session[key] = payload[key];
    }
  });

  if (
    Object.prototype.hasOwnProperty.call(payload, "startAt") ||
    Object.prototype.hasOwnProperty.call(payload, "courseId")
  ) {
    await ensureSessionSlotIsUnique({
      courseId: session.courseId,
      startAt: session.startAt,
      excludeId: session._id,
    });
  }

  if (session.status === "cancelled" && Object.prototype.hasOwnProperty.call(payload, "cancelReason")) {
    session.cancelReason = payload.cancelReason || "";
  }

  if (session.status !== "cancelled") {
    session.cancelReason = "";
  }

  session.status = deriveSessionStatus(session);
  await session.save();
  if (session.status === "cancelled") {
    runCalendarTask(
      () => enqueueSessionCalendarRemoval(session),
      "Failed to remove cancelled session calendars",
    );
  } else {
    runCalendarTask(
      async () => {
        await syncTeacherCalendarEvent(session);
        await enqueueSessionCalendarSync(session._id);
      },
      "Failed to update session calendars",
    );
  }

  const populated = await LiveSession.findById(session._id).populate("courseId", "title");
  return res.json(
    new ApiResponse({
      message: "Live session updated successfully",
      data: mapTeacherSession(populated),
    }),
  );
});

export const deleteTeacherLiveSession = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  await enqueueSessionCalendarRemoval(session);
  await LiveSession.deleteOne({ _id: session._id });

  return res.json(
    new ApiResponse({
      message: "Live session deleted successfully",
      data: { id: session._id },
    }),
  );
});

export const startTeacherLiveSession = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  if (session.status === "cancelled") {
    throw new ApiError(400, "Cancelled session cannot be started");
  }
  if (session.status === "completed") {
    throw new ApiError(400, "Completed session cannot be started again");
  }
  if (session.status === "live") {
    return res.json(
      new ApiResponse({
        message: "Live session is already running",
        data: mapTeacherSession(session),
      }),
    );
  }

  const courseId = session.courseId?._id || session.courseId;
  const course = await Course.findById(courseId).select(
    "_id classStartedAt classEndedAt classCancelledAt currentSessionNumber",
  );
  if (!course?.classStartedAt) {
    throw new ApiError(409, "Start the course officially before starting a live session");
  }
  if (course.classEndedAt || course.classCancelledAt) {
    throw new ApiError(400, "This course is no longer active");
  }

  const now = new Date();
  const earliestStart = new Date(new Date(session.startAt).getTime() - 15 * 60 * 1000);
  if (!Number.isNaN(earliestStart.getTime()) && now < earliestStart) {
    throw new ApiError(400, "This session can be started up to 15 minutes before its scheduled time");
  }

  session.status = "live";
  session.actualStartedAt = session.actualStartedAt || now;
  await session.save();
  course.currentSessionNumber = Math.max(
    Number(course.currentSessionNumber || 1),
    Number(session.sessionNumber || 1),
  );
  await course.save();
  await publishLiveSessionStarted({
    courseId: course._id,
    sessionId: session._id,
    sessionTitle: session.title,
  });

  return res.json(
    new ApiResponse({
      message: "Live session started",
      data: mapTeacherSession(session),
    }),
  );
});

export const endTeacherLiveSession = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  if (session.status === "cancelled") {
    throw new ApiError(400, "Cancelled session cannot be completed");
  }
  if (session.status !== "live") {
    throw new ApiError(409, "Only a live session can be completed");
  }

  session.status = "completed";
  session.actualEndedAt = new Date();
  await session.save();
  await finalizeSessionAttendance(session);

  return res.json(
    new ApiResponse({
      message: "Live session completed",
      data: mapTeacherSession(session),
    }),
  );
});

export const cancelTeacherLiveSession = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  session.status = "cancelled";
  session.cancelReason = req.body.reason || "";
  await session.save();
  runCalendarTask(
    () => enqueueSessionCalendarRemoval(session),
    "Failed to remove cancelled session calendars",
  );

  return res.json(
    new ApiResponse({
      message: "Live session cancelled",
      data: mapTeacherSession(session),
    }),
  );
});

export const getTeacherLiveSessionAttendance = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  await finalizeSessionAttendance(session);
  const enrollments = await Enrollment.find({
    courseId: session.courseId,
    enrollmentStatus: { $in: ["active", "completed"] },
  }).populate("studentId", "name email avatar");

  for (const enrollment of enrollments) {
    await expireEnrollmentIfNeeded(enrollment, session.courseId);
  }

  const accessibleEnrollments = enrollments.filter(
    (enrollment) => hasAllowedEnrollmentAccess(enrollment) && Boolean(enrollment?.studentId?._id),
  );

  const attendanceMap = new Map(
    (Array.isArray(session.attendance) ? session.attendance : []).map((row) => [
      getAttendanceStudentId(row),
      row,
    ]),
  );

  const attendees = (Array.isArray(accessibleEnrollments) ? accessibleEnrollments : []).map((enrollment) => {
    const student = enrollment.studentId || {};
    const record = attendanceMap.get(getObjectIdString(student._id || student)) || null;

    return {
      studentId: getObjectIdString(student._id || student),
      name: student.name || "Student",
      email: student.email || "",
      avatar: student.avatar || "",
      status: record?.status ? normalizeAttendanceStatus(record.status) : "absent",
      note: record?.note || "",
      joinedAt: record?.joinedAt || null,
      leftAt: record?.leftAt || null,
    };
  });

  const stats = attendanceStatsFromRows(attendees);

  return res.json(
    new ApiResponse({
      message: "Session attendance fetched successfully",
      data: {
        session: mapTeacherSession(session),
        attendees,
        stats,
      },
    }),
  );
});

export const updateTeacherLiveSessionAttendance = asyncHandler(async (req, res) => {
  const session = await getTeacherSessionById(req.user._id, req.params.id);
  assertTeacherCanManageCourse(session.courseId);
  const attendeesPayload = Array.isArray(req.body.attendees) ? req.body.attendees : [];

  const validEnrollments = await Enrollment.find({
    courseId: session.courseId,
    enrollmentStatus: { $in: ["active", "completed"] },
  }).select("studentId enrollmentStatus accessStatus accessExpiresAt status");
  for (const enrollment of validEnrollments) {
    await expireEnrollmentIfNeeded(enrollment, session.courseId);
  }
  const allowedStudentIds = new Set(
    validEnrollments
      .filter(hasAllowedEnrollmentAccess)
      .map((row) => getObjectIdString(row.studentId)),
  );

  const attendanceMap = new Map(
    (Array.isArray(session.attendance) ? session.attendance : []).map((row) => [
      getAttendanceStudentId(row),
      { ...row.toObject?.(), ...row },
    ]),
  );

  attendeesPayload.forEach((row) => {
    const studentId = getObjectIdString(row.studentId);
    if (!allowedStudentIds.has(studentId)) {
      throw new ApiError(400, "One or more attendees are not enrolled in this course");
    }

    const previous = attendanceMap.get(studentId) || { studentId: row.studentId };
    attendanceMap.set(studentId, {
      ...previous,
      studentId: row.studentId,
      status: normalizeAttendanceStatus(row.status),
      note: row.note || "",
      joinedAt: row.joinedAt ? new Date(row.joinedAt) : previous.joinedAt || null,
      leftAt: row.leftAt ? new Date(row.leftAt) : previous.leftAt || null,
      markedBy: req.user._id,
    });
  });

  session.attendance = Array.from(attendanceMap.values());
  await session.save();

  return res.json(
    new ApiResponse({
      message: "Session attendance updated successfully",
      data: {
        session: mapTeacherSession(session),
        stats: attendanceStatsFromRows(session.attendance),
      },
    }),
  );
});

export const getTeacherAttendanceOverview = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  const skip = (page - 1) * limit;
  const ownedCourseIds = await getOwnedTeacherCourseIds(teacherId);

  if (!ownedCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher attendance overview fetched successfully",
        data: {
          courses: [],
          sessions: [],
          stats: { totalSessions: 0, totalMarked: 0, ...emptyAttendanceStats() },
        },
        meta: { page, limit, total: 0, totalPages: 1 },
      }),
    );
  }

  const activeCourses = await Course.find({
    _id: { $in: ownedCourseIds },
    classEndedAt: null,
  })
    .select("_id title enrolledStudentsCount maxStudents status isPublished classEndedAt")
    .sort({ createdAt: -1 })
    .lean();
  const activeCourseIds = activeCourses.map((course) => course._id);

  if (!activeCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher attendance overview fetched successfully",
        data: {
          courses: [],
          sessions: [],
          stats: { totalSessions: 0, totalMarked: 0, ...emptyAttendanceStats() },
        },
        meta: { page, limit, total: 0, totalPages: 1 },
      }),
    );
  }

  const filter = { teacherId, courseId: { $in: activeCourseIds } };
  if (req.query.courseId) {
    const requestedCourseId = String(req.query.courseId);
    const isOwnedCourse = activeCourseIds.some((courseId) => String(courseId) === requestedCourseId);
    if (!isOwnedCourse) {
      filter.courseId = { $in: [] };
    } else {
      filter.courseId = req.query.courseId;
    }
  }
  if (req.query.status) filter.status = req.query.status;
  const dateFilter = buildSessionDateFilter(req.query);
  if (dateFilter) filter.startAt = dateFilter;

  const [sessions, total] = await Promise.all([
    LiveSession.find(filter)
      .populate("courseId", "title classEndedAt")
      .sort({ startAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LiveSession.countDocuments(filter),
  ]);
  await finalizeSessionsAttendance(sessions);

  const enrollmentCounts = await Enrollment.aggregate([
    {
      $match: {
        courseId: { $in: activeCourseIds },
        enrollmentStatus: { $in: ["active", "completed"] },
      },
    },
    { $group: { _id: "$courseId", total: { $sum: 1 } } },
  ]);
  const enrollmentCountMap = new Map(enrollmentCounts.map((row) => [String(row._id), row.total]));

  const mappedSessions = sessions.map(mapTeacherSession);
  const stats = mappedSessions.reduce(
    (acc, session) => {
      acc.totalSessions += 1;
      acc.totalMarked += Number(session.attendanceCount || 0);
      mergeAttendanceStats(acc, session.attendanceStats);
      return acc;
    },
    { totalSessions: 0, totalMarked: 0, ...emptyAttendanceStats() },
  );

  return res.json(
    new ApiResponse({
      message: "Teacher attendance overview fetched successfully",
      data: {
        courses: activeCourses.map((course) => ({
          ...course,
          activeStudentsCount: enrollmentCountMap.get(String(course._id)) || 0,
        })),
        sessions: mappedSessions,
        stats,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }),
  );
});

export const getStudentLiveSessions = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const enrollments = await Enrollment.find({
    studentId,
    enrollmentStatus: { $in: ["pending", "active", "completed", "cancelled"] },
  })
    .select("courseId enrollmentStatus accessStatus accessExpiresAt")
    .populate("courseId", "isFree price startDate");

  const enrollmentMap = new Map();
  const courseIds = [];
  for (const row of (Array.isArray(enrollments) ? enrollments : [])) {
    await expireEnrollmentIfNeeded(row, row?.courseId);
    if (!row?.courseId) continue;
    const key = String(row.courseId?._id || row.courseId);
    enrollmentMap.set(key, {
      enrollmentStatus: row.enrollmentStatus || "pending",
      accessAllowed: hasAllowedEnrollmentAccess(row),
    });
    courseIds.push(row.courseId?._id || row.courseId);
  }

  if (!courseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Student live sessions fetched successfully",
        data: [],
        meta: { page, limit, total: 0, totalPages: 1 },
      }),
    );
  }

  const dbFilter = {
    courseId: { $in: courseIds },
  };
  if (req.query.courseId) dbFilter.courseId = req.query.courseId;
  if (req.query.status) dbFilter.status = req.query.status;

  const sessions = await LiveSession.find(dbFilter)
    .populate({
      path: "courseId",
      select: "title meetingType teacher createdBy",
      populate: [
        { path: "teacher", select: "name avatar" },
        { path: "createdBy", select: "name avatar" },
      ],
    })
    .sort({ startAt: 1, createdAt: -1 });
  await finalizeSessionsAttendance(sessions);

  const mapped = sessions
    .map((session) => {
      const courseId = String(session.courseId?._id || session.courseId || "");
      const enrollmentState = enrollmentMap.get(courseId) || {};
      const enrollmentStatus = enrollmentState.enrollmentStatus || "pending";
      const accessAllowed = Boolean(enrollmentState.accessAllowed);
      return mapStudentSession(session, enrollmentStatus, accessAllowed);
    })
    .filter((row) => Boolean(String(row?.course?.title || "").trim()))
    .filter((row) => (req.query.status ? row.status === req.query.status : true));

  const total = mapped.length;
  const start = (page - 1) * limit;
  const data = mapped.slice(start, start + limit);

  return res.json(
    new ApiResponse({
      message: "Student live sessions fetched successfully",
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }),
  );
});

export const getStudentAttendance = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;

  const enrollments = await Enrollment.find({
    studentId,
    enrollmentStatus: { $in: ["active", "completed"] },
  })
    .select("courseId enrollmentStatus accessStatus accessExpiresAt status")
    .populate({
      path: "courseId",
      select: "title teacher createdBy isFree price startDate",
      populate: [
        { path: "teacher", select: "name avatar" },
        { path: "createdBy", select: "name avatar" },
      ],
    });

  for (const enrollment of enrollments) {
    await expireEnrollmentIfNeeded(enrollment, enrollment?.courseId);
  }

  const accessibleEnrollments = enrollments.filter(hasAllowedEnrollmentAccess);

  const enrollmentMap = new Map();
  const courseIds = [];
  (Array.isArray(accessibleEnrollments) ? accessibleEnrollments : []).forEach((row) => {
    const courseId = row?.courseId?._id || row?.courseId;
    if (!courseId) return;
    const key = String(courseId);
    enrollmentMap.set(key, row.enrollmentStatus || "active");
    courseIds.push(courseId);
  });

  if (!courseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Student attendance fetched successfully",
        data: {
          courses: [],
          sessions: [],
          stats: { totalSessions: 0, countedSessions: 0, attendanceRate: 0, ...emptyAttendanceStats() },
        },
        meta: { page, limit, total: 0, totalPages: 1 },
      }),
    );
  }

  const filter = { courseId: { $in: courseIds } };
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.status) filter.status = req.query.status;
  const dateFilter = buildSessionDateFilter(req.query);
  if (dateFilter) filter.startAt = dateFilter;

  const sessions = await LiveSession.find(filter)
    .populate({
      path: "courseId",
      select: "title teacher createdBy",
      populate: [
        { path: "teacher", select: "name avatar" },
        { path: "createdBy", select: "name avatar" },
      ],
    })
    .sort({ startAt: -1, createdAt: -1 });
  await finalizeSessionsAttendance(sessions);

  const mapped = sessions
    .map((session) => {
      const courseId = String(session.courseId?._id || session.courseId || "");
      return mapStudentAttendanceSession(session, studentId, enrollmentMap.get(courseId) || "active");
    })
    .filter((row) => Boolean(String(row?.course?.title || "").trim()));

  const total = mapped.length;
  const start = (page - 1) * limit;
  const pagedSessions = mapped.slice(start, start + limit);
  const countedSessions = mapped.filter((row) => row.status === "completed" || row.attendanceStatus !== "not_marked");
  const stats = countedSessions.reduce(
    (acc, row) => {
      if (row.attendanceStatus === "present") acc.present += 1;
      if (row.attendanceStatus === "absent") acc.absent += 1;
      return acc;
    },
    { totalSessions: mapped.length, countedSessions: countedSessions.length, ...emptyAttendanceStats() },
  );
  stats.attendanceRate = stats.countedSessions
    ? Math.round((stats.present / stats.countedSessions) * 100)
    : 0;

  return res.json(
    new ApiResponse({
      message: "Student attendance fetched successfully",
      data: {
        courses: accessibleEnrollments
          .filter((row) => row.courseId && typeof row.courseId === "object")
          .map((row) => ({
            _id: row.courseId._id,
            title: row.courseId.title || "",
            teacherName: row.courseId.teacher?.name || row.courseId.createdBy?.name || "",
            enrollmentStatus: row.enrollmentStatus || "active",
          })),
        sessions: pagedSessions,
        stats,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }),
  );
});

export const getStudentLiveSessionLink = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { session, enrollment } = await getSessionAndEnrollmentForStudent(studentId, req.params.sessionId);
  await finalizeSessionAttendance(session);

  if (!hasAllowedEnrollmentAccess(enrollment) || enrollment.enrollmentStatus !== "active") {
    throw new ApiError(403, "Student is not actively enrolled in this course");
  }

  const availability = computeLinkAvailability(session);

  if (!availability.available) {
    return res.json(
      new ApiResponse({
        message: availability.message,
        data: {
          available: false,
          message: availability.message,
          startTime: session.startAt,
          serverTime: new Date(),
          visibleAt: availability.openAt,
          expiresAt: availability.closeAt,
        },
      }),
    );
  }

  return res.json(
    new ApiResponse({
      message: "Live link is available",
      data: {
        available: true,
        meetLink: session.meetingLink || "",
        startTime: session.startAt,
        endTime: session.endAt,
        visibleAt: availability.openAt,
        expiresAt: availability.closeAt,
      },
    }),
  );
});

export const joinStudentLiveSession = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { session, enrollment } = await getSessionAndEnrollmentForStudent(studentId, req.params.id);
  await finalizeSessionAttendance(session);

  if (!hasAllowedEnrollmentAccess(enrollment) || enrollment.enrollmentStatus !== "active") {
    throw new ApiError(403, "You do not have access to this live session");
  }

  const availability = computeLinkAvailability(session);
  if (!availability.available) {
    throw new ApiError(400, availability.message);
  }

  const currentIndex = session.attendance.findIndex(
    (row) => getAttendanceStudentId(row) === getObjectIdString(studentId),
  );
  const now = new Date();
  let attendanceStatus = "present";

  if (currentIndex >= 0) {
    const previous = session.attendance[currentIndex];
    const wasAlreadyJoined = Boolean(previous.joinedAt);
    const wasManuallyChangedAfterJoin =
      wasAlreadyJoined &&
      previous.markedBy &&
      String(previous.markedBy) !== String(studentId) &&
      normalizeAttendanceStatus(previous.status) !== "present";

    if (!wasManuallyChangedAfterJoin) {
      previous.status = "present";
      previous.markedBy = studentId;
    }

    previous.joinedAt = previous.joinedAt || now;
    attendanceStatus = normalizeAttendanceStatus(previous.status);
  } else {
    session.attendance.push({
      studentId,
      status: "present",
      joinedAt: now,
      markedBy: studentId,
    });
  }

  await session.save();
  const [ratingPrompt = null] = await getEligibleCourseRatingPrompts(studentId, {
    courseId: session.courseId,
    limit: 1,
  });

  return res.json(
    new ApiResponse({
      message: "Live session join granted",
      data: {
        meetingLink: session.meetingLink || "",
        sessionId: session._id,
        status: deriveSessionStatus(session),
        attendanceStatus,
        attendanceClosesAt: availability.closeAt,
        ratingPrompt,
      },
    }),
  );
});

export const generateCourseMonthlyMeetLinks = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const payload = { ...req.body };
  const actingUser = req.user;

  const course = await assertCoursePermission(actingUser, courseId);

  const hasDirectPayload =
    Array.isArray(payload.daysOfWeek) &&
    payload.daysOfWeek.length > 0 &&
    Boolean(payload.startTime) &&
    Number(payload.durationMinutes) > 0;

  const scheduleConfig = hasDirectPayload
    ? { daysOfWeek: payload.daysOfWeek, startTime: payload.startTime, durationMinutes: payload.durationMinutes }
    : courseScheduleToGeneratorPayload(course, payload);

  const daysOfWeek = payload.daysOfWeek?.length ? payload.daysOfWeek : scheduleConfig.daysOfWeek;
  const startTime = payload.startTime || scheduleConfig.startTime;
  const durationMinutes = payload.durationMinutes || scheduleConfig.durationMinutes;
  const timezone = payload.timezone || APP_TIMEZONE;

  const generatedDates = generateDatesForMonth({
    month: payload.month,
    rangeDays: payload.rangeDays,
    startDate: payload.startDate,
    daysOfWeek,
    startTime,
    durationMinutes,
    timezone,
  });
  const courseStart = course.startDate ? new Date(course.startDate).getTime() : null;
  const courseEnd = course.endDate ? new Date(course.endDate).getTime() : null;
  const dates = generatedDates.filter((slot) => {
    const slotTime = new Date(slot.startAt).getTime();
    if (Number.isFinite(courseStart) && slotTime < courseStart) return false;
    if (Number.isFinite(courseEnd) && slotTime > courseEnd) return false;
    return true;
  });

  if (!dates.length) {
    return res.json(
      new ApiResponse({
        message: "No class dates matched the selected schedule",
        data: {
          created: [],
          skipped: [],
          totalRequestedDates: 0,
        },
      }),
    );
  }

  const title = buildSessionTitle(course, payload);
  const description = payload.description || "";
  const calendarId = payload.calendarId || "primary";

  const created = [];
  const skipped = [];

  for (const slot of dates) {
    const duplicate = await LiveSession.findOne({
      courseId,
      startAt: slot.startAt,
    }).select("_id");

    if (duplicate) {
      skipped.push({
        reason: "duplicate",
        startAt: slot.startAt,
        existingSessionId: duplicate._id,
      });
      continue;
    }

    const event = await createCalendarEventWithMeet({
      userId: actingUser._id,
      calendarId,
      title,
      description,
      startTime: slot.startAt.toISOString(),
      endTime: slot.endAt.toISOString(),
      timezone,
    });

    const session = await LiveSession.create({
      courseId,
      teacherId: course.teacherId || course.teacher || actingUser._id,
      title,
      description,
      platform: payload.platform || "google_meet",
      timezone,
      meetingLink: event.meetLink || "",
      googleEventId: event.eventId,
      googleCalendarId: event.calendarId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: "scheduled",
      notifyStudents: payload.notifyStudents ?? true,
      reminderEnabled: payload.reminderEnabled ?? true,
      autoAttendance: payload.autoAttendance ?? false,
      autoGenerated: true,
      createdBy: actingUser._id,
    });
    runCalendarTask(
      () => enqueueSessionCalendarSync(session._id),
      "Failed to enqueue generated session calendars",
    );

    created.push(session);
  }

  return res.status(201).json(
    new ApiResponse({
      message: "Monthly Google Meet links generated successfully",
      data: {
        created: created.map(mapTeacherSession),
        skipped,
        totalRequestedDates: dates.length,
      },
    }),
  );
});

export const getTeacherCourseSessions = asyncHandler(async (req, res) => {
  const now = new Date();
  const ownedCourseIds = await getOwnedTeacherCourseIds(req.user._id);
  if (!ownedCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher upcoming course sessions fetched successfully",
        data: [],
      }),
    );
  }

  const sessions = await LiveSession.find({
    teacherId: req.user._id,
    courseId: { $in: ownedCourseIds },
    startAt: { $gte: now },
  })
    .populate("courseId", "title")
    .sort({ startAt: 1 })
    .limit(200);

  return res.json(
    new ApiResponse({
      message: "Teacher upcoming course sessions fetched successfully",
      data: sessions.map(mapTeacherSession),
    }),
  );
});

export const getAdminCourseSessions = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).select("_id");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const sessions = await LiveSession.find({
    courseId: req.params.courseId,
  })
    .populate("courseId", "title")
    .sort({ startAt: 1 });

  return res.json(
    new ApiResponse({
      message: "Admin course sessions fetched successfully",
      data: sessions.map(mapTeacherSession),
    }),
  );
});

export const getMeetAutomationConfig = asyncHandler(async (_req, res) => {
  return res.json(
    new ApiResponse({
      message: "Meet automation config fetched",
      data: {
        timezone: APP_TIMEZONE,
        meetLinkVisibleBeforeMinutes: LINK_VISIBLE_BEFORE_MINUTES,
        meetLinkDisableAfterStartMinutes: LINK_CLOSE_AFTER_START_MINUTES,
      },
    }),
  );
});

export const buildCourseSchedulePreview = asyncHandler(async (req, res) => {
  const course = await assertCoursePermission(req.user, req.params.courseId);
  const generated = generateDatesForMonth({
    month: req.body.month,
    rangeDays: req.body.rangeDays,
    startDate: req.body.startDate,
    daysOfWeek: req.body.daysOfWeek,
    startTime: req.body.startTime,
    durationMinutes: req.body.durationMinutes,
    timezone: req.body.timezone || APP_TIMEZONE,
  });

  return res.json(
    new ApiResponse({
      message: "Schedule preview generated successfully",
      data: {
        courseId: course._id,
        count: generated.length,
        sessions: generated.map((slot) => ({
          startAt: slot.startAt,
          endAt: slot.endAt,
          localStartAt: DateTime.fromJSDate(slot.startAt, { zone: "utc" })
            .setZone(req.body.timezone || APP_TIMEZONE)
            .toISO(),
          localEndAt: DateTime.fromJSDate(slot.endAt, { zone: "utc" })
            .setZone(req.body.timezone || APP_TIMEZONE)
            .toISO(),
        })),
      },
    }),
  );
});
