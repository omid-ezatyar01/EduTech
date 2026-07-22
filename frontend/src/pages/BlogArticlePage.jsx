import { ArrowLeft, ArrowRight, BookOpen, Clock3, Eye, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchArticleBySlug, fetchArticles, resolveArticleCoverUrl } from "../../services/articleService.js";
import { shareContent } from "../utils/share.js";
import { applySeo } from "../seo/useSeo.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const copy = {
  fa: { blog: "وبلاگ", minutes: "دقیقه مطالعه", views: "بازدید", share: "اشتراک‌گذاری", copied: "لینک مقاله کاپی شد.", related: "مقاله‌های مرتبط", notFound: "این مقاله پیدا نشد یا دیگر منتشر نیست.", retry: "تلاش دوباره" },
  en: { blog: "Blog", minutes: "min read", views: "views", share: "Share article", copied: "Article link copied.", related: "Related articles", notFound: "This article was not found or is no longer published.", retry: "Try again" },
};
const categoryNames = { fa: { languages: "زبان‌ها", technology: "تکنالوژی", career: "کسب‌وکار", education: "آموزش", general: "عمومی" }, en: { languages: "Languages", technology: "Technology", career: "Career", education: "Education", general: "General" } };
const localized = (value, locale) => value?.[locale] || value?.[locale === "fa" ? "en" : "fa"] || "";

export default function BlogArticlePage({ language = "fa" }) {
  const { slug } = useParams();
  const locale = language === "fa" ? "fa" : "en";
  const page = copy[locale];
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const row = await fetchArticleBySlug(slug);
      setArticle(row);
      const result = await fetchArticles({ category: row.category, limit: 4, sort: "latest" });
      setRelated(result.articles.filter((item) => item.slug !== row.slug).slice(0, 3));
    } catch (err) { setError(err.status === 404 ? page.notFound : err.message || page.notFound); }
    finally { setLoading(false); }
  };

  useEffect(() => { let active = true; fetchArticleBySlug(slug).then(async (row) => { if (!active) return; setArticle(row); setError(""); setLoadedSlug(slug); const result = await fetchArticles({ category: row.category, limit: 4, sort: "latest" }); if (active) setRelated(result.articles.filter((item) => item.slug !== row.slug).slice(0, 3)); }).catch((err) => { if (active) { setLoadedSlug(slug); setError(err.status === 404 ? page.notFound : err.message || page.notFound); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page.notFound, slug]);

  useEffect(() => {
    if (!article) return;
    const title = localized(article.seoTitle, locale) || localized(article.title, locale);
    const description = localized(article.seoDescription, locale) || localized(article.excerpt, locale);
    const coverImage = resolveArticleCoverUrl(article.coverImage) || "/logo.png";
    applySeo({ pathname: `/blog/${article.slug}`, language: locale, overrides: { title: `${title} | EduTech`, description, canonicalPath: `/blog/${article.slug}`, image: coverImage, type: "article" }, additionalStructuredData: [{ "@type": "Article", headline: title, description, image: coverImage, datePublished: article.publishedAt, dateModified: article.updatedAt, author: { "@type": "Person", name: article.author?.name || "EduTech" }, publisher: { "@id": "https://edutech.study/#organization" }, mainEntityOfPage: `https://edutech.study/blog/${article.slug}` }] });
  }, [article, locale]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  if (loading || loadedSlug !== slug) return <FrontendPageLoader label={locale === "fa" ? "در حال بارگذاری مقاله…" : "Loading article…"}/>;
  if (error || !article) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><BookOpen className="mx-auto text-slate-300" size={48}/><h1 className="mt-5 text-2xl font-black">{error || page.notFound}</h1><button onClick={load} className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white">{page.retry}</button></div>;

  const title = localized(article.title, locale);
  const paragraphs = localized(article.content, locale).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const share = async () => { const shared = await shareContent({ title, text: localized(article.excerpt, locale), path: `/blog/${article.slug}`, includeText: true }); if (shared && !navigator.share) { setNotice(page.copied); window.setTimeout(() => setNotice(""), 2400); } };

  return <article className="min-h-screen bg-slate-50 pb-16" dir={locale === "fa" ? "rtl" : "ltr"}>
    {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">{notice}</div>}
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-400"><Link to="/blog" className="text-blue-700">{page.blog}</Link><Arrow size={15}/><span>{categoryNames[locale][article.category] || article.category}</span></div><h1 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">{title}</h1><p className="mt-5 text-base font-medium leading-8 text-slate-600 sm:text-lg">{localized(article.excerpt, locale)}</p><div className="mt-7 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4 text-sm font-bold text-slate-500"><span>{article.author?.name || "EduTech"}</span><span className="inline-flex items-center gap-1"><Clock3 size={16}/>{article.estimatedReadMinutes} {page.minutes}</span><span className="inline-flex items-center gap-1"><Eye size={16}/>{Number(article.viewCount || 0).toLocaleString(locale === "fa" ? "fa-AF" : "en-US")}</span></div><button onClick={share} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"><Share2 size={17}/>{page.share}</button></div></div></header>
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6"><div className="aspect-[16/8] overflow-hidden rounded-3xl bg-white shadow-sm"><img src={resolveArticleCoverUrl(article.coverImage) || "/logo.png"} alt={title} onError={(event) => { event.currentTarget.src = "/logo.png"; }} className={`h-full w-full ${article.coverImage ? "object-cover" : "object-contain p-12"}`}/></div></div>
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`} className="mb-6 whitespace-pre-line text-base font-medium leading-9 text-slate-700 sm:text-lg">{paragraph}</p>)}</div>
    {related.length > 0 && <section className="mx-auto max-w-5xl border-t border-slate-200 px-4 pt-10 sm:px-6"><h2 className="text-2xl font-black">{page.related}</h2><div className="mt-6 grid gap-5 md:grid-cols-3">{related.map((item) => <Link key={item._id} to={`/blog/${item.slug}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="aspect-video bg-blue-50"><img src={resolveArticleCoverUrl(item.coverImage) || "/logo.png"} alt="" className={`h-full w-full ${item.coverImage ? "object-cover" : "object-contain p-6"}`}/></div><div className="p-4"><p className="line-clamp-2 font-black leading-6 text-slate-900">{localized(item.title, locale)}</p></div></Link>)}</div></section>}
  </article>;
}
