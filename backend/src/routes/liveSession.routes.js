import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  buildCourseSchedulePreview,
  cancelTeacherLiveSession,
  createTeacherLiveSession,
  deleteTeacherLiveSession,
  endTeacherLiveSession,
  generateCourseMonthlyMeetLinks,
  getAdminCourseSessions,
  getMeetAutomationConfig,
  getStudentLiveSessionLink,
  getStudentLiveSessions,
  getStudentAttendance,
  getTeacherAttendanceOverview,
  getTeacherCourseSessions,
  getTeacherLiveSessionAttendance,
  getTeacherLiveSessionById,
  getTeacherLiveSessions,
  joinStudentLiveSession,
  startTeacherLiveSession,
  updateTeacherLiveSession,
  updateTeacherLiveSessionAttendance,
} from "../controllers/liveSessionController.js";
import {
  cancelLiveSessionSchema,
  createLiveSessionSchema,
  generateMeetLinksBodySchema,
  generateMeetLinksParamSchema,
  liveSessionIdParamSchema,
  liveSessionListQuerySchema,
  studentLiveLinkParamSchema,
  studentLiveSessionQuerySchema,
  attendanceListQuerySchema,
  updateLiveSessionAttendanceSchema,
  updateLiveSessionSchema,
} from "../validators/liveSession.validators.js";

const router = express.Router();

router.get(
  "/teacher/live-sessions",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionListQuerySchema, "query"),
  getTeacherLiveSessions,
);

router.post(
  "/teacher/live-sessions",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(createLiveSessionSchema),
  createTeacherLiveSession,
);

router.get(
  "/teacher/live-sessions/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  getTeacherLiveSessionById,
);

router.patch(
  "/teacher/live-sessions/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  validateRequest(updateLiveSessionSchema),
  updateTeacherLiveSession,
);

router.delete(
  "/teacher/live-sessions/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  deleteTeacherLiveSession,
);

router.patch(
  "/teacher/live-sessions/:id/start",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  startTeacherLiveSession,
);

router.patch(
  "/teacher/live-sessions/:id/end",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  endTeacherLiveSession,
);

router.patch(
  "/teacher/live-sessions/:id/cancel",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  validateRequest(cancelLiveSessionSchema),
  cancelTeacherLiveSession,
);

router.get(
  "/teacher/attendance",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(attendanceListQuerySchema, "query"),
  getTeacherAttendanceOverview,
);

router.get(
  "/teacher/live-sessions/:id/attendance",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  getTeacherLiveSessionAttendance,
);

router.patch(
  "/teacher/live-sessions/:id/attendance",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(liveSessionIdParamSchema, "params"),
  validateRequest(updateLiveSessionAttendanceSchema),
  updateTeacherLiveSessionAttendance,
);

router.get(
  "/teacher/course-sessions",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  getTeacherCourseSessions,
);

router.get(
  "/admin/courses/:courseId/sessions",
  protect,
  authorizeRoles("admin"),
  validateRequest(generateMeetLinksParamSchema, "params"),
  getAdminCourseSessions,
);

router.post(
  "/courses/:courseId/generate-month-meet-links",
  protect,
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(generateMeetLinksParamSchema, "params"),
  validateRequest(generateMeetLinksBodySchema),
  generateCourseMonthlyMeetLinks,
);

router.post(
  "/courses/:courseId/schedule-preview",
  protect,
  authorizeRoles("teacher", "admin"),
  requireApprovedTeacher(),
  validateRequest(generateMeetLinksParamSchema, "params"),
  validateRequest(generateMeetLinksBodySchema),
  buildCourseSchedulePreview,
);

router.get("/live-sessions/config", protect, authorizeRoles("teacher", "admin", "student"), getMeetAutomationConfig);

router.get(
  "/student/attendance",
  protect,
  authorizeRoles("student"),
  validateRequest(attendanceListQuerySchema, "query"),
  getStudentAttendance,
);

router.get(
  "/student/live-sessions",
  protect,
  authorizeRoles("student"),
  validateRequest(studentLiveSessionQuerySchema, "query"),
  getStudentLiveSessions,
);

router.get(
  "/student/course-sessions/:sessionId/live-link",
  protect,
  authorizeRoles("student"),
  validateRequest(studentLiveLinkParamSchema, "params"),
  getStudentLiveSessionLink,
);

router.post(
  "/student/live-sessions/:id/join",
  protect,
  authorizeRoles("student"),
  validateRequest(liveSessionIdParamSchema, "params"),
  joinStudentLiveSession,
);

export default router;
