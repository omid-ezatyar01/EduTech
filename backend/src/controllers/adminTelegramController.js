import asyncHandler from "../middlewares/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  getRecentTelegramPosts,
  getTelegramSettings,
  sendTelegramTestPost,
  updateTelegramSettings,
} from "../services/telegramAnnouncement.service.js";

export const getAdminTelegramSettings = asyncHandler(async (_req, res) => {
  const settings = await getTelegramSettings();
  return res.json(
    new ApiResponse({
      message: "Telegram settings fetched successfully",
      data: settings,
    }),
  );
});

export const updateAdminTelegramSettings = asyncHandler(async (req, res) => {
  const settings = await updateTelegramSettings(req.body || {});
  return res.json(
    new ApiResponse({
      message: "Telegram settings updated successfully",
      data: settings,
    }),
  );
});

export const sendAdminTelegramTestPost = asyncHandler(async (_req, res) => {
  const result = await sendTelegramTestPost();
  return res.json(
    new ApiResponse({
      message: "Telegram test post sent successfully",
      data: result,
    }),
  );
});

export const getAdminTelegramPosts = asyncHandler(async (req, res) => {
  const posts = await getRecentTelegramPosts({ limit: req.query.limit });
  return res.json(
    new ApiResponse({
      message: "Telegram posts fetched successfully",
      data: posts,
    }),
  );
});
