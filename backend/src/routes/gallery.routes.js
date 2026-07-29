import express from "express";
import { admin, protect } from "../middlewares/authMiddleware.js";
import galleryImageUpload from "../middlewares/galleryImageUpload.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createGalleryImage,
  createGalleryCategory,
  deleteGalleryImage,
  getAdminGallery,
  getAdminGalleryCategories,
  getPublicGallery,
  updateGalleryImage,
  uploadGalleryImage,
} from "../controllers/galleryController.js";
import {
  adminGalleryQuerySchema,
  createGalleryImageSchema,
  createGalleryCategorySchema,
  galleryImageIdParamSchema,
  publicGalleryQuerySchema,
  updateGalleryImageSchema,
} from "../validators/gallery.validators.js";

const router = express.Router();

router.get(
  "/gallery",
  validateRequest(publicGalleryQuerySchema, "query"),
  getPublicGallery,
);

router.get(
  "/admin/gallery",
  protect,
  admin,
  validateRequest(adminGalleryQuerySchema, "query"),
  getAdminGallery,
);
router.get(
  "/admin/gallery/categories",
  protect,
  admin,
  getAdminGalleryCategories,
);
router.post(
  "/admin/gallery/categories",
  protect,
  admin,
  validateRequest(createGalleryCategorySchema),
  createGalleryCategory,
);
router.post(
  "/admin/gallery/upload",
  protect,
  admin,
  galleryImageUpload.single("image"),
  uploadGalleryImage,
);
router.post(
  "/admin/gallery",
  protect,
  admin,
  validateRequest(createGalleryImageSchema),
  createGalleryImage,
);
router.patch(
  "/admin/gallery/:id",
  protect,
  admin,
  validateRequest(galleryImageIdParamSchema, "params"),
  validateRequest(updateGalleryImageSchema),
  updateGalleryImage,
);
router.delete(
  "/admin/gallery/:id",
  protect,
  admin,
  validateRequest(galleryImageIdParamSchema, "params"),
  deleteGalleryImage,
);

export default router;
