import Category from "../models/Category.js";
import ApiError from "./ApiError.js";

const normalizeObjectIdText = (value) => String(value || "").trim();

const getCategoryLineage = async (categoryId) => {
  const lineage = [];
  const visited = new Set();
  let currentId = normalizeObjectIdText(categoryId);

  while (currentId && lineage.length < 20) {
    if (visited.has(currentId)) {
      throw new ApiError(400, "Category parent hierarchy is invalid");
    }
    visited.add(currentId);

    const category = await Category.findById(currentId).select("_id name parent");
    if (!category) {
      throw new ApiError(400, "Category not found");
    }
    lineage.unshift(category);
    currentId = normalizeObjectIdText(category.parent);
  }

  return lineage;
};

const getCategoryAndDescendantIds = async (categoryId) => {
  const rows = await Category.find().select("_id parent").lean();
  const selectedId = normalizeObjectIdText(categoryId);
  const ids = new Set([selectedId]);
  let changed = true;

  while (changed) {
    changed = false;
    rows.forEach((row) => {
      const rowId = normalizeObjectIdText(row._id);
      const parentId = normalizeObjectIdText(row.parent);
      if (parentId && ids.has(parentId) && !ids.has(rowId)) {
        ids.add(rowId);
        changed = true;
      }
    });
  }

  return [...ids];
};

export const resolveCourseCategoryAssignment = async (categoryId, subcategoryId) => {
  const normalizedCategoryId = normalizeObjectIdText(categoryId);
  const normalizedSubcategoryId = normalizeObjectIdText(subcategoryId);

  if (!normalizedCategoryId) {
    throw new ApiError(400, "Category is required");
  }

  const categoryLineage = await getCategoryLineage(normalizedCategoryId);
  const selectedCategory = categoryLineage.at(-1);
  const rootCategory = categoryLineage[0];

  if (!normalizedSubcategoryId) {
    return {
      categoryId: String(rootCategory._id),
      subcategoryId:
        categoryLineage.length > 1 ? String(selectedCategory._id) : null,
      categoryDoc: rootCategory,
      subcategoryDoc: categoryLineage.length > 1 ? selectedCategory : null,
    };
  }

  const subcategoryLineage = await getCategoryLineage(normalizedSubcategoryId);
  const belongsToSelectedCategory = subcategoryLineage.some(
    (item) => String(item._id) === String(selectedCategory._id),
  );
  if (!belongsToSelectedCategory) {
    throw new ApiError(400, "Selected subcategory does not belong to the selected category");
  }
  const selectedSubcategory = subcategoryLineage.at(-1);

  return {
    categoryId: String(subcategoryLineage[0]._id),
    subcategoryId: String(selectedSubcategory._id),
    categoryDoc: subcategoryLineage[0],
    subcategoryDoc: selectedSubcategory,
  };
};

export const buildCourseCategoryFilter = async (categoryId) => {
  const normalizedCategoryId = normalizeObjectIdText(categoryId);
  if (!normalizedCategoryId) return {};

  const lineage = await getCategoryLineage(normalizedCategoryId);
  const descendantIds = await getCategoryAndDescendantIds(normalizedCategoryId);
  if (lineage.length === 1) {
    return { category: normalizedCategoryId };
  }
  return { subcategory: { $in: descendantIds } };
};
