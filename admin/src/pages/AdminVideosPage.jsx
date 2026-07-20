import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2, Video, X } from "lucide-react";
import { createAdminVideo, deleteAdminVideo, fetchAdminVideos, updateAdminVideo } from "../../services/videoService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const EMPTY_FORM = { title: "", url: "", sortOrder: 0, isPublished: true };

const copy = {
  fa: {
    title: "ویدیوها", subtitle: "ویدیوهای یوتیوب و اینستاگرام را برای صفحه عمومی مدیریت کنید.", add: "افزودن ویدیو",
    total: "مجموع ویدیوها", published: "منتشرشده", hidden: "پنهان", empty: "هنوز ویدیویی اضافه نشده است.",
    formTitle: "عنوان ویدیو", link: "لینک یوتیوب یا اینستاگرام", order: "ترتیب نمایش",
    visible: "نمایش برای کاربران", save: "ذخیره ویدیو", update: "ذخیره تغییرات", cancel: "انصراف", edit: "ویرایش",
    remove: "حذف", refresh: "تازه‌سازی", loading: "در حال بارگذاری ویدیوها", required: "عنوان و لینک الزامی است.",
    loadError: "بارگذاری ویدیوها ناموفق بود.", saveError: "ذخیره ویدیو ناموفق بود.", deleteConfirm: "این ویدیو حذف شود؟",
    deleteError: "حذف ویدیو ناموفق بود.", titleLong: "عنوان ویدیو نباید بیشتر از ۸۰ نویسه باشد.", open: "باز کردن لینک اصلی", youtube: "یوتیوب", instagram: "اینستاگرام",
  },
  en: {
    title: "Videos", subtitle: "Manage YouTube and Instagram videos shown on the public gallery.", add: "Add video",
    total: "Total videos", published: "Published", hidden: "Hidden", empty: "No videos have been added yet.",
    formTitle: "Video title", link: "YouTube or Instagram link", order: "Display order",
    visible: "Visible to users", save: "Add video", update: "Save changes", cancel: "Cancel", edit: "Edit",
    remove: "Delete", refresh: "Refresh", loading: "Loading videos", required: "Title and link are required.",
    loadError: "Could not load videos.", saveError: "Could not save the video.", deleteConfirm: "Delete this video?",
    deleteError: "Could not delete the video.", titleLong: "The video title must not exceed 80 characters.", open: "Open original link", youtube: "YouTube", instagram: "Instagram",
  },
};

export default function AdminVideosPage() {
  const { language, isRTL } = useAdminI18n();
  const text = copy[language === "fa" ? "fa" : "en"];
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true); setError("");
    try { setVideos(await fetchAdminVideos()); }
    catch (err) { setError(err.message || text.loadError); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    fetchAdminVideos()
      .then((rows) => { if (active) setVideos(rows); })
      .catch((err) => { if (active) setError(err.message || text.loadError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [text.loadError]);

  const counts = useMemo(() => ({
    published: videos.filter((item) => item.isPublished).length,
    hidden: videos.filter((item) => !item.isPublished).length,
  }), [videos]);

  const openCreate = () => { setEditingId(""); setForm(EMPTY_FORM); setFormOpen(true); setError(""); };
  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({ title: item.title || "", url: item.url || "", sortOrder: item.sortOrder || 0, isPublished: item.isPublished !== false });
    setFormOpen(true); setError("");
  };
  const closeForm = () => { setFormOpen(false); setEditingId(""); setForm(EMPTY_FORM); };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) { setError(text.required); return; }
    if (form.title.trim().length > 80) { setError(text.titleLong); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, title: form.title.trim(), url: form.url.trim(), sortOrder: Number(form.sortOrder) || 0 };
      if (editingId) await updateAdminVideo(editingId, payload); else await createAdminVideo(payload);
      closeForm(); await load();
    } catch (err) { setError(err.message || text.saveError); }
    finally { setSaving(false); }
  };

  const togglePublished = async (item) => {
    try { await updateAdminVideo(item._id, { isPublished: !item.isPublished }); await load(); }
    catch (err) { setError(err.message || text.saveError); }
  };

  const remove = async (item) => {
    if (!window.confirm(text.deleteConfirm)) return;
    try { await deleteAdminVideo(item._id); setVideos((rows) => rows.filter((row) => row._id !== item._id)); }
    catch (err) { setError(err.message || text.deleteError); }
  };

  return (
    <div className="mx-auto max-w-7xl" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{text.title}</h1><p className="mt-1 text-sm font-medium text-slate-500">{text.subtitle}</p></div>
        <div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"><RefreshCw size={17}/>{text.refresh}</button><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#0B4FD8] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200"><Plus size={18}/>{text.add}</button></div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[[text.total, videos.length, "text-blue-700"], [text.published, counts.published, "text-emerald-700"], [text.hidden, counts.hidden, "text-amber-700"]].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p></div>)}
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {loading ? <AdminPageLoader label={text.loading}/> : videos.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><Video className="mx-auto text-slate-300" size={46}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((item) => <article key={item._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-video bg-white bg-center bg-no-repeat" style={{ backgroundImage: 'url("/logo.png")', backgroundSize: "72% auto" }}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover"/> : null}<span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-black text-white">{text[item.platform] || item.platform}</span></div>
            <div className="p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-black text-slate-900">{item.title}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${item.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.isPublished ? text.published : text.hidden}</span></div><p className="mt-3 text-xs font-bold text-slate-400">{text.order}: {item.sortOrder || 0}</p>
              <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => openEdit(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14}/>{text.edit}</button><button onClick={() => togglePublished(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{item.isPublished ? <EyeOff size={14}/> : <Eye size={14}/>} {item.isPublished ? text.hidden : text.published}</button><a href={item.url} target="_blank" rel="noreferrer" title={text.open} className="rounded-lg bg-slate-100 p-2 text-slate-600"><ExternalLink size={15}/></a><button onClick={() => remove(item)} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div>
            </div>
          </article>)}
        </div>
      )}

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeForm(); }}><form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-900">{editingId ? text.edit : text.add}</h2><button type="button" onClick={closeForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></div><div className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-slate-700">{text.formTitle}<input value={form.title} onChange={(e) => setForm({...form,title:e.target.value})} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" required/><span className="mt-1 block text-end text-xs text-slate-400">{form.title.length}/80</span></label>
        <label className="block text-sm font-bold text-slate-700">{text.link}<input value={form.url} onChange={(e) => setForm({...form,url:e.target.value})} placeholder="https://www.youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-blue-500" dir="ltr" required/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">{text.order}<input type="number" min="0" max="100000" value={form.sortOrder} onChange={(e) => setForm({...form,sortOrder:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"/></label><label className="mt-7 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({...form,isPublished:e.target.checked})} className="h-4 w-4"/>{text.visible}</label></div>
      </div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">{text.cancel}</button><button disabled={saving} className="rounded-xl bg-[#0B4FD8] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "…" : editingId ? text.update : text.save}</button></div></form></div>}
    </div>
  );
}
