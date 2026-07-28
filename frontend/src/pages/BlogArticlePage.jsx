import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, Clock3, Eye, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchArticleBySlug, fetchArticles, resolveArticleCoverUrl } from "../../services/articleService.js";
import { shareContent } from "../utils/share.js";
import { applySeo } from "../seo/useSeo.js";
import { buildLocalizedSiteUrl } from "../utils/localizedRoutes.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const copy = {
  fa: { blog: "وبلاگ", minutes: "دقیقه مطالعه", views: "بازدید", share: "اشتراک‌گذاری", copied: "لینک مقاله کاپی شد.", related: "مقاله‌های مرتبط", notFound: "این مقاله پیدا نشد یا دیگر منتشر نیست.", retry: "تلاش دوباره", section: "بخش", nextSection: "ادامه مطالعه", readingProgress: "پیشرفت مطالعه" },
  en: { blog: "Blog", minutes: "min read", views: "views", share: "Share article", copied: "Article link copied.", related: "Related articles", notFound: "This article was not found or is no longer published.", retry: "Try again", section: "Section", nextSection: "Continue reading", readingProgress: "Reading progress" },
};
const categoryNames = { fa: { languages: "زبان‌ها", technology: "تکنالوژی", career: "کسب‌وکار", education: "آموزش", general: "عمومی" }, en: { languages: "Languages", technology: "Technology", career: "Career", education: "Education", general: "General" } };
const localized = (value, locale) => value?.[locale] || value?.[locale === "fa" ? "en" : "fa"] || "";

const splitArticleContent = (value, targetLength = 1400) => {
  const content = String(value || "");
  if (!content) return [];
  const chunks = [];
  let offset = 0;

  while (content.length - offset > targetLength) {
    const windowText = content.slice(offset, offset + targetLength);
    const paragraphBreak = windowText.lastIndexOf("\n\n");
    const lineBreak = windowText.lastIndexOf("\n");
    const sentenceBreak = Math.max(
      windowText.lastIndexOf(". "),
      windowText.lastIndexOf("! "),
      windowText.lastIndexOf("? "),
      windowText.lastIndexOf("؟ "),
    );
    const wordBreak = windowText.lastIndexOf(" ");
    let cut = paragraphBreak >= targetLength * 0.55
      ? paragraphBreak + 2
      : lineBreak >= targetLength * 0.55
        ? lineBreak + 1
        : sentenceBreak >= targetLength * 0.55
          ? sentenceBreak + 2
          : wordBreak >= targetLength * 0.55
            ? wordBreak + 1
            : targetLength;
    if (cut <= 0) cut = targetLength;
    chunks.push(content.slice(offset, offset + cut));
    offset += cut;
  }

  if (offset < content.length) chunks.push(content.slice(offset));
  return chunks;
};

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
  const [chunkProgress, setChunkProgress] = useState({ slug: "", count: 1 });
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    applySeo({ pathname: `/blog/${article.slug}`, language: locale, overrides: { title: `${title} | EduTech Academy`, description, canonicalPath: `/blog/${article.slug}`, image: coverImage, type: "article" }, additionalStructuredData: [{ "@type": "Article", headline: title, description, image: coverImage, datePublished: article.publishedAt, dateModified: article.updatedAt, author: { "@type": "Person", name: article.author?.name || "EduTech Academy" }, publisher: { "@id": "https://edutech.study/#organization" }, mainEntityOfPage: buildLocalizedSiteUrl(`/blog/${article.slug}`, locale) }] });
  }, [article, locale]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 520);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const contentChunks = useMemo(
    () => splitArticleContent(article ? localized(article.content, locale) : ""),
    [article, locale],
  );
  const visibleChunkCount = chunkProgress.slug === slug ? chunkProgress.count : 1;
  const readingProgress = contentChunks.length
    ? Math.min(100, Math.round((visibleChunkCount / contentChunks.length) * 100))
    : 100;
  if (loading || loadedSlug !== slug) return <FrontendPageLoader label={locale === "fa" ? "در حال بارگذاری مقاله…" : "Loading article…"}/>;
  if (error || !article) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><BookOpen className="mx-auto text-slate-300" size={48}/><h1 className="mt-5 text-2xl font-black">{error || page.notFound}</h1><button onClick={load} className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white">{page.retry}</button></div>;

  const title = localized(article.title, locale);
  const share = async () => { const shared = await shareContent({ title, text: localized(article.excerpt, locale), path: `/blog/${article.slug}`, includeText: true }); if (shared && !navigator.share) { setNotice(page.copied); window.setTimeout(() => setNotice(""), 2400); } };

  return <article className="min-h-screen bg-slate-50 pb-16 sm:pb-20" dir={locale === "fa" ? "rtl" : "ltr"}>
    {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">{notice}</div>}
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400 sm:text-sm"><Link to="/blog" className="text-blue-700 transition hover:text-blue-800">{page.blog}</Link><Arrow size={15}/><span>{categoryNames[locale][article.category] || article.category}</span></div>
          <h1 className="mt-5 break-words text-3xl font-black leading-[1.35] text-slate-950 sm:mt-6 sm:text-5xl sm:leading-[1.25]">{title}</h1>
          <p className="mt-4 whitespace-pre-wrap break-words text-justify text-base font-medium leading-8 text-slate-600 sm:mt-5 sm:text-lg sm:leading-9">{localized(article.excerpt, locale)}</p>
          <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500 sm:text-sm"><span className="text-slate-800">{article.author?.name || "EduTech"}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={16}/>{article.estimatedReadMinutes} {page.minutes}</span><span className="inline-flex items-center gap-1.5"><Eye size={16}/>{Number(article.viewCount || 0).toLocaleString(locale === "fa" ? "fa-AF" : "en-US")}</span></div>
            <button onClick={share} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:w-auto"><Share2 size={17}/>{page.share}</button>
          </div>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8"><div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl"><img src={resolveArticleCoverUrl(article.coverImage) || "/logo.png"} alt={title} onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "absolute inset-0 h-full w-full object-contain p-8 sm:p-12"; }} className={`absolute inset-0 h-full w-full ${article.coverImage ? "object-cover" : "object-contain p-8 sm:p-12"}`}/></div></div>
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6">
        <div className="flex items-center justify-between gap-4 text-xs font-black text-slate-500">
          <span>{page.readingProgress}</span>
          <span>{readingProgress.toLocaleString(locale === "fa" ? "fa-AF" : "en-US")}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-[width] duration-500" style={{ width: `${readingProgress}%` }}/>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] sm:px-8 sm:py-9 lg:px-10">
        {contentChunks.slice(0, visibleChunkCount).map((chunk, index) => (
          <section key={`${index}-${chunk.slice(0, 20)}`} className={index > 0 ? "mt-7 border-t border-slate-100 pt-7 sm:mt-9 sm:pt-9" : ""}>
            <div className="whitespace-pre-wrap break-words text-justify text-[15px] font-medium leading-8 text-slate-700 sm:text-lg sm:leading-9">{chunk}</div>
          </section>
        ))}
        {visibleChunkCount < contentChunks.length ? (
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-100 pt-7">
            <p className="text-xs font-bold text-slate-400">{page.section} {Number(visibleChunkCount).toLocaleString(locale === "fa" ? "fa-AF" : "en-US")} / {Number(contentChunks.length).toLocaleString(locale === "fa" ? "fa-AF" : "en-US")}</p>
            <button type="button" onClick={() => setChunkProgress({ slug, count: Math.min(contentChunks.length, visibleChunkCount + 1) })} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:w-auto">{page.nextSection}</button>
          </div>
        ) : null}
      </div>
    </div>
    {related.length > 0 && <section className="mx-auto max-w-[1180px] border-t border-slate-200 px-4 pt-9 sm:px-6 sm:pt-10 lg:px-8"><h2 className="text-xl font-black text-slate-950 sm:text-2xl">{page.related}</h2><div className="mt-5 grid gap-5 md:grid-cols-3">{related.map((item) => <Link key={item._id} to={`/blog/${item.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"><div className="aspect-video overflow-hidden bg-blue-50"><img src={resolveArticleCoverUrl(item.coverImage) || "/logo.png"} alt="" className={`h-full w-full transition duration-500 group-hover:scale-105 ${item.coverImage ? "object-cover" : "object-contain p-6"}`}/></div><div className="p-4 sm:p-5"><p className="line-clamp-2 font-black leading-7 text-slate-900">{localized(item.title, locale)}</p></div></Link>)}</div></section>}
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" })}
      className={`fixed bottom-5 right-5 z-[90] grid h-12 w-12 place-items-center rounded-full border border-blue-500 bg-white text-blue-700 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
      aria-label={locale === "fa" ? "رفتن به بالای صفحه" : "Scroll to top"}
      title={locale === "fa" ? "رفتن به بالای صفحه" : "Scroll to top"}
    >
      <ArrowUp size={20} />
    </button>
  </article>;
}
