import mongoose from "mongoose";
import CourseRating from "../models/CourseRating.js";
import TeacherRating from "../models/TeacherRating.js";
import Enrollment from "../models/Enrollment.js";

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
      select: "title thumbnail teacher teacherId createdBy status isPublished classEndedAt classCancelledAt",
      populate: [
        { path: "teacher", select: "name avatar" },
        { path: "teacherId", select: "name avatar" },
        { path: "createdBy", select: "name avatar" },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 5)));

  const prompts = [];

  for (const enrollment of enrollments) {
    const course = enrollment?.courseId;
    if (!course || typeof course !== "object" || !course._id) continue;
    if (
      course.status !== "published" ||
      course.isPublished !== true ||
      course.classEndedAt ||
      course.classCancelledAt
    ) continue;

    const existingRating = await CourseRating.exists({
      studentId: studentObjectId,
      courseId: course._id,
    });
    if (existingRating) continue;

    const teacher = course.teacherId || course.teacher || course.createdBy || null;
    const teacherId =
      typeof teacher === "object" && teacher?._id
        ? teacher._id
        : teacher;
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
    });
  }

  return prompts;
};

export const assertStudentCanRateCourse = async (studentId, courseId) => {
  const prompts = await getEligibleCourseRatingPrompts(studentId, { courseId, limit: 1 });
  return prompts[0] || null;
};

export const getEligibleTeacherRatingPrompts = async (studentId, { teacherId = null, limit = 10 } = {}) => {
  const studentObjectId = toObjectId(studentId);
  const teacherObjectId = teacherId ? toObjectId(teacherId) : null;
  if (!studentObjectId || (teacherId && !teacherObjectId)) return [];
  const enrollments = await Enrollment.find({ studentId: studentObjectId, ...activeEnrollmentFilter() })
    .populate({ path: "courseId", select: "title teacher teacherId createdBy status isPublished classEndedAt classCancelledAt", populate: [{ path: "teacher", select: "name avatar" }, { path: "teacherId", select: "name avatar" }, { path: "createdBy", select: "name avatar" }] })
    .sort({ updatedAt: -1 }).limit(50);
  const prompts = [];
  const seen = new Set();
  for (const enrollment of enrollments) {
    const course = enrollment?.courseId;
    if (!course?._id || course.status !== "published" || course.isPublished !== true || course.classEndedAt || course.classCancelledAt) continue;
    const teacher = course.teacherId || course.teacher || course.createdBy;
    const resolvedTeacherId = toObjectId(teacher?._id || teacher);
    if (!resolvedTeacherId || (teacherObjectId && String(resolvedTeacherId) !== String(teacherObjectId)) || seen.has(String(resolvedTeacherId))) continue;
    if (await TeacherRating.exists({ studentId: studentObjectId, teacherId: resolvedTeacherId })) continue;
    seen.add(String(resolvedTeacherId));
    prompts.push({ teacherId: String(resolvedTeacherId), teacherName: teacher?.name || "Teacher", teacherAvatar: teacher?.avatar || "", eligibilityCourseId: String(course._id), eligibilityCourseTitle: course.title || "Course" });
    if (prompts.length >= Math.max(1, Math.min(20, Number(limit) || 10))) break;
  }
  return prompts;
};

export const assertStudentCanRateTeacher = async (studentId, teacherId) => (await getEligibleTeacherRatingPrompts(studentId, { teacherId, limit: 1 }))[0] || null;

export const getCourseRatingAggregates = async (courseIds = []) => {
  const ids = courseIds.map(toObjectId).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await CourseRating.aggregate([
    { $match: { courseId: { $in: ids }, moderationStatus: "published" } },
    {
      $group: {
        _id: "$courseId",
        rating: { $avg: "$courseRating" },
        teacherRating: { $avg: "$teacherRating" },
        ratingCount: { $sum: 1 },
        oneStar: { $sum: { $cond: [{ $eq: ["$courseRating", 1] }, 1, 0] } },
        twoStar: { $sum: { $cond: [{ $eq: ["$courseRating", 2] }, 1, 0] } },
        threeStar: { $sum: { $cond: [{ $eq: ["$courseRating", 3] }, 1, 0] } },
        fourStar: { $sum: { $cond: [{ $eq: ["$courseRating", 4] }, 1, 0] } },
        fiveStar: { $sum: { $cond: [{ $eq: ["$courseRating", 5] }, 1, 0] } },
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
        ratingDistribution: { 1: row.oneStar, 2: row.twoStar, 3: row.threeStar, 4: row.fourStar, 5: row.fiveStar },
      },
    ]),
  );
};

export const getTeacherRatingAggregates = async (teacherIds = []) => {
  const ids = teacherIds.map(toObjectId).filter(Boolean);
  if (!ids.length) return new Map();

  const rows = await TeacherRating.aggregate([
    { $match: { teacherId: { $in: ids }, moderationStatus: "published" } },
    {
      $group: {
        _id: "$teacherId",
        rating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
        oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }, twoStar: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } }, threeStar: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } }, fourStar: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } }, fiveStar: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        rating: roundRating(row.rating),
        ratingCount: Number(row.ratingCount || 0),
        ratingDistribution: { 1: row.oneStar, 2: row.twoStar, 3: row.threeStar, 4: row.fourStar, 5: row.fiveStar },
      },
    ]),
  );
};

const mapPublicReviewRow = (rating = {}, { mode = "course" } = {}) => {
  const studentName = rating?.displayName === false
    ? "Anonymous learner"
    : String(rating?.studentId?.name || "Student").trim() || "Student";
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
    tags: Array.isArray(rating?.tags) ? rating.tags : [],
    verifiedLearner: true,
    teacherReply: String(rating?.teacherReply || "").trim(),
    helpfulCount: Array.isArray(rating?.helpfulBy) ? rating.helpfulBy.length : 0,
  };
};

export const getPublicCourseReviews = async (courseId, { limit = 6 } = {}) => {
  const courseObjectId = toObjectId(courseId);
  if (!courseObjectId) return [];

  const rows = await CourseRating.find({
    courseId: courseObjectId,
    moderationStatus: "published",
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

  const rows = await TeacherRating.find({
    teacherId: teacherObjectId,
    moderationStatus: "published",
  })
    .populate("studentId", "name")
    .populate("eligibilityCourseId", "title")
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(10, Number(limit) || 10)))
    .lean();

  return rows.map((row) => ({ ...mapPublicReviewRow({ ...row, teacherRating: row.rating, courseId: row.eligibilityCourseId }, { mode: "teacher" }), teacherRating: Number(row.rating || 0), rating: Number(row.rating || 0) }));
};
