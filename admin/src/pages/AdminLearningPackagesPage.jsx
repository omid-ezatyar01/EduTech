import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Boxes,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { fetchAdminCourses } from "../../services/courseService.js";
import {
  createAdminLearningPackage,
  deleteAdminLearningPackage,
  fetchAdminLearningPackages,
  resolveLearningPackageCoverUrl,
  updateAdminLearningPackage,
  uploadAdminLearningPackageCover,
} from "../../services/learningPackageService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { compressImageFileToLimit } from "../utils/imageCompression.js";

const PACKAGE_COVER_MAX_BYTES = 400 * 1024;
const PACKAGE_COVER_RAW_MAX_BYTES = 10 * 1024 * 1024;
const PACKAGE_COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const newStep = () => ({
  titleFa: "",
  titleEn: "",
  descriptionFa: "",
  descriptionEn: "",
  courseSearch: "",
  courses: [],
});
const emptyForm = () => ({
  titleFa: "",
  titleEn: "",
  descriptionFa: "",
  descriptionEn: "",
  coverImage: "",
  status: "draft",
  steps: [newStep()],
});

const copy = {
  fa: {
    title: "بسته‌های آموزشی",
    subtitle: "مسیرهای مرحله‌به‌مرحله را با کورس‌های موجود بسازید.",
    add: "ساخت بسته",
    empty: "هنوز بسته آموزشی ساخته نشده است.",
    create: "بسته آموزشی جدید",
    edit: "ویرایش بسته",
    titleFa: "عنوان فارسی",
    titleEn: "عنوان انگلیسی",
    descriptionFa: "توضیحات فارسی",
    descriptionEn: "توضیحات انگلیسی",
    draft: "پیش‌نویس",
    published: "منتشرشده",
    status: "وضعیت",
    steps: "مراحل بسته",
    step: "مرحله",
    addStep: "افزودن مرحله",
    courses: "کورس‌های این مرحله",
    noCourses: "ابتدا حداقل یک کورس منتشر کنید.",
    save: "ذخیره بسته",
    cancel: "لغو",
    deleteConfirm: "این بسته آموزشی حذف شود؟",
    loadError: "دریافت بسته‌ها انجام نشد.",
    saveError: "ذخیره بسته انجام نشد.",
    selectCourseError:
      "برای انتشار بسته، در هر مرحله حداقل یک کورس انتخاب کنید. مرحله بدون کورس:",
    draftCourseHelp:
      "می‌توانید پیش‌نویس را بدون کورس ذخیره کنید؛ برای انتشار، هر مرحله باید حداقل یک کورس داشته باشد.",
    publicLink: "لینک عمومی",
    copyLink: "کپی لینک",
    copied: "کپی شد",
    openLink: "باز کردن لینک عمومی",
    cover: "تصویر بسته آموزشی",
    chooseCover: "انتخاب تصویر",
    coverHelp: "اندازه پیشنهادی: ۱۶۰۰ × ۹۰۰ پیکسل (نسبت ۱۶:۹). تصویر به‌صورت خودکار برای نمایش درست در همه دستگاه‌ها تنظیم می‌شود.",
    coverTypeError: "فقط تصویر PNG، JPG یا WEBP مجاز است.",
    coverSizeError: "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد.",
    coverUploadError: "آماده‌سازی تصویر انجام نشد. تصویر دیگری انتخاب کنید.",
    removeCover: "حذف تصویر",
    searchCourses: "جستجوی کورس بر اساس نام…",
    noCourseMatches: "کورسی مطابق جستجو پیدا نشد.",
    selectedCourses: "کورس انتخاب‌شده",
  },
  en: {
    title: "Learning packages",
    subtitle: "Build step-by-step learning paths from existing courses.",
    add: "Create package",
    empty: "No learning package has been created yet.",
    create: "New learning package",
    edit: "Edit package",
    titleFa: "Persian title",
    titleEn: "English title",
    descriptionFa: "Persian description",
    descriptionEn: "English description",
    draft: "Draft",
    published: "Published",
    status: "Status",
    steps: "Package steps",
    step: "Step",
    addStep: "Add step",
    courses: "Courses in this step",
    noCourses: "Publish at least one course first.",
    save: "Save package",
    cancel: "Cancel",
    deleteConfirm: "Delete this learning package?",
    loadError: "Learning packages could not be loaded.",
    saveError: "Learning package could not be saved.",
    selectCourseError:
      "To publish the package, select at least one course in every step. Empty step:",
    draftCourseHelp:
      "A draft can be saved without courses; publishing requires at least one course in every step.",
    publicLink: "Public link",
    copyLink: "Copy link",
    copied: "Copied",
    openLink: "Open public link",
    cover: "Package cover image",
    chooseCover: "Choose image",
    coverHelp: "Recommended size: 1600 × 900 px (16:9). The image is automatically prepared for consistent display on every device.",
    coverTypeError: "Only PNG, JPG, or WEBP images are allowed.",
    coverSizeError: "The source image must be smaller than 10 MB.",
    coverUploadError: "The image could not be prepared. Choose another image.",
    removeCover: "Remove image",
    searchCourses: "Search courses by name…",
    noCourseMatches: "No course matches your search.",
    selectedCourses: "courses selected",
  },
};

const idOf = (value) => String(value?._id || value || "");
const normalizeCourseSearch = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim();
const courseTitle = (course, language) => {
  if (typeof course?.title === "string") return course.title;
  return course?.title?.[language] || course?.title?.fa || course?.title?.en || "";
};
const courseMatchesSearch = (course, search, language) => {
  const query = normalizeCourseSearch(search);
  if (!query) return true;
  return normalizeCourseSearch([
    courseTitle(course, language),
    course?.teacher?.name,
    course?.category?.name,
  ].filter(Boolean).join(" ")).includes(query);
};

const fetchAllPublishedCourses = async () => {
  const firstPage = await fetchAdminCourses({
    page: 1,
    limit: 100,
    status: "published",
    sortBy: "newest",
  });
  const totalPages = Math.max(1, Number(firstPage?.meta?.totalPages || 1));
  if (totalPages === 1) return firstPage.courses || [];
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchAdminCourses({
      page: index + 2,
      limit: 100,
      status: "published",
      sortBy: "newest",
    })),
  );
  return [
    ...(firstPage.courses || []),
    ...remainingPages.flatMap((page) => page.courses || []),
  ];
};

const publicPackageUrl = (slug, language) => {
  const configured = String(
    import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_SITE_URL || "",
  ).replace(/\/+$/, "");
  const origin =
    configured ||
    (["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? `${window.location.protocol}//${window.location.hostname}:5173`
      : "https://edutech.study");
  return `${origin}/${language === "en" ? "en" : "fa"}/packages/${encodeURIComponent(slug)}`;
};

export default function AdminLearningPackagesPage() {
  const { language, isRTL } = useAdminI18n();
  const text = copy[language] || copy.en;
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [packageRows, publishedCourses] = await Promise.all([
        fetchAdminLearningPackages(),
        fetchAllPublishedCourses(),
      ]);
      setItems(packageRows);
      setCourses(publishedCourses);
    } catch (requestError) {
      setError(requestError?.message || text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const showCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  };

  const showEdit = (item) => {
    setEditing(item);
    setForm({
      titleFa: item.title?.fa || "",
      titleEn: item.title?.en || "",
      descriptionFa: item.description?.fa || "",
      descriptionEn: item.description?.en || "",
      coverImage: item.coverImage || "",
      status: item.status || "draft",
      steps: (item.steps || []).map((step) => ({
        titleFa: step.title?.fa || "",
        titleEn: step.title?.en || "",
        descriptionFa: step.description?.fa || "",
        descriptionEn: step.description?.en || "",
        courseSearch: "",
        courses: (step.courses || []).map(idOf),
      })),
    });
    setError("");
    setOpen(true);
  };

  const updateStep = (index, patch) =>
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));

  const moveStep = (index, direction) =>
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });

  const toggleCourse = (stepIndex, courseId) => {
    const selected = form.steps[stepIndex].courses;
    updateStep(stepIndex, {
      courses: selected.includes(courseId)
        ? selected.filter((id) => id !== courseId)
        : [...selected, courseId],
    });
  };

  const selectCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PACKAGE_COVER_TYPES.has(file.type)) {
      setError(text.coverTypeError);
      return;
    }
    if (file.size > PACKAGE_COVER_RAW_MAX_BYTES) {
      setError(text.coverSizeError);
      return;
    }

    try {
      setUploadingCover(true);
      setError("");
      const optimizedFile = await compressImageFileToLimit({
        file,
        maxBytes: PACKAGE_COVER_MAX_BYTES,
        maxWidth: 1600,
        maxHeight: 900,
        initialQuality: 0.84,
        baseName: "learning-package-cover",
      });
      const coverImage = await uploadAdminLearningPackageCover(optimizedFile);
      setForm((current) => ({ ...current, coverImage }));
    } catch (requestError) {
      setError(requestError?.message || text.coverUploadError);
    } finally {
      setUploadingCover(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (uploadingCover) return;
    const emptyStepIndex = form.steps.findIndex(
      (step) => step.courses.length === 0,
    );
    if (form.status === "published" && emptyStepIndex >= 0) {
      setError(`${text.selectCourseError} ${emptyStepIndex + 1}`);
      return;
    }
    const payload = {
      title: { fa: form.titleFa, en: form.titleEn },
      description: { fa: form.descriptionFa, en: form.descriptionEn },
      coverImage: form.coverImage,
      status: form.status,
      steps: form.steps.map((step) => ({
        title: { fa: step.titleFa, en: step.titleEn },
        description: { fa: step.descriptionFa, en: step.descriptionEn },
        courses: step.courses,
      })),
    };
    try {
      setSaving(true);
      setError("");
      if (editing) await updateAdminLearningPackage(editing._id, payload);
      else await createAdminLearningPackage(payload);
      setOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError?.message || text.saveError);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(text.deleteConfirm)) return;
    try {
      await deleteAdminLearningPackage(item._id);
      setItems((current) => current.filter((row) => row._id !== item._id));
    } catch (requestError) {
      setError(requestError?.message || text.saveError);
    }
  };

  const copyPublicLink = async (item) => {
    const url = publicPackageUrl(item.slug, language);
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement("textarea");
        input.value = url;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopiedId(item._id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setError(text.saveError);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{text.title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {text.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={showCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white"
        >
          <Plus size={18} />
          {text.add}
        </button>
      </div>
      {error && !open ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-8">
          <AdminPageLoader label={text.title} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Boxes className="mx-auto text-slate-300" size={48} />
          <p className="mt-3 font-bold text-slate-500">{text.empty}</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item._id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {item.coverImage ? (
                <div className="mb-5 aspect-video overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={resolveLearningPackageCoverUrl(item.coverImage)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {item.status === "published" ? text.published : text.draft}
                  </span>
                  <h2 className="mt-3 text-lg font-black text-slate-950">
                    {item.title?.[language] || item.title?.en || item.title?.fa}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.steps?.length || 0} {text.steps}
                  </p>
                </div>
                <Boxes className="text-blue-600" />
              </div>
              {item.status === "published" ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">
                    {text.publicLink}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-1 truncate text-xs font-semibold text-slate-600"
                  >
                    {publicPackageUrl(item.slug, language)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyPublicLink(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm"
                    >
                      {copiedId === item._id ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}{" "}
                      {copiedId === item._id ? text.copied : text.copyLink}
                    </button>
                    <a
                      href={publicPackageUrl(item.slug, language)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
                    >
                      <ExternalLink size={14} />
                      {text.openLink}
                    </a>
                  </div>
                </div>
              ) : null}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => showEdit(item)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-black text-blue-700"
                >
                  <Pencil size={16} />
                  {text.edit}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/65 p-3 sm:p-6">
          <form
            onSubmit={submit}
            className="flex h-[calc(100dvh-1.5rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[calc(100dvh-3rem)] sm:max-h-[940px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
              <h2 className="text-xl font-black text-slate-950">
                {editing ? text.edit : text.create}
              </h2>
              <button
                type="button"
                disabled={saving || uploadingCover}
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <div className="edutech-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain [direction:ltr] [scrollbar-gutter:stable]">
              <div dir={isRTL ? "rtl" : "ltr"} className="px-5 py-5 sm:px-7 sm:py-6">
              {error ? (
                <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : null}
            <div className={`${error ? "mt-5" : ""} grid gap-4 sm:grid-cols-2`}>
              <div className="sm:col-span-2">
                <p className="text-sm font-black text-slate-800">{text.cover}</p>
                <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
                  <div>
                    <label className="flex min-h-28 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-5 py-6 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                      {uploadingCover ? (
                        <Loader2 className="animate-spin" size={19} />
                      ) : (
                        <ImagePlus size={19} />
                      )}
                      {text.chooseCover}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploadingCover || saving}
                        onChange={selectCover}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {text.coverHelp}
                    </p>
                  </div>
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {form.coverImage ? (
                      <>
                        <img
                          src={resolveLearningPackageCoverUrl(form.coverImage)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, coverImage: "" }))}
                          className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-rose-600 shadow-md"
                          aria-label={text.removeCover}
                        >
                          <X size={17} />
                        </button>
                      </>
                    ) : (
                      <div className="grid h-full place-items-center text-slate-300">
                        <ImagePlus size={34} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Field
                label={text.titleFa}
                required={!form.titleEn}
                value={form.titleFa}
                onChange={(value) =>
                  setForm((old) => ({ ...old, titleFa: value }))
                }
              />
              <Field
                label={text.titleEn}
                required={!form.titleFa}
                value={form.titleEn}
                onChange={(value) =>
                  setForm((old) => ({ ...old, titleEn: value }))
                }
              />
              <Field
                label={text.descriptionFa}
                textarea
                value={form.descriptionFa}
                onChange={(value) =>
                  setForm((old) => ({ ...old, descriptionFa: value }))
                }
              />
              <Field
                label={text.descriptionEn}
                textarea
                value={form.descriptionEn}
                onChange={(value) =>
                  setForm((old) => ({ ...old, descriptionEn: value }))
                }
              />
              <label className="flex flex-col gap-2 text-sm font-black text-slate-800">
                {text.status}
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, status: event.target.value }))
                  }
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3"
                >
                  <option value="draft">{text.draft}</option>
                  <option value="published">{text.published}</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs font-bold leading-6 text-slate-500">
              {text.draftCourseHelp}
            </p>
            <div className="mt-8 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">
                {text.steps}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setForm((old) => ({
                    ...old,
                    steps: [...old.steps, newStep()],
                  }))
                }
                className="inline-flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"
              >
                <Plus size={16} />
                {text.addStep}
              </button>
            </div>
            <div className="mt-4 space-y-5">
              {form.steps.map((step, index) => (
                <section
                  key={index}
                  className={`rounded-2xl border bg-slate-50 p-4 sm:p-5 ${form.status === "published" && step.courses.length === 0 ? "border-rose-300" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900">
                      {text.step} {index + 1}
                    </h4>
                    <div className="flex gap-1">
                      <IconButton
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => moveStep(index, 1)}
                        disabled={index === form.steps.length - 1}
                      >
                        <ArrowDown size={16} />
                      </IconButton>
                      <IconButton
                        danger
                        onClick={() =>
                          setForm((old) => ({
                            ...old,
                            steps: old.steps.filter(
                              (_, stepIndex) => stepIndex !== index,
                            ),
                          }))
                        }
                        disabled={form.steps.length === 1}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label={text.titleFa}
                      required={!step.titleEn}
                      value={step.titleFa}
                      onChange={(value) =>
                        updateStep(index, { titleFa: value })
                      }
                    />
                    <Field
                      label={text.titleEn}
                      required={!step.titleFa}
                      value={step.titleEn}
                      onChange={(value) =>
                        updateStep(index, { titleEn: value })
                      }
                    />
                    <Field
                      label={text.descriptionFa}
                      textarea
                      value={step.descriptionFa}
                      onChange={(value) =>
                        updateStep(index, { descriptionFa: value })
                      }
                    />
                    <Field
                      label={text.descriptionEn}
                      textarea
                      value={step.descriptionEn}
                      onChange={(value) =>
                        updateStep(index, { descriptionEn: value })
                      }
                    />
                  </div>
                  <p className="mt-5 text-sm font-black text-slate-800">
                    {text.courses}
                  </p>
                  {courses.length === 0 ? (
                    <p className="mt-2 text-sm font-bold text-amber-700">
                      {text.noCourses}
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                          <Search size={17} className="shrink-0 text-slate-400" />
                          <input
                            type="search"
                            value={step.courseSearch}
                            onChange={(event) => updateStep(index, { courseSearch: event.target.value })}
                            placeholder={text.searchCourses}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                          />
                          {step.courseSearch ? (
                            <button
                              type="button"
                              onClick={() => updateStep(index, { courseSearch: "" })}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label={text.cancel}
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </label>
                        <span className="shrink-0 text-xs font-black text-blue-700">
                          {step.courses.length} {text.selectedCourses}
                        </span>
                      </div>
                      {(() => {
                        const visibleCourses = courses.filter((course) =>
                          courseMatchesSearch(course, step.courseSearch, language));
                        if (visibleCourses.length === 0) {
                          return (
                            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-500">
                              {text.noCourseMatches}
                            </p>
                          );
                        }
                        return (
                          <div className="edutech-scrollbar mt-3 grid max-h-56 gap-2 overflow-y-auto overscroll-contain pe-1 [direction:ltr] sm:grid-cols-2 lg:grid-cols-3">
                            {visibleCourses.map((course) => {
                              const courseId = idOf(course);
                              return (
                                <label
                                  key={courseId}
                                  dir={isRTL ? "rtl" : "ltr"}
                                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${step.courses.includes(courseId) ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={step.courses.includes(courseId)}
                                    onChange={() => toggleCourse(index, courseId)}
                                    className="h-4 w-4 shrink-0"
                                  />
                                  <BookOpen size={16} className="shrink-0" />
                                  <span className="line-clamp-2">{courseTitle(course, language)}</span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </section>
              ))}
            </div>
              </div>
            </div>
            <div dir={isRTL ? "rtl" : "ltr"} className="flex shrink-0 gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
              <button
                disabled={saving || uploadingCover}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 font-black text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                {text.save}
              </button>
              <button
                type="button"
                disabled={saving || uploadingCover}
                onClick={() => setOpen(false)}
                className="h-12 rounded-xl bg-slate-100 px-6 font-black text-slate-600"
              >
                {text.cancel}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, textarea = false, onChange, ...props }) {
  const Component = textarea ? "textarea" : "input";
  return (
    <label className="flex flex-col gap-2 text-sm font-black text-slate-800">
      {label}
      <Component
        {...props}
        onChange={(event) => onChange(event.target.value)}
        className={`${textarea ? "min-h-24 py-3" : "h-12"} rounded-xl border border-slate-200 bg-white px-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100`}
      />
    </label>
  );
}

function IconButton({ danger = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30 ${danger ? "bg-rose-50 text-rose-600" : "bg-white text-slate-600"}`}
    />
  );
}
