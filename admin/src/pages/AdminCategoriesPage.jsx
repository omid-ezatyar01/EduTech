import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from "../../services/categoryService.js";
import { isNetworkError } from "../../services/http.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  clearAdminPageCache,
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";
import {
  formatCategoryPathLabel,
} from "../utils/categoryTree.js";

const ADMIN_CATEGORIES_CACHE_KEY = getAdminPageCacheKey("categories");
const ADMIN_CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

const PAGE_TEXT = {
  "Category operations": "عملیات دسته‌بندی‌ها",
  "Manage main categories, subcategories, and their visibility from one clear workspace.":
    "دسته‌بندی‌های اصلی، زیر‌دسته‌ها و وضعیت نمایش آن‌ها را از یک فضای کاری روشن مدیریت کنید.",
  "Total categories": "مجموع دسته‌بندی‌ها",
  "Active categories": "دسته‌بندی‌های فعال",
  "Inactive categories": "دسته‌بندی‌های غیرفعال",
  "New category": "دسته‌بندی جدید",
  "Edit category": "ویرایش دسته‌بندی",
  "Category workspace": "فضای کاری دسته‌بندی‌ها",
  "Create a new category or update an existing one with the same admin controls used across the platform.":
    "یک دسته‌بندی تازه بسازید یا دسته‌بندی موجود را با همان کنترل‌های مدیریتی رایج در سراسر پلتفرم به‌روزرسانی کنید.",
  "Category name": "نام دسته‌بندی",
  "Enter category name": "نام دسته‌بندی را وارد کنید",
  "Parent category": "دسته‌بندی والد",
  "Main category (no parent)": "دسته‌بندی اصلی (بدون والد)",
  Status: "وضعیت",
  Active: "فعال",
  Inactive: "غیرفعال",
  Saving: "در حال ذخیره...",
  "Save changes": "ذخیره تغییرات",
  "Create category": "ایجاد دسته‌بندی",
  Cancel: "انصراف",
  "Cancel edit": "لغو ویرایش",
  "Category directory": "فهرست دسته‌بندی‌ها",
  "Search by category path and manage every category from one table.":
    "با مسیر دسته‌بندی جستجو کنید و همه دسته‌بندی‌ها را از یک جدول مدیریت نمایید.",
  "Choose parent step by step. Start from a main category, then continue deeper only if needed.":
    "دسته‌بندی والد را مرحله‌به‌مرحله انتخاب کنید. از دسته‌بندی اصلی شروع کنید و فقط در صورت نیاز به لایه‌های پایین‌تر بروید.",
  "Search category path": "جستجو در مسیر دسته‌بندی",
  Refresh: "تازه‌سازی",
  "Failed to load categories": "بارگذاری دسته‌بندی‌ها ناموفق بود",
  "Category name is required": "نام دسته‌بندی الزامی است",
  "Category updated": "دسته‌بندی به‌روزرسانی شد",
  "Category created": "دسته‌بندی ایجاد شد",
  "Save failed": "ذخیره ناموفق بود",
  "Delete this category?": "این دسته‌بندی حذف شود؟",
  "Category deleted": "دسته‌بندی حذف شد",
  "Delete failed": "حذف ناموفق بود",
  "Loading categories": "در حال بارگذاری دسته‌بندی‌ها",
  "No categories found.": "هیچ دسته‌بندی‌ای پیدا نشد.",
  Category: "دسته‌بندی",
  Type: "نوع",
  Parent: "والد",
  Path: "مسیر",
  Actions: "اقدام‌ها",
  Main: "اصلی",
  Subcategory: "زیردسته",
  "Main category": "دسته‌بندی اصلی",
  "Subcategory level": "سطح زیردسته",
  "No parent": "بدون والد",
  "Select main category": "دسته‌بندی اصلی را انتخاب کنید",
  "Select subcategory": "زیردسته را انتخاب کنید",
  "Use this level": "همین سطح",
  "Continue deeper": "ادامه به سطح پایین‌تر",
  "Selected parent": "والد انتخاب‌شده",
  "This category will be created at the top level.": "این دسته‌بندی در سطح اصلی ایجاد می‌شود.",
  "This category will be nested under the selected parent.":
    "این دسته‌بندی زیر دسته‌بندی والد انتخاب‌شده ساخته می‌شود.",
  Level: "سطح",
  "Top level": "سطح اصلی",
  "Nested category": "دسته‌بندی تو در تو",
  "Edit category action": "ویرایش دسته‌بندی",
  "Delete category action": "حذف دسته‌بندی",
  "subcategories count": "زیر‌دسته",
  Expand: "باز کردن",
  Collapse: "بستن",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const getStatusStyle = (isActive) =>
  isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

const normalizeCategoryId = (value) => String(value || "").trim();

const buildCategoryMaps = (rows = []) => {
  const items = Array.isArray(rows) ? rows : [];
  const byId = new Map(items.map((item) => [normalizeCategoryId(item?._id), item]));
  const childrenByParent = new Map();

  items.forEach((item) => {
    const parentId = normalizeCategoryId(item?.parent?._id || item?.parent);
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId).push(item);
  });

  childrenByParent.forEach((group) => {
    group.sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
  });

  return { byId, childrenByParent };
};

const collectDescendantIds = (childrenByParent, parentId) => {
  const blocked = new Set();
  const queue = [...(childrenByParent.get(normalizeCategoryId(parentId)) || [])];

  while (queue.length) {
    const current = queue.shift();
    const currentId = normalizeCategoryId(current?._id);
    if (!currentId || blocked.has(currentId)) continue;
    blocked.add(currentId);
    queue.push(...(childrenByParent.get(currentId) || []));
  }

  return blocked;
};

const buildAncestorChain = (categoryId, byId) => {
  const chain = [];
  let current = byId.get(normalizeCategoryId(categoryId));
  let depth = 0;

  while (current && depth < 20) {
    chain.unshift(current);
    const parentId = normalizeCategoryId(current?.parent?._id || current?.parent);
    current = parentId ? byId.get(parentId) || null : null;
    depth += 1;
  }

  return chain;
};

const buildDisplayRows = (rows = []) => {
  const { childrenByParent } = buildCategoryMaps(rows);
  const ordered = [];

  const walk = (parentId = "", depth = 0) => {
    const branch = childrenByParent.get(normalizeCategoryId(parentId)) || [];
    branch.forEach((item) => {
      ordered.push({
        ...item,
        treeDepth: depth,
      });
      walk(item._id, depth + 1);
    });
  };

  walk("", 0);
  return ordered;
};

const getInitiallyExpandedIds = (rows = []) =>
  new Set(
    (Array.isArray(rows) ? rows : [])
      .filter((item) => Number(item?.childrenCount || 0) > 0)
      .map((item) => normalizeCategoryId(item?._id)),
  );

export default function AdminCategoriesPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    parent: "",
    isActive: true,
  });
  const [parentSelectionPath, setParentSelectionPath] = useState([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(() => new Set());
  const categoriesRequest = useLatestRequest();

  const loadCategories = useCallback(async () => {
    const cached = readAdminPageCache(ADMIN_CATEGORIES_CACHE_KEY, {
      maxAgeMs: ADMIN_CATEGORIES_CACHE_TTL_MS,
    });

    if (cached) {
      setCategories(cached);
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }

    await categoriesRequest.runLatest(fetchAdminCategories, {
      onSuccess: (rows) => {
        setCategories(rows);
        setExpandedCategoryIds(getInitiallyExpandedIds(rows));
        writeAdminPageCache(ADMIN_CATEGORIES_CACHE_KEY, rows);
      },
      onError: (err) => {
        setError(err.message || pageTr("Failed to load categories"));
      },
      onFinally: () => {
        setLoading(false);
      },
    });
  }, [categoriesRequest, pageTr]);

  const refreshCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    await categoriesRequest.runLatest(fetchAdminCategories, {
      onSuccess: (rows) => {
        setCategories(rows);
        setExpandedCategoryIds(getInitiallyExpandedIds(rows));
        writeAdminPageCache(ADMIN_CATEGORIES_CACHE_KEY, rows);
      },
      onError: (err) => {
        setError(err.message || pageTr("Failed to load categories"));
      },
      onFinally: () => {
        setLoading(false);
      },
    });
  }, [categoriesRequest, pageTr]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadCategories(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCategories]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const orderedCategories = useMemo(() => buildDisplayRows(categories), [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (q) {
      return orderedCategories.filter((item) => formatCategoryPathLabel(item).toLowerCase().includes(q));
    }

    return orderedCategories.filter((item) => {
      if (item.treeDepth === 0) return true;

      let currentParentId = normalizeCategoryId(item?.parent?._id || item?.parent);
      while (currentParentId) {
        if (!expandedCategoryIds.has(currentParentId)) return false;
        const parentItem = categories.find(
          (candidate) => normalizeCategoryId(candidate?._id) === currentParentId,
        );
        currentParentId = normalizeCategoryId(parentItem?.parent?._id || parentItem?.parent);
      }

      return true;
    });
  }, [categories, expandedCategoryIds, orderedCategories, search]);

  const selectableTree = useMemo(() => {
    const maps = buildCategoryMaps(categories);
    const blockedIds = new Set();
    const currentEditingId = normalizeCategoryId(editingId);
    if (currentEditingId) {
      blockedIds.add(currentEditingId);
      collectDescendantIds(maps.childrenByParent, currentEditingId).forEach((id) => blockedIds.add(id));
    }

    const allowedRows = categories.filter((item) => !blockedIds.has(normalizeCategoryId(item?._id)));
    return buildCategoryMaps(allowedRows);
  }, [categories, editingId]);

  const parentSelectorLevels = useMemo(() => {
    const levels = [];
    let parentId = "";
    let level = 0;

    while (level < 10) {
      const options = selectableTree.childrenByParent.get(parentId) || [];
      if (!options.length) break;
      levels.push({
        level,
        parentId,
        options,
        selectedId: parentSelectionPath[level] || "",
      });
      const nextSelectedId = normalizeCategoryId(parentSelectionPath[level]);
      if (!nextSelectedId) break;
      parentId = nextSelectedId;
      level += 1;
    }

    return levels;
  }, [parentSelectionPath, selectableTree.childrenByParent]);

  const selectedParentCategory = useMemo(() => {
    const selectedId = normalizeCategoryId(form.parent);
    if (!selectedId) return null;
    return selectableTree.byId.get(selectedId) || null;
  }, [form.parent, selectableTree.byId]);

  const statsCards = useMemo(
    () => [
      {
        title: pageTr("Total categories"),
        value: categories.length,
        icon: FolderTree,
        tone: "bg-blue-50 text-blue-700",
      },
      {
        title: pageTr("Active categories"),
        value: categories.filter((item) => item.isActive).length,
        icon: Layers,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        title: pageTr("Inactive categories"),
        value: categories.filter((item) => !item.isActive).length,
        icon: Trash2,
        tone: "bg-amber-50 text-amber-700",
      },
    ],
    [categories, pageTr],
  );

  const resetForm = () => {
    setEditingId("");
    setIsFormOpen(false);
    setParentSelectionPath([]);
    setForm({
      name: "",
      description: "",
      parent: "",
      isActive: true,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!String(form.name || "").trim()) {
      setToast(pageTr("Category name is required"));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        parent: form.parent || null,
        isActive: Boolean(form.isActive),
      };

      if (editingId) {
        await updateAdminCategory(editingId, payload);
        setToast(pageTr("Category updated"));
      } else {
        await createAdminCategory(payload);
        setToast(pageTr("Category created"));
      }

      clearAdminPageCache("admin:categories");
      clearAdminPageCache("admin:courses-categories");
      resetForm();
      await loadCategories();
    } catch (err) {
      setToast(err.message || pageTr("Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    const parentId = normalizeCategoryId(category.parent?._id || category.parent);
    const lineage = parentId ? buildAncestorChain(parentId, selectableTree.byId) : [];
    setIsFormOpen(true);
    setEditingId(String(category._id || ""));
    setParentSelectionPath(lineage.map((item) => normalizeCategoryId(item?._id)));
    setForm({
      name: category.name || "",
      description: category.description || "",
      parent: parentId,
      isActive: Boolean(category.isActive),
    });
  };

  const handleOpenCreateModal = () => {
    setEditingId("");
    setParentSelectionPath([]);
    setForm({
      name: "",
      description: "",
      parent: "",
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleParentLevelChange = (levelIndex, nextValue) => {
    const normalizedValue = normalizeCategoryId(nextValue);
    const nextPath = parentSelectionPath.slice(0, levelIndex);
    if (normalizedValue) {
      nextPath[levelIndex] = normalizedValue;
    }
    setParentSelectionPath(nextPath);
    setForm((prev) => ({
      ...prev,
      parent: normalizedValue || normalizeCategoryId(nextPath[nextPath.length - 1]),
    }));
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm(pageTr("Delete this category?"))) return;

    try {
      setDeletingId(normalizeCategoryId(categoryId));
      await deleteAdminCategory(categoryId);
      setCategories((current) =>
        current.filter(
          (item) => normalizeCategoryId(item?._id) !== normalizeCategoryId(categoryId),
        ),
      );
      setExpandedCategoryIds((current) => {
        const next = new Set(current);
        next.delete(normalizeCategoryId(categoryId));
        return next;
      });
      setToast(pageTr("Category deleted"));
      clearAdminPageCache("admin:categories");
      clearAdminPageCache("admin:courses-categories");
      refreshCategories().catch(() => {});
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          const rows = await fetchAdminCategories();
          const categoryStillExists = rows.some(
            (item) => normalizeCategoryId(item?._id) === normalizeCategoryId(categoryId),
          );

          if (!categoryStillExists) {
            setCategories(rows);
            setExpandedCategoryIds(getInitiallyExpandedIds(rows));
            writeAdminPageCache(ADMIN_CATEGORIES_CACHE_KEY, rows);
            setToast(pageTr("Category deleted"));
            clearAdminPageCache("admin:categories");
            clearAdminPageCache("admin:courses-categories");
            return;
          }
        } catch {
          // Keep the original error toast when final-state verification fails.
        }
      }
      setToast(err.message || pageTr("Delete failed"));
    } finally {
      setDeletingId("");
    }
  };

  const handleToggleExpanded = (categoryId) => {
    const normalizedId = normalizeCategoryId(categoryId);
    if (!normalizedId) return;

    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      return next;
    });
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full space-y-6 overflow-x-hidden ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">{pageTr("Category operations")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.categories.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Manage main categories, subcategories, and their visibility from one clear workspace.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-blue-50"
            >
              <Plus size={16} />
              {pageTr("New category")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-nowrap gap-4">
        {statsCards.map((card) => (
          <article key={card.title} className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Category directory")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by category path and manage every category from one table.")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
              <Search size={18} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={pageTr("Search category path")}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </label>

          <button
            type="button"
            onClick={refreshCategories}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {pageTr("Refresh")}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[24%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Category")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Type")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Parent")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Path")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className="px-5 py-4 text-center font-bold text-slate-500">{pageTr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading categories")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No categories found.")}
                  </td>
                </tr>
              ) : (
                filtered.map((category) => (
                  <tr key={category._id} className="align-middle transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-2 flex shrink-0 items-center gap-2"
                          style={{ [isRTL ? "marginRight" : "marginLeft"]: `${category.treeDepth * 16}px` }}
                        >
                          {category.treeDepth > 0 ? (
                            <span className="h-6 w-1 rounded-full bg-slate-200" />
                          ) : null}
                        </div>
                        {Number(category.childrenCount || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleToggleExpanded(category._id)}
                            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            title={
                              expandedCategoryIds.has(normalizeCategoryId(category._id))
                                ? pageTr("Collapse")
                                : pageTr("Expand")
                            }
                          >
                            {expandedCategoryIds.has(normalizeCategoryId(category._id)) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} className={isRTL ? "rotate-180" : ""} />
                            )}
                          </button>
                        ) : (
                          <span className="mt-1 inline-flex h-8 w-8 shrink-0" />
                        )}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{category.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">
                      <div className="space-y-1">
                        <span className="block">{category.parent ? pageTr("Subcategory") : pageTr("Main")}</span>
                        <span className="block text-xs font-bold text-slate-400">
                          {category.parent
                            ? `${pageTr("Subcategory level")} ${category.treeDepth + 1}`
                            : pageTr("Main category")}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">
                      <span className="inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {category.parent?.name || pageTr("No parent")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <p className="line-clamp-2 font-medium leading-6">{formatCategoryPathLabel(category) || "-"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black ${getStatusStyle(category.isActive)}`}>
                        {category.isActive ? pageTr("Active") : pageTr("Inactive")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
                          title={pageTr("Edit category action")}
                        >
                          <SquarePen size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category._id)}
                          disabled={deletingId === normalizeCategoryId(category._id)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("Delete category action")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[120] rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4">
          <div className="flex min-h-full items-center justify-center py-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
                  {editingId ? pageTr("Edit category") : pageTr("Category workspace")}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-800">
                  {editingId ? pageTr("Edit category") : pageTr("Category workspace")}
                </h3>
                <p className="mt-1 text-sm font-normal text-slate-600">
                  {pageTr("Create a new category or update an existing one with the same admin controls used across the platform.")}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
              </div>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Category name")}</span>
                        <input
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder={pageTr("Enter category name")}
                          className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Status")}</span>
                        <select
                          value={form.isActive ? "active" : "inactive"}
                          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "active" }))}
                          className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                        >
                          <option value="active">{pageTr("Active")}</option>
                          <option value="inactive">{pageTr("Inactive")}</option>
                        </select>
                      </label>

                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          {pageTr("Selected parent")}
                        </p>
                        <p className="mt-2 text-sm font-black text-slate-800">
                          {selectedParentCategory ? formatCategoryPathLabel(selectedParentCategory) : pageTr("No parent")}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                          {selectedParentCategory
                            ? pageTr("This category will be nested under the selected parent.")
                            : pageTr("This category will be created at the top level.")}
                        </p>
                      </div>
                    </div>

                    <div className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Parent category")}</span>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold leading-6 text-slate-500">
                          {pageTr("Choose parent step by step. Start from a main category, then continue deeper only if needed.")}
                        </p>

                        <div className="mt-4 space-y-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-slate-700">
                              {pageTr("Main category")}
                            </span>
                            <select
                              value={parentSelectionPath[0] || ""}
                              onChange={(e) => handleParentLevelChange(0, e.target.value)}
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500"
                            >
                              <option value="">{pageTr("Main category (no parent)")}</option>
                              {(parentSelectorLevels[0]?.options || []).map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          {parentSelectorLevels.slice(1).map((levelItem, index) => (
                            <label key={`${levelItem.parentId}-${levelItem.level}`} className="block">
                              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <ChevronDown size={14} className="text-slate-400" />
                                {pageTr("Select subcategory")} {index + 1}
                              </span>
                              <select
                                value={levelItem.selectedId}
                                onChange={(e) => handleParentLevelChange(levelItem.level, e.target.value)}
                                className="block h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500"
                              >
                                <option value="">{pageTr("Use this level")}</option>
                                {levelItem.options.map((item) => (
                                  <option key={item._id} value={item._id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    {pageTr("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? pageTr("Saving") : editingId ? pageTr("Save changes") : pageTr("Create category")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
