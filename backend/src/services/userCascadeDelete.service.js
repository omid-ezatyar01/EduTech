import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Course from "../models/Course.js";
import CourseRating from "../models/CourseRating.js";
import CourseResource from "../models/CourseResource.js";
import DirectMessage from "../models/DirectMessage.js";
import Enrollment from "../models/Enrollment.js";
import GoogleAccount from "../models/GoogleAccount.js";
import LiveSession from "../models/LiveSession.js";
import OtpVerification from "../models/OtpVerification.js";
import Payment from "../models/Payment.js";
import PushSubscription from "../models/PushSubscription.js";
import TeacherIncomeSettlement from "../models/TeacherIncomeSettlement.js";
import StudentNotification from "../models/StudentNotification.js";
import TeacherNotification from "../models/TeacherNotification.js";
import TeacherFollow from "../models/TeacherFollow.js";
import { deleteCoursesWithRelationsByFilter } from "./courseCascadeDelete.service.js";

const userIdOf = (user) => user?._id || user;

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const isHistoricalTeacherCourse = (course = {}) => {
  if (course?.classEndedAt) return true;
  if (!course?.endDate) return false;

  const endDate = new Date(course.endDate);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() < Date.now();
};

const buildCourseScopedDeleteFilter = (teacherId, preservedCourseIds = []) => {
  const filter = { teacherId };
  if (preservedCourseIds.length) {
    filter.courseId = { $nin: preservedCourseIds };
  }
  return filter;
};

export const deleteUserRelatedData = async (user) => {
  const userId = userIdOf(user);
  if (!userId) return { deletedCourses: [], preservedHistoricalCourses: [] };

  let deletedCourses = [];
  let preservedHistoricalCourses = [];
  let preservedCourseIds = [];

  if (user?.role === "teacher") {
    const teacherCourses = await Course.find(teacherCourseFilter(userId))
      .select("_id title slug status endDate classEndedAt")
      .lean();

    const historicalCourses = teacherCourses.filter(isHistoricalTeacherCourse);
    const activeCourseIds = teacherCourses
      .filter((course) => !isHistoricalTeacherCourse(course))
      .map((course) => course._id);

    preservedHistoricalCourses = historicalCourses.map((course) => ({
      id: String(course?._id || ""),
      title: course?.title || "Course",
      status: course?.status || "draft",
    }));
    preservedCourseIds = historicalCourses.map((course) => course._id);

    if (activeCourseIds.length) {
      deletedCourses = await deleteCoursesWithRelationsByFilter({
        _id: { $in: activeCourseIds },
      });
    }

    if (preservedCourseIds.length) {
      await Course.updateMany(
        { _id: { $in: preservedCourseIds } },
        {
          $set: {
            teacher: null,
            teacherId: null,
            meetingLink: "",
            allowStudentGroupMessages: false,
          },
        },
      );
    }
  }

  const teacherScopedCourseFilter = buildCourseScopedDeleteFilter(userId, preservedCourseIds);

  await Promise.all([
    Enrollment.deleteMany({ studentId: userId }),
    Payment.deleteMany({ studentId: userId }),
    Assignment.deleteMany(teacherScopedCourseFilter),
    AssignmentSubmission.deleteMany({
      $or: [
        { studentId: userId },
        teacherScopedCourseFilter,
        { reviewedBy: userId, ...(preservedCourseIds.length ? { courseId: { $nin: preservedCourseIds } } : {}) },
      ],
    }),
    CourseResource.deleteMany(teacherScopedCourseFilter),
    LiveSession.deleteMany(teacherScopedCourseFilter),
    LiveSession.updateMany(
      { "attendance.studentId": userId },
      { $pull: { attendance: { studentId: userId } } },
    ),
    DirectMessage.deleteMany(buildCourseScopedDeleteFilter(userId, preservedCourseIds)),
    CourseRating.deleteMany({
      $or: [
        { studentId: userId },
        buildCourseScopedDeleteFilter(userId, preservedCourseIds),
      ],
    }),
    TeacherIncomeSettlement.deleteMany(buildCourseScopedDeleteFilter(userId, preservedCourseIds)),
    PushSubscription.deleteMany({ userId }),
    StudentNotification.deleteMany({
      $or: [{ recipient: userId }, { teacher: userId }],
    }),
    TeacherNotification.deleteMany({
      $or: [{ recipient: userId }, { student: userId }],
    }),
    TeacherFollow.deleteMany({
      $or: [{ teacher: userId }, { follower: userId }],
    }),
    OtpVerification.deleteMany({ userId }),
    GoogleAccount.deleteMany({ userId }),
  ]);

  return { deletedCourses, preservedHistoricalCourses };
};
