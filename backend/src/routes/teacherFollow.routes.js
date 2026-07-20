import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import { idParamSchema } from "../validators/course.validators.js";
import {
  followTeacher, getStudentTeacherNotifications, getTeacherFollowStatus,
  markAllStudentTeacherNotificationsRead, markStudentTeacherNotificationRead, unfollowTeacher,
} from "../controllers/teacherFollowController.js";

const router = express.Router();
const studentOnly = [protect, authorizeRoles("student")];

router.get("/teachers/:id/follow-status", ...studentOnly, validateRequest(idParamSchema, "params"), getTeacherFollowStatus);
router.post("/teachers/:id/follow", ...studentOnly, validateRequest(idParamSchema, "params"), followTeacher);
router.delete("/teachers/:id/follow", ...studentOnly, validateRequest(idParamSchema, "params"), unfollowTeacher);
router.get("/student/teacher-notifications", ...studentOnly, getStudentTeacherNotifications);
router.patch("/student/teacher-notifications/read-all", ...studentOnly, markAllStudentTeacherNotificationsRead);
router.patch("/student/teacher-notifications/:id/read", ...studentOnly, validateRequest(idParamSchema, "params"), markStudentTeacherNotificationRead);

export default router;
