import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Images,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  createAdminGalleryCategory,
  createAdminGalleryImage,
  deleteAdminGalleryImage,
  fetchAdminGallery,
  fetchAdminGalleryCategories,
  resolveGalleryImageUrl,
  updateAdminGalleryImage,
  uploadAdminGalleryImage,
} from "../../services/galleryService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { compressImageFileToLimit } from "../utils/imageCompression.js";

const EMPTY_FORM = {
  title: { fa: "" },
  category: "events",
  image: "",
  status: "published",
};

const DEFAULT_CATEGORIES = ["events", "classes", "workshops", "graduation", "community", "general"];
const mergeCategories = (values = []) =>
  [...new Set([...DEFAULT_CATEGORIES, ...values].filter(Boolean))].sort();

const copy = {
  fa: {
    title: "گالری تصاویر",
    subtitle: "تصاویر وب‌سایت را بر اساس دسته‌بندی مدیریت کنید.",
    add: "افزودن تصویر",
    refresh: "تازه‌سازی",
    all: "همه دسته‌ها",
    allStatuses: "همه وضعیت‌ها",
    published: "منتشرشده",
    draft: "پیش‌نویس",
    empty: "هنوز تصویری در گالری نیست.",
    loading: "در حال بارگذاری گالری…",
    create: "تصویر جدید",
    edit: "ویرایش تصویر",
    category: "دسته‌بندی (انگلیسی)",
    categoryHelp: "یک دسته ذخیره‌شده را انتخاب کنید یا دسته جدید بسازید.",
    newCategory: "دسته جدید",
    newCategoryPlaceholder: "مانند student-events",
    saveCategory: "ذخیره دسته",
    titleFa: "عنوان فارسی",
    titleRequired: "لطفاً عنوان فارسی را وارد کنید.",
    status: "وضعیت",
    choose: "انتخاب تصویر",
    imageRequired: "لطفاً یک تصویر انتخاب کنید.",
    categoryRequired: "دسته‌بندی باید با حروف انگلیسی و خط فاصله نوشته شود.",
    save: "ذخیره",
    cancel: "لغو",
    remove: "حذف",
    deleteConfirm: "این تصویر برای همیشه حذف شود؟",
    loadError: "بارگذاری گالری انجام نشد.",
    saveError: "ذخیره تصویر انجام نشد.",
    fileError: "فقط تصویر PNG، JPG یا WEBP تا حجم ۱۲ مگابایت مجاز است.",
    modalSubtitle: "تصویر را انتخاب کنید، معلومات آن را بنویسید و وضعیت نشر را تعیین کنید.",
    mediaSection: "تصویر گالری",
    detailsSection: "معلومات اصلی",
    imageHelp: "PNG، JPG یا WEBP · حداکثر ۱۲ مگابایت · تصویر به‌صورت خودکار بهینه می‌شود",
    replaceImage: "تغییر تصویر",
    removeImage: "حذف تصویر انتخاب‌شده",
    uploadInProgress: "در حال بهینه‌سازی و آپلود…",
    publishingHelp: "تصویر بلافاصله در گالری عمومی نمایش داده می‌شود.",
    draftHelp: "تصویر ذخیره می‌شود اما در وب‌سایت عمومی دیده نمی‌شود.",
    saveNew: "افزودن به گالری",
    saveChanges: "ذخیره تغییرات",
    preview: "پیش‌نمایش",
  },
  en: {
    title: "Image gallery",
    subtitle: "Manage website images and organize them by category.",
    add: "Add image",
    refresh: "Refresh",
    all: "All categories",
    allStatuses: "All statuses",
    published: "Published",
    draft: "Draft",
    empty: "The gallery does not have any images yet.",
    loading: "Loading gallery…",
    create: "New image",
    edit: "Edit image",
    category: "Category (English)",
    categoryHelp: "Select a saved category or create a new one once.",
    newCategory: "New category",
    newCategoryPlaceholder: "For example: student-events",
    saveCategory: "Save category",
    titleFa: "Persian title",
    titleRequired: "Please enter the Persian title.",
    status: "Status",
    choose: "Choose image",
    imageRequired: "Please choose an image.",
    categoryRequired: "Use lowercase English letters and hyphens for the category.",
    save: "Save",
    cancel: "Cancel",
    remove: "Delete",
    deleteConfirm: "Permanently delete this image?",
    loadError: "The gallery could not be loaded.",
    saveError: "The image could not be saved.",
    fileError: "Only PNG, JPG, or WEBP images up to 12 MB are allowed.",
    modalSubtitle: "Choose an image, add its details, and decide when it appears publicly.",
    mediaSection: "Gallery image",
    detailsSection: "Main details",
    imageHelp: "PNG, JPG, or WEBP · Up to 12 MB · Automatically optimized",
    replaceImage: "Replace image",
    removeImage: "Remove selected image",
    uploadInProgress: "Optimizing and uploading…",
    publishingHelp: "The image will appear in the public gallery immediately.",
    draftHelp: "The image will be saved but hidden from the public website.",
    saveNew: "Add to gallery",
    saveChanges: "Save changes",
    preview: "Preview",
  },
};

export default function AdminGalleryPage() {
  const { language, isRTL } = useAdminI18n();
  const text = copy[language === "fa" ? "fa" : "en"];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORIES);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [modalError, setModalError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, savedCategories] = await Promise.all([
        fetchAdminGallery({ category, status }),
        fetchAdminGalleryCategories(),
      ]);
      setItems(rows);
      setCategoryOptions(mergeCategories(savedCategories));
    } catch (err) {
      setError(err.message || text.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAdminGallery({ category, status }),
      fetchAdminGalleryCategories(),
    ])
      .then(([rows, savedCategories]) => {
        if (active) {
          setItems(rows);
          setCategoryOptions(mergeCategories(savedCategories));
          setError("");
        }
      })
      .catch((err) => active && setError(err.message || text.loadError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, status, text.loadError]);

  const close = useCallback(() => {
    setOpen(false);
    setEditingId("");
    setForm(EMPTY_FORM);
    setAddingCategory(false);
    setNewCategory("");
    setModalError("");
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving && !uploading && !savingCategory) close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open, saving, savingCategory, uploading]);

  const create = () => {
    setEditingId("");
    setForm(EMPTY_FORM);
    setAddingCategory(false);
    setNewCategory("");
    setModalError("");
    setOpen(true);
  };

  const edit = (item) => {
    setEditingId(item._id);
    setForm({
      title: { fa: item.title?.fa || "" },
      category: item.category || "events",
      image: item.image || "",
      status: item.status || "published",
    });
    setAddingCategory(false);
    setNewCategory("");
    setModalError("");
    setOpen(true);
  };

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setModalError(text.fileError);
      return;
    }
    setUploading(true);
    setModalError("");
    try {
      const optimized = await compressImageFileToLimit({
        file,
        maxBytes: 650 * 1024,
        maxWidth: 1920,
        maxHeight: 1440,
        initialQuality: 0.84,
        baseName: "gallery-image",
      });
      const image = await uploadAdminGalleryImage(optimized);
      setForm((current) => ({ ...current, image }));
    } catch (err) {
      setModalError(err.message || text.fileError);
    } finally {
      setUploading(false);
    }
  };

  const saveCategory = async () => {
    const normalizedCategory = newCategory.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedCategory)) {
      setModalError(text.categoryRequired);
      return;
    }
    setSavingCategory(true);
    setModalError("");
    try {
      const saved = await createAdminGalleryCategory(normalizedCategory);
      setCategoryOptions((current) => mergeCategories([...current, saved]));
      setForm((current) => ({ ...current, category: saved }));
      setNewCategory("");
      setAddingCategory(false);
    } catch (err) {
      setModalError(err.message || text.saveError);
    } finally {
      setSavingCategory(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.image) {
      setModalError(text.imageRequired);
      return;
    }
    if (!form.title.fa.trim()) {
      setModalError(text.titleRequired);
      return;
    }
    const normalizedCategory = form.category.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedCategory)) {
      setModalError(text.categoryRequired);
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        title: { fa: form.title.fa.trim() },
        category: normalizedCategory,
        image: form.image,
        status: form.status,
      };
      if (editingId) await updateAdminGalleryImage(editingId, payload);
      else await createAdminGalleryImage(payload);
      close();
      await load();
    } catch (err) {
      setModalError(err.message || text.saveError);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item) => {
    try {
      await updateAdminGalleryImage(item._id, {
        status: item.status === "published" ? "draft" : "published",
      });
      await load();
    } catch (err) {
      setError(err.message || text.saveError);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(text.deleteConfirm)) return;
    try {
      await deleteAdminGalleryImage(item._id);
      setItems((rows) => rows.filter((row) => row._id !== item._id));
    } catch (err) {
      setError(err.message || text.saveError);
    }
  };

  return (
    <div className="mx-auto max-w-7xl" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{text.title}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{text.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">
            <RefreshCw size={17} /> {text.refresh}
          </button>
          <button type="button" onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
            <Plus size={18} /> {text.add}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
          <option value="all">{text.all}</option>
          {categoryOptions.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
          <option value="all">{text.allStatuses}</option>
          <option value="published">{text.published}</option>
          <option value="draft">{text.draft}</option>
        </select>
      </div>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}

      {loading ? (
        <AdminPageLoader label={text.loading} />
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Images className="mx-auto text-slate-300" size={46} />
          <p className="mt-3 font-bold text-slate-500">{text.empty}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] bg-slate-100">
                <img src={resolveGalleryImageUrl(item.image)} alt={item.title?.fa || item.category} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{item.title?.fa || item.category}</p>
                    <p className="mt-1 text-xs font-bold text-blue-600">{item.category}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.status === "published" ? text.published : text.draft}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14} />{text.edit}</button>
                  <button type="button" onClick={() => toggle(item)} className="rounded-lg bg-slate-100 p-2 text-slate-600">{item.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  <button type="button" onClick={() => remove(item)} aria-label={text.remove} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving && !uploading && !savingCategory) close();
          }}
          role="presentation"
        >
          <form
            onSubmit={submit}
            className="flex h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-[28px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-modal-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                  <ImagePlus size={21} />
                </span>
                <div className="min-w-0">
                  <h2 id="gallery-modal-title" className="text-lg font-black text-slate-950 sm:text-xl">
                    {editingId ? text.edit : text.create}
                  </h2>
                  <p className="mt-1 hidden max-w-xl text-sm font-medium leading-6 text-slate-500 sm:block">
                    {text.modalSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={saving || uploading || savingCategory}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={text.cancel}
              >
                <X size={19} />
              </button>
            </div>

            {modalError && (
              <div className="flex shrink-0 items-start gap-2.5 border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold leading-6 text-red-700 sm:px-7" role="alert">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/70 ${
                isRTL ? "[direction:ltr]" : "[direction:rtl]"
              }`}
            >
              <div
                className="grid min-h-full lg:grid-cols-[0.92fr_1.08fr]"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <section className="border-b border-slate-200 p-5 sm:p-7 lg:border-b-0 lg:border-e">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-900">{text.mediaSection}</h3>
                    {form.image && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        <CheckCircle2 size={13} /> {text.preview}
                      </span>
                    )}
                  </div>

                  {!form.image ? (
                    <label className={`group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition sm:min-h-96 ${
                      modalError === text.imageRequired
                        ? "border-red-300 bg-red-50"
                        : "border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/50"
                    }`}>
                      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-blue-700 transition group-hover:scale-105">
                        <ImagePlus size={29} />
                      </span>
                      <span className="mt-5 text-base font-black text-slate-900">
                        {uploading ? text.uploadInProgress : text.choose}
                      </span>
                      <span className="mt-2 max-w-xs text-xs font-semibold leading-6 text-slate-500">
                        {text.imageHelp}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={selectImage}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <div className="relative grid min-h-72 place-items-center overflow-hidden bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] sm:min-h-96">
                        <img
                          src={resolveGalleryImageUrl(form.image)}
                          alt=""
                          className="max-h-[430px] w-full object-contain"
                        />
                        {uploading && (
                          <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm">
                            <div className="text-center">
                              <RefreshCw className="mx-auto animate-spin text-blue-600" size={27} />
                              <p className="mt-3 text-sm font-black text-slate-700">{text.uploadInProgress}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 border-t border-slate-200 p-3 sm:flex-row">
                        <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                          <ImagePlus size={17} /> {text.replaceImage}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={selectImage}
                            disabled={uploading}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, image: "" }))}
                          disabled={uploading}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={16} /> {text.removeImage}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="p-5 sm:p-7">
                  <div className="flex items-center gap-2">
                    <Images size={18} className="text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900">{text.detailsSection}</h3>
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-bold text-slate-800">
                      {text.titleFa}
                      <input
                        dir="rtl"
                        maxLength={160}
                        value={form.title.fa}
                        onChange={(event) => setForm({ ...form, title: { fa: event.target.value } })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                  </div>

                  <div className="my-6 h-px bg-slate-200" />

                  <div>
                    <label className="text-sm font-bold text-slate-800">
                      {text.category}
                      <select
                        value={form.category}
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-left outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        dir="ltr"
                      >
                        {categoryOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      <span className="mt-1.5 block text-xs font-medium leading-5 text-slate-400">{text.categoryHelp}</span>
                    </label>

                    {!addingCategory ? (
                      <button
                        type="button"
                        onClick={() => setAddingCategory(true)}
                        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                      >
                        <Plus size={16} /> {text.newCategory}
                      </button>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                      <input
                        dir="ltr"
                        value={newCategory}
                        onChange={(event) => setNewCategory(event.target.value)}
                        placeholder={text.newCategoryPlaceholder}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      />
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={saveCategory}
                            disabled={savingCategory}
                            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50"
                          >
                            {savingCategory ? "…" : text.saveCategory}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingCategory(false);
                              setNewCategory("");
                            }}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
                          >
                            {text.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <fieldset className="mt-5">
                    <legend className="text-sm font-bold text-slate-800">{text.status}</legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {[
                        ["published", text.published, text.publishingHelp, "emerald"],
                        ["draft", text.draft, text.draftHelp, "amber"],
                      ].map(([value, label, help, tone]) => {
                        const selected = form.status === value;
                        return (
                          <label
                            key={value}
                            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                              selected
                                ? tone === "emerald"
                                  ? "border-emerald-300 bg-emerald-50"
                                  : "border-amber-300 bg-amber-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="gallery-status"
                                value={value}
                                checked={selected}
                                onChange={(event) => setForm({ ...form, status: event.target.value })}
                                className="h-4 w-4"
                              />
                              <span className="text-sm font-black text-slate-800">{label}</span>
                            </span>
                            <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">{help}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-7 sm:py-4">
              <button
                type="button"
                onClick={close}
                disabled={saving || uploading || savingCategory}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {text.cancel}
              </button>
              <button
                disabled={saving || uploading || savingCategory}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving || uploading ? (
                  <>
                    <RefreshCw className="animate-spin" size={17} />
                    {uploading ? text.uploadInProgress : "…"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    {editingId ? text.saveChanges : text.saveNew}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
