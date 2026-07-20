import { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout.jsx";
import TeacherPageLoader from "../components/common/TeacherPageLoader.jsx";
import useTeacherLanguage from "../hooks/useTeacherLanguage.js";
import { getAuthUser } from "../../services/portal.js";
import { createTeacherVideo, deleteTeacherVideo, fetchTeacherVideos, updateTeacherVideo } from "../../services/videoService.js";

const EMPTY = { title: "", url: "", sortOrder: 0, isPublished: true };
const copy = {
  fa: { title: "ویدیوهای من", subtitle: "لینک ویدیوهای یوتیوب یا اینستاگرام را منتشر کنید تا در صفحه ویدیوهای ایجوتک نمایش داده شود.", add: "ویدیوی جدید", total: "مجموع ویدیوها", empty: "هنوز ویدیویی منتشر نکرده‌اید.", name: "عنوان ویدیو", link: "لینک یوتیوب یا اینستاگرام", order: "ترتیب نمایش", visible: "نمایش برای کاربران", save: "انتشار ویدیو", update: "ذخیره تغییرات", cancel: "انصراف", edit: "ویرایش", remove: "حذف", published: "منتشرشده", hidden: "پنهان", load: "در حال بارگذاری ویدیوها", required: "عنوان و لینک الزامی است.", titleLong: "عنوان ویدیو نباید بیشتر از ۸۰ نویسه باشد.", confirm: "این ویدیو حذف شود؟" },
  en: { title: "My Videos", subtitle: "Publish YouTube or Instagram links to the EduTech public video gallery.", add: "New video", total: "Total videos", empty: "You have not published any videos yet.", name: "Video title", link: "YouTube or Instagram link", order: "Display order", visible: "Visible to users", save: "Publish video", update: "Save changes", cancel: "Cancel", edit: "Edit", remove: "Delete", published: "Published", hidden: "Hidden", load: "Loading videos", required: "Title and link are required.", titleLong: "The video title must not exceed 80 characters.", confirm: "Delete this video?" },
};

export default function TeacherVideos() {
  const { language, setLanguage } = useTeacherLanguage();
  const text = copy[language === "fa" ? "fa" : "en"];
  const teacher = getAuthUser() || {};
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY);
  const publishedCount = videos.filter((item) => item.isPublished !== false).length;
  const hiddenCount = videos.length - publishedCount;
  const stats = [
    { label: text.total, value: videos.length, Icon: Video, tone: "bg-blue-50 text-blue-700" },
    { label: text.published, value: publishedCount, Icon: Eye, tone: "bg-emerald-50 text-emerald-700" },
    { label: text.hidden, value: hiddenCount, Icon: EyeOff, tone: "bg-amber-50 text-amber-700" },
  ];

  const load = async () => { setLoading(true); setError(""); try { setVideos(await fetchTeacherVideos()); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { let active = true; fetchTeacherVideos().then((rows) => { if (active) setVideos(rows); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const close = () => { setOpen(false); setEditingId(""); setForm(EMPTY); };
  const edit = (item) => { setEditingId(item._id); setForm({ title: item.title, url: item.url, sortOrder: item.sortOrder || 0, isPublished: item.isPublished !== false }); setOpen(true); };
  const submit = async (event) => { event.preventDefault(); if (!form.title.trim() || !form.url.trim()) { setError(text.required); return; } if (form.title.trim().length > 80) { setError(text.titleLong); return; } setSaving(true); setError(""); try { const payload = { ...form, title: form.title.trim(), url: form.url.trim(), sortOrder: Number(form.sortOrder) || 0 }; if (editingId) await updateTeacherVideo(editingId, payload); else await createTeacherVideo(payload); close(); await load(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const toggle = async (item) => { try { await updateTeacherVideo(item._id, { isPublished: !item.isPublished }); await load(); } catch (err) { setError(err.message); } };
  const remove = async (item) => { if (!window.confirm(text.confirm)) return; try { await deleteTeacherVideo(item._id); setVideos((rows) => rows.filter((row) => row._id !== item._id)); } catch (err) { setError(err.message); } };

  return <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
    <div className="mx-auto max-w-7xl"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-black text-slate-950">{text.title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">{text.subtitle}</p></div><button onClick={() => { setEditingId(""); setForm(EMPTY); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 py-3 text-sm font-black text-white"><Plus size={18}/>{text.add}</button></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">{stats.map(({ label, value, Icon, tone }) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon size={22}/></span><span><span className="block text-sm font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-black text-slate-950">{loading ? "—" : value}</strong></span></div>)}</div>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    {loading ? <TeacherPageLoader label={text.load}/> : videos.length === 0 ? <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><Video className="mx-auto text-slate-300" size={48}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{videos.map((item) => <article key={item._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="aspect-video bg-white bg-center bg-no-repeat" style={{ backgroundImage: 'url("/logo.png")', backgroundSize: "72% auto" }}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover"/> : null}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-black text-slate-950">{item.title}</h2><span className={`rounded-full px-2 py-1 text-[11px] font-black ${item.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.isPublished ? text.published : text.hidden}</span></div><div className="mt-4 flex gap-2"><button onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14}/>{text.edit}</button><button onClick={() => toggle(item)} className="rounded-lg bg-slate-100 p-2 text-slate-600">{item.isPublished ? <EyeOff size={15}/> : <Eye size={15}/>}</button><button onClick={() => remove(item)} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div></div></article>)}</div>}
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{editingId ? text.edit : text.add}</h2><button type="button" onClick={close}><X/></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-bold">{text.name}<input maxLength={80} className="mt-2 w-full rounded-xl border border-slate-200 p-3" value={form.title} onChange={(e) => setForm({...form,title:e.target.value})} required/><span className="mt-1 block text-end text-xs text-slate-400">{form.title.length}/80</span></label><label className="block text-sm font-bold">{text.link}<input dir="ltr" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-left" value={form.url} onChange={(e) => setForm({...form,url:e.target.value})} placeholder="https://..." required/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">{text.order}<input type="number" min="0" className="mt-2 w-full rounded-xl border border-slate-200 p-3" value={form.sortOrder} onChange={(e) => setForm({...form,sortOrder:e.target.value})}/></label><label className="mt-7 flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({...form,isPublished:e.target.checked})}/>{text.visible}</label></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={close} className="rounded-xl border px-5 py-2.5 text-sm font-bold">{text.cancel}</button><button disabled={saving} className="rounded-xl bg-[#0B4FD8] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "…" : editingId ? text.update : text.save}</button></div></form></div>}
    </div>
  </TeacherLayout>;
}
