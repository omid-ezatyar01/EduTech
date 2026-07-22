import asyncHandler from "../middlewares/asyncHandler.js";
import CourseRating from "../models/CourseRating.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  assertStudentCanRateCourse,
  getEligibleCourseRatingPrompts,
} from "../utils/courseRatings.js";
import PlatformFeedback from "../models/PlatformFeedback.js";

const normalizeRating = (value, fieldName) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, `${fieldName} must be an integer from 1 to 5`);
  }
  return rating;
};

export const getPendingStudentCourseRatings = asyncHandler(async (req, res) => {
  const prompts = await getEligibleCourseRatingPrompts(req.user._id, {
    limit: Math.min(10, Math.max(1, Number(req.query.limit) || 5)),
  });

  return res.json(
    new ApiResponse({
      message: "Pending course ratings fetched successfully",
      data: prompts,
    }),
  );
});

export const submitStudentCourseRating = asyncHandler(async (req, res) => {
  const courseId = String(req.body?.courseId || "").trim();
  if (!courseId) {
    throw new ApiError(400, "courseId is required");
  }

  const prompt = await assertStudentCanRateCourse(req.user._id, courseId);
  if (!prompt) {
    throw new ApiError(403, "You can rate this course after joining 2 live classes");
  }

  const courseRating = normalizeRating(req.body?.courseRating, "courseRating");
  const teacherRating = normalizeRating(req.body?.teacherRating, "teacherRating");
  const comment = String(req.body?.comment || "").trim().slice(0, 500);
  const tags = [...new Set((Array.isArray(req.body?.tags) ? req.body.tags : []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 5);
  const displayName = req.body?.displayName !== false;

  const existingRating = await CourseRating.findOne({
    studentId: req.user._id,
    courseId: prompt.courseId,
  }).select("_id");

  if (existingRating) {
    throw new ApiError(409, "You have already submitted a rating for this course");
  }

  const rating = await CourseRating.create({
    studentId: req.user._id,
    courseId: prompt.courseId,
    teacherId: prompt.teacherId,
    courseRating,
    teacherRating,
    comment,
    tags,
    displayName,
  }).catch((error) => {
    if (error?.code === 11000) {
      throw new ApiError(409, "You have already submitted a rating for this course");
    }
    throw error;
  });

  return res.status(201).json(
    new ApiResponse({
      statusCode: 201,
      message: "Rating submitted successfully",
      data: {
        _id: rating._id,
        courseId: String(rating.courseId),
        teacherId: String(rating.teacherId),
        courseRating: rating.courseRating,
        teacherRating: rating.teacherRating,
        comment: rating.comment || "",
      },
    }),
  );
});

const ratingPayload = (row) => ({
  _id: String(row._id),
  courseId: row.courseId?._id ? String(row.courseId._id) : String(row.courseId || ""),
  courseTitle: row.courseId?.title || "Course",
  teacherId: row.teacherId?._id ? String(row.teacherId._id) : String(row.teacherId || ""),
  teacherName: row.teacherId?.name || "Teacher",
  studentName: row.displayName === false ? "Anonymous learner" : row.studentId?.name || "Student",
  courseRating: Number(row.courseRating || 0),
  teacherRating: Number(row.teacherRating || 0),
  comment: row.comment || "",
  tags: Array.isArray(row.tags) ? row.tags : [],
  displayName: row.displayName !== false,
  moderationStatus: row.moderationStatus || "published",
  teacherReply: row.teacherReply || "",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  canEdit: Date.now() <= new Date(row.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000,
  helpfulCount: Array.isArray(row.helpfulBy) ? row.helpfulBy.length : 0,
  reportCount: Array.isArray(row.reports) ? row.reports.length : 0,
});

export const getStudentRatings = asyncHandler(async (req, res) => {
  const ratings = await CourseRating.find({ studentId: req.user._id })
    .populate("courseId", "title thumbnail")
    .populate("teacherId", "name avatar")
    .sort({ updatedAt: -1 })
    .lean();
  return res.json(new ApiResponse({ message: "Student ratings fetched successfully", data: ratings.map(ratingPayload) }));
});

export const updateStudentRating = asyncHandler(async (req, res) => {
  const row = await CourseRating.findOne({ _id: req.params.id, studentId: req.user._id });
  if (!row) throw new ApiError(404, "Rating not found");
  const editableUntil = new Date(row.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  if (Date.now() > editableUntil) throw new ApiError(403, "Ratings can be edited for seven days");
  row.courseRating = normalizeRating(req.body?.courseRating, "courseRating");
  row.teacherRating = normalizeRating(req.body?.teacherRating, "teacherRating");
  row.comment = String(req.body?.comment || "").trim().slice(0, 500);
  row.tags = [...new Set((Array.isArray(req.body?.tags) ? req.body.tags : []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 5);
  row.displayName = req.body?.displayName !== false;
  await row.save();
  await row.populate("courseId", "title thumbnail");
  await row.populate("teacherId", "name avatar");
  return res.json(new ApiResponse({ message: "Rating updated successfully", data: ratingPayload(row) }));
});

export const submitPlatformFeedback = asyncHandler(async (req, res) => {
  const score = normalizeRating(req.body?.score, "score");
  const feedback = await PlatformFeedback.create({
    userId: req.user._id,
    type: ["feedback", "suggestion", "complaint", "bug"].includes(req.body?.type) ? req.body.type : "feedback",
    score,
    message: String(req.body?.message || "").trim().slice(0, 2000),
    page: String(req.body?.page || "").trim().slice(0, 200),
  });
  return res.status(201).json(new ApiResponse({ statusCode: 201, message: "Feedback submitted successfully", data: feedback }));
});

export const getTeacherRatingInsights = asyncHandler(async (req, res) => {
  const rows = await CourseRating.find({ teacherId: req.user._id })
    .populate("courseId", "title")
    .populate("studentId", "name")
    .sort({ createdAt: -1 })
    .lean();
  const distribution = [1, 2, 3, 4, 5].reduce((acc, value) => ({ ...acc, [value]: rows.filter((row) => row.teacherRating === value).length }), {});
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.teacherRating || 0), 0) / rows.length : 0;
  return res.json(new ApiResponse({ message: "Teacher feedback fetched successfully", data: { average: Math.round(average * 10) / 10, total: rows.length, distribution, reviews: rows.map(ratingPayload) } }));
});

export const replyToTeacherRating = asyncHandler(async (req, res) => {
  const row = await CourseRating.findOne({ _id: req.params.id, teacherId: req.user._id });
  if (!row) throw new ApiError(404, "Rating not found");
  row.teacherReply = String(req.body?.reply || "").trim().slice(0, 500);
  row.teacherRepliedAt = row.teacherReply ? new Date() : null;
  await row.save();
  return res.json(new ApiResponse({ message: "Reply saved successfully", data: ratingPayload(row) }));
});

export const getAdminFeedback = asyncHandler(async (req, res) => {
  const [ratings, feedback] = await Promise.all([
    CourseRating.find().populate("courseId", "title").populate("teacherId", "name").populate("studentId", "name email").sort({ createdAt: -1 }).limit(200).lean(),
    PlatformFeedback.find().populate("userId", "name email").sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  return res.json(new ApiResponse({ message: "Feedback center fetched successfully", data: { ratings: ratings.map(ratingPayload), feedback } }));
});

export const moderateAdminRating = asyncHandler(async (req, res) => {
  const row = await CourseRating.findById(req.params.id);
  if (!row) throw new ApiError(404, "Rating not found");
  row.moderationStatus = req.body?.status === "hidden" ? "hidden" : "published";
  row.moderatedBy = req.user._id;
  row.moderatedAt = new Date();
  await row.save();
  return res.json(new ApiResponse({ message: "Review moderation updated", data: ratingPayload(row) }));
});

export const updateAdminPlatformFeedback = asyncHandler(async (req, res) => {
  const row = await PlatformFeedback.findById(req.params.id);
  if (!row) throw new ApiError(404, "Feedback not found");
  row.status = ["new", "reviewing", "resolved"].includes(req.body?.status) ? req.body.status : row.status;
  row.adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);
  if (row.status === "resolved") { row.resolvedBy = req.user._id; row.resolvedAt = new Date(); }
  await row.save();
  return res.json(new ApiResponse({ message: "Feedback updated", data: row }));
});

export const toggleRatingHelpful = asyncHandler(async (req, res) => {
  const row = await CourseRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) throw new ApiError(404, "Review not found");
  const userId = String(req.user._id);
  const hasMarked = (row.helpfulBy || []).some((id) => String(id) === userId);
  row.helpfulBy = hasMarked ? row.helpfulBy.filter((id) => String(id) !== userId) : [...row.helpfulBy, req.user._id];
  await row.save();
  return res.json(new ApiResponse({ message: "Helpful vote updated", data: { helpful: !hasMarked, helpfulCount: row.helpfulBy.length } }));
});

export const reportRating = asyncHandler(async (req, res) => {
  const row = await CourseRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) throw new ApiError(404, "Review not found");
  if ((row.reports || []).some((report) => String(report.userId) === String(req.user._id))) throw new ApiError(409, "You already reported this review");
  row.reports.push({ userId: req.user._id, reason: String(req.body?.reason || "Inappropriate content").trim().slice(0, 300) });
  await row.save();
  return res.status(201).json(new ApiResponse({ statusCode: 201, message: "Review reported", data: { reported: true } }));
});
