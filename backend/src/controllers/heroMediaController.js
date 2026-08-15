import HeroMedia from "../models/HeroMedia.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { removeHeroMediaIfLocal, saveHeroMediaFromUpload } from "../utils/heroMediaFile.js";

const safeFields = "mediaType mediaUrl title altText status sortOrder displayDurationSeconds createdAt updatedAt";

export const getPublicHeroMedia = asyncHandler(async (_req, res) => {
  const items = await HeroMedia.find({ status: "active", mediaType: "image" })
    .select(safeFields)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.json(new ApiResponse({ message: "Hero media fetched successfully", data: items }));
});

export const getAdminHeroMedia = asyncHandler(async (_req, res) => {
  const items = await HeroMedia.find({ mediaType: "image" }).select(safeFields).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return res.json(new ApiResponse({ message: "Admin hero media fetched successfully", data: items }));
});

export const uploadHeroMedia = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, "Please select an image");
  let uploaded;
  try {
    uploaded = await saveHeroMediaFromUpload(req.user._id, req.file);
  } catch (error) {
    throw new ApiError(400, error.message || "Hero media upload failed");
  }
  return res.status(201).json(new ApiResponse({ message: "Hero media uploaded successfully", data: uploaded }));
});

export const createHeroMedia = asyncHandler(async (req, res) => {
  const item = await HeroMedia.create({ ...req.body, createdBy: req.user._id });
  return res.status(201).json(new ApiResponse({ message: "Hero media created successfully", data: item }));
});

export const updateHeroMedia = asyncHandler(async (req, res) => {
  const existing = await HeroMedia.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Hero media not found");
  const item = await HeroMedia.findByIdAndUpdate(existing._id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (req.body.mediaUrl && req.body.mediaUrl !== existing.mediaUrl) {
    await removeHeroMediaIfLocal(existing.mediaUrl);
  }
  return res.json(new ApiResponse({ message: "Hero media updated successfully", data: item }));
});

export const deleteHeroMedia = asyncHandler(async (req, res) => {
  const item = await HeroMedia.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Hero media not found");
  await removeHeroMediaIfLocal(item.mediaUrl);
  return res.json(new ApiResponse({ message: "Hero media deleted successfully", data: { id: item._id } }));
});
