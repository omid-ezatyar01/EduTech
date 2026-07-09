import { getParentCategories } from "../../utils/categoryTree";

const getParentId = (item) =>
  String(item?.parent?._id || item?.parent || "").trim();

export default function CourseCategoryFields({
  categories = [],
  categoryId = "",
  subcategoryId = "",
  language = "en",
  onChange,
}) {
  const rows = Array.isArray(categories) ? categories : [];
  const byId = new Map(rows.map((item) => [String(item?._id || ""), item]));
  const roots = getParentCategories(rows);
  const selectedRootId = String(categoryId || roots[0]?._id || "");
  const selectedIds = [selectedRootId];

  if (subcategoryId && byId.has(String(subcategoryId))) {
    const descendants = [];
    let current = byId.get(String(subcategoryId));
    let depth = 0;
    while (current && depth < 20) {
      const currentId = String(current?._id || "");
      if (currentId === selectedRootId) break;
      descendants.unshift(currentId);
      current = byId.get(getParentId(current));
      depth += 1;
    }
    if (String(current?._id || "") === selectedRootId) {
      selectedIds.push(...descendants);
    }
  }

  const levels = [];
  let parentId = selectedRootId;
  for (let level = 0; level < 20; level += 1) {
    const options = rows
      .filter((item) => getParentId(item) === parentId)
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));
    if (!options.length) break;
    const selectedValue = selectedIds[level + 1] || "";
    levels.push({ parentId, options, selectedValue, level });
    if (!selectedValue) break;
    parentId = selectedValue;
  }

  const selectedLeafId = String(subcategoryId || selectedRootId);
  const selectedLeaf = byId.get(selectedLeafId);

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 sm:col-span-2">
      <div className="mb-3">
        <h4 className="text-sm font-black text-slate-900">
          {language === "fa" ? "دسته‌بندی دقیق کورس" : "Specific course category"}
        </h4>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-600">
          {language === "fa"
            ? "دسته اصلی را انتخاب کنید؛ اگر زیر‌دسته داشته باشد، گزینه بعدی خودکار نمایش داده می‌شود."
            : "Choose the main category. Each direct subcategory appears in a separate field."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-600">
            {language === "fa" ? "دسته اصلی" : "Main category"}
          </span>
          <select
            value={selectedRootId}
            onChange={(event) =>
              onChange?.({ category: event.target.value, subcategory: "" })
            }
            className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-semibold"
            required
          >
            {roots.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {levels.map(({ parentId: levelParentId, options, selectedValue, level }) => {
          const parent = byId.get(levelParentId);
          return (
            <label key={`${level}-${levelParentId}`}>
              <span className="mb-1 block text-xs font-bold text-slate-600">
                {level === 0
                  ? language === "fa"
                    ? "زیر‌دسته مستقیم"
                    : "Direct subcategory"
                  : language === "fa"
                    ? `زیر‌دسته سطح ${level + 2}`
                    : `Subcategory level ${level + 2}`}
              </span>
              <select
                value={selectedValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onChange?.({
                    category: selectedRootId,
                    subcategory:
                      nextValue ||
                      (level === 0 ? "" : selectedIds[level]),
                  });
                }}
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-semibold"
              >
                <option value="">
                  {language === "fa"
                    ? `انتخاب خود ${parent?.name || "دسته"}`
                    : `Use ${parent?.name || "this category"}`}
                </option>
                {options.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-teal-800">
        {language === "fa" ? "مسیر انتخاب‌شده: " : "Selected path: "}
        {selectedLeaf?.pathLabel || selectedLeaf?.name || "-"}
      </p>
    </div>
  );
}
