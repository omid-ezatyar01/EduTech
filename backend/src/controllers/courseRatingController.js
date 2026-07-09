import asyncHandler from "../middlewares/asyncHandler.js";
import CourseRating from "../models/CourseRating.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  assertStudentCanRateCourse,
  getEligibleCourseRatingPrompts,
} from "../utils/courseRatings.js";

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
