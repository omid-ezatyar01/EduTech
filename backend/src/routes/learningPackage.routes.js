import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import learningPackageCoverUpload from "../middlewares/learningPackageCoverUpload.js";
import {
  createLearningPackage,
  deleteLearningPackage,
  getAdminLearningPackages,
  getPublicLearningPackageBySlug,
  getPublicLearningPackages,
  updateLearningPackage,
  uploadLearningPackageCover,
} from "../controllers/learningPackageController.js";
import {
  createLearningPackageSchema,
  learningPackageIdParamsSchema,
  learningPackageSlugParamsSchema,
  updateLearningPackageSchema,
} from "../validators/learningPackage.validators.js";

const router = express.Router();

router.get("/packages", getPublicLearningPackages);
router.get("/packages/:slug", validateRequest(learningPackageSlugParamsSchema, "params"), getPublicLearningPackageBySlug);

router.use("/admin/packages", protect, authorizeRoles("admin"));
router.post(
  "/admin/packages/cover",
  learningPackageCoverUpload.single("cover"),
  uploadLearningPackageCover,
);
router
  .route("/admin/packages")
  .get(getAdminLearningPackages)
  .post(validateRequest(createLearningPackageSchema), createLearningPackage);
router
  .route("/admin/packages/:id")
  .patch(validateRequest(learningPackageIdParamsSchema, "params"), validateRequest(updateLearningPackageSchema), updateLearningPackage)
  .delete(validateRequest(learningPackageIdParamsSchema, "params"), deleteLearningPackage);

export default router;
