import Course from "../models/Course.js";
import CourseResource from "../models/CourseResource.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";
import Payment from "../models/Payment.js";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import CourseRating from "../models/CourseRating.js";
import DirectMessage from "../models/DirectMessage.js";
import StudentNotification from "../models/StudentNotification.js";
import TeacherNotification from "../models/TeacherNotification.js";
import { removeOldCourseThumbnailIfLocal } from "../utils/courseImage.js";
import { removeCourseResourcePdfIfLocal } from "../utils/courseResourceFile.js";
import { enqueueSessionCalendarRemoval } from "./studentCalendarSync.service.js";

const toObjectId = (value) => (value && value._id ? value._id : value);

export const deleteCourseWithRelationsByFilter = async (filter = {}) => {
  const course = await Course.findOne(filter).select("_id thumbnail").lean();
  if (!course) return null;

  const courseId = toObjectId(course._id);
  const [resources, calendarSessions] = await Promise.all([
    CourseResource.find({ courseId }).select("filePath").lean(),
    LiveSession.find({ courseId }).select(
      "_id teacherId googleEventId googleCalendarId",
    ),
  ]);

  await Promise.all(
    resources
      .map((resource) => resource?.filePath)
      .filter(Boolean)
      .map((filePath) => removeCourseResourcePdfIfLocal(filePath)),
  );
  await Promise.all(
    calendarSessions.map((session) => enqueueSessionCalendarRemoval(session)),
  );

  const [
    resourceResult,
    sessionResult,
    enrollmentResult,
    paymentResult,
    assignmentResult,
    submissionResult,
    ratingResult,
    messageResult,
    studentNotificationResult,
    teacherNotificationResult,
    courseResult,
  ] =
    await Promise.all([
      CourseResource.deleteMany({ courseId }),
      LiveSession.deleteMany({ courseId }),
      Enrollment.deleteMany({ courseId }),
      Payment.deleteMany({ courseId }),
      Assignment.deleteMany({ courseId }),
      AssignmentSubmission.deleteMany({ courseId }),
      CourseRating.deleteMany({ courseId }),
      DirectMessage.deleteMany({ courseId }),
      StudentNotification.deleteMany({ course: courseId }),
      TeacherNotification.deleteMany({ course: courseId }),
      Course.deleteOne({ _id: courseId }),
    ]);

  await removeOldCourseThumbnailIfLocal(course.thumbnail);

  return {
    id: String(courseId),
    removed: {
      courses: Number(courseResult?.deletedCount || 0),
      sessions: Number(sessionResult?.deletedCount || 0),
      resources: Number(resourceResult?.deletedCount || 0),
      enrollments: Number(enrollmentResult?.deletedCount || 0),
      payments: Number(paymentResult?.deletedCount || 0),
      assignments: Number(assignmentResult?.deletedCount || 0),
      submissions: Number(submissionResult?.deletedCount || 0),
      ratings: Number(ratingResult?.deletedCount || 0),
      messages: Number(messageResult?.deletedCount || 0),
      studentNotifications: Number(studentNotificationResult?.deletedCount || 0),
      teacherNotifications: Number(teacherNotificationResult?.deletedCount || 0),
    },
  };
};

export const deleteCoursesWithRelationsByFilter = async (filter = {}) => {
  const courses = await Course.find(filter).select("_id").lean();
  const results = [];

  for (const course of courses) {
    const result = await deleteCourseWithRelationsByFilter({ _id: course._id });
    if (result) results.push(result);
  }

  return results;
};
