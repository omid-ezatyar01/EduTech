import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import validateRequest from "../middlewares/validateRequest.js";
import {
  createPlatformChatReply,
  createStudentChatReply,
  streamPlatformChatReplyResponse,
} from "../controllers/aiChatController.js";
import { createStudentChatReplySchema } from "../validators/aiChat.validators.js";

const router = express.Router();

router.post(
  "/ai-chat/messages",
  validateRequest(createStudentChatReplySchema),
  createPlatformChatReply,
);

router.post(
  "/ai-chat/messages/stream",
  validateRequest(createStudentChatReplySchema),
  streamPlatformChatReplyResponse,
);

router.post(
  "/student/ai-chat/messages",
  protect,
  authorizeRoles("student"),
  validateRequest(createStudentChatReplySchema),
  createStudentChatReply,
);

export default router;
