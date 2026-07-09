export const formatCategoryPathLabel = (item = {}) =>
  String(item?.pathLabel || item?.name || "").trim();
