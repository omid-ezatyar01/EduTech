import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createCategory,
  deleteCategory,
  getAdminCategories,
  getPublicCategories,
  updateCategory,
} from "../controllers/categoryController.js";
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validators.js";

const router = express.Router();

router.get("/categories", getPublicCategories);

router.post(
  "/admin/categories",
  protect,
  authorizeRoles("admin"),
  validateRequest(createCategorySchema),
  createCategory,
);
router.get("/admin/categories", protect, authorizeRoles("admin"), getAdminCategories);
router.patch(
  "/admin/categories/:id",
  protect,
  authorizeRoles("admin"),
  validateRequest(categoryIdParamSchema, "params"),
  validateRequest(updateCategorySchema),
  updateCategory,
);
router.delete(
  "/admin/categories/:id",
  protect,
  authorizeRoles("admin"),
  validateRequest(categoryIdParamSchema, "params"),
  deleteCategory,
);

export default router;
