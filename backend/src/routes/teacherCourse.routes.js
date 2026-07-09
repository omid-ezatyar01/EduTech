import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import courseThumbnailUpload from "../middlewares/courseThumbnailUpload.js";
import courseResourceUpload from "../middlewares/courseResourceUpload.js";
import normalizeCoursePayload from "../middlewares/normalizeCoursePayload.js";
import {
  createTeacherCourse,
  deleteTeacherCourse,
  endTeacherCourseClass,
  getTeacherCourseById,
  getTeacherCourses,
  getTeacherCoursePricingSettings,
  requestTeacherCourseCancellation,
  startTeacherCourseClass,
  updateTeacherCourse,
} from "../controllers/teacherCourseController.js";
import {
  createCourseResource,
  deleteCourseResource,
  getCourseResources,
  updateCourseResource,
} from "../controllers/courseResourceController.js";
import {
  courseListQuerySchema,
  courseResourceParamSchema,
  createCourseByTeacherSchema,
  idParamSchema,
  requestCourseCancellationSchema,
  updateCourseByTeacherSchema,
} from "../validators/course.validators.js";

const router = express.Router();

router.use(protect, authorizeRoles("teacher"), requireApprovedTeacher());

router.get("/courses/pricing-settings", getTeacherCoursePricingSettings);

router
  .route("/courses")
  .post(
    courseThumbnailUpload.single("thumbnailFile"),
    normalizeCoursePayload,
    validateRequest(createCourseByTeacherSchema),
    createTeacherCourse,
  )
  .get(validateRequest(courseListQuerySchema, "query"), getTeacherCourses);

router
  .route("/courses/:id")
  .get(validateRequest(idParamSchema, "params"), getTeacherCourseById)
  .patch(
    courseThumbnailUpload.single("thumbnailFile"),
    normalizeCoursePayload,
    validateRequest(idParamSchema, "params"),
    validateRequest(updateCourseByTeacherSchema),
    updateTeacherCourse,
  )
  .delete(validateRequest(idParamSchema, "params"), deleteTeacherCourse);

router.post(
  "/courses/:id/start-class",
  validateRequest(idParamSchema, "params"),
  startTeacherCourseClass,
);

router.post(
  "/courses/:id/end-class",
  validateRequest(idParamSchema, "params"),
  endTeacherCourseClass,
);

router.post(
  "/courses/:id/cancellation-request",
  validateRequest(idParamSchema, "params"),
  validateRequest(requestCourseCancellationSchema),
  requestTeacherCourseCancellation,
);

router
  .route("/courses/:id/resources")
  .get(validateRequest(idParamSchema, "params"), getCourseResources)
  .post(
    courseResourceUpload.single("resourceFile"),
    validateRequest(idParamSchema, "params"),
    createCourseResource,
  );

router
  .route("/courses/:id/resources/:resourceId")
  .patch(
    courseResourceUpload.single("resourceFile"),
    validateRequest(courseResourceParamSchema, "params"),
    updateCourseResource,
  )
  .delete(validateRequest(courseResourceParamSchema, "params"), deleteCourseResource);

export default router;
