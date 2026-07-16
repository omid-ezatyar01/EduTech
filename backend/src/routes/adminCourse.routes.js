import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import courseThumbnailUpload from "../middlewares/courseThumbnailUpload.js";
import normalizeCoursePayload from "../middlewares/normalizeCoursePayload.js";
import {
  approveCourseCancellation,
  approveCourseEndRequest,
  approveCourse,
  createAdminCourse,
  deleteAdminCourse,
  getAdminCourseById,
  getAdminCourses,
  publishCourse,
  rejectCourseCancellation,
  rejectCourseEndRequest,
  rejectCourse,
  unpublishCourse,
  updateAdminCourse,
} from "../controllers/adminCourseController.js";
import {
  courseListQuerySchema,
  createCourseByAdminSchema,
  idParamSchema,
  rejectCourseSchema,
  reviewCourseCancellationSchema,
  reviewCourseEndSchema,
  adminCoursePublishSchema,
  updateCourseByAdminSchema,
} from "../validators/course.validators.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router
  .route("/courses")
  .post(
    courseThumbnailUpload.single("thumbnailFile"),
    normalizeCoursePayload,
    validateRequest(createCourseByAdminSchema),
    createAdminCourse,
  )
  .get(validateRequest(courseListQuerySchema, "query"), getAdminCourses);

router
  .route("/courses/:id")
  .get(validateRequest(idParamSchema, "params"), getAdminCourseById)
  .patch(
    courseThumbnailUpload.single("thumbnailFile"),
    normalizeCoursePayload,
    validateRequest(idParamSchema, "params"),
    validateRequest(updateCourseByAdminSchema),
    updateAdminCourse,
  )
  .delete(validateRequest(idParamSchema, "params"), deleteAdminCourse);

router.patch("/courses/:id/approve", validateRequest(idParamSchema, "params"), approveCourse);
router.patch(
  "/courses/:id/reject",
  validateRequest(idParamSchema, "params"),
  validateRequest(rejectCourseSchema),
  rejectCourse,
);
router.patch(
  "/courses/:id/publish",
  validateRequest(idParamSchema, "params"),
  validateRequest(adminCoursePublishSchema),
  publishCourse,
);
router.patch("/courses/:id/unpublish", validateRequest(idParamSchema, "params"), unpublishCourse);
router.patch(
  "/courses/:id/cancellation-request/approve",
  validateRequest(idParamSchema, "params"),
  validateRequest(reviewCourseCancellationSchema),
  approveCourseCancellation,
);
router.patch(
  "/courses/:id/cancellation-request/reject",
  validateRequest(idParamSchema, "params"),
  validateRequest(reviewCourseCancellationSchema),
  rejectCourseCancellation,
);
router.patch(
  "/courses/:id/end-request/approve",
  validateRequest(idParamSchema, "params"),
  validateRequest(reviewCourseEndSchema),
  approveCourseEndRequest,
);
router.patch(
  "/courses/:id/end-request/reject",
  validateRequest(idParamSchema, "params"),
  validateRequest(reviewCourseEndSchema),
  rejectCourseEndRequest,
);

export default router;
