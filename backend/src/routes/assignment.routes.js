import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import assignmentSubmissionUpload from "../middlewares/assignmentSubmissionUpload.js";
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  getTeacherAssignmentById,
  getTeacherAssignments,
  getTeacherAssignmentSubmissions,
  reviewTeacherAssignmentSubmission,
  submitStudentAssignment,
  updateTeacherAssignment,
} from "../controllers/assignmentController.js";
import {
  assignmentIdParamSchema,
  assignmentListQuerySchema,
  assignmentSubmissionListQuerySchema,
  assignmentSubmissionParamSchema,
  createAssignmentSchema,
  reviewAssignmentSubmissionSchema,
  updateAssignmentSchema,
} from "../validators/assignment.validators.js";

const router = express.Router();

router.get(
  "/teacher/assignments",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentListQuerySchema, "query"),
  getTeacherAssignments,
);

router.post(
  "/teacher/assignments",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(createAssignmentSchema),
  createTeacherAssignment,
);

router.get(
  "/teacher/assignments/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentIdParamSchema, "params"),
  getTeacherAssignmentById,
);

router.patch(
  "/teacher/assignments/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentIdParamSchema, "params"),
  validateRequest(updateAssignmentSchema),
  updateTeacherAssignment,
);

router.delete(
  "/teacher/assignments/:id",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentIdParamSchema, "params"),
  deleteTeacherAssignment,
);

router.get(
  "/teacher/assignments/:id/submissions",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentIdParamSchema, "params"),
  validateRequest(assignmentSubmissionListQuerySchema, "query"),
  getTeacherAssignmentSubmissions,
);

router.patch(
  "/teacher/assignments/:id/submissions/:studentId/review",
  protect,
  authorizeRoles("teacher"),
  requireApprovedTeacher({ allowAdmin: false }),
  validateRequest(assignmentSubmissionParamSchema, "params"),
  validateRequest(reviewAssignmentSubmissionSchema),
  reviewTeacherAssignmentSubmission,
);

router.post(
  "/student/assignments/:id/submit",
  protect,
  authorizeRoles("student"),
  assignmentSubmissionUpload.single("submissionFile"),
  validateRequest(assignmentIdParamSchema, "params"),
  submitStudentAssignment,
);

export default router;
