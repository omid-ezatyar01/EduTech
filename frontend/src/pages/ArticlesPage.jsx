import { ArrowLeft, ArrowRight, BookOpen, Clock3, Eye, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchArticles, resolveArticleCoverUrl } from "../../services/articleService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const copy = {
  fa: {
    eyebrow: "مجله آموزشی ایجوتک", title: "مقاله‌هایی برای یادگیری بهتر", intro: "راهنماهای عملی، تجربه‌های آموزشی و نکته‌هایی که مسیر یادگیری شما را روشن‌تر می‌کنند.",
    search: "جستجوی مقاله…", submit: "جستجو", all: "همه", latest: "تازه‌ترین", popular: "پربازدیدترین", featured: "مقاله ویژه", read: "مطالعه مقاله", minutes: "دقیقه مطالعه", views: "بازدید", empty: "مقاله‌ای پیدا نشد.", retry: "تلاش دوباره", more: "مقاله‌های بیشتر", loading: "در حال بارگذاری مقاله‌ها…",
  },
  en: {
    eyebrow: "EduTech learning journal", title: "Articles for better learning", intro: "Practical guides, teaching insights, and useful ideas that make your learning path clearer.",
    search: "Search articles…", submit: "Search", all: "All", latest: "Newest", popular: "Most viewed", featured: "Featured article", read: "Read article", minutes: "min read", views: "views", empty: "No articles were found.", retry: "Try again", more: "More articles", loading: "Loading articles…",
  },
};

const categoryNames = {
  fa: { languages: "زبان‌ها", technology: "تکنالوژی", career: "کسب‌وکار", education: "آموزش", general: "عمومی" },
  en: { languages: "Languages", technology: "Technology", career: "Career", education: "Education", general: "General" },
};

const localized = (value, locale) => value?.[locale] || value?.[locale === "fa" ? "en" : "fa"] || "";
const formatDate = (value, locale) => value ? new Intl.DateTimeFormat(locale === "fa" ? "fa-AF" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "";

function ArticleCard({ article, locale, page, featured = false, rank = 0 }) {
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;
  const title = localized(article.title, locale);
  return <article className={`group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl ${featured ? "grid lg:grid-cols-[1.08fr_0.92fr]" : "flex h-full flex-col"}`}>
    <Link to={`/blog/${article.slug}`} className={`relative block overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 ${featured ? "aspect-video min-h-64 lg:aspect-auto lg:min-h-[430px]" : "aspect-video"}`}>
      <img src={resolveArticleCoverUrl(article.coverImage) || "/logo.png"} alt={title} loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "absolute inset-0 h-full w-full object-contain p-10"; }} className={`absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.03] ${article.coverImage ? "object-cover" : "object-contain p-10"}`}/>
      <div className="absolute start-4 top-4 flex flex-wrap gap-2">
        {rank > 0 && <span className={`rounded-full border px-3 py-1.5 text-xs font-black shadow-sm backdrop-blur ${rank === 1 ? "border-amber-200 bg-amber-50/95 text-amber-800" : rank <= 3 ? "border-blue-200 bg-blue-50/95 text-blue-700" : "border-white/70 bg-white/90 text-slate-700"}`}>{locale === "fa" ? "رتبه" : "Rank"} #{rank}</span>}
        {article.featured && <span className="rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-black text-white backdrop-blur"><Sparkles size={13} className="me-1 inline"/>{page.featured}</span>}
      </div>
    </Link>
    <div className="flex flex-1 flex-col p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{categoryNames[locale][article.category] || article.category}</span><span>{formatDate(article.publishedAt, locale)}</span></div>
      <h2 className={`${featured ? "mt-5 text-2xl sm:text-3xl" : "mt-4 text-xl"} font-black leading-tight text-slate-950`}><Link to={`/blog/${article.slug}`}>{title}</Link></h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-justify text-sm font-medium leading-7 text-slate-600">{localized(article.excerpt, locale)}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-5 text-xs font-bold text-slate-400">
        <span className="flex flex-wrap gap-3"><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{article.estimatedReadMinutes} {page.minutes}</span><span className="inline-flex items-center gap-1"><Eye size={14}/>{Number(article.viewCount || 0).toLocaleString(locale === "fa" ? "fa-AF" : "en-US")}</span></span>
        <Link to={`/blog/${article.slug}`} aria-label={`${page.read}: ${title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition group-hover:bg-teal-500"><Arrow size={17}/></Link>
      </div>
    </div>
  </article>;
}

export default function ArticlesPage({ language = "fa" }) {
  const locale = language === "fa" ? "fa" : "en";
  const page = copy[locale];
  const [articles, setArticles] = useState([]);
  const [meta, setMeta] = useState({ categories: [], page: 1, hasMore: false, total: 0 });
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = async ({ nextPage = 1, append = false } = {}) => {
    append ? setLoadingMore(true) : setLoading(true); setError("");
    try {
      const result = await fetchArticles({ page: nextPage, limit: 9, category, search, sort });
      setArticles((previous) => append ? [...previous, ...result.articles] : result.articles);
      setMeta(result.meta);
    } catch (err) { setError(err.message || page.empty); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { let active = true; fetchArticles({ page: 1, limit: 9, category, search, sort }).then((result) => { if (active) { setArticles(result.articles); setMeta(result.meta); setError(""); } }).catch((err) => { if (active) setError(err.message || page.empty); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [category, page.empty, search, sort]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const featured = articles[0] || null;
  const remaining = featured ? articles.slice(1) : [];
  const categories = ["all", ...(meta.categories || [])];

  return <div className="min-h-screen bg-slate-50 pb-16" dir={locale === "fa" ? "rtl" : "ltr"}>
    <section className="px-4 pt-8 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-[1536px] overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 shadow-sm sm:px-8 sm:py-14">
        <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl"/>
        <div className="absolute -bottom-28 end-0 h-80 w-80 rounded-full bg-teal-100/70 blur-3xl"/>
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><BookOpen size={17}/>{page.eyebrow}</p>
          <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-5xl">{page.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{page.intro}</p>
          <form onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); }} className="mx-auto mt-8 flex max-w-2xl gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] focus-within:border-teal-400">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 text-slate-400"><Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={page.search} className="min-w-0 flex-1 bg-transparent py-2 text-sm font-bold text-slate-900 outline-none"/></label>
            <button className="rounded-xl bg-teal-600 px-5 text-sm font-black text-white transition hover:bg-teal-700">{page.submit}</button>
          </form>
        </div>
      </div>
    </section>
    <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((key) => <button key={key} onClick={() => setCategory(key)} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-black ${category === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{key === "all" ? page.all : categoryNames[locale][key] || key}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"><option value="latest">{page.latest}</option><option value="popular">{page.popular}</option></select></div>
      {loading ? <FrontendPageLoader label={page.loading}/> : error ? <div className="mt-8 rounded-3xl border border-red-200 bg-white py-16 text-center"><p className="font-bold text-red-700">{error}</p><button onClick={() => load()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{page.retry}</button></div> : !featured ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><BookOpen className="mx-auto text-slate-300" size={45}/><p className="mt-3 font-bold text-slate-500">{page.empty}</p></div> : <><div className="mt-8"><ArticleCard article={featured} locale={locale} page={page} featured={Boolean(featured.featured)} rank={1}/></div>{remaining.length > 0 && <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{remaining.map((article, index) => <ArticleCard key={article._id} article={article} locale={locale} page={page} rank={index + 2}/>)}</div>}{meta.hasMore && <div className="mt-8 text-center"><button disabled={loadingMore} onClick={() => load({ nextPage: Number(meta.page || 1) + 1, append: true })} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-60">{loadingMore ? "…" : page.more}</button></div>}</>}
    </main>
  </div>;
}
