import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import validateRequest from "../middlewares/validateRequest.js";
import { createTeacherVideo, createVideo, deleteTeacherVideo, deleteVideo, getAdminVideos, getPublicVideo, getPublicVideos, getStudentVideos, getStudentVideoSocialState, getTeacherVideos, toggleVideoLike, toggleVideoSave, updateTeacherVideo, updateVideo } from "../controllers/videoController.js";
import { createVideoSchema, publicVideoQuerySchema, studentVideoQuerySchema, updateVideoSchema, videoIdParamSchema } from "../validators/video.validators.js";

const router = express.Router();

router.get("/videos", validateRequest(publicVideoQuerySchema, "query"), getPublicVideos);
router.get("/videos/:id", validateRequest(videoIdParamSchema, "params"), getPublicVideo);
router.post("/videos/:id/like", protect, authorizeRoles("student"), validateRequest(videoIdParamSchema, "params"), toggleVideoLike);
router.post("/videos/:id/save", protect, authorizeRoles("student"), validateRequest(videoIdParamSchema, "params"), toggleVideoSave);
router.get("/student/videos", protect, authorizeRoles("student"), validateRequest(studentVideoQuerySchema, "query"), getStudentVideos);
router.get("/student/video-social-state", protect, authorizeRoles("student"), getStudentVideoSocialState);
router.get("/teacher/videos", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), getTeacherVideos);
router.post("/teacher/videos", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(createVideoSchema), createTeacherVideo);
router.patch("/teacher/videos/:id", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(videoIdParamSchema, "params"), validateRequest(updateVideoSchema), updateTeacherVideo);
router.delete("/teacher/videos/:id", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(videoIdParamSchema, "params"), deleteTeacherVideo);
router.get("/admin/videos", protect, authorizeRoles("admin"), getAdminVideos);
router.post("/admin/videos", protect, authorizeRoles("admin"), validateRequest(createVideoSchema), createVideo);
router.patch("/admin/videos/:id", protect, authorizeRoles("admin"), validateRequest(videoIdParamSchema, "params"), validateRequest(updateVideoSchema), updateVideo);
router.delete("/admin/videos/:id", protect, authorizeRoles("admin"), validateRequest(videoIdParamSchema, "params"), deleteVideo);

export default router;
