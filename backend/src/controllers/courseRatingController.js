import asyncHandler from "../middlewares/asyncHandler.js";
import CourseRating from "../models/CourseRating.js";
import TeacherRating from "../models/TeacherRating.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  assertStudentCanRateCourse,
  assertStudentCanRateTeacher,
  getEligibleCourseRatingPrompts,
  getEligibleTeacherRatingPrompts,
} from "../utils/courseRatings.js";
import PlatformFeedback from "../models/PlatformFeedback.js";
import { DateTime } from "luxon";

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
    throw new ApiError(403, "Only enrolled students can rate an active course before it ends");
  }

  const courseRating = normalizeRating(req.body?.courseRating, "courseRating");
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
  canEdit: true,
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
  row.courseRating = normalizeRating(req.body?.courseRating, "courseRating");
  row.comment = String(req.body?.comment || "").trim().slice(0, 500);
  row.tags = [...new Set((Array.isArray(req.body?.tags) ? req.body.tags : []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 5);
  row.displayName = req.body?.displayName !== false;
  await row.save();
  await row.populate("courseId", "title thumbnail");
  await row.populate("teacherId", "name avatar");
  return res.json(new ApiResponse({ message: "Rating updated successfully", data: ratingPayload(row) }));
});

const teacherRatingPayload = (row) => ({
  _id: String(row._id), teacherId: row.teacherId?._id ? String(row.teacherId._id) : String(row.teacherId || ""), teacherName: row.teacherId?.name || "Teacher",
  eligibilityCourseId: row.eligibilityCourseId?._id ? String(row.eligibilityCourseId._id) : String(row.eligibilityCourseId || ""), eligibilityCourseTitle: row.eligibilityCourseId?.title || "Course", courseTitle: row.eligibilityCourseId?.title || "Course",
  studentName: row.displayName === false ? "Anonymous learner" : row.studentId?.name || "Student", teacherRating: Number(row.rating || 0), rating: Number(row.rating || 0), comment: row.comment || "", tags: row.tags || [], displayName: row.displayName !== false,
  moderationStatus: row.moderationStatus || "pending", teacherReply: row.teacherReply || "", createdAt: row.createdAt, updatedAt: row.updatedAt, canEdit: true, helpfulCount: row.helpfulBy?.length || 0, reportCount: row.reports?.length || 0, reviewType: "teacher",
});

export const getPendingStudentTeacherRatings = asyncHandler(async (req, res) => res.json(new ApiResponse({ message: "Pending teacher ratings fetched successfully", data: await getEligibleTeacherRatingPrompts(req.user._id, { limit: Number(req.query.limit) || 10 }) })));

export const submitStudentTeacherRating = asyncHandler(async (req, res) => {
  const teacherId = String(req.body?.teacherId || "").trim();
  const prompt = await assertStudentCanRateTeacher(req.user._id, teacherId);
  if (!prompt) throw new ApiError(403, "Only students enrolled in an active course from this teacher can submit a teacher review");
  const row = await TeacherRating.create({ studentId: req.user._id, teacherId: prompt.teacherId, eligibilityCourseId: prompt.eligibilityCourseId, rating: normalizeRating(req.body?.teacherRating, "teacherRating"), comment: String(req.body?.comment || "").trim().slice(0, 500), tags: [...new Set((req.body?.tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 5), displayName: req.body?.displayName !== false }).catch((error) => { if (error?.code === 11000) throw new ApiError(409, "You have already reviewed this teacher"); throw error; });
  return res.status(201).json(new ApiResponse({ statusCode: 201, message: "Teacher review submitted successfully", data: teacherRatingPayload(row) }));
});

export const getStudentTeacherRatings = asyncHandler(async (req, res) => {
  const rows = await TeacherRating.find({ studentId: req.user._id }).populate("teacherId", "name avatar").populate("eligibilityCourseId", "title").sort({ updatedAt: -1 }).lean();
  return res.json(new ApiResponse({ message: "Student teacher ratings fetched successfully", data: rows.map(teacherRatingPayload) }));
});

export const updateStudentTeacherRating = asyncHandler(async (req, res) => {
  const row = await TeacherRating.findOne({ _id: req.params.id, studentId: req.user._id });
  if (!row) throw new ApiError(404, "Teacher rating not found");
  row.rating = normalizeRating(req.body?.teacherRating, "teacherRating"); row.comment = String(req.body?.comment || "").trim().slice(0, 500); row.tags = [...new Set((req.body?.tags || []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 5); row.displayName = req.body?.displayName !== false; await row.save();
  await row.populate("teacherId", "name avatar"); await row.populate("eligibilityCourseId", "title");
  return res.json(new ApiResponse({ message: "Teacher review updated successfully", data: teacherRatingPayload(row) }));
});

export const submitPlatformFeedback = asyncHandler(async (req, res) => {
  const now = DateTime.now().setZone("Asia/Kabul");
  const feedbackMonth = now.toFormat("yyyy-MM");
  const monthStart = now.startOf("month").toUTC().toJSDate();
  const nextMonthStart = now.plus({ months: 1 }).startOf("month").toUTC().toJSDate();
  const existing = await PlatformFeedback.findOne({ userId: req.user._id, $or: [{ feedbackMonth }, { feedbackMonth: { $exists: false }, createdAt: { $gte: monthStart, $lt: nextMonthStart } }] }).select("_id createdAt score").lean();
  if (existing) throw new ApiError(409, "You have already submitted your EduTech satisfaction rating this month");
  const score = normalizeRating(req.body?.score, "score");
  const feedback = await PlatformFeedback.create({
    userId: req.user._id,
    feedbackMonth,
    type: ["feedback", "suggestion", "complaint", "bug"].includes(req.body?.type) ? req.body.type : "feedback",
    score,
    message: String(req.body?.message || "").trim().slice(0, 2000),
    page: String(req.body?.page || "").trim().slice(0, 200),
  }).catch((error) => { if (error?.code === 11000) throw new ApiError(409, "You have already submitted your EduTech satisfaction rating this month"); throw error; });
  return res.status(201).json(new ApiResponse({ statusCode: 201, message: "Feedback submitted successfully", data: feedback }));
});

export const getMonthlyPlatformFeedbackStatus = asyncHandler(async (req, res) => {
  const now = DateTime.now().setZone("Asia/Kabul");
  const feedbackMonth = now.toFormat("yyyy-MM");
  const monthStart = now.startOf("month").toUTC().toJSDate();
  const nextMonthStart = now.plus({ months: 1 }).startOf("month").toUTC().toJSDate();
  const existing = await PlatformFeedback.findOne({ userId: req.user._id, $or: [{ feedbackMonth }, { feedbackMonth: { $exists: false }, createdAt: { $gte: monthStart, $lt: nextMonthStart } }] }).select("score createdAt").lean();
  const nextAvailableAt = now.plus({ months: 1 }).startOf("month").toUTC().toISO();
  return res.json(new ApiResponse({ message: "Monthly feedback status fetched successfully", data: { canSubmit: !existing, feedbackMonth, nextAvailableAt, submittedAt: existing?.createdAt || null, score: Number(existing?.score || 0) } }));
});

export const getTeacherRatingInsights = asyncHandler(async (req, res) => {
  const rows = await TeacherRating.find({ teacherId: req.user._id, removedByTeacherAt: null })
    .populate("eligibilityCourseId", "title")
    .populate("studentId", "name")
    .sort({ createdAt: -1 })
    .lean();
  const distribution = [1, 2, 3, 4, 5].reduce((acc, value) => ({ ...acc, [value]: rows.filter((row) => row.rating === value).length }), {});
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / rows.length : 0;
  return res.json(new ApiResponse({ message: "Teacher feedback fetched successfully", data: { average: Math.round(average * 10) / 10, total: rows.length, distribution, reviews: rows.map(teacherRatingPayload) } }));
});

export const replyToTeacherRating = asyncHandler(async (req, res) => {
  const row = await TeacherRating.findOne({ _id: req.params.id, teacherId: req.user._id, removedByTeacherAt: null });
  if (!row) throw new ApiError(404, "Rating not found");
  row.teacherReply = String(req.body?.reply || "").trim().slice(0, 500);
  row.teacherRepliedAt = row.teacherReply ? new Date() : null;
  await row.save();
  return res.json(new ApiResponse({ message: "Reply saved successfully", data: teacherRatingPayload(row) }));
});

export const setTeacherRatingVisibility = asyncHandler(async (req, res) => {
  const row = await TeacherRating.findOne({ _id: req.params.id, teacherId: req.user._id, removedByTeacherAt: null });
  if (!row) throw new ApiError(404, "Rating not found");
  const hidden = req.body?.hidden === true;
  row.moderationStatus = hidden ? "hidden" : "pending";
  row.moderatedBy = req.user._id;
  row.moderatedAt = new Date();
  await row.save();
  await row.populate("eligibilityCourseId", "title");
  await row.populate("studentId", "name");
  return res.json(new ApiResponse({ message: hidden ? "Review hidden successfully" : "Review sent for moderation", data: teacherRatingPayload(row) }));
});

export const removeTeacherRating = asyncHandler(async (req, res) => {
  const row = await TeacherRating.findOne({ _id: req.params.id, teacherId: req.user._id });
  if (!row) throw new ApiError(404, "Rating not found");
  row.moderationStatus = "hidden";
  row.removedByTeacherAt = new Date();
  row.moderatedBy = req.user._id;
  row.moderatedAt = new Date();
  await row.save();
  return res.json(new ApiResponse({ message: "Review removed successfully", data: { _id: String(row._id) } }));
});

export const getAdminFeedback = asyncHandler(async (req, res) => {
  const [courseRatings, teacherRatings, feedback] = await Promise.all([
    CourseRating.find().populate("courseId", "title").populate("teacherId", "name").populate("studentId", "name email").sort({ createdAt: -1 }).limit(200).lean(),
    TeacherRating.find().populate("eligibilityCourseId", "title").populate("teacherId", "name").populate("studentId", "name email").sort({ createdAt: -1 }).limit(200).lean(),
    PlatformFeedback.find().populate("userId", "name email").sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  return res.json(new ApiResponse({ message: "Feedback center fetched successfully", data: { ratings: [...courseRatings.map((row) => ({ ...ratingPayload(row), reviewType: "course" })), ...teacherRatings.map(teacherRatingPayload)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), feedback } }));
});

export const moderateAdminRating = asyncHandler(async (req, res) => {
  let row = await CourseRating.findById(req.params.id);
  let mode = "course";
  if (!row) { row = await TeacherRating.findById(req.params.id); mode = "teacher"; }
  if (!row) throw new ApiError(404, "Rating not found");
  row.moderationStatus = req.body?.status === "hidden" ? "hidden" : "published";
  row.moderatedBy = req.user._id;
  row.moderatedAt = new Date();
  await row.save();
  return res.json(new ApiResponse({ message: "Review moderation updated", data: mode === "teacher" ? teacherRatingPayload(row) : ratingPayload(row) }));
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
  let row = await CourseRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) row = await TeacherRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) throw new ApiError(404, "Review not found");
  const userId = String(req.user._id);
  const hasMarked = (row.helpfulBy || []).some((id) => String(id) === userId);
  row.helpfulBy = hasMarked ? row.helpfulBy.filter((id) => String(id) !== userId) : [...row.helpfulBy, req.user._id];
  await row.save();
  return res.json(new ApiResponse({ message: "Helpful vote updated", data: { helpful: !hasMarked, helpfulCount: row.helpfulBy.length } }));
});

export const reportRating = asyncHandler(async (req, res) => {
  let row = await CourseRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) row = await TeacherRating.findOne({ _id: req.params.id, moderationStatus: "published" });
  if (!row) throw new ApiError(404, "Review not found");
  if ((row.reports || []).some((report) => String(report.userId) === String(req.user._id))) throw new ApiError(409, "You already reported this review");
  row.reports.push({ userId: req.user._id, reason: String(req.body?.reason || "Inappropriate content").trim().slice(0, 300) });
  await row.save();
  return res.status(201).json(new ApiResponse({ statusCode: 201, message: "Review reported", data: { reported: true } }));
});
