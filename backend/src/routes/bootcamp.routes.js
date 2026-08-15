import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import bootcampCoverUpload from "../middlewares/bootcampCoverUpload.js";
import {
  createBootcamp,
  deleteBootcamp,
  getAdminBootcampRegistrations,
  getAdminBootcamps,
  getPublicBootcampBySlug,
  getPublicBootcamps,
  getStudentBootcampRegistrations,
  registerForBootcamp,
  updateBootcamp,
  uploadBootcampCover,
} from "../controllers/bootcampController.js";
import {
  bootcampIdParamsSchema,
  bootcampSlugParamsSchema,
  createBootcampSchema,
  registerBootcampSchema,
  updateBootcampSchema,
} from "../validators/bootcamp.validators.js";

const router = express.Router();

router.get("/bootcamps", getPublicBootcamps);
router.get("/bootcamps/:slug", validateRequest(bootcampSlugParamsSchema, "params"), getPublicBootcampBySlug);
router.post(
  "/bootcamps/:slug/register",
  protect,
  authorizeRoles("student"),
  validateRequest(bootcampSlugParamsSchema, "params"),
  validateRequest(registerBootcampSchema),
  registerForBootcamp,
);
router.get(
  "/student/bootcamp-registrations",
  protect,
  authorizeRoles("student"),
  getStudentBootcampRegistrations,
);

router.use("/admin/bootcamps", protect, authorizeRoles("admin"));
router.post(
  "/admin/bootcamps/cover",
  bootcampCoverUpload.single("cover"),
  uploadBootcampCover,
);
router.route("/admin/bootcamps")
  .get(getAdminBootcamps)
  .post(validateRequest(createBootcampSchema), createBootcamp);
router.get(
  "/admin/bootcamps/:id/registrations",
  validateRequest(bootcampIdParamsSchema, "params"),
  getAdminBootcampRegistrations,
);
router.route("/admin/bootcamps/:id")
  .patch(validateRequest(bootcampIdParamsSchema, "params"), validateRequest(updateBootcampSchema), updateBootcamp)
  .delete(validateRequest(bootcampIdParamsSchema, "params"), deleteBootcamp);

export default router;
