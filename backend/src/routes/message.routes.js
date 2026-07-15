import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import ApiError from "../utils/ApiError.js";
import {
  deleteStudentCourseGroupMessages,
  deleteTeacherCourseBroadcastMessages,
  getStudentCourseGroupConversations,
  getStudentCourseGroupMessages,
  getStudentConversationMessages,
  getStudentMessageConversations,
  getTeacherCourseGroupMessageSettings,
  getTeacherCourseBroadcastConversations,
  getTeacherCourseBroadcastMessages,
  getTeacherMessageSettings,
  markStudentCourseGroupAsRead,
  getTeacherConversationMessages,
  getTeacherMessageConversations,
  markStudentConversationAsRead,
  markTeacherConversationAsRead,
  sendStudentCourseGroupMessage,
  sendStudentConversationMessage,
  sendTeacherConversationMessage,
  sendTeacherCourseBroadcastMessage,
  updateTeacherCourseGroupMessageSettings,
  updateTeacherMessageSettings,
} from "../controllers/messageController.js";
import {
  conversationListQuerySchema,
  conversationMessageListQuerySchema,
  groupMessageDeleteSchema,
  sendMessageSchema,
  studentCourseGroupSendSchema,
  studentConversationParamSchema,
  teacherConversationParamSchema,
  teacherCourseGroupMessageSettingsSchema,
  teacherCourseParamSchema,
  teacherCourseBroadcastSchema,
  teacherMessageSettingsSchema,
} from "../validators/message.validators.js";

const router = express.Router();
const chatDisabled = (_req, _res, next) =>
  next(new ApiError(503, "Chat system is currently disabled."));

router.use("/teacher/messages", chatDisabled);
router.use("/student/messages", chatDisabled);

router.get(
  "/teacher/messages/conversations",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(conversationListQuerySchema, "query"),
  getTeacherMessageConversations,
);

router.get(
  "/teacher/messages/conversations/:studentId/messages",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherConversationParamSchema, "params"),
  validateRequest(conversationMessageListQuerySchema, "query"),
  getTeacherConversationMessages,
);

router.post(
  "/teacher/messages/conversations/:studentId/messages",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherConversationParamSchema, "params"),
  validateRequest(sendMessageSchema),
  sendTeacherConversationMessage,
);

router.patch(
  "/teacher/messages/conversations/:studentId/read",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherConversationParamSchema, "params"),
  markTeacherConversationAsRead,
);

router.post(
  "/teacher/messages/broadcast/course",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherCourseBroadcastSchema),
  sendTeacherCourseBroadcastMessage,
);

router.get(
  "/teacher/messages/broadcast/courses",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  getTeacherCourseBroadcastConversations,
);

router.get(
  "/teacher/messages/broadcast/course/:courseId/messages",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherCourseParamSchema, "params"),
  getTeacherCourseBroadcastMessages,
);

router.delete(
  "/teacher/messages/broadcast/course/:courseId/messages",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherCourseParamSchema, "params"),
  validateRequest(groupMessageDeleteSchema),
  deleteTeacherCourseBroadcastMessages,
);

router.get(
  "/teacher/messages/settings/course/:courseId",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherCourseParamSchema, "params"),
  getTeacherCourseGroupMessageSettings,
);

router.patch(
  "/teacher/messages/settings/course/:courseId",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherCourseParamSchema, "params"),
  validateRequest(teacherCourseGroupMessageSettingsSchema),
  updateTeacherCourseGroupMessageSettings,
);

router.get(
  "/teacher/messages/settings",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  getTeacherMessageSettings,
);

router.patch(
  "/teacher/messages/settings",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(teacherMessageSettingsSchema),
  updateTeacherMessageSettings,
);

router.get(
  "/student/messages/conversations",
  protect,
  authorizeRoles("student"),
  validateRequest(conversationListQuerySchema, "query"),
  getStudentMessageConversations,
);

router.get(
  "/student/messages/conversations/:teacherId/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(studentConversationParamSchema, "params"),
  validateRequest(conversationMessageListQuerySchema, "query"),
  getStudentConversationMessages,
);

router.post(
  "/student/messages/conversations/:teacherId/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(studentConversationParamSchema, "params"),
  validateRequest(sendMessageSchema),
  sendStudentConversationMessage,
);

router.patch(
  "/student/messages/conversations/:teacherId/read",
  protect,
  authorizeRoles("student"),
  validateRequest(studentConversationParamSchema, "params"),
  markStudentConversationAsRead,
);

router.get(
  "/student/messages/groups",
  protect,
  authorizeRoles("student"),
  validateRequest(conversationListQuerySchema, "query"),
  getStudentCourseGroupConversations,
);

router.get(
  "/student/messages/groups/:courseId/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(teacherCourseParamSchema, "params"),
  getStudentCourseGroupMessages,
);

router.post(
  "/student/messages/groups/:courseId/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(teacherCourseParamSchema, "params"),
  validateRequest(studentCourseGroupSendSchema),
  sendStudentCourseGroupMessage,
);

router.patch(
  "/student/messages/groups/:courseId/read",
  protect,
  authorizeRoles("student"),
  validateRequest(teacherCourseParamSchema, "params"),
  markStudentCourseGroupAsRead,
);

router.delete(
  "/student/messages/groups/:courseId/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(teacherCourseParamSchema, "params"),
  validateRequest(groupMessageDeleteSchema),
  deleteStudentCourseGroupMessages,
);

export default router;
