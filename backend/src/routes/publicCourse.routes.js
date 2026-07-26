import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  getPublicPlatformStats,
  getPublishedCourseBySlug,
  getPublishedCourses,
} from "../controllers/publicCourseController.js";
import {
  enrollInCourse,
  getStudentAssignments,
  getStudentEnrollments,
  getStudentLearningStats,
  getStudentResources,
  verifyCertificateById,
} from "../controllers/enrollmentController.js";
import { courseListQuerySchema, idParamSchema, slugParamSchema } from "../validators/course.validators.js";
import {
  certificateIdParamSchema,
  enrollCourseBodySchema,
} from "../validators/enrollment.validators.js";

const router = express.Router();

router.get("/courses", validateRequest(courseListQuerySchema, "query"), getPublishedCourses);
router.get("/courses/:slug", validateRequest(slugParamSchema, "params"), getPublishedCourseBySlug);
router.get("/stats/platform", getPublicPlatformStats);
router.get(
  "/certificates/verify/:certificateId",
  validateRequest(certificateIdParamSchema, "params"),
  verifyCertificateById,
);

router.post(
  "/courses/:id/enroll",
  protect,
  authorizeRoles("student"),
  validateRequest(idParamSchema, "params"),
  validateRequest(enrollCourseBodySchema),
  enrollInCourse,
);

router.get("/student/enrollments", protect, authorizeRoles("student"), getStudentEnrollments);
router.get("/student/assignments", protect, authorizeRoles("student"), getStudentAssignments);
router.get("/student/resources", protect, authorizeRoles("student"), getStudentResources);
router.get("/student/learning-stats", protect, authorizeRoles("student"), getStudentLearningStats);

export default router;
