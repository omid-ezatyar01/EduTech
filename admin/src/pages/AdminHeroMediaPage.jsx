import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  createAdminHeroMedia,
  deleteAdminHeroMedia,
  fetchAdminHeroMedia,
  resolveHeroMediaUrl,
  updateAdminHeroMedia,
  uploadAdminHeroMedia,
} from "../../services/heroMediaService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const emptyForm = {
  status: "active",
};

const pageCopy = {
  fa: {
    title: "تصاویر تبلیغاتی صفحه اصلی",
    subtitle: "تصاویر تبلیغاتی چرخشی صفحه اصلی را مدیریت کنید.",
    add: "افزودن رسانه",
    empty: "هنوز هیچ رسانه‌ای افزوده نشده است.",
    edit: "ویرایش رسانه",
    create: "رسانه جدید",
    file: "حداقل یک تصویر انتخاب کنید",
    choose: "انتخاب چند تصویر",
    replace: "برای جایگزینی، فایل جدید انتخاب کنید",
    status: "وضعیت",
    active: "فعال",
    inactive: "غیرفعال",
    save: "ذخیره",
    cancel: "لغو",
    deleteConfirm: "این رسانه حذف شود؟",
    loadError: "دریافت رسانه‌ها انجام نشد.",
    saveError: "ذخیره رسانه انجام نشد.",
    max: "PNG، JPG یا WEBP — حداکثر ۲۰ مگابایت برای هر تصویر",
    dimensions: "اندازه پیشنهادی تصویر: ۱۹۲۰ × ۱۰۸۰ پیکسل (نسبت ۱۶:۹)",
    imageResize: "تصاویر هنگام بارگذاری به‌صورت خودکار به اندازه ۱۹۲۰ × ۱۰۸۰ برش و بهینه می‌شوند.",
    selectedCount: (count) => `${count} فایل انتخاب شده است`,
    removeSelected: "حذف از انتخاب",
  },
  en: {
    title: "Homepage advertisements",
    subtitle: "Manage rotating advertisement images on the homepage.",
    add: "Add media",
    empty: "No hero media has been added yet.",
    edit: "Edit media",
    create: "New media",
    file: "Select at least one image",
    choose: "Choose multiple images",
    replace: "Choose a new file to replace the current one",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    save: "Save",
    cancel: "Cancel",
    deleteConfirm: "Delete this hero media item?",
    loadError: "Hero media could not be loaded.",
    saveError: "Hero media could not be saved.",
    max: "PNG, JPG or WEBP — maximum 20 MB per image",
    dimensions: "Recommended image size: 1920 × 1080 pixels (16:9 ratio)",
    imageResize: "Uploaded images are automatically cropped and optimized to 1920 × 1080 pixels.",
    selectedCount: (count) => `${count} files selected`,
    removeSelected: "Remove from selection",
  },
};

export default function AdminHeroMediaPage() {
  const { language, isRTL } = useAdminI18n();
  const text = pageCopy[language] || pageCopy.en;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await fetchAdminHeroMedia());
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

  const showCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFiles([]);
    setError("");
    setOpen(true);
  };

  const showEdit = (item) => {
    setEditing(item);
    setForm({
      status: item.status || "active",
    });
    setFiles([]);
    setError("");
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!editing && files.length === 0) return setError(text.file);
    try {
      setSaving(true);
      setError("");
      if (editing) {
        const uploaded = files[0] ? await uploadAdminHeroMedia(files[0]) : null;
        await updateAdminHeroMedia(editing._id, {
          status: form.status,
          ...(uploaded ? uploaded : {}),
        });
      } else {
        let remainingFiles = [...files];
        for (const selectedFile of files) {
          const uploaded = await uploadAdminHeroMedia(selectedFile);
          await createAdminHeroMedia({ status: form.status, ...uploaded });
          remainingFiles = remainingFiles.slice(1);
          setFiles(remainingFiles);
        }
      }
      setOpen(false);
      await load();
    } catch (requestError) {
      await load();
      setError(requestError?.message || text.saveError);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(text.deleteConfirm)) return;
    try {
      await deleteAdminHeroMedia(item._id);
      setItems((current) => current.filter((row) => row._id !== item._id));
    } catch (requestError) {
      setError(requestError?.message || text.saveError);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-black text-slate-950">{text.title}</h1><p className="mt-2 text-sm font-semibold text-slate-500">{text.subtitle}</p></div>
        <button type="button" onClick={showCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 text-sm font-black text-white"><Plus size={18} />{text.add}</button>
      </div>
      {error && !open ? <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
      {loading ? <div className="mt-8"><AdminPageLoader label={text.title} /></div> : items.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><ImageIcon className="mx-auto text-slate-300" size={48}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative aspect-video bg-slate-950"><img src={resolveHeroMediaUrl(item.mediaUrl)} alt="" className="h-full w-full object-cover" /><span className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-black text-white ${item.status === "active" ? "bg-emerald-600" : "bg-slate-600"}`}>{item.status === "active" ? text.active : text.inactive}</span></div><div className="p-4"><div className="mt-1 flex gap-2"><button type="button" onClick={() => showEdit(item)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700"><Pencil size={15}/>{text.edit}</button><button type="button" onClick={() => remove(item)} className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600" aria-label={text.deleteConfirm}><Trash2 size={17}/></button></div></div></article>)}</div>}

      {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}><form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">{editing ? text.edit : text.create}</h2><button type="button" onClick={() => setOpen(false)} disabled={saving} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><X size={19}/></button></div>{error ? <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}<label className="mt-6 block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center"><Upload className="mx-auto text-blue-600"/><span className="mt-2 block text-sm font-black text-slate-800">{editing ? text.replace : text.choose}</span><span className="mt-2 block text-sm font-black text-blue-700">{text.dimensions}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{text.imageResize}</span><span className="mt-2 block text-xs font-semibold text-slate-400">{files.length ? text.selectedCount(files.length) : text.max}</span><input type="file" multiple={!editing} accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const selected = Array.from(event.target.files || []); setFiles(editing ? selected.slice(0, 1) : selected); event.target.value = ""; }} /></label>{files.length ? <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">{files.map((selectedFile, index) => <div key={`${selectedFile.name}-${selectedFile.size}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600"><span className="min-w-0 truncate">{selectedFile.name}</span><button type="button" disabled={saving} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="shrink-0 text-rose-600 disabled:opacity-50" aria-label={text.removeSelected}><X size={16}/></button></div>)}</div> : null}<div className="mt-5"><label className="flex flex-col gap-2 text-sm font-black text-slate-800">{text.status}<select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))} className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none"><option value="active">{text.active}</option><option value="inactive">{text.inactive}</option></select></label></div><div className="mt-7 flex gap-3"><button disabled={saving} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18}/> : null}{text.save}</button><button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-12 rounded-xl bg-slate-100 px-5 font-black text-slate-600">{text.cancel}</button></div></form></div> : null}
    </div>
  );
}
