import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  getCategoryParentOptions,
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
  "Edit category action": "ویرایش دسته‌بندی",
  "Delete category action": "حذف دسته‌بندی",
  "subcategories count": "زیر‌دسته",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const getStatusStyle = (isActive) =>
  isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

export default function AdminCategoriesPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    parent: "",
    isActive: true,
  });
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
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return categories.filter((item) => !q || formatCategoryPathLabel(item).toLowerCase().includes(q));
  }, [categories, search]);

  const parentCategories = useMemo(
    () => getCategoryParentOptions(categories, editingId),
    [categories, editingId],
  );

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
      resetForm();
      await loadCategories();
    } catch (err) {
      setToast(err.message || pageTr("Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setIsFormOpen(true);
    setEditingId(String(category._id || ""));
    setForm({
      name: category.name || "",
      description: category.description || "",
      parent: category.parent?._id || "",
      isActive: Boolean(category.isActive),
    });
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm(pageTr("Delete this category?"))) return;

    try {
      await deleteAdminCategory(categoryId);
      setToast(pageTr("Category deleted"));
      clearAdminPageCache("admin:categories");
      await loadCategories();
    } catch (err) {
      setToast(err.message || pageTr("Delete failed"));
    }
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
              onClick={() => {
                setIsFormOpen(true);
                setEditingId("");
                setForm({
                  name: "",
                  description: "",
                  parent: "",
                  isActive: true,
                });
              }}
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
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:bg-white"
          >
            <RefreshCw size={16} />
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{category.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {category.childrenCount || 0} {pageTr("subcategories count")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">
                      {category.parent ? pageTr("Subcategory") : pageTr("Main")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">
                      <span className="block truncate">{category.parent?.name || "-"}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <p className="line-clamp-2 font-medium">{formatCategoryPathLabel(category) || "-"}</p>
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
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
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

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Category name")}</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={pageTr("Enter category name")}
                  className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Parent category")}</span>
                  <select
                    value={form.parent}
                    onChange={(e) => setForm((prev) => ({ ...prev, parent: e.target.value }))}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  >
                    <option value="">{pageTr("Main category (no parent)")}</option>
                    {parentCategories.map((item) => (
                      <option key={item._id} value={item._id}>
                        {formatCategoryPathLabel(item)}
                      </option>
                    ))}
                  </select>
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
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
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
      ) : null}
    </div>
  );
}
