import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ExternalLink, Eye, EyeOff, FileText, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout.jsx";
import TeacherPageLoader from "../components/common/TeacherPageLoader.jsx";
import useTeacherLanguage from "../hooks/useTeacherLanguage.js";
import { getAuthUser } from "../../services/portal.js";
import { createTeacherArticle, deleteTeacherArticle, fetchTeacherArticles, resolveArticleCoverUrl, updateTeacherArticle, uploadTeacherArticleCover } from "../../services/articleService.js";

const EMPTY = {
  slug: "", titleFa: "", titleEn: "", excerptFa: "", excerptEn: "", contentFa: "", contentEn: "",
  category: "education", tags: "", coverImage: "", status: "draft", seoTitleFa: "", seoTitleEn: "",
  seoDescriptionFa: "", seoDescriptionEn: "",
};

const ARTICLE_COVER_MAX_BYTES = 300 * 1024;
const formatCoverSize = (bytes, locale) => `${new Intl.NumberFormat(locale === "fa" ? "fa-AF" : "en-US", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;

const copy = {
  fa: { title: "مقاله‌های من", subtitle: "مقاله‌های فارسی و انگلیسی خود را برای وبلاگ ایجوتک بنویسید و منتشر کنید.", add: "مقاله جدید", total: "مجموع مقاله‌ها", published: "منتشرشده", drafts: "پیش‌نویس", empty: "هنوز مقاله‌ای نساخته‌اید.", loading: "در حال بارگذاری مقاله‌ها", loadError: "بارگذاری مقاله‌ها ناموفق بود.", saveError: "ذخیره مقاله ناموفق بود.", deleteError: "حذف مقاله ناموفق بود.", confirm: "این مقاله برای همیشه حذف شود؟", edit: "ویرایش", remove: "حذف", publish: "انتشار", unpublish: "انتقال به پیش‌نویس", create: "ساخت مقاله", update: "ویرایش مقاله", titleFa: "عنوان فارسی", titleEn: "عنوان انگلیسی", slug: "نشانی مقاله", slugHelp: "برای ساخت خودکار از عنوان موجود، خالی بگذارید.", excerptFa: "خلاصه فارسی", excerptEn: "خلاصه انگلیسی", contentFa: "متن فارسی", contentEn: "متن انگلیسی", category: "دسته‌بندی", tags: "برچسب‌ها", tagsHelp: "برچسب‌ها را با ویرگول جدا کنید", cover: "نشانی تصویر روی جلد", status: "وضعیت", draft: "پیش‌نویس", seo: "تنظیمات اختیاری سئو", seoTitleFa: "عنوان سئوی فارسی", seoTitleEn: "عنوان سئوی انگلیسی", seoDescriptionFa: "توضیح سئوی فارسی", seoDescriptionEn: "توضیح سئوی انگلیسی", cancel: "انصراف", save: "ذخیره مقاله", required: "عنوان، خلاصه و متن را حداقل در یک زبان کامل کنید.", languageHelp: "فقط یکی از زبان‌های فارسی یا انگلیسی کافی است؛ زبان دوم اختیاری است.", search: "جستجوی مقاله‌ها…", all: "همه" },
  en: { title: "My Articles", subtitle: "Write and publish your Persian and English articles on the EduTech blog.", add: "New article", total: "Total articles", published: "Published", drafts: "Drafts", empty: "You have not created an article yet.", loading: "Loading articles", loadError: "Could not load articles.", saveError: "Could not save the article.", deleteError: "Could not delete the article.", confirm: "Permanently delete this article?", edit: "Edit", remove: "Delete", publish: "Publish", unpublish: "Move to draft", create: "Create article", update: "Edit article", titleFa: "Persian title", titleEn: "English title", slug: "Article slug", slugHelp: "Leave empty to generate it from the available title.", excerptFa: "Persian excerpt", excerptEn: "English excerpt", contentFa: "Persian content", contentEn: "English content", category: "Category", tags: "Tags", tagsHelp: "Separate tags with commas", cover: "Cover image URL", status: "Status", draft: "Draft", seo: "Optional SEO settings", seoTitleFa: "Persian SEO title", seoTitleEn: "English SEO title", seoDescriptionFa: "Persian SEO description", seoDescriptionEn: "English SEO description", cancel: "Cancel", save: "Save article", required: "Complete the title, excerpt, and content in at least one language.", languageHelp: "Only Persian or English is required; the second language is optional.", search: "Search articles…", all: "All" },
};

const publicArticleUrl = (slug) => {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (configured) return `${configured}/blog/${slug}`;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.protocol}//${window.location.hostname}:5173/blog/${slug}`;
  return `https://edutech.study/blog/${slug}`;
};

const toForm = (item) => ({
  slug: item.slug || "", titleFa: item.title?.fa || "", titleEn: item.title?.en || "",
  excerptFa: item.excerpt?.fa || "", excerptEn: item.excerpt?.en || "", contentFa: item.content?.fa || "",
  contentEn: item.content?.en || "", category: item.category || "education", tags: (item.tags || []).join(", "),
  coverImage: item.coverImage || "", status: item.status || "draft", seoTitleFa: item.seoTitle?.fa || "",
  seoTitleEn: item.seoTitle?.en || "", seoDescriptionFa: item.seoDescription?.fa || "",
  seoDescriptionEn: item.seoDescription?.en || "",
});

export default function TeacherArticles() {
  const { language, setLanguage } = useTeacherLanguage();
  const text = {
    ...copy[language === "fa" ? "fa" : "en"],
    cover: language === "fa" ? "تصویر کاور" : "Cover image",
    coverHelp: language === "fa" ? "اندازه پیشنهادی: ۱۶۰۰ × ۹۰۰ پیکسل (نسبت ۱۶:۹) · حداکثر حجم: ۳۰۰ کیلوبایت" : "Recommended size: 1600 × 900 px (16:9) · Maximum file size: 300 KB",
    coverTooLarge: language === "fa" ? "حجم تصویر کاور باید ۳۰۰ کیلوبایت یا کمتر باشد." : "The cover image must be 300 KB or less.",
    selectedCover: language === "fa" ? "فایل انتخاب‌شده" : "Selected file",
  };
  const teacher = getAuthUser() || {};
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editorLanguage, setEditorLanguage] = useState(language === "fa" ? "fa" : "en");
  const [form, setForm] = useState(EMPTY);
  const [coverSelection, setCoverSelection] = useState(null);
  const counts = useMemo(() => ({ published: articles.filter((item) => item.status === "published").length, drafts: articles.filter((item) => item.status === "draft").length }), [articles]);

  const load = async () => { setLoading(true); setError(""); try { setArticles(await fetchTeacherArticles({ status, search })); } catch (err) { setError(err.message || text.loadError); } finally { setLoading(false); } };
  useEffect(() => { let active = true; fetchTeacherArticles({ status, search }).then((rows) => { if (active) { setArticles(rows); setError(""); } }).catch((err) => { if (active) setError(err.message || text.loadError); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [search, status, text.loadError]);
  const close = () => { setOpen(false); setEditingId(""); setForm(EMPTY); setCoverSelection(null); };
  const edit = (item) => { const preferredLanguage = language === "fa" ? "fa" : "en"; setEditingId(item._id); setEditorLanguage(item.title?.[preferredLanguage] ? preferredLanguage : preferredLanguage === "fa" ? "en" : "fa"); setForm(toForm(item)); setCoverSelection(null); setOpen(true); };
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const languageState = [[form.titleFa, form.excerptFa, form.contentFa], [form.titleEn, form.excerptEn, form.contentEn]].map((values) => {
      const fields = values.map((value) => value.trim());
      return { started: fields.some(Boolean), complete: fields.every(Boolean) };
    });
    if (!languageState.some(({ complete }) => complete) || languageState.some(({ started, complete }) => started && !complete)) { setError(text.required); return; }
    const payload = {
      slug: form.slug.trim(), title: { fa: form.titleFa.trim(), en: form.titleEn.trim() },
      excerpt: { fa: form.excerptFa.trim(), en: form.excerptEn.trim() }, content: { fa: form.contentFa.trim(), en: form.contentEn.trim() },
      category: form.category.trim().toLowerCase(), tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      coverImage: form.coverImage.trim(), status: form.status,
      seoTitle: { fa: form.seoTitleFa.trim(), en: form.seoTitleEn.trim() },
      seoDescription: { fa: form.seoDescriptionFa.trim(), en: form.seoDescriptionEn.trim() },
    };
    setSaving(true); setError("");
    try { if (editingId) await updateTeacherArticle(editingId, payload); else await createTeacherArticle(payload); close(); await load(); }
    catch (err) { setError(err.message || text.saveError); } finally { setSaving(false); }
  };
  const toggle = async (item) => { try { await updateTeacherArticle(item._id, { status: item.status === "published" ? "draft" : "published" }); await load(); } catch (err) { setError(err.message || text.saveError); } };
  const remove = async (item) => { if (!window.confirm(text.confirm)) return; try { await deleteTeacherArticle(item._id); setArticles((rows) => rows.filter((row) => row._id !== item._id)); } catch (err) { setError(err.message || text.deleteError); } };
  const selectCover = async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setCoverSelection({ name: file.name, size: file.size }); if (file.size > ARTICLE_COVER_MAX_BYTES) { setError(text.coverTooLarge); return; } setUploadingCover(true); setError(""); try { updateField("coverImage", await uploadTeacherArticleCover(file)); } catch (err) { setError(err.message || text.saveError); } finally { setUploadingCover(false); } };

  return <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}><div className="mx-auto max-w-7xl">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-black text-slate-950">{text.title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">{text.subtitle}</p></div><button type="button" onClick={() => { setEditingId(""); setEditorLanguage(language === "fa" ? "fa" : "en"); setForm(EMPTY); setCoverSelection(null); setOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 py-3 text-sm font-black text-white"><Plus size={18}/>{text.add}</button></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">{[[text.total, articles.length, FileText, "bg-blue-50 text-blue-700"], [text.published, counts.published, Eye, "bg-emerald-50 text-emerald-700"], [text.drafts, counts.drafts, EyeOff, "bg-amber-50 text-amber-700"]].map(([label, value, Icon, tone]) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon size={22}/></span><span><span className="block text-sm font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-black">{loading ? "—" : value}</strong></span></div>)}</div>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><option value="all">{text.all}</option><option value="published">{text.published}</option><option value="draft">{text.drafts}</option></select></div>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    {loading ? <TeacherPageLoader label={text.loading}/> : articles.length === 0 ? <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><BookOpen className="mx-auto text-slate-300" size={48}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{articles.map((item) => <article key={item._id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="aspect-video bg-white"><img src={resolveArticleCoverUrl(item.coverImage) || "/logo.png"} alt="" className={`h-full w-full ${item.coverImage ? "object-cover" : "object-contain p-8"}`}/></div><div className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-2 font-black text-slate-950">{(language === "fa" ? item.title?.fa : item.title?.en) || item.title?.fa || item.title?.en}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status === "published" ? text.published : text.draft}</span></div><p className="mt-2 text-xs font-bold text-slate-400">/{item.slug}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14}/>{text.edit}</button><button type="button" onClick={() => toggle(item)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{item.status === "published" ? <EyeOff size={14}/> : <Eye size={14}/>} {item.status === "published" ? text.unpublish : text.publish}</button>{item.status === "published" && <a href={publicArticleUrl(item.slug)} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 p-2 text-slate-600"><ExternalLink size={15}/></a>}<button type="button" onClick={() => remove(item)} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div></div></article>)}</div>}
    {open && createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-950/55 p-2 sm:p-4" role="dialog" aria-modal="true">
        <form onSubmit={submit} className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
            <div><h2 className="text-lg font-black sm:text-xl">{editingId ? text.update : text.create}</h2><p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{text.languageHelp}</p></div>
            <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100" aria-label={text.cancel}><X size={20}/></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setEditorLanguage("fa")} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${editorLanguage === "fa" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>فارسی</button><button type="button" onClick={() => setEditorLanguage("en")} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${editorLanguage === "en" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>English</button></div>
            <div className="grid gap-4">{editorLanguage === "fa" ? <><Field label={text.titleFa} value={form.titleFa} onChange={(v) => updateField("titleFa", v)} dir="rtl" maxLength={160}/><Field label={text.excerptFa} value={form.excerptFa} onChange={(v) => updateField("excerptFa", v)} dir="rtl" textarea maxLength={400}/><Field label={text.contentFa} value={form.contentFa} onChange={(v) => updateField("contentFa", v)} dir="rtl" textarea rows={7}/></> : <><Field label={text.titleEn} value={form.titleEn} onChange={(v) => updateField("titleEn", v)} dir="ltr" maxLength={160}/><Field label={text.excerptEn} value={form.excerptEn} onChange={(v) => updateField("excerptEn", v)} dir="ltr" textarea maxLength={400}/><Field label={text.contentEn} value={form.contentEn} onChange={(v) => updateField("contentEn", v)} dir="ltr" textarea rows={7}/></>}</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={text.slug} help={text.slugHelp} value={form.slug} onChange={(v) => updateField("slug", v)} dir="ltr"/><Field label={text.category} value={form.category} onChange={(v) => updateField("category", v)} dir="ltr"/><Field label={text.tags} help={text.tagsHelp} value={form.tags} onChange={(v) => updateField("tags", v)}/><div className="text-sm font-bold"><span>{text.cover}</span><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-blue-700"><ImagePlus size={18}/>{uploadingCover ? "…" : language === "fa" ? "انتخاب تصویر از دستگاه" : "Choose image from device"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectCover} disabled={uploadingCover} className="hidden"/></label>{form.coverImage && <div className="relative mt-3 aspect-video overflow-hidden rounded-xl border bg-slate-50"><img src={resolveArticleCoverUrl(form.coverImage)} alt="" className="h-full w-full object-cover"/><button type="button" onClick={() => { updateField("coverImage", ""); setCoverSelection(null); }} className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-600 shadow"><X size={16}/></button></div>}<span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{text.coverHelp}<br/>PNG, JPG, WEBP</span>{coverSelection && <span className={`mt-2 block rounded-lg px-3 py-2 text-xs font-bold ${coverSelection.size > ARTICLE_COVER_MAX_BYTES ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{text.selectedCover}: <span dir="ltr">{coverSelection.name} · {formatCoverSize(coverSelection.size, language)}</span></span>}</div><label className="block text-sm font-bold">{text.status}<select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"><option value="draft">{text.draft}</option><option value="published">{text.published}</option></select></label></div>
            <details className="mt-5 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-black">{text.seo}</summary><div className="mt-4 grid gap-4">{editorLanguage === "fa" ? <><Field label={text.seoTitleFa} value={form.seoTitleFa} onChange={(v) => updateField("seoTitleFa", v)} dir="rtl" maxLength={180}/><Field label={text.seoDescriptionFa} value={form.seoDescriptionFa} onChange={(v) => updateField("seoDescriptionFa", v)} dir="rtl" textarea maxLength={320}/></> : <><Field label={text.seoTitleEn} value={form.seoTitleEn} onChange={(v) => updateField("seoTitleEn", v)} dir="ltr" maxLength={180}/><Field label={text.seoDescriptionEn} value={form.seoDescriptionEn} onChange={(v) => updateField("seoDescriptionEn", v)} dir="ltr" textarea maxLength={320}/></>}</div></details>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4"><button type="button" onClick={close} className="rounded-xl border px-5 py-2.5 text-sm font-bold">{text.cancel}</button><button disabled={saving} className="rounded-xl bg-[#0B4FD8] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "…" : text.save}</button></div>
        </form>
      </div>,
      document.body,
    )}
  </div></TeacherLayout>;
}

function Field({ label, help = "", value, onChange, textarea = false, rows = 3, ...props }) {
  const Component = textarea ? "textarea" : "input";
  return <label className="block text-sm font-bold">{label}<Component {...props} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal"/>{help && <span className="mt-1 block text-xs font-semibold text-slate-400">{help}</span>}</label>;
}
