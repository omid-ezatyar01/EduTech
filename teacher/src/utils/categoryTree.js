export const getParentCategories = (rows = []) =>
  (Array.isArray(rows) ? rows : []).filter(
    (item) => !String(item?.parent?._id || item?.parent || "").trim(),
  );

export const getSubcategoriesForParent = (rows = [], parentId = "") => {
  const categoryRows = Array.isArray(rows) ? rows : [];
  const byId = new Map(
    categoryRows.map((row) => [String(row?._id || ""), row]),
  );
  const targetId = String(parentId || "").trim();

  return categoryRows
    .filter((item) => {
      let current = item;
      let depth = 0;
      while (current && depth < 20) {
        const currentParentId = String(
          current?.parent?._id || current?.parent || "",
        ).trim();
        if (!currentParentId) return false;
        if (currentParentId === targetId) return true;
        current = byId.get(currentParentId);
        depth += 1;
      }
      return false;
    })
    .sort((left, right) =>
      formatCategoryPathLabel(left).localeCompare(formatCategoryPathLabel(right)),
    );
};

export const formatCategoryPathLabel = (item = {}) => String(item?.pathLabel || item?.name || "").trim();
