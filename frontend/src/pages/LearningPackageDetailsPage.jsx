import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { Link, useParams } from "react-router";
import {
  fetchLearningPackage,
  resolveLearningPackageCoverImage,
  resolvePackageCourseImage,
} from "../../services/learningPackageService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import { buildCoursePath } from "../utils/routePaths.js";

const text = {
  fa: {
    home: "خانه",
    packages: "بسته‌های آموزشی",
    badge: "مسیر یادگیری",
    overview: "معرفی بسته آموزشی",
    pathTitle: "مراحل این مسیر یادگیری",
    pathSubtitle: "مراحل را به ترتیب دنبال کنید و کورس‌های هر بخش را مشاهده نمایید.",
    steps: "مرحله",
    courses: "کورس",
    step: "مرحله",
    view: "مشاهده کورس",
    empty: "در این مرحله کورس منتشرشده‌ای وجود ندارد.",
    error: "این بسته آموزشی پیدا نشد یا بارگذاری نشد.",
    retry: "تلاش دوباره",
    loading: "در حال آماده‌سازی مسیر یادگیری",
    teacher: "مدرس",
    imageFallback: "تصویر بسته آموزشی",
  },
  en: {
    home: "Home",
    packages: "Learning packages",
    badge: "Learning path",
    overview: "Package overview",
    pathTitle: "Steps in this learning path",
    pathSubtitle: "Follow the steps in order and explore the courses included in each stage.",
    steps: "steps",
    courses: "courses",
    step: "Step",
    view: "View course",
    empty: "This step has no published courses.",
    error: "This learning package could not be found or loaded.",
    retry: "Try again",
    loading: "Preparing learning path",
    teacher: "Teacher",
    imageFallback: "Learning package image",
  },
};

const localized = (value, language) =>
  typeof value === "string"
    ? value
    : value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";

export default function LearningPackageDetailsPage({ language = "fa" }) {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isRTL = language === "fa";
  const copy = text[language] || text.fa;
  const ForwardArrow = isRTL ? ArrowLeft : ArrowRight;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItem(await fetchLearningPackage(slug));
    } catch (requestError) {
      setError(requestError?.message || copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, slug]);

  useEffect(() => {
    let active = true;
    window.scrollTo({ top: 0, behavior: "instant" });

    fetchLearningPackage(slug)
      .then((value) => {
        if (active) setItem(value);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || copy.error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [copy.error, slug]);

  if (loading) {
    return (
      <section className="min-h-[60vh] bg-slate-50 py-16">
        <FrontendPageLoader label={copy.loading} minHeight="min-h-[45vh]" />
      </section>
    );
  }

  if (error || !item) {
    return (
      <main
        className="grid min-h-[60vh] place-items-center bg-slate-50 px-4 py-16"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <p className="font-bold text-slate-800">{copy.error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white transition hover:bg-primary-700"
          >
            <RefreshCw size={16} />
            {copy.retry}
          </button>
        </div>
      </main>
    );
  }

  const title = localized(item.title, language);
  const description = localized(item.description, language);
  const totalCourses = item.steps.reduce(
    (total, step) => total + step.courses.length,
    0,
  );

  return (
    <section
      className="min-h-screen overflow-x-hidden bg-slate-50 pb-16 pt-6 sm:pt-8"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8">
        <nav className="mb-5 flex min-w-0 items-center gap-2 overflow-hidden text-sm font-bold text-slate-500">
          <Link to="/" className="shrink-0 transition hover:text-primary-700">
            {copy.home}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            to="/packages"
            className="shrink-0 transition hover:text-primary-700"
          >
            {copy.packages}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-slate-700">{title}</span>
        </nav>

        <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="pointer-events-none absolute -start-20 -top-24 h-64 w-64 rounded-full bg-primary-100/65 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 end-4 h-56 w-56 rounded-full bg-teal-100/65 blur-3xl" />

          <div className="relative grid items-center gap-8 p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10 xl:p-12">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700">
                <Layers3 size={16} />
                {copy.badge}
              </span>

              <p className="mt-6 text-sm font-black text-primary-700">
                {copy.overview}
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl xl:text-5xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">
                  {description}
                </p>
              ) : null}

            </div>

            <div className="order-first overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:order-none">
              <div className="aspect-video w-full">
                {item.coverImage ? (
                  <img
                    src={resolveLearningPackageCoverImage(item.coverImage)}
                    alt={title}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = "/logo.png";
                      event.currentTarget.className =
                        "h-full w-full bg-white object-contain p-10";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-50 via-white to-teal-50 p-8 text-center">
                    <div>
                      <Layers3
                        size={48}
                        className="mx-auto text-primary-500"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-sm font-black text-slate-500">
                        {copy.imageFallback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>

        <div className="mb-6 mt-10 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">
              {copy.pathTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">
              {copy.pathSubtitle}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
            <BookOpen size={17} className="text-primary-600" />
            {totalCourses} {copy.courses}
          </span>
        </div>

        <main className="space-y-6">
          {item.steps.map((step, stepIndex) => (
            <article
              key={step._id || stepIndex}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            >
              <header className="border-b border-slate-100 bg-gradient-to-l from-primary-50/80 via-white to-teal-50/60 p-5 sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-600 text-lg font-black text-white shadow-glow">
                    {stepIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-teal-600">
                      {copy.step} {stepIndex + 1}
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      {localized(step.title, language)}
                    </h3>
                    {localized(step.description, language) ? (
                      <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                        {localized(step.description, language)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="p-5 sm:p-7">
                {step.courses.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {step.courses.map((course) => (
                      <Link
                        key={course._id}
                        to={buildCoursePath(course)}
                        className="group flex min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
                      >
                        <img
                          src={resolvePackageCourseImage(course.thumbnail)}
                          alt={localized(course.title, language)}
                          className="h-24 w-28 shrink-0 rounded-xl bg-slate-50 object-cover sm:w-32"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.src = "/logo.png";
                            event.currentTarget.className =
                              "h-24 w-28 shrink-0 rounded-xl bg-slate-50 object-contain p-3 sm:w-32";
                          }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col py-1">
                          <h4 className="line-clamp-2 font-black leading-6 text-slate-950 transition group-hover:text-primary-700">
                            {localized(course.title, language)}
                          </h4>
                          {course.teacher?.name ? (
                            <p className="mt-2 truncate text-xs font-bold text-slate-500">
                              {copy.teacher}: {course.teacher.name}
                            </p>
                          ) : null}
                          <span className="mt-auto inline-flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-black text-primary-700">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen size={13} />
                              {copy.view}
                            </span>
                            <ForwardArrow size={14} />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                    {copy.empty}
                  </p>
                )}

              </div>
            </article>
          ))}
        </main>
      </div>
    </section>
  );
}
