import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import {
  getTeacherDashboard,
  getTeacherProfile,
  getTeacherStudents,
} from "../controllers/teacherPortalController.js";

const router = express.Router();

router.get(
  "/teacher/dashboard",
  protect,
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  getTeacherDashboard,
);
router.get(
  "/teacher/students",
  protect,
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  getTeacherStudents,
);
router.get("/teacher/profile", protect, authorizeRoles("teacher", "admin"), getTeacherProfile);

export default router;
