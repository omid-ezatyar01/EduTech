import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Plus, Pencil, Trash2, Search, RefreshCw } from "lucide-react";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from "../../services/categoryService.js";
import {
  formatCategoryPathLabel,
  getCategoryParentOptions,
} from "../utils/categoryTree.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  clearAdminPageCache,
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const ADMIN_CATEGORIES_CACHE_KEY = getAdminPageCacheKey("categories");
const ADMIN_CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
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
        setError(err.message || "Failed to load categories");
      },
      onFinally: () => {
        setLoading(false);
      },
    });
  }, [categoriesRequest]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return categories.filter((item) =>
      !q || formatCategoryPathLabel(item).toLowerCase().includes(q),
    );
  }, [categories, search]);

  const parentCategories = useMemo(
    () => getCategoryParentOptions(categories, editingId),
    [categories, editingId],
  );

  const resetForm = () => {
    setEditingId("");
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
      setToast("Category name is required");
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
        setToast("Category updated");
      } else {
        await createAdminCategory(payload);
        setToast("Category created");
      }
      clearAdminPageCache("admin:categories");
      resetForm();
      await loadCategories();
    } catch (err) {
      setToast(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (category) => {
    setEditingId(String(category._id || ""));
    setForm({
      name: category.name || "",
      description: category.description || "",
      parent: category.parent?._id || "",
      isActive: Boolean(category.isActive),
    });
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm("Delete this category?")) return;

    try {
      await deleteAdminCategory(categoryId);
      setToast("Category deleted");
      clearAdminPageCache("admin:categories");
      await loadCategories();
    } catch (err) {
      setToast(err.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Categories</h1>
          <p className="text-sm font-normal text-slate-500">Manage main categories and subcategories for courses.</p>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-500">Total categories</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{categories.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-500">Active categories</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{categories.filter((c) => c.isActive).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-500">Inactive categories</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{categories.filter((c) => !c.isActive).length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Category name"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none"
          />
          <select
            value={form.parent}
            onChange={(e) => setForm((prev) => ({ ...prev, parent: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none"
          >
            <option value="">Main category (no parent)</option>
            {parentCategories.map((item) => (
              <option key={item._id} value={item._id}>
                {formatCategoryPathLabel(item)}
              </option>
            ))}
          </select>
          <input
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {editingId ? "Save" : "Create"}
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none"
              placeholder="Search category name"
            />
          </label>
          <button
            type="button"
            onClick={loadCategories}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
      {loading ? <p className="text-sm font-medium text-slate-500">در حال بارگذاری دسته‌بندی‌ها</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((category) => (
                <tr key={category._id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-700"><Layers size={16} /></span>
                      <span className="text-sm font-extrabold text-slate-800">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    {category.parent ? "Subcategory" : "Main"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    {category.parent?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{category.description || "-"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatCategoryPathLabel(category) || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${category.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(category)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(category._id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm font-medium text-slate-600">No categories found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? <div className="fixed bottom-5 right-5 z-[120] rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-xl">{toast}</div> : null}
    </div>
  );
}
