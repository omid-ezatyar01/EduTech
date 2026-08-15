import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Boxes, Layers3, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import {
  fetchLearningPackages,
  resolveLearningPackageCoverImage,
  resolvePackageCourseImage,
} from "../../services/learningPackageService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const text = {
  fa: { badge: "بسته‌های آموزشی", title: "یک مسیر کامل برای هدف خود انتخاب کنید", subtitle: "هر بسته، کورس‌های لازم را به ترتیب مرحله‌های یادگیری به شما نشان می‌دهد.", steps: "مرحله", courses: "کورس", open: "مشاهده مسیر", empty: "هنوز بسته آموزشی منتشر نشده است.", error: "بسته‌های آموزشی بارگذاری نشد.", retry: "تلاش دوباره", loading: "در حال بارگذاری بسته‌ها" },
  en: { badge: "Learning packages", title: "Choose a complete path for your goal", subtitle: "Each package organizes the courses you need into a clear learning sequence.", steps: "steps", courses: "courses", open: "View learning path", empty: "No learning packages have been published yet.", error: "Learning packages could not be loaded.", retry: "Try again", loading: "Loading packages" },
};

const localized = (value, language) => typeof value === "string" ? value : value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";
const courseCount = (item) => (item?.steps || []).reduce((total, step) => total + (step?.courses?.length || 0), 0);

export default function LearningPackagesPage({ language = "fa" }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isRTL = language === "fa";
  const copy = text[language] || text.fa;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setPackages(await fetchLearningPackages()); }
    catch (requestError) { setError(requestError?.message || copy.error); }
    finally { setLoading(false); }
  }, [copy.error]);

  useEffect(() => {
    let active = true;
    fetchLearningPackages()
      .then((rows) => { if (active) setPackages(rows); })
      .catch((requestError) => { if (active) setError(requestError?.message || copy.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.error]);
  const visiblePackages = useMemo(() => packages.filter((item) => courseCount(item) > 0), [packages]);

  if (loading) {
    return (
      <section className="min-h-[60vh] bg-slate-50 py-16">
        <FrontendPageLoader label={copy.loading} minHeight="min-h-[45vh]" />
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-16" dir={isRTL ? "rtl" : "ltr"}>
      <section className="px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[1536px] overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 shadow-sm sm:px-8 sm:py-14">
          <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute -bottom-28 end-0 h-80 w-80 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="relative mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><Boxes size={17} />{copy.badge}</span>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl md:text-5xl">{copy.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">{copy.subtitle}</p>
          </div>
        </div>
      </section>

        <main className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 lg:px-8">
          {error ? <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><p className="font-bold text-amber-900">{copy.error}</p><button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-amber-800 shadow-sm"><RefreshCw size={16} />{copy.retry}</button></div> : null}
          {!error && !visiblePackages.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Boxes className="mx-auto text-slate-300" size={44} /><p className="mt-4 font-bold text-slate-600">{copy.empty}</p></div> : null}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visiblePackages.map((item) => {
            const previewCourses = (item.steps || []).flatMap((step) => step.courses || []).slice(0, 3);
            return <Link key={item._id} to={`/packages/${encodeURIComponent(item.slug)}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl">
              {item.coverImage ? <div className="aspect-video overflow-hidden bg-slate-100"><img src={resolveLearningPackageCoverImage(item.coverImage)} alt={localized(item.title, language)} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full bg-white object-contain p-10"; }} /></div> : <div className="grid aspect-video grid-cols-3 gap-1 overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50">
                  {previewCourses.map((course) => <img key={course._id} src={resolvePackageCourseImage(course.thumbnail)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full bg-white object-contain p-4"; }} />)}
                  {Array.from({ length: Math.max(0, 3 - previewCourses.length) }).map((_, index) => <div key={`empty-${index}`} className="grid place-items-center bg-primary-50"><BookOpen className="text-primary-200" size={28} /></div>)}
                </div>}
              <div className="flex min-h-[230px] flex-col p-5 sm:p-6">
                <h2 className="text-xl font-black text-slate-950">{localized(item.title, language)}</h2>
                {localized(item.description, language) ? <p className="mt-3 line-clamp-2 text-sm font-medium leading-7 text-slate-600">{localized(item.description, language)}</p> : null}
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-black text-slate-600"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><Layers3 size={14} />{item.steps.length} {copy.steps}</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><BookOpen size={14} />{courseCount(item)} {copy.courses}</span></div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-5"><span className="text-sm font-black text-primary-700">{copy.open}</span><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white transition group-hover:bg-teal-500"><Arrow size={17} /></span></div>
              </div>
            </Link>;
          })}
          </div>
        </main>
    </div>
  );
}
