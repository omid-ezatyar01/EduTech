import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import {
  getPendingStudentCourseRatings,
  getStudentRatings,
  updateStudentRating,
  submitPlatformFeedback,
  getTeacherRatingInsights,
  replyToTeacherRating,
  removeTeacherRating,
  setTeacherRatingVisibility,
  getAdminFeedback,
  moderateAdminRating,
  updateAdminPlatformFeedback,
  toggleRatingHelpful,
  reportRating,
  submitStudentCourseRating,
  getPendingStudentTeacherRatings,
  getStudentTeacherRatings,
  submitStudentTeacherRating,
  updateStudentTeacherRating,
} from "../controllers/courseRatingController.js";

const router = express.Router();

router.get(
  "/student/ratings/pending",
  protect,
  authorizeRoles("student"),
  getPendingStudentCourseRatings,
);

router.post(
  "/student/ratings",
  protect,
  authorizeRoles("student"),
  submitStudentCourseRating,
);

router.get("/student/ratings", protect, authorizeRoles("student"), getStudentRatings);
router.patch("/student/ratings/:id", protect, authorizeRoles("student"), updateStudentRating);
router.get("/student/teacher-ratings/pending", protect, authorizeRoles("student"), getPendingStudentTeacherRatings);
router.get("/student/teacher-ratings", protect, authorizeRoles("student"), getStudentTeacherRatings);
router.post("/student/teacher-ratings", protect, authorizeRoles("student"), submitStudentTeacherRating);
router.patch("/student/teacher-ratings/:id", protect, authorizeRoles("student"), updateStudentTeacherRating);
router.post("/student/platform-feedback", protect, authorizeRoles("student"), submitPlatformFeedback);
router.get("/teacher/feedback", protect, authorizeRoles("teacher"), getTeacherRatingInsights);
router.patch("/teacher/feedback/:id/reply", protect, authorizeRoles("teacher"), replyToTeacherRating);
router.patch("/teacher/feedback/:id/visibility", protect, authorizeRoles("teacher"), setTeacherRatingVisibility);
router.delete("/teacher/feedback/:id", protect, authorizeRoles("teacher"), removeTeacherRating);
router.get("/admin/feedback", protect, authorizeRoles("admin"), getAdminFeedback);
router.patch("/admin/feedback/ratings/:id", protect, authorizeRoles("admin"), moderateAdminRating);
router.patch("/admin/feedback/platform/:id", protect, authorizeRoles("admin"), updateAdminPlatformFeedback);
router.post("/ratings/:id/helpful", protect, authorizeRoles("student"), toggleRatingHelpful);
router.post("/ratings/:id/report", protect, authorizeRoles("student"), reportRating);

export default router;
