import mongoose from "mongoose";
import CourseRating from "../models/CourseRating.js";
import Enrollment from "../models/Enrollment.js";
import LiveSession from "../models/LiveSession.js";

const REQUIRED_JOINED_CLASSES = 2;

const activeEnrollmentFilter = (now = new Date()) => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: now } },
  ],
});

const toObjectId = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

const roundRating = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 10) / 10;
};

export const getJoinedLiveClassCount = async (studentId, courseId) => {
  const studentObjectId = toObjectId(studentId);
  const courseObjectId = toObjectId(courseId);
  if (!studentObjectId || !courseObjectId) return 0;

  return LiveSession.countDocuments({
    courseId: courseObjectId,
    attendance: {
      $elemMatch: {
        studentId: studentObjectId,
        status: "present",
        joinedAt: { $exists: true, $ne: null },
      },
    },
  });
};

export const getEligibleCourseRatingPrompts = async (
  studentId,
  { courseId = null, limit = 5 } = {},
) => {
  const studentObjectId = toObjectId(studentId);
  if (!studentObjectId) return [];

  const courseObjectId = courseId ? toObjectId(courseId) : null;
  if (courseId && !courseObjectId) return [];

  const filter = {
    studentId: studentObjectId,
    ...activeEnrollmentFilter(),
  };
  if (courseObjectId) filter.courseId = courseObjectId;

  const enrollments = await Enrollment.find(filter)
    .populate({
      path: "courseId",
      select: "title thumbnail teacher teacherId",
      populate: [
        { path: "teacher", select: "name avatar" },
        { path: "teacherId", select: "name avatar" },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 5)));

  const prompts = [];

  for (const enrollment of enrollments) {
    const course = enrollment?.courseId;
    if (!course || typeof course !== "object" || !course._id) continue;

    const existingRating = await CourseRating.exists({
      studentId: studentObjectId,
      courseId: course._id,
    });
    if (existingRating) continue;

    const joinedClassCount = await getJoinedLiveClassCount(studentObjectId, course._id);
    if (joinedClassCount < REQUIRED_JOINED_CLASSES) continue;

    const teacher = course.teacherId || course.teacher || null;
    const teacherId =
      typeof teacher === "object" && teacher?._id
        ? teacher._id
        : course.teacherId || course.teacher;
    if (!teacherId) continue;

    prompts.push({
      courseId: String(course._id),
      courseTitle: course.title || "Course",
      courseThumbnail: course.thumbnail || "",
      teacherId: String(teacherId),
      teacherName:
        typeof teacher === "object" && teacher?.name
          ? teacher.name
          : "Teacher",
      teacherAvatar:
        typeof teacher === "object" && teacher?.avatar
          ? teacher.avatar
          : "",
      joinedClassCount,
      requiredJoinedClasses: REQUIRED_JOINED_CLASSES,
    });
  }

  return prompts;
};

export const assertStudentCanRateCourse = async (studentId, courseId) => {
  const prompts = await getEligibleCourseRatingPrompts(studentId, { courseId, limit: 1 });
  return prompts[0] || null;
};

export const getCourseRatingAggregates = async (courseIds = []) => {
  const ids = courseIds.map(toObjectId).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await CourseRating.aggregate([
    { $match: { courseId: { $in: ids } } },
    {
      $group: {
        _id: "$courseId",
        rating: { $avg: "$courseRating" },
        teacherRating: { $avg: "$teacherRating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        rating: roundRating(row.rating),
        teacherRating: roundRating(row.teacherRating),
        ratingCount: Number(row.ratingCount || 0),
      },
    ]),
  );
};

export const getTeacherRatingAggregates = async (teacherIds = []) => {
  const ids = teacherIds.map(toObjectId).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await CourseRating.aggregate([
    { $match: { teacherId: { $in: ids } } },
    {
      $group: {
        _id: "$teacherId",
        rating: { $avg: "$teacherRating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        rating: roundRating(row.rating),
        ratingCount: Number(row.ratingCount || 0),
      },
    ]),
  );
};

const mapPublicReviewRow = (rating = {}, { mode = "course" } = {}) => {
  const studentName = String(rating?.studentId?.name || "Student").trim() || "Student";
  const courseTitle = String(rating?.courseId?.title || "Course").trim() || "Course";

  return {
    _id: String(rating?._id || ""),
    studentName,
    courseTitle,
    comment: String(rating?.comment || "").trim(),
    courseRating: Number(rating?.courseRating || 0),
    teacherRating: Number(rating?.teacherRating || 0),
    rating: mode === "teacher"
      ? Number(rating?.teacherRating || 0)
      : Number(rating?.courseRating || 0),
    createdAt: rating?.createdAt || null,
  };
};

export const getPublicCourseReviews = async (courseId, { limit = 6 } = {}) => {
  const courseObjectId = toObjectId(courseId);
  if (!courseObjectId) return [];

  const rows = await CourseRating.find({
    courseId: courseObjectId,
    comment: { $type: "string", $ne: "" },
  })
    .populate("studentId", "name")
    .populate("courseId", "title")
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 6)))
    .lean();

  return rows.map((row) => mapPublicReviewRow(row, { mode: "course" }));
};

export const getPublicTeacherReviews = async (teacherId, { limit = 10 } = {}) => {
  const teacherObjectId = toObjectId(teacherId);
  if (!teacherObjectId) return [];

  const rows = await CourseRating.find({
    teacherId: teacherObjectId,
    comment: { $type: "string", $ne: "" },
  })
    .populate("studentId", "name")
    .populate("courseId", "title")
    .sort({ teacherRating: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(10, Number(limit) || 10)))
    .lean();

  return rows.map((row) => mapPublicReviewRow(row, { mode: "teacher" }));
};
