import Category from "../models/Category.js";
import Course from "../models/Course.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { realignCourseCategoryAssignments } from "../utils/courseCategory.js";

const normalizeParentId = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const buildCategoryPath = (category, byId) => {
  const names = [];
  let current = category;
  let depth = 0;

  while (current && depth < 10) {
    names.unshift(current.name);
    const parentId = String(current.parent?._id || current.parent || "").trim();
    if (parentId && !byId.has(parentId) && current.parent?.name) {
      names.unshift(current.parent.name);
      break;
    }
    current = parentId ? byId.get(parentId) || null : null;
    depth += 1;
  }

  return names.join(" / ");
};

const shapeCategoryRows = (rows = []) => {
  const normalized = rows.map((row) => ({
    ...row,
    _id: String(row._id),
    parent: row.parent
      ? {
          _id: String(row.parent?._id || row.parent),
          name: row.parent?.name || "",
          slug: row.parent?.slug || "",
        }
      : null,
  }));
  const byId = new Map(normalized.map((item) => [String(item._id), item]));

  return normalized.map((item) => {
    const childrenCount = normalized.filter(
      (candidate) => String(candidate.parent?._id || "") === String(item._id),
    ).length;

    return {
      ...item,
      pathLabel: buildCategoryPath(item, byId),
      isParentCategory: !item.parent,
      childrenCount,
    };
  });
};

const ensureParentCategoryExists = async (parentId) => {
  const normalizedParentId = normalizeParentId(parentId);
  if (!normalizedParentId) return null;

  const parent = await Category.findById(normalizedParentId);
  if (!parent) {
    throw new ApiError(400, "Parent category not found");
  }

  return parent;
};

const ensureNoCategoryLoop = async (categoryId, parentId) => {
  const normalizedParentId = normalizeParentId(parentId);
  if (!normalizedParentId) return;
  if (String(categoryId) === normalizedParentId) {
    throw new ApiError(400, "Category cannot be its own parent");
  }

  let current = await Category.findById(normalizedParentId).select("parent");
  let depth = 0;
  while (current && current.parent && depth < 10) {
    if (String(current.parent) === String(categoryId)) {
      throw new ApiError(400, "Category parent hierarchy is invalid");
    }
    current = await Category.findById(current.parent).select("parent");
    depth += 1;
  }
};

export const createCategory = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    parent: normalizeParentId(req.body.parent),
  };
  const existing = await Category.findOne({ name: req.body.name });
  if (existing) {
    throw new ApiError(400, "Category already exists");
  }

  await ensureParentCategoryExists(payload.parent);
  const category = await Category.create(payload);

  return res.status(201).json(
    new ApiResponse({
      message: "Category created successfully",
      data: category,
    }),
  );
});

export const getAdminCategories = asyncHandler(async (_req, res) => {
  const rows = await Category.find()
    .populate("parent", "name slug")
    .sort({ parent: 1, name: 1 })
    .lean();
  const categories = shapeCategoryRows(rows);

  return res.json(
    new ApiResponse({
      message: "Categories fetched successfully",
      data: categories,
    }),
  );
});

export const updateCategory = asyncHandler(async (req, res) => {
  const existingCategory = await Category.findById(req.params.id).select("parent");
  if (!existingCategory) {
    throw new ApiError(404, "Category not found");
  }

  const payload = {
    ...req.body,
    parent: Object.prototype.hasOwnProperty.call(req.body, "parent")
      ? normalizeParentId(req.body.parent)
      : undefined,
  };
  if (Object.prototype.hasOwnProperty.call(payload, "parent")) {
    await ensureParentCategoryExists(payload.parent);
    await ensureNoCategoryLoop(req.params.id, payload.parent);
  }

  const updatePayload = {
    ...Object.fromEntries(
      Object.entries(payload).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  };

  const category = await Category.findByIdAndUpdate(req.params.id, updatePayload, {
    returnDocument: "after",
    runValidators: true,
  }).populate("parent", "name slug");

  const previousParentId = String(existingCategory.parent || "").trim();
  const nextParentId = String(category.parent?._id || category.parent || "").trim();
  if (previousParentId !== nextParentId) {
    await realignCourseCategoryAssignments(req.params.id);
  }

  const categories = shapeCategoryRows([category.toObject()]);

  return res.json(
    new ApiResponse({
      message: "Category updated successfully",
      data: categories[0],
    }),
  );
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const childCount = await Category.countDocuments({ parent: req.params.id });
  if (childCount > 0) {
    throw new ApiError(400, "Delete or move subcategories first");
  }

  await realignCourseCategoryAssignments(req.params.id);

  const linkedCourses = await Course.countDocuments({
    $or: [{ category: req.params.id }, { subcategory: req.params.id }],
  });
  if (linkedCourses > 0) {
    throw new ApiError(400, "This category is already used by courses");
  }

  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.json(
    new ApiResponse({
      message: "Category deleted successfully",
      data: { id: category._id },
    }),
  );
});

export const getPublicCategories = asyncHandler(async (_req, res) => {
  const rows = await Category.find({ isActive: true })
    .populate("parent", "name slug isActive")
    .sort({ parent: 1, name: 1 })
    .lean();
  const categories = shapeCategoryRows(
    rows.filter((row) => !row.parent || row.parent?.isActive !== false),
  );

  return res.json(
    new ApiResponse({
      message: "Categories fetched successfully",
      data: categories,
    }),
  );
});
