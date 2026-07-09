import express from "express";
import {
  getPublicTeacherById,
  getPublicTeachers,
} from "../controllers/publicTeacherController.js";
import validateRequest from "../middlewares/validateRequest.js";
import { idParamSchema } from "../validators/course.validators.js";
import { publicTeacherListQuerySchema } from "../validators/publicTeacher.validators.js";

const router = express.Router();

router.get(
  "/teachers",
  validateRequest(publicTeacherListQuerySchema, "query"),
  getPublicTeachers,
);
router.get("/teachers/:id", validateRequest(idParamSchema, "params"), getPublicTeacherById);

export default router;
