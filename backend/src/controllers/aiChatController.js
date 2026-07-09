import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { generatePlatformChatReply, streamPlatformChatReply } from "../services/aiChat.service.js";
import { blockTeacherIfContractExpired } from "../utils/teacherContract.js";

const logAiChatFailure = ({ phase = "", req, error }) => {
  const role = String(req?.user?.role || req?.body?.context?.role || "guest");
  const path = String(req?.body?.context?.path || "");
  const pageTitle = String(req?.body?.context?.pageTitle || "");
  const latestMessage =
    req?.body?.messages?.[req.body.messages.length - 1]?.content || "";

  console.error(`[ai-chat:${phase}]`, {
    role,
    path,
    pageTitle,
    latestMessage: String(latestMessage).slice(0, 200),
    message: error?.message || "Unknown AI chat error",
    status: error?.status || null,
  });
};

const resolveOptionalUserFromRequest = async (req) => {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader) return null;

  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Not authorized, token failed");
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select(
    "-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts",
  );

  if (!user) {
    throw new ApiError(401, "Not authorized, user not found");
  }

  if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
    throw new ApiError(401, "Password changed. Please login again");
  }

  const didExpireContract = await blockTeacherIfContractExpired(user);
  if (didExpireContract) {
    throw new ApiError(403, "Your teacher account contract has expired and the account was blocked");
  }

  if (user.status === "blocked") {
    throw new ApiError(403, "Your account has been blocked");
  }

  return user;
};

export const createPlatformChatReply = async (req, res, next) => {
  try {
    const actor = await resolveOptionalUserFromRequest(req);
    const result = await generatePlatformChatReply({
      user: actor,
      messages: req.body?.messages || [],
      context: req.body?.context || {},
    });

    return res.status(200).json({
      success: true,
      message: "AI reply generated successfully",
      data: result,
    });
  } catch (error) {
    logAiChatFailure({ phase: "reply", req, error });
    return next(error);
  }
};

export const streamPlatformChatReplyResponse = async (req, res, next) => {
  try {
    const actor = await resolveOptionalUserFromRequest(req);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const result = await streamPlatformChatReply({
      user: actor,
      messages: req.body?.messages || [],
      context: req.body?.context || {},
      onChunk: (delta) => {
        if (delta) {
          sendEvent({ type: "chunk", delta });
        }
      },
    });

    sendEvent({
      type: "done",
      reply: String(result?.reply || "").trim(),
      model: String(result?.model || "").trim(),
    });
    res.end();
  } catch (error) {
    logAiChatFailure({ phase: "stream", req, error });
    if (!res.headersSent) {
      return next(error);
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: error?.message || "Could not get an assistant reply.",
      })}\n\n`,
    );
    res.end();
  }
};

export const createStudentChatReply = createPlatformChatReply;
