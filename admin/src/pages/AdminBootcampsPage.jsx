import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import {
  createAdminBootcamp,
  deleteAdminBootcamp,
  fetchAdminBootcamps,
  fetchBootcampRegistrations,
  resolveBootcampImageUrl,
  updateAdminBootcamp,
  uploadAdminBootcampCover,
} from "../../services/bootcampService.js";
import { fetchAdminTeachers } from "../../services/courseService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { compressImageFileToLimit } from "../utils/imageCompression.js";

const COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const COVER_RAW_MAX_BYTES = 10 * 1024 * 1024;

const emptyForm = {
  titleFa: "",
  titleEn: "",
  descriptionFa: "",
  descriptionEn: "",
  teacherId: "",
  coverImage: "",
  status: "draft",
  minimumStudents: "10",
  maximumStudents: "100",
  registrationOpensAt: "",
  registrationClosesAt: "",
  plannedStartAt: "",
};

const copy = {
  fa: {
    title: "مدیریت بوت‌کمپ‌ها",
    subtitle:
      "ثبت‌نام رایگان، حداقل اشتراک‌کنندگان و کلاس‌های زنده را مدیریت کنید.",
    add: "بوت‌کمپ جدید",
    empty: "هنوز بوت‌کمپی ایجاد نشده است.",
    edit: "ویرایش بوت‌کمپ",
    create: "بوت‌کمپ جدید",
    save: "ذخیره",
    cancel: "لغو",
    deleteConfirm: "این بوت‌کمپ حذف شود؟",
    course: "مدرس بوت‌کمپ",
    chooseCourse: "انتخاب مدرس",
    titleFa: "عنوان فارسی",
    titleEn: "عنوان انگلیسی",
    descriptionFa: "توضیحات فارسی",
    descriptionEn: "توضیحات انگلیسی",
    cover: "تصویر بوت‌کمپ (اختیاری)",
    status: "وضعیت",
    minimum: "حداقل شاگرد",
    maximum: "ظرفیت نهایی",
    opens: "شروع ثبت‌نام",
    closes: "پایان ثبت‌نام",
    starts: "شروع برنامه",
    registrations: "ثبت‌نام‌ها",
    noRegistrations: "هنوز شاگردی ثبت‌نام نکرده است.",
    student: "شاگرد",
    phone: "شماره تماس",
    country: "کشور",
    experience: "سطح",
    close: "بستن",
    publicPage: "صفحه عمومی",
    loadError: "بارگذاری بوت‌کمپ‌ها انجام نشد.",
    saveError: "ذخیره بوت‌کمپ انجام نشد.",
    activeCount: "ثبت‌نام",
    minimumReached: "حداقل تکمیل شده",
    waiting: "در انتظار حداقل",
  },
  en: {
    title: "Bootcamp management",
    subtitle:
      "Manage free registration, minimum participation and live classes.",
    add: "New bootcamp",
    empty: "No bootcamp has been created yet.",
    edit: "Edit bootcamp",
    create: "New bootcamp",
    save: "Save",
    cancel: "Cancel",
    deleteConfirm: "Delete this bootcamp?",
    course: "Bootcamp teacher",
    chooseCourse: "Choose a teacher",
    titleFa: "Persian title",
    titleEn: "English title",
    descriptionFa: "Persian description",
    descriptionEn: "English description",
    cover: "Bootcamp cover (optional)",
    status: "Status",
    minimum: "Minimum students",
    maximum: "Maximum capacity",
    opens: "Registration opens",
    closes: "Registration closes",
    starts: "Planned start",
    registrations: "Registrations",
    noRegistrations: "No students have registered yet.",
    student: "Student",
    phone: "Phone",
    country: "Country",
    experience: "Level",
    close: "Close",
    publicPage: "Public page",
    loadError: "Bootcamps could not be loaded.",
    saveError: "Bootcamp could not be saved.",
    activeCount: "registered",
    minimumReached: "Minimum reached",
    waiting: "Waiting for minimum",
  },
};

const statusLabels = {
  fa: {
    draft: "پیش‌نویس",
    registration_open: "ثبت‌نام باز",
    registration_closed: "ثبت‌نام بسته",
    in_progress: "در حال اجرا",
    completed: "تکمیل‌شده",
    cancelled: "لغوشده",
  },
  en: {
    draft: "Draft",
    registration_open: "Registration open",
    registration_closed: "Registration closed",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  },
};

const toInputDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";
const localized = (value, language) =>
  value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";

export default function AdminBootcampsPage() {
  const { language, isRTL } = useAdminI18n();
  const t = copy[language] || copy.en;
  const [items, setItems] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [rosterFor, setRosterFor] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bootcamps, teacherRows] = await Promise.all([
        fetchAdminBootcamps(),
        fetchAdminTeachers({ page: 1, limit: 100 }),
      ]);
      setItems(bootcamps);
      setTeachers(teacherRows);
    } catch (requestError) {
      setError(requestError?.message || t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!open && !rosterFor) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, rosterFor]);

  const publicOrigin = String(
    import.meta.env.VITE_PUBLIC_SITE_URL ||
      import.meta.env.VITE_SITE_URL ||
      "http://localhost:5173",
  ).replace(/\/$/, "");
  const publicUrl = (item) =>
    `${publicOrigin}/${language === "en" ? "en" : "fa"}/bootcamps/${encodeURIComponent(item.slug)}`;
  const teacherNames = useMemo(
    () => new Map(teachers.map((teacher) => [String(teacher._id), teacher.name || teacher.email])),
    [teachers],
  );

  const showCreate = () => {
    setEditing(null);
    setForm(emptyForm);
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
      teacherId: String(item.course?.teacher?._id || item.teacherId || ""),
      coverImage: item.coverImage || "",
      status: item.status || "draft",
      minimumStudents: String(item.minimumStudents || 10),
      maximumStudents: String(item.maximumStudents || 100),
      registrationOpensAt: toInputDate(item.registrationOpensAt),
      registrationClosesAt: toInputDate(item.registrationClosesAt),
      plannedStartAt: toInputDate(item.plannedStartAt),
    });
    setError("");
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: { fa: form.titleFa.trim(), en: form.titleEn.trim() },
      description: {
        fa: form.descriptionFa.trim(),
        en: form.descriptionEn.trim(),
      },
      teacherId: form.teacherId,
      coverImage: form.coverImage.trim(),
      status: form.status,
      minimumStudents: Number(form.minimumStudents),
      maximumStudents: Number(form.maximumStudents),
      registrationOpensAt: form.registrationOpensAt
        ? new Date(form.registrationOpensAt).toISOString()
        : null,
      registrationClosesAt: form.registrationClosesAt
        ? new Date(form.registrationClosesAt).toISOString()
        : null,
      plannedStartAt: form.plannedStartAt
        ? new Date(form.plannedStartAt).toISOString()
        : null,
    };
    try {
      if (editing) await updateAdminBootcamp(editing._id, payload);
      else await createAdminBootcamp(payload);
      setOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError?.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await deleteAdminBootcamp(item._id);
      setItems((current) => current.filter((row) => row._id !== item._id));
    } catch (requestError) {
      setError(requestError?.message || t.saveError);
    }
  };

  const showRoster = async (item) => {
    setRosterFor(item);
    setRoster([]);
    setRosterLoading(true);
    try {
      setRoster(await fetchBootcampRegistrations(item._id));
    } catch (requestError) {
      setError(requestError?.message || t.loadError);
    } finally {
      setRosterLoading(false);
    }
  };

  const selectCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!COVER_TYPES.has(file.type) || file.size > COVER_RAW_MAX_BYTES) {
      setError(
        language === "fa"
          ? "تصویر باید PNG، JPG یا WEBP و کمتر از ۱۰ مگابایت باشد."
          : "Use a PNG, JPG, or WEBP image under 10 MB.",
      );
      return;
    }
    try {
      setUploadingCover(true);
      setError("");
      const optimized = await compressImageFileToLimit({
        file,
        maxBytes: 700 * 1024,
        maxWidth: 1600,
        maxHeight: 900,
        initialQuality: 0.84,
        baseName: "bootcamp-cover",
      });
      const coverImage = await uploadAdminBootcampCover(optimized);
      setForm((current) => ({ ...current, coverImage }));
    } catch (requestError) {
      setError(requestError?.message || t.saveError);
    } finally {
      setUploadingCover(false);
    }
  };

  if (loading) return <AdminPageLoader label={t.title} />;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{t.title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={showCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white"
        >
          <Plus size={18} />
          {t.add}
        </button>
      </div>
      {error && !open ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}
      {!items.length ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <UsersRound size={46} className="mx-auto text-slate-300" />
          <p className="mt-3 font-bold text-slate-500">{t.empty}</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item._id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {item.coverImage ? (
                <img
                  src={item.coverImage}
                  alt=""
                  className="aspect-video w-full bg-slate-100 object-cover"
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-gradient-to-br from-blue-50 to-teal-50">
                  <UsersRound size={48} className="text-blue-300" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">
                      {localized(item.title, language)}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {item.course?.teacher?.name ||
                        teacherNames.get(String(item.teacherId)) || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                    {statusLabels[language][item.status]}
                  </span>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between text-xs font-black text-slate-600">
                    <span>
                      {item.registeredCount} {t.activeCount}
                    </span>
                    <span>
                      {item.minimumStudents} / {item.maximumStudents}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{
                        width: `${Math.min(100, (item.registeredCount / item.minimumStudents) * 100)}%`,
                      }}
                    />
                  </div>
                  <p
                    className={`mt-2 text-xs font-black ${item.minimumReached ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {item.minimumReached ? t.minimumReached : t.waiting}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => showRoster(item)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-50 text-xs font-black text-teal-700"
                  >
                    <UsersRound size={15} />
                    {t.registrations}
                  </button>
                  <a
                    href={publicUrl(item)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-50 text-xs font-black text-slate-700"
                  >
                    <ExternalLink size={15} />
                    {t.publicPage}
                  </a>
                  <button
                    onClick={() => showEdit(item)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-50 text-xs font-black text-blue-700"
                  >
                    <Pencil size={15} />
                    {t.edit}
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-50 text-xs font-black text-rose-700"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setOpen(false);
          }}
        >
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-4">
              <h2 className="text-xl font-black">
                {editing ? t.edit : t.create}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            {error ? (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-black">
                {t.titleFa}
                <input
                  required={!form.titleEn}
                  value={form.titleFa}
                  onChange={(e) =>
                    setForm((old) => ({ ...old, titleFa: e.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.titleEn}
                <input
                  required={!form.titleFa}
                  value={form.titleEn}
                  onChange={(e) =>
                    setForm((old) => ({ ...old, titleEn: e.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black sm:col-span-2">
                {t.course}
                <select
                  required
                  value={form.teacherId}
                  onChange={(e) =>
                    setForm((old) => ({ ...old, teacherId: e.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                >
                  <option value="">{t.chooseCourse}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name || teacher.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-black">
                {t.descriptionFa}
                <textarea
                  value={form.descriptionFa}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      descriptionFa: e.target.value,
                    }))
                  }
                  rows="4"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.descriptionEn}
                <textarea
                  value={form.descriptionEn}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      descriptionEn: e.target.value,
                    }))
                  }
                  rows="4"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3"
                />
              </label>
              <div className="text-sm font-black sm:col-span-2">
                <span>{t.cover}</span>
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-blue-700">
                  <ImagePlus size={18} />
                  {uploadingCover
                    ? language === "fa"
                      ? "در حال بارگذاری…"
                      : "Uploading…"
                    : language === "fa"
                      ? "انتخاب تصویر ۱۶:۹"
                      : "Choose a 16:9 image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={selectCover}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                </label>
                {form.coverImage ? (
                  <div className="relative mt-3 aspect-video overflow-hidden rounded-xl border bg-slate-50">
                    <img
                      src={resolveBootcampImageUrl(form.coverImage)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((old) => ({ ...old, coverImage: "" }))
                      }
                      className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-rose-600 shadow"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : null}
                <span className="mt-2 block text-xs font-semibold text-slate-500">
                  {language === "fa"
                    ? "پیشنهاد: ۱۶۰۰ × ۹۰۰ پیکسل؛ PNG، JPG یا WEBP"
                    : "Recommended: 1600 × 900 px; PNG, JPG, or WEBP"}
                </span>
              </div>
              <label className="text-sm font-black">
                {t.minimum}
                <input
                  required
                  type="number"
                  min="1"
                  max="2000"
                  value={form.minimumStudents}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      minimumStudents: e.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.maximum}
                <input
                  required
                  type="number"
                  min="1"
                  max="2000"
                  value={form.maximumStudents}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      maximumStudents: e.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.opens}
                <input
                  type="datetime-local"
                  value={form.registrationOpensAt}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      registrationOpensAt: e.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.closes}
                <input
                  type="datetime-local"
                  value={form.registrationClosesAt}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      registrationClosesAt: e.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.starts}
                <input
                  type="datetime-local"
                  value={form.plannedStartAt}
                  onChange={(e) =>
                    setForm((old) => ({
                      ...old,
                      plannedStartAt: e.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </label>
              <label className="text-sm font-black">
                {t.status}
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((old) => ({ ...old, status: e.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                >
                  {Object.entries(statusLabels[language]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-100 bg-white pt-4">
              <button
                disabled={saving || uploadingCover}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 font-black text-white disabled:bg-slate-400"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                {t.save}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 rounded-xl bg-slate-100 px-5 font-black text-slate-600"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {rosterFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">{t.registrations}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {localized(rosterFor.title, language)}
                </p>
              </div>
              <button
                onClick={() => setRosterFor(null)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            {rosterLoading ? (
              <AdminPageLoader label={t.registrations} />
            ) : !roster.length ? (
              <p className="py-16 text-center font-bold text-slate-500">
                {t.noRegistrations}
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start text-xs text-slate-500">
                      <th className="p-3 text-start">{t.student}</th>
                      <th className="p-3 text-start">{t.phone}</th>
                      <th className="p-3 text-start">{t.country}</th>
                      <th className="p-3 text-start">{t.experience}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((row) => (
                      <tr key={row._id} className="border-b border-slate-100">
                        <td className="p-3">
                          <strong>{row.studentId?.name || "-"}</strong>
                          <span className="block text-xs text-slate-500">
                            {row.studentId?.email}
                          </span>
                        </td>
                        <td className="p-3" dir="ltr">
                          {row.phone}
                        </td>
                        <td className="p-3">{row.country}</td>
                        <td className="p-3">{row.experienceLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
