import Course from "../models/Course.js";
import LearningPackage from "../models/LearningPackage.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import generateSlug from "../utils/generateSlug.js";
import {
  removeLearningPackageCoverIfLocal,
  saveLearningPackageCoverFromBuffer,
} from "../utils/learningPackageCover.js";

const courseSelect = "title slug thumbnail level language status isPublished teacher";

const collectCourseIds = (steps = []) => [
  ...new Set(steps.flatMap((step) => step.courses || []).map(String)),
];

const ensureCoursesExist = async (steps = []) => {
  const ids = collectCourseIds(steps);
  const count = await Course.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) throw new ApiError(400, "One or more selected courses do not exist");
};

const ensurePackageCanBePublished = (status, steps = []) => {
  if (status !== "published") return;
  const emptyStepIndex = steps.findIndex((step) => !Array.isArray(step.courses) || step.courses.length === 0);
  if (emptyStepIndex >= 0) {
    throw new ApiError(400, `Step ${emptyStepIndex + 1} must contain at least one course before publishing`);
  }
};

const buildUniqueSlug = async (title, excludedId = null) => {
  const rawBase = generateSlug(title?.en || title?.fa || "") || `package-${Date.now()}`;
  const base = rawBase.slice(0, 150);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const exists = await LearningPackage.exists({
      slug,
      ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    });
    if (!exists) return slug;
  }
  throw new ApiError(409, "Could not generate a unique package URL");
};

const populateCourses = (query, publishedOnly = false) =>
  query.populate({
    path: "steps.courses",
    select: courseSelect,
    ...(publishedOnly ? { match: { status: "published", isPublished: true, classEndedAt: null } } : {}),
    populate: { path: "teacher", select: "name avatar" },
  });

const publicPackage = (document) => {
  const value = document.toObject ? document.toObject() : document;
  return {
    _id: value._id,
    title: value.title,
    description: value.description,
    coverImage: value.coverImage || "",
    slug: value.slug,
    steps: (value.steps || []).map((step) => ({
      _id: step._id,
      title: step.title,
      description: step.description,
      courses: (step.courses || []).filter(Boolean),
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const getPublicLearningPackages = asyncHandler(async (_req, res) => {
  const packages = await populateCourses(
    LearningPackage.find({ status: "published" }).sort({ createdAt: -1 }),
    true,
  );
  // Package edits (especially a newly uploaded cover) must be visible as soon
  // as the admin saves them. Revalidate instead of serving a stale package DTO.
  res.set("Cache-Control", "no-cache, must-revalidate");
  return res.json(new ApiResponse({
    message: "Learning packages fetched successfully",
    data: packages.map(publicPackage),
  }));
});

export const getPublicLearningPackageBySlug = asyncHandler(async (req, res) => {
  const item = await populateCourses(
    LearningPackage.findOne({ slug: req.params.slug, status: "published" }),
    true,
  );
  if (!item) throw new ApiError(404, "Learning package not found");
  res.set("Cache-Control", "no-cache, must-revalidate");
  return res.json(new ApiResponse({
    message: "Learning package fetched successfully",
    data: publicPackage(item),
  }));
});

export const getAdminLearningPackages = asyncHandler(async (_req, res) => {
  const packages = await populateCourses(
    LearningPackage.find().sort({ updatedAt: -1 }),
  );
  return res.json(new ApiResponse({ message: "Learning packages fetched successfully", data: packages }));
});

export const uploadLearningPackageCover = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, "Please select a package cover image");
  const coverImage = await saveLearningPackageCoverFromBuffer(req.user._id, req.file.buffer);
  return res.status(201).json(new ApiResponse({
    message: "Package cover uploaded successfully",
    data: { coverImage },
  }));
});

export const createLearningPackage = asyncHandler(async (req, res) => {
  ensurePackageCanBePublished(req.body.status, req.body.steps);
  await ensureCoursesExist(req.body.steps);
  const item = await LearningPackage.create({
    ...req.body,
    slug: await buildUniqueSlug(req.body.title),
    createdBy: req.user._id,
  });
  return res.status(201).json(new ApiResponse({ message: "Learning package created successfully", data: item }));
});

export const updateLearningPackage = asyncHandler(async (req, res) => {
  const existing = await LearningPackage.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Learning package not found");
  if (req.body.steps) await ensureCoursesExist(req.body.steps);
  const previousCoverImage = existing.coverImage;
  Object.assign(existing, req.body);
  ensurePackageCanBePublished(existing.status, existing.steps);
  await existing.save();
  if (
    Object.prototype.hasOwnProperty.call(req.body, "coverImage")
    && req.body.coverImage !== previousCoverImage
  ) {
    await removeLearningPackageCoverIfLocal(previousCoverImage);
  }
  return res.json(new ApiResponse({ message: "Learning package updated successfully", data: existing }));
});

export const deleteLearningPackage = asyncHandler(async (req, res) => {
  const item = await LearningPackage.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Learning package not found");
  await removeLearningPackageCoverIfLocal(item.coverImage);
  return res.json(new ApiResponse({ message: "Learning package deleted successfully", data: { id: item._id } }));
});
