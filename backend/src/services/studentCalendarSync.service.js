import Enrollment from "../models/Enrollment.js";
import GoogleAccount from "../models/GoogleAccount.js";
import LiveSession from "../models/LiveSession.js";
import StudentNotification from "../models/StudentNotification.js";
import StudentSessionCalendarEvent from "../models/StudentSessionCalendarEvent.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "./googleCalendar.service.js";
import { notifyStudentCalendarConnectionRequired } from "./webPush.service.js";

const activeEnrollmentFilter = (now = new Date()) => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: now } },
  ],
});

const sessionEventPayload = (session = {}) => ({
  title: session.title || `${session.courseId?.title || "Course"} Live Session`,
  description: session.description || "",
  meetingLink: session.meetingLink || "",
  startTime: new Date(session.startAt).toISOString(),
  endTime: new Date(session.endAt).toISOString(),
  timezone: session.timezone || process.env.APP_TIMEZONE || "Asia/Kabul",
});

const isReconnectError = (error) => {
  const status = Number(error?.code || error?.response?.status || 0);
  const message = String(
    `${error?.response?.data?.error || ""} ${error?.message || ""}`,
  ).toLowerCase();
  return (
    status === 401 ||
    message.includes("invalid_grant") ||
    message.includes("invalid credentials") ||
    message.includes("not connected") ||
    message.includes("refresh token is missing")
  );
};

const createConnectPrompt = async ({ studentId, session }) => {
  const course = session.courseId || {};
  const courseId = course?._id || course;
  const teacherId = session.teacherId?._id || session.teacherId;
  if (!studentId || !courseId || !teacherId) return;

  const result = await StudentNotification.updateOne(
    {
      recipient: studentId,
      eventKey: `google-calendar-connect:${courseId}`,
    },
    {
      $setOnInsert: {
        recipient: studentId,
        teacher: teacherId,
        course: courseId,
        session: session._id,
        type: "calendar_connect_required",
        title: "Connect Google Calendar",
        body: `Connect Google Calendar to automatically receive and update sessions for ${course.title || "your course"}.`,
        url: "/student/schedule?connectGoogle=1",
        eventKey: `google-calendar-connect:${courseId}`,
        isRead: false,
      },
    },
    { upsert: true },
  ).catch((error) => {
    if (error?.code !== 11000) throw error;
  });
  if (Number(result?.upsertedCount || 0) > 0) {
    notifyStudentCalendarConnectionRequired({
      studentId,
      courseTitle: course.title || "",
    }).catch(() => {});
  }
};

const processMapping = async (mapping) => {
  const session = await LiveSession.findById(mapping.sessionId)
    .populate("courseId", "title")
    .lean();

  if (!session || session.status === "cancelled" || mapping.status === "pending_delete") {
    if (mapping.eventId) {
      await deleteCalendarEvent({
        userId: mapping.studentId,
        calendarId: mapping.calendarId || "primary",
        eventId: mapping.eventId,
      });
    }
    await StudentSessionCalendarEvent.deleteOne({ _id: mapping._id });
    return;
  }

  const payload = sessionEventPayload(session);
  let eventId = mapping.eventId || "";
  if (eventId) {
    const updated = await updateCalendarEvent({
      userId: mapping.studentId,
      calendarId: mapping.calendarId || "primary",
      eventId,
      ...payload,
    });
    if (updated?.missing) eventId = "";
  }

  if (!eventId) {
    const created = await createCalendarEvent({
      userId: mapping.studentId,
      calendarId: mapping.calendarId || "primary",
      ...payload,
    });
    eventId = created.eventId;
  }

  await StudentSessionCalendarEvent.updateOne(
    { _id: mapping._id },
    {
      $set: {
        eventId,
        status: "synced",
        attempts: 0,
        nextAttemptAt: null,
        lastError: "",
        syncedAt: new Date(),
      },
    },
  );
};

export const processPendingStudentCalendarSyncs = async ({
  sessionId = null,
  limit = 40,
} = {}) => {
  const filter = {
    status: { $in: ["pending", "pending_delete", "failed"] },
    $or: [
      { nextAttemptAt: null },
      { nextAttemptAt: { $lte: new Date() } },
    ],
  };
  if (sessionId) filter.sessionId = sessionId;

  const mappings = await StudentSessionCalendarEvent.find(filter)
    .sort({ nextAttemptAt: 1, updatedAt: 1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 40)));

  for (let index = 0; index < mappings.length; index += 4) {
    await Promise.allSettled(
      mappings.slice(index, index + 4).map(async (mapping) => {
        try {
          await processMapping(mapping);
        } catch (error) {
          const attempts = Number(mapping.attempts || 0) + 1;
          const retryMinutes = Math.min(60, 2 ** Math.min(5, attempts));
          await StudentSessionCalendarEvent.updateOne(
            { _id: mapping._id },
            {
              $set: {
                status: "failed",
                attempts,
                lastError: String(error?.message || "Google Calendar sync failed").slice(0, 500),
                nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000),
              },
            },
          );
          if (isReconnectError(error)) {
            await GoogleAccount.updateOne(
              { userId: mapping.studentId },
              {
                $set: {
                  reconnectRequired: true,
                  lastError: "Google Calendar authorization expired. Reconnect your account.",
                },
              },
            );
            const session = await LiveSession.findById(mapping.sessionId)
              .populate("courseId", "title")
              .lean();
            if (session) await createConnectPrompt({ studentId: mapping.studentId, session });
          }
        }
      }),
    );
  }

  return { processed: mappings.length };
};

export const enqueueSessionCalendarSync = async (sessionId) => {
  const session = await LiveSession.findById(sessionId)
    .populate("courseId", "title")
    .lean();
  if (!session || session.status === "cancelled") return { queued: 0 };

  const enrollments = await Enrollment.find({
    courseId: session.courseId?._id || session.courseId,
    ...activeEnrollmentFilter(),
  })
    .select("studentId")
    .lean();
  const studentIds = [
    ...new Set(enrollments.map((row) => String(row.studentId || "")).filter(Boolean)),
  ];

  const connectedAccounts = await GoogleAccount.find({
    userId: { $in: studentIds },
    reconnectRequired: { $ne: true },
  })
    .select("userId")
    .lean();
  const connectedIds = new Set(
    connectedAccounts.map((account) => String(account.userId)),
  );

  const operations = studentIds
    .filter((studentId) => connectedIds.has(studentId))
    .map((studentId) => ({
      updateOne: {
        filter: { sessionId: session._id, studentId },
        update: {
          $setOnInsert: {
            sessionId: session._id,
            courseId: session.courseId?._id || session.courseId,
            studentId,
            calendarId: "primary",
          },
          $set: {
            courseId: session.courseId?._id || session.courseId,
            status: "pending",
            nextAttemptAt: new Date(),
            lastError: "",
          },
        },
        upsert: true,
      },
    }));
  if (operations.length) {
    await StudentSessionCalendarEvent.bulkWrite(operations, { ordered: false });
  }

  const expectedIds = new Set(studentIds);
  await StudentSessionCalendarEvent.updateMany(
    {
      sessionId: session._id,
      studentId: { $nin: [...expectedIds] },
    },
    { $set: { status: "pending_delete", nextAttemptAt: new Date() } },
  );

  await Promise.all(
    studentIds
      .filter((studentId) => !connectedIds.has(studentId))
      .map((studentId) => createConnectPrompt({ studentId, session })),
  );

  setImmediate(() => {
    processPendingStudentCalendarSyncs({ sessionId: session._id }).catch((error) => {
      console.warn(`Student calendar sync failed: ${error.message}`);
    });
  });
  return { queued: operations.length };
};

export const enqueueSessionCalendarRemoval = async (session) => {
  if (!session?._id) return;
  await StudentSessionCalendarEvent.updateMany(
    { sessionId: session._id },
    { $set: { status: "pending_delete", nextAttemptAt: new Date() } },
  );

  if (session.googleEventId) {
    deleteCalendarEvent({
      userId: session.teacherId,
      calendarId: session.googleCalendarId || "primary",
      eventId: session.googleEventId,
    }).catch((error) => {
      console.warn(`Teacher calendar event removal failed: ${error.message}`);
    });
  }

  setImmediate(() => {
    processPendingStudentCalendarSyncs({ sessionId: session._id }).catch((error) => {
      console.warn(`Student calendar removal failed: ${error.message}`);
    });
  });
};

export const syncTeacherCalendarEvent = async (session) => {
  if (!session?.googleEventId || !session?.teacherId) return;
  if (session.status === "cancelled") {
    await enqueueSessionCalendarRemoval(session);
    return;
  }

  const updated = await updateCalendarEvent({
    userId: session.teacherId,
    calendarId: session.googleCalendarId || "primary",
    eventId: session.googleEventId,
    ...sessionEventPayload(session),
  });
  if (updated?.missing) {
    const created = await createCalendarEvent({
      userId: session.teacherId,
      calendarId: session.googleCalendarId || "primary",
      ...sessionEventPayload(session),
    });
    session.googleEventId = created.eventId;
    session.googleCalendarId = created.calendarId;
    await session.save();
  }
};

export const syncFutureSessionsForStudent = async (studentId) => {
  const enrollments = await Enrollment.find({
    studentId,
    ...activeEnrollmentFilter(),
  })
    .select("courseId")
    .lean();
  const courseIds = [...new Set(enrollments.map((row) => String(row.courseId)))];
  if (!courseIds.length) return { queued: 0 };

  const sessions = await LiveSession.find({
    courseId: { $in: courseIds },
    status: "scheduled",
    endAt: { $gt: new Date() },
  })
    .select("_id courseId teacherId")
    .populate("courseId", "title");
  if (!sessions.length) return { queued: 0 };

  const account = await GoogleAccount.findOne({
    userId: studentId,
    reconnectRequired: { $ne: true },
  })
    .select("_id")
    .lean();
  if (!account) {
    await Promise.all(
      sessions.map((session) => createConnectPrompt({ studentId, session })),
    );
    return { queued: 0, connectionRequired: true };
  }

  await StudentSessionCalendarEvent.bulkWrite(
    sessions.map((session) => ({
      updateOne: {
        filter: { sessionId: session._id, studentId },
        update: {
          $setOnInsert: {
            sessionId: session._id,
            courseId: session.courseId?._id || session.courseId,
            studentId,
            calendarId: "primary",
          },
          $set: {
            status: "pending",
            nextAttemptAt: new Date(),
            lastError: "",
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  await StudentNotification.updateMany(
    { recipient: studentId, type: "calendar_connect_required", isRead: false },
    { $set: { isRead: true } },
  );
  setImmediate(() => {
    processPendingStudentCalendarSyncs({ limit: 100 }).catch(() => {});
  });
  return { queued: sessions.length };
};

let workerTimer = null;
export const startStudentCalendarSyncWorker = () => {
  if (workerTimer) return workerTimer;
  workerTimer = setInterval(() => {
    processPendingStudentCalendarSyncs().catch((error) => {
      console.warn(`Student calendar retry worker failed: ${error.message}`);
    });
  }, 2 * 60_000);
  workerTimer.unref?.();
  return workerTimer;
};
