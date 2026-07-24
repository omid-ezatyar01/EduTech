import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import StudentNotification from "../models/StudentNotification.js";
import TeacherNotification from "../models/TeacherNotification.js";
import User from "../models/User.js";
import {
  notifyStudentsCourseStarted,
  notifyStudentsLiveSessionStarted,
  notifyTeacherCourseEvent,
} from "./webPush.service.js";
import { syncFutureSessionsForStudent } from "./studentCalendarSync.service.js";

const activeEnrollmentFilter = (now = new Date()) => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: now } },
  ],
});

const resolveTeacherId = (course = {}) => {
  const raw = course?.teacher || course?.teacherId || course?.createdBy;
  return raw?._id || raw || null;
};

const createTeacherNotificationOnce = async (payload) => {
  try {
    return await TeacherNotification.create(payload);
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

export const publishCourseEnrollmentEvents = async ({
  courseId,
  enrollmentId,
  studentId,
} = {}) => {
  if (
    !courseId ||
    !enrollmentId ||
    !studentId ||
    !mongoose.isValidObjectId(courseId)
  ) {
    return { enrollment: false, minimumReached: false };
  }

  try {
    const [course, student] = await Promise.all([
      Course.findById(courseId)
        .select("title slug teacher teacherId createdBy minimumStudentsToStart")
        .lean(),
      User.findById(studentId).select("name").lean(),
    ]);
    if (!course) return { enrollment: false, minimumReached: false };

    const teacherId = resolveTeacherId(course);
    if (!teacherId) return { enrollment: false, minimumReached: false };

    const studentName = String(student?.name || "A student").trim();
    const courseTitle = String(course.title || "your course").trim();
    const enrollmentNotification = await createTeacherNotificationOnce({
      recipient: teacherId,
      type: "student_enrolled",
      course: course._id,
      student: studentId,
      title: "New student enrolled",
      body: `${studentName} enrolled in ${courseTitle}.`,
      url: "/teacher/students",
      eventKey: `course-enrollment:${enrollmentId}`,
    });

    if (enrollmentNotification) {
      notifyTeacherCourseEvent({
        teacherId,
        type: "student_enrolled",
        title: "New student enrolled",
        body: `${studentName} enrolled in ${courseTitle}.`,
        url: "/teacher/students",
        courseId: course._id,
      }).catch((error) => {
        console.warn(`Failed to send teacher enrollment push notification: ${error.message}`);
      });
    }

    setImmediate(() => {
      syncFutureSessionsForStudent(studentId).catch((error) => {
        console.warn(`Failed to sync enrolled student's calendar: ${error.message}`);
      });
    });

    const minimumStudents = Math.max(1, Number(course.minimumStudentsToStart || 1));
    const activeStudents = await Enrollment.countDocuments({
      courseId: course._id,
      ...activeEnrollmentFilter(),
    });

    let minimumNotification = null;
    if (activeStudents >= minimumStudents) {
      minimumNotification = await createTeacherNotificationOnce({
        recipient: teacherId,
        type: "minimum_students_reached",
        course: course._id,
        title: "Minimum students reached",
        body: `${courseTitle} has reached its minimum of ${minimumStudents} students and is ready to start on schedule.`,
        url: "/teacher/courses",
        eventKey: `course-minimum-reached:${course._id}:${minimumStudents}`,
      });

      if (minimumNotification) {
        notifyTeacherCourseEvent({
          teacherId,
          type: "minimum_students_reached",
          title: "Minimum students reached",
          body: `${courseTitle} has reached its minimum of ${minimumStudents} students.`,
          url: "/teacher/courses",
          courseId: course._id,
        }).catch((error) => {
          console.warn(`Failed to send teacher minimum-students push notification: ${error.message}`);
        });
      }
    }

    return {
      enrollment: Boolean(enrollmentNotification),
      minimumReached: Boolean(minimumNotification),
    };
  } catch (error) {
    console.warn(`Failed to publish course enrollment notifications: ${error.message}`);
    return { enrollment: false, minimumReached: false };
  }
};

export const publishCourseStarted = async ({ courseId } = {}) => {
  if (!courseId || !mongoose.isValidObjectId(courseId)) return { recipients: 0 };

  try {
    const course = await Course.findById(courseId)
      .select("title slug teacher teacherId createdBy")
      .lean();
    if (!course) return { recipients: 0 };

    const teacherId = resolveTeacherId(course);
    if (!teacherId) return { recipients: 0 };

    const enrollments = await Enrollment.find({
      courseId: course._id,
      ...activeEnrollmentFilter(),
    })
      .select("studentId")
      .lean();
    const studentIds = [
      ...new Set(enrollments.map((row) => String(row.studentId || "")).filter(Boolean)),
    ];
    if (!studentIds.length) return { recipients: 0 };

    const eventKey = `course-started:${course._id}`;
    const existingRows = await StudentNotification.find({
      recipient: { $in: studentIds },
      eventKey,
    })
      .select("recipient")
      .lean();
    const existingRecipients = new Set(existingRows.map((row) => String(row.recipient)));
    const newRecipientIds = studentIds.filter((studentId) => !existingRecipients.has(studentId));
    if (!newRecipientIds.length) return { recipients: 0 };

    await StudentNotification.bulkWrite(
      newRecipientIds.map((recipient) => ({
        updateOne: {
          filter: { recipient, eventKey },
          update: {
            $setOnInsert: {
              recipient,
              teacher: teacherId,
              course: course._id,
              type: "course_started",
              title: "Course started",
              body: `${course.title || "Your course"} has started. Open the course to continue learning.`,
              url: course.slug ? `/course/${encodeURIComponent(course.slug)}` : "/student/courses",
              eventKey,
              isRead: false,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    notifyStudentsCourseStarted({
      studentIds: newRecipientIds,
      courseTitle: course.title,
      courseSlug: course.slug,
      courseId: course._id,
    }).catch((error) => {
      console.warn(`Failed to send course-start push notifications: ${error.message}`);
    });

    return { recipients: newRecipientIds.length };
  } catch (error) {
    console.warn(`Failed to publish course-start notifications: ${error.message}`);
    return { recipients: 0 };
  }
};

export const publishLiveSessionStarted = async ({
  courseId,
  sessionId,
  sessionTitle = "",
} = {}) => {
  if (
    !mongoose.isValidObjectId(courseId) ||
    !mongoose.isValidObjectId(sessionId)
  ) {
    return { recipients: 0 };
  }

  try {
    const course = await Course.findById(courseId)
      .select("title teacher teacherId createdBy")
      .lean();
    if (!course) return { recipients: 0 };

    const teacherId = resolveTeacherId(course);
    if (!teacherId) return { recipients: 0 };

    const enrollments = await Enrollment.find({
      courseId: course._id,
      ...activeEnrollmentFilter(),
    })
      .select("studentId")
      .lean();
    const studentIds = [
      ...new Set(enrollments.map((row) => String(row.studentId || "")).filter(Boolean)),
    ];
    if (!studentIds.length) return { recipients: 0 };

    const eventKey = `live-session-started:${sessionId}`;
    await StudentNotification.bulkWrite(
      studentIds.map((recipient) => ({
        updateOne: {
          filter: { recipient, eventKey },
          update: {
            $setOnInsert: {
              recipient,
              teacher: teacherId,
              course: course._id,
              session: sessionId,
              type: "live_session_started",
              title: "Live session started",
              body: `${sessionTitle || "Your live session"} for ${course.title || "your course"} is now open.`,
              url: "/student/live",
              eventKey,
              isRead: false,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    notifyStudentsLiveSessionStarted({
      studentIds,
      courseTitle: course.title,
      sessionTitle,
      courseId: course._id,
      sessionId,
    }).catch((error) => {
      console.warn(`Failed to send live-session push notifications: ${error.message}`);
    });

    return { recipients: studentIds.length };
  } catch (error) {
    console.warn(`Failed to publish live-session notifications: ${error.message}`);
    return { recipients: 0 };
  }
};
