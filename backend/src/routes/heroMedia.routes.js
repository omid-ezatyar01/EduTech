import express from "express";
import { admin, protect } from "../middlewares/authMiddleware.js";
import heroMediaUpload from "../middlewares/heroMediaUpload.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createHeroMedia,
  deleteHeroMedia,
  getAdminHeroMedia,
  getPublicHeroMedia,
  updateHeroMedia,
  uploadHeroMedia,
} from "../controllers/heroMediaController.js";
import {
  createHeroMediaSchema,
  heroMediaIdParamSchema,
  updateHeroMediaSchema,
} from "../validators/heroMedia.validators.js";

const router = express.Router();

router.get("/hero-media", getPublicHeroMedia);
router.get("/admin/hero-media", protect, admin, getAdminHeroMedia);
router.post("/admin/hero-media/upload", protect, admin, heroMediaUpload.single("media"), uploadHeroMedia);
router.post("/admin/hero-media", protect, admin, validateRequest(createHeroMediaSchema), createHeroMedia);
router.patch("/admin/hero-media/:id", protect, admin, validateRequest(heroMediaIdParamSchema, "params"), validateRequest(updateHeroMediaSchema), updateHeroMedia);
router.delete("/admin/hero-media/:id", protect, admin, validateRequest(heroMediaIdParamSchema, "params"), deleteHeroMedia);

export default router;
