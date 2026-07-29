import GalleryImage from "../models/GalleryImage.js";
import GalleryCategory from "../models/GalleryCategory.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  removeGalleryImageIfLocal,
  saveGalleryImageFromBuffer,
} from "../utils/galleryImage.js";

export const getPublicGallery = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 48);
  const category = req.query.category || "all";
  const filter = {
    status: "published",
    ...(category !== "all" ? { category } : {}),
  };

  const [images, total, categories] = await Promise.all([
    GalleryImage.find(filter)
      .select("title.fa category image status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    GalleryImage.countDocuments(filter),
    GalleryImage.distinct("category", { status: "published" }),
  ]);

  res.set("Cache-Control", "no-store");
  return res.json(
    new ApiResponse({
      message: "Gallery fetched successfully",
      data: images,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        category,
        categories: categories.sort(),
      },
    }),
  );
});

export const getAdminGallery = asyncHandler(async (req, res) => {
  const filter = {
    ...(req.query.category !== "all" ? { category: req.query.category } : {}),
    ...(req.query.status !== "all" ? { status: req.query.status } : {}),
  };
  const images = await GalleryImage.find(filter)
    .select("title.fa category image status createdBy createdAt updatedAt")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(
    new ApiResponse({ message: "Admin gallery fetched successfully", data: images }),
  );
});

export const getAdminGalleryCategories = asyncHandler(async (_req, res) => {
  const [savedCategories, usedCategories] = await Promise.all([
    GalleryCategory.distinct("name"),
    GalleryImage.distinct("category"),
  ]);
  const categories = [...new Set([...savedCategories, ...usedCategories])].sort();
  return res.json(
    new ApiResponse({
      message: "Gallery categories fetched successfully",
      data: categories,
    }),
  );
});

export const createGalleryCategory = asyncHandler(async (req, res) => {
  const category = await GalleryCategory.findOneAndUpdate(
    { name: req.body.name },
    { $setOnInsert: { name: req.body.name, createdBy: req.user._id } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  return res.status(201).json(
    new ApiResponse({
      message: "Gallery category saved successfully",
      data: { name: category.name },
    }),
  );
});

export const uploadGalleryImage = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, "Please select a gallery image");
  const image = await saveGalleryImageFromBuffer(req.user._id, req.file.buffer);
  return res.status(201).json(
    new ApiResponse({
      message: "Gallery image uploaded successfully",
      data: { image },
    }),
  );
});

export const createGalleryImage = asyncHandler(async (req, res) => {
  const item = await GalleryImage.create({
    ...req.body,
    createdBy: req.user._id,
  });
  return res.status(201).json(
    new ApiResponse({ message: "Gallery image created successfully", data: item }),
  );
});

export const updateGalleryImage = asyncHandler(async (req, res) => {
  const existing = await GalleryImage.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Gallery image not found");
  const item = await GalleryImage.findByIdAndUpdate(existing._id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (
    Object.prototype.hasOwnProperty.call(req.body, "image") &&
    req.body.image !== existing.image
  ) {
    await removeGalleryImageIfLocal(existing.image);
  }
  return res.json(
    new ApiResponse({ message: "Gallery image updated successfully", data: item }),
  );
});

export const deleteGalleryImage = asyncHandler(async (req, res) => {
  const item = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Gallery image not found");
  await removeGalleryImageIfLocal(item.image);
  return res.json(
    new ApiResponse({
      message: "Gallery image deleted successfully",
      data: { id: item._id },
    }),
  );
});
