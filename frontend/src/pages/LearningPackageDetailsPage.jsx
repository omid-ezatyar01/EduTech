import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Layers3, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router";
import {
  fetchLearningPackage,
  resolveLearningPackageCoverImage,
  resolvePackageCourseImage,
} from "../../services/learningPackageService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import { buildCoursePath } from "../utils/routePaths.js";

const text = {
  fa: { back: "همه بسته‌ها", badge: "مسیر یادگیری", steps: "مرحله", courses: "کورس", step: "مرحله", view: "مشاهده کورس", empty: "در این مرحله کورس منتشرشده‌ای وجود ندارد.", error: "این بسته آموزشی پیدا نشد یا بارگذاری نشد.", retry: "تلاش دوباره", loading: "در حال آماده‌سازی مسیر یادگیری", teacher: "مدرس" },
  en: { back: "All packages", badge: "Learning path", steps: "steps", courses: "courses", step: "Step", view: "View course", empty: "This step has no published courses.", error: "This learning package could not be found or loaded.", retry: "Try again", loading: "Preparing learning path", teacher: "Teacher" },
};

const localized = (value, language) => typeof value === "string" ? value : value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";

export default function LearningPackageDetailsPage({ language = "fa" }) {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isRTL = language === "fa";
  const copy = text[language] || text.fa;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItem(await fetchLearningPackage(slug)); }
    catch (requestError) { setError(requestError?.message || copy.error); }
    finally { setLoading(false); }
  }, [copy.error, slug]);

  useEffect(() => {
    let active = true;
    fetchLearningPackage(slug)
      .then((value) => { if (active) setItem(value); })
      .catch((requestError) => { if (active) setError(requestError?.message || copy.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.error, slug]);
  if (loading) return <FrontendPageLoader label={copy.loading} minHeight="min-h-[60vh]" />;
  if (error || !item) return <main className="grid min-h-[60vh] place-items-center bg-slate-50 px-4" dir={isRTL ? "rtl" : "ltr"}><div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><p className="font-bold text-slate-800">{copy.error}</p><button type="button" onClick={load} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white"><RefreshCw size={16} />{copy.retry}</button></div></main>;

  const totalCourses = item.steps.reduce((total, step) => total + step.courses.length, 0);
  return <div className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-16" dir={isRTL ? "rtl" : "ltr"}>
    <section className="px-4 pt-8 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-[1536px] overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-12">
        <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="absolute -bottom-28 end-0 h-80 w-80 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <Link to="/packages" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700"><BackArrow size={16} />{copy.back}</Link>
          {item.coverImage ? <div className="mx-auto mt-6 aspect-video max-w-4xl overflow-hidden rounded-2xl bg-slate-100 shadow-sm sm:rounded-3xl"><img src={resolveLearningPackageCoverImage(item.coverImage)} alt={localized(item.title, language)} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-full w-full bg-white object-contain p-12"; }} /></div> : null}
          <div className="mt-7 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><Layers3 size={16} />{copy.badge}</span>
            <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl md:text-5xl">{localized(item.title, language)}</h1>
            {localized(item.description, language) ? <p className="mx-auto mt-5 max-w-3xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">{localized(item.description, language)}</p> : null}
            <div className="mt-6 flex justify-center gap-3 text-sm font-black text-slate-600"><span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">{item.steps.length} {copy.steps}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">{totalCourses} {copy.courses}</span></div>
          </div>
        </div>
      </div>
    </section>
    <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8"><div className="space-y-8">{item.steps.map((step, stepIndex) => <article key={step._id || stepIndex} className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-7"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-600 text-lg font-black text-white shadow-glow">{stepIndex + 1}</span><div><p className="text-xs font-black uppercase tracking-wider text-teal-600">{copy.step} {stepIndex + 1}</p><h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{localized(step.title, language)}</h2>{localized(step.description, language) ? <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{localized(step.description, language)}</p> : null}</div></div>
      {step.courses.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{step.courses.map((course) => <Link key={course._id} to={buildCoursePath(course)} className="group flex min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"><img src={resolvePackageCourseImage(course.thumbnail)} alt={localized(course.title, language)} className="h-24 w-28 shrink-0 rounded-xl bg-slate-50 object-cover sm:w-32" loading="lazy" onError={(event) => { event.currentTarget.src = "/logo.png"; event.currentTarget.className = "h-24 w-28 shrink-0 rounded-xl bg-slate-50 object-contain p-3 sm:w-32"; }} /><div className="flex min-w-0 flex-1 flex-col py-1"><h3 className="line-clamp-2 font-black leading-6 text-slate-950 group-hover:text-primary-700">{localized(course.title, language)}</h3>{course.teacher?.name ? <p className="mt-2 truncate text-xs font-bold text-slate-500">{copy.teacher}: {course.teacher.name}</p> : null}<span className="mt-auto inline-flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-black text-primary-700"><span className="inline-flex items-center gap-1"><BookOpen size={13} />{copy.view}</span><ForwardArrow size={14} /></span></div></Link>)}</div> : <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">{copy.empty}</p>}
      {stepIndex < item.steps.length - 1 ? <span className="absolute -bottom-8 start-10 grid h-8 w-8 place-items-center rounded-full bg-teal-500 text-white ring-4 ring-slate-50"><Check size={15} /></span> : null}</article>)}</div></main>
  </div>;
}
