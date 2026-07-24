import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import {
  getTeacherDashboard,
  getTeacherProfile,
  getTeacherStudents,
} from "../controllers/teacherPortalController.js";
import {
  getTeacherNotifications,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
} from "../controllers/teacherNotificationController.js";
import validateRequest from "../middlewares/validateRequest.js";
import { idParamSchema } from "../validators/course.validators.js";

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
router.get(
  "/teacher/notifications",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher(),
  getTeacherNotifications,
);
router.patch(
  "/teacher/notifications/read-all",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher(),
  markAllTeacherNotificationsRead,
);
router.patch(
  "/teacher/notifications/:id/read",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher(),
  validateRequest(idParamSchema, "params"),
  markTeacherNotificationRead,
);

export default router;
