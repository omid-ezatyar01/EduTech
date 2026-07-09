import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import {
  getPendingStudentCourseRatings,
  submitStudentCourseRating,
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

export default router;
