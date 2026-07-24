import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ExternalLink, Eye, EyeOff, ImagePlus, Pencil, Plus, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import { createAdminArticle, deleteAdminArticle, fetchAdminArticles, resolveArticleCoverUrl, updateAdminArticle, uploadAdminArticleCover } from "../../services/articleService.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { compressImageFileToLimit } from "../utils/imageCompression.js";

const EMPTY_LOCALIZED = { fa: "", en: "" };
const EMPTY_FORM = { slug: "", title: { ...EMPTY_LOCALIZED }, excerpt: { ...EMPTY_LOCALIZED }, content: { ...EMPTY_LOCALIZED }, category: "education", tags: "", coverImage: "", status: "draft", featured: false, seoTitle: { ...EMPTY_LOCALIZED }, seoDescription: { ...EMPTY_LOCALIZED } };
const ARTICLE_COVER_MAX_BYTES = 300 * 1024;
const ARTICLE_COVER_RAW_MAX_BYTES = 10 * 1024 * 1024;
const ARTICLE_COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const formatCoverSize = (bytes, locale) => `${new Intl.NumberFormat(locale === "fa" ? "fa-AF" : "en-US", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
const copy = {
  fa: { title: "مقاله‌ها", subtitle: "مقاله‌های فارسی و انگلیسی وبلاگ را مدیریت کنید.", add: "مقاله جدید", refresh: "تازه‌سازی", total: "مجموع مقاله‌ها", published: "منتشرشده", drafts: "پیش‌نویس", featured: "ویژه", empty: "هنوز مقاله‌ای ساخته نشده است.", loading: "در حال بارگذاری مقاله‌ها", loadError: "بارگذاری مقاله‌ها ناموفق بود.", saveError: "ذخیره مقاله ناموفق بود.", deleteError: "حذف مقاله ناموفق بود.", deleteConfirm: "این مقاله برای همیشه حذف شود؟", edit: "ویرایش", remove: "حذف", publish: "انتشار", unpublish: "تبدیل به پیش‌نویس", formCreate: "ساخت مقاله", formEdit: "ویرایش مقاله", titleFa: "عنوان فارسی", titleEn: "عنوان انگلیسی", slug: "آدرس مقاله", slugHelp: "اگر خالی باشد از عنوان انگلیسی ساخته می‌شود.", excerptFa: "خلاصه فارسی", excerptEn: "خلاصه انگلیسی", contentFa: "متن فارسی", contentEn: "متن انگلیسی", category: "دسته‌بندی", tags: "برچسب‌ها", tagsHelp: "با کاما جدا کنید", cover: "تصویر کاور", status: "وضعیت", draft: "پیش‌نویس", makeFeatured: "مقاله ویژه", seoTitleFa: "عنوان سئوی فارسی", seoTitleEn: "عنوان سئوی انگلیسی", seoDescriptionFa: "توضیح سئوی فارسی", seoDescriptionEn: "توضیح سئوی انگلیسی", cancel: "انصراف", save: "ذخیره مقاله", required: "عنوان، خلاصه و متن را حداقل در یک زبان کامل کنید.", languageHelp: "فقط یکی از زبان‌های فارسی یا انگلیسی کافی است؛ زبان دوم اختیاری است.", search: "جستجوی مقاله…", all: "همه" },
  en: { title: "Articles", subtitle: "Manage Persian and English articles for the public blog.", add: "New article", refresh: "Refresh", total: "Total articles", published: "Published", drafts: "Drafts", featured: "Featured", empty: "No articles have been created yet.", loading: "Loading articles", loadError: "Could not load articles.", saveError: "Could not save the article.", deleteError: "Could not delete the article.", deleteConfirm: "Permanently delete this article?", edit: "Edit", remove: "Delete", publish: "Publish", unpublish: "Move to draft", formCreate: "Create article", formEdit: "Edit article", titleFa: "Persian title", titleEn: "English title", slug: "Article slug", slugHelp: "Leave empty to generate it from the English title.", excerptFa: "Persian excerpt", excerptEn: "English excerpt", contentFa: "Persian content", contentEn: "English content", category: "Category", tags: "Tags", tagsHelp: "Separate tags with commas", cover: "Cover image", status: "Status", draft: "Draft", makeFeatured: "Featured article", seoTitleFa: "Persian SEO title", seoTitleEn: "English SEO title", seoDescriptionFa: "Persian SEO description", seoDescriptionEn: "English SEO description", cancel: "Cancel", save: "Save article", required: "Complete the title, excerpt, and content in at least one language.", languageHelp: "Only Persian or English is required; the second language is optional.", search: "Search articles…", all: "All" },
};

const localizedField = (form, field, locale, value) => ({ ...form, [field]: { ...form[field], [locale]: value } });
const publicArticleUrl = (slug) => {
  const configured = String(import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (configured) return `${configured}/blog/${slug}`;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.protocol}//${window.location.hostname}:5173/blog/${slug}`;
  return `https://edutech.study/blog/${slug}`;
};

export default function AdminArticlesPage() {
  const { language, isRTL } = useAdminI18n();
  const text = {
    ...copy[language === "fa" ? "fa" : "en"],
    coverHelp: language === "fa" ? "اندازه پیشنهادی: ۱۶۰۰ × ۹۰۰ پیکسل (نسبت ۱۶:۹) · حداکثر حجم: ۳۰۰ کیلوبایت" : "Recommended size: 1600 × 900 px (16:9) · Maximum file size: 300 KB",
    coverTooLarge: language === "fa" ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد؛ خروجی خودکار به کمتر از ۳۰۰ کیلوبایت فشرده می‌شود." : "The source image must be under 10 MB; it will be compressed below 300 KB automatically.",
    coverTypeInvalid: language === "fa" ? "فقط تصویر PNG، JPG یا WEBP مجاز است." : "Only PNG, JPG, or WEBP images are allowed.",
    coverCompressError: language === "fa" ? "فشرده‌سازی تصویر انجام نشد. تصویر دیگری انتخاب کنید." : "The image could not be compressed. Choose another image.",
    selectedCover: language === "fa" ? "فایل انتخاب‌شده" : "Selected file",
  };
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editorLanguage, setEditorLanguage] = useState(language === "fa" ? "fa" : "en");
  const [form, setForm] = useState(EMPTY_FORM);
  const [coverSelection, setCoverSelection] = useState(null);

  const load = async () => { setLoading(true); setError(""); try { setArticles(await fetchAdminArticles({ status, search })); } catch (err) { setError(err.message || text.loadError); } finally { setLoading(false); } };
  useEffect(() => { let active = true; fetchAdminArticles({ status, search }).then((rows) => { if (active) { setArticles(rows); setError(""); } }).catch((err) => { if (active) setError(err.message || text.loadError); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [search, status, text.loadError]);

  const counts = useMemo(() => ({ published: articles.filter((item) => item.status === "published").length, drafts: articles.filter((item) => item.status === "draft").length, featured: articles.filter((item) => item.featured).length }), [articles]);
  const close = () => { setOpen(false); setEditingId(""); setForm(EMPTY_FORM); setCoverSelection(null); };
  const create = () => { setEditingId(""); setEditorLanguage(language === "fa" ? "fa" : "en"); setForm(EMPTY_FORM); setCoverSelection(null); setOpen(true); setError(""); };
  const edit = (item) => { const preferredLanguage = language === "fa" ? "fa" : "en"; setEditingId(item._id); setEditorLanguage(item.title?.[preferredLanguage] ? preferredLanguage : preferredLanguage === "fa" ? "en" : "fa"); setForm({ slug: item.slug || "", title: { fa: item.title?.fa || "", en: item.title?.en || "" }, excerpt: { fa: item.excerpt?.fa || "", en: item.excerpt?.en || "" }, content: { fa: item.content?.fa || "", en: item.content?.en || "" }, category: item.category || "education", tags: (item.tags || []).join(", "), coverImage: item.coverImage || "", status: item.status || "draft", featured: Boolean(item.featured), seoTitle: { fa: item.seoTitle?.fa || "", en: item.seoTitle?.en || "" }, seoDescription: { fa: item.seoDescription?.fa || "", en: item.seoDescription?.en || "" } }); setCoverSelection(null); setOpen(true); setError(""); };

  const submit = async (event) => {
    event.preventDefault();
    const languageState = ["fa", "en"].map((key) => {
      const fields = [form.title[key], form.excerpt[key], form.content[key]].map((value) => value.trim());
      return { started: fields.some(Boolean), complete: fields.every(Boolean) };
    });
    if (!languageState.some(({ complete }) => complete) || languageState.some(({ started, complete }) => started && !complete)) { setError(text.required); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, slug: form.slug.trim(), category: form.category.trim().toLowerCase(), tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), coverImage: form.coverImage.trim(), title: { fa: form.title.fa.trim(), en: form.title.en.trim() }, excerpt: { fa: form.excerpt.fa.trim(), en: form.excerpt.en.trim() }, content: { fa: form.content.fa.trim(), en: form.content.en.trim() } };
      if (editingId) await updateAdminArticle(editingId, payload); else await createAdminArticle(payload);
      close(); await load();
    } catch (err) { setError(err.message || text.saveError); }
    finally { setSaving(false); }
  };
  const toggle = async (item) => { try { await updateAdminArticle(item._id, { status: item.status === "published" ? "draft" : "published" }); await load(); } catch (err) { setError(err.message || text.saveError); } };
  const remove = async (item) => { if (!window.confirm(text.deleteConfirm)) return; try { await deleteAdminArticle(item._id); setArticles((rows) => rows.filter((row) => row._id !== item._id)); } catch (err) { setError(err.message || text.deleteError); } };
  const selectCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ARTICLE_COVER_TYPES.has(file.type)) {
      setCoverSelection({ name: file.name, size: file.size, invalid: true });
      setError(text.coverTypeInvalid);
      return;
    }
    if (file.size > ARTICLE_COVER_RAW_MAX_BYTES) {
      setCoverSelection({ name: file.name, size: file.size, invalid: true });
      setError(text.coverTooLarge);
      return;
    }
    setUploadingCover(true);
    setError("");
    try {
      const optimizedFile = await compressImageFileToLimit({
        file,
        maxBytes: ARTICLE_COVER_MAX_BYTES,
        maxWidth: 1600,
        maxHeight: 900,
        initialQuality: 0.82,
        baseName: "article-cover",
      });
      setCoverSelection({ name: optimizedFile.name, size: optimizedFile.size });
      const coverImage = await uploadAdminArticleCover(optimizedFile);
      setForm((current) => ({ ...current, coverImage }));
    } catch (err) {
      setError(err?.message || text.coverCompressError || text.saveError);
    } finally {
      setUploadingCover(false);
    }
  };

  return <div className="mx-auto max-w-7xl" dir={isRTL ? "rtl" : "ltr"}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{text.title}</h1><p className="mt-1 text-sm font-medium text-slate-500">{text.subtitle}</p></div><div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"><RefreshCw size={17}/>{text.refresh}</button><button onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={18}/>{text.add}</button></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-4">{[[text.total, articles.length, "text-blue-700"], [text.published, counts.published, "text-emerald-700"], [text.drafts, counts.drafts, "text-amber-700"], [text.featured, counts.featured, "text-violet-700"]].map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-bold text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p></div>)}</div>
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={17} className="text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} className="min-w-0 flex-1 py-2.5 text-sm font-bold outline-none"/></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"><option value="all">{text.all}</option><option value="published">{text.published}</option><option value="draft">{text.drafts}</option></select></div>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    {loading ? <AdminPageLoader label={text.loading}/> : articles.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><BookOpen className="mx-auto text-slate-300" size={46}/><p className="mt-3 font-bold text-slate-500">{text.empty}</p></div> : <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{articles.map((item) => <article key={item._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative aspect-video bg-blue-50"><img src={resolveArticleCoverUrl(item.coverImage) || "/logo.png"} alt="" className={`h-full w-full ${item.coverImage ? "object-cover" : "object-contain p-8"}`}/>{item.featured && <span className="absolute start-3 top-3 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-black text-white"><Star size={12} className="me-1 inline"/>{text.featured}</span>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-2 font-black text-slate-900">{(language === "fa" ? item.title?.fa : item.title?.en) || item.title?.fa || item.title?.en}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status === "published" ? text.published : text.draft}</span></div><p className="mt-2 text-xs font-bold text-slate-400">/{item.slug}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => edit(item)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14}/>{text.edit}</button><button onClick={() => toggle(item)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{item.status === "published" ? <EyeOff size={14}/> : <Eye size={14}/>} {item.status === "published" ? text.unpublish : text.publish}</button>{item.status === "published" && <a href={publicArticleUrl(item.slug)} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 p-2 text-slate-600"><ExternalLink size={15}/></a>}<button onClick={() => remove(item)} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div></div></article>)}</div>}
    {open && createPortal(<div className="fixed inset-0 z-[100] bg-slate-950/60 p-2 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} role="dialog" aria-modal="true"><form onSubmit={submit} className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"><div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4"><div><h2 className="text-lg font-black sm:text-xl">{editingId ? text.formEdit : text.formCreate}</h2><p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{text.languageHelp}</p></div><button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={text.cancel}><X size={20}/></button></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"><div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setEditorLanguage("fa")} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${editorLanguage === "fa" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>فارسی</button><button type="button" onClick={() => setEditorLanguage("en")} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${editorLanguage === "en" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>English</button></div>
      {editorLanguage === "fa" ? <section className="space-y-4 rounded-2xl border border-slate-200 p-4" dir="rtl"><label className="block text-sm font-bold">{text.titleFa}<input maxLength={160} value={form.title.fa} onChange={(e) => setForm(localizedField(form,"title","fa",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">{text.excerptFa}<textarea maxLength={400} rows="3" value={form.excerpt.fa} onChange={(e) => setForm(localizedField(form,"excerpt","fa",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">{text.contentFa}<textarea maxLength={50000} rows="10" value={form.content.fa} onChange={(e) => setForm(localizedField(form,"content","fa",e.target.value))} className="mt-2 w-full rounded-xl border p-3 leading-7"/></label></section> : <section className="space-y-4 rounded-2xl border border-slate-200 p-4" dir="ltr"><label className="block text-sm font-bold">{text.titleEn}<input maxLength={160} value={form.title.en} onChange={(e) => setForm(localizedField(form,"title","en",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">{text.excerptEn}<textarea maxLength={400} rows="3" value={form.excerpt.en} onChange={(e) => setForm(localizedField(form,"excerpt","en",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="block text-sm font-bold">{text.contentEn}<textarea maxLength={50000} rows="10" value={form.content.en} onChange={(e) => setForm(localizedField(form,"content","en",e.target.value))} className="mt-2 w-full rounded-xl border p-3 leading-7"/></label></section>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">{text.slug}<input dir="ltr" value={form.slug} onChange={(e) => setForm({...form,slug:e.target.value})} placeholder="how-to-learn-english" className="mt-2 w-full rounded-xl border p-3 text-left"/><span className="mt-1 block text-xs font-medium text-slate-400">{text.slugHelp}</span></label><label className="text-sm font-bold">{text.category}<input dir="ltr" list="article-categories" value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} className="mt-2 w-full rounded-xl border p-3 text-left"/><datalist id="article-categories"><option value="education"/><option value="languages"/><option value="technology"/><option value="career"/><option value="general"/></datalist></label><label className="text-sm font-bold">{text.tags}<input value={form.tags} onChange={(e) => setForm({...form,tags:e.target.value})} className="mt-2 w-full rounded-xl border p-3"/><span className="mt-1 block text-xs font-medium text-slate-400">{text.tagsHelp}</span></label><div className="text-sm font-bold"><span>{text.cover}</span><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-blue-700"><ImagePlus size={18}/>{uploadingCover ? "…" : language === "fa" ? "انتخاب تصویر از دستگاه" : "Choose image from device"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectCover} disabled={uploadingCover} className="hidden"/></label>{form.coverImage && <div className="relative mt-3 aspect-video overflow-hidden rounded-xl border bg-slate-50"><img src={resolveArticleCoverUrl(form.coverImage)} alt="" className="h-full w-full object-cover"/><button type="button" onClick={() => { setForm({...form,coverImage:""}); setCoverSelection(null); }} className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-600 shadow"><X size={16}/></button></div>}<span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{text.coverHelp}<br/>PNG, JPG, WEBP</span>{coverSelection && <span className={`mt-2 block rounded-lg px-3 py-2 text-xs font-bold ${coverSelection.invalid || coverSelection.size > ARTICLE_COVER_MAX_BYTES ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{text.selectedCover}: <span dir="ltr">{coverSelection.name} · {formatCoverSize(coverSelection.size, language)}</span></span>}</div><label className="text-sm font-bold">{text.status}<select value={form.status} onChange={(e) => setForm({...form,status:e.target.value})} className="mt-2 w-full rounded-xl border p-3"><option value="draft">{text.draft}</option><option value="published">{text.published}</option></select></label><label className="flex items-center gap-3 rounded-xl bg-violet-50 p-4 text-sm font-black text-violet-800"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})}/>{text.makeFeatured}</label></div>
    <details className="mt-5 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-black">SEO</summary><div className="mt-4 grid gap-4">{editorLanguage === "fa" ? <><label className="text-sm font-bold">{text.seoTitleFa}<input value={form.seoTitle.fa} onChange={(e) => setForm(localizedField(form,"seoTitle","fa",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="text-sm font-bold">{text.seoDescriptionFa}<textarea rows="3" value={form.seoDescription.fa} onChange={(e) => setForm(localizedField(form,"seoDescription","fa",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label></> : <><label className="text-sm font-bold">{text.seoTitleEn}<input dir="ltr" value={form.seoTitle.en} onChange={(e) => setForm(localizedField(form,"seoTitle","en",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label><label className="text-sm font-bold">{text.seoDescriptionEn}<textarea dir="ltr" rows="3" value={form.seoDescription.en} onChange={(e) => setForm(localizedField(form,"seoDescription","en",e.target.value))} className="mt-2 w-full rounded-xl border p-3"/></label></>}</div></details>
    </div><div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4"><button type="button" onClick={close} className="rounded-xl border px-5 py-2.5 text-sm font-bold">{text.cancel}</button><button disabled={saving} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-60">{saving ? "…" : text.save}</button></div></form></div>, document.body)}
  </div>;
}
