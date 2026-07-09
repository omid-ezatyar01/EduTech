import express from "express";
import {
  getCourseSharePreview,
  getTeacherSharePreview,
} from "../controllers/sharePreviewController.js";

const router = express.Router();

router.get("/share/course/:identifier", getCourseSharePreview);
router.get("/share/teacher/:id", getTeacherSharePreview);

export default router;
