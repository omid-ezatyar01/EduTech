import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useParams } from "react-router";
import CourseCatalogCard from "../components/CourseCatalogCard.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import {
  fetchPublicCategories,
  fetchPublishedCourses,
  getCachedPublicCategories,
  fetchStudentEnrollments,
} from "../../services/courseService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";
import { buildEnrolledCourseIdSet } from "../utils/courseEnrollmentAccess.js";
import { buildCourseCategoryPath, buildCoursePath } from "../utils/routePaths.js";

const PAGE_SIZE = 20;
const INITIAL_PAGE_COUNT = 3;
const LOAD_MORE_PAGE_STEP = 2;

function extractRouteIdentifier(value = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "";
  const parts = normalizedValue.split("-");
  return parts[parts.length - 1] || normalizedValue;
}

export default function MobileCourseCategoryPage({ t }) {
  const { categoryId: rawCategoryId } = useParams();
  const dir = t.meta.dir;
  const language = t.meta.lang === "fa" ? "fa" : "en";
  const page = t.liveCoursesPage;
  const resolvedCategoryId = extractRouteIdentifier(rawCategoryId);
  const [categories, setCategories] = useState(() => getCachedPublicCategories() || []);
  const [courses, setCourses] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGE_COUNT);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const loadedFilterKeyRef = useRef("");

  const rootCategories = useMemo(
    () => categories.filter((item) => !item?.parent),
    [categories],
  );

  const currentCategory = useMemo(
    () => rootCategories.find((item) => String(item?._id || "") === resolvedCategoryId) || null,
    [resolvedCategoryId, rootCategories],
  );
  const categoriesByParent = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      const parentId = String(item?.parent?._id || item?.parent || "");
      const list = map.get(parentId) || [];
      list.push(item);
      map.set(parentId, list);
    });
    map.forEach((rows) => rows.sort((left, right) => String(left.name).localeCompare(String(right.name))));
    return map;
  }, [categories]);
  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [String(item?._id || ""), item])),
    [categories],
  );
  const selectedPathNodes = useMemo(
    () =>
      selectedCategoryPath
        .map((id) => categoriesById.get(String(id)))
        .filter(Boolean),
    [categoriesById, selectedCategoryPath],
  );
  const activeFilterParentId = selectedCategoryPath.at(-1) || String(resolvedCategoryId || "");
  const currentFilterOptions = useMemo(
    () => categoriesByParent.get(activeFilterParentId) || [],
    [activeFilterParentId, categoriesByParent],
  );
  const activeCategoryFilter = selectedCategoryPath.at(-1) || resolvedCategoryId;
  const applySearch = useCallback(() => {
    setCurrentPage(INITIAL_PAGE_COUNT);
    setSearchTerm(searchInput.trim());
  }, [searchInput]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [resolvedCategoryId]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 520);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      const cachedCategories = getCachedPublicCategories();
      if (cachedCategories?.length) {
        setCategories(cachedCategories);
      }

      try {
        const rows = await fetchPublicCategories({ forceRefresh: Boolean(cachedCategories) });
        setCategories(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cachedCategories?.length) setCategories([]);
      }
    };

    loadCategories();
  }, []);

  const loadEnrollments = useCallback(async () => {
    if (localStorage.getItem("edutech_auth") !== "true") {
      setEnrolledCourseIds(new Set());
      return;
    }

    try {
      const rows = await fetchStudentEnrollments();
      setEnrolledCourseIds(buildEnrolledCourseIdSet(rows));
    } catch {
      setEnrolledCourseIds(new Set());
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadEnrollments, 0);
    return () => window.clearTimeout(timer);
  }, [loadEnrollments]);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      try {
        if (!resolvedCategoryId) return;
        const filterKey = `${activeCategoryFilter}:${searchTerm}`;
        if (loadedFilterKeyRef.current !== filterKey) {
          loadedFilterKeyRef.current = filterKey;
          setCourses([]);
          setMeta({ totalPages: 1, total: 0 });
        }
        setLoading(true);
        setError("");

        const results = await Promise.all(
          Array.from({ length: currentPage }, (_, index) =>
            fetchPublishedCourses({
              page: index + 1,
              limit: PAGE_SIZE,
              category: activeCategoryFilter,
              search: searchTerm.trim() || undefined,
              sortBy: "popular",
              sortOrder: "desc",
            }),
          ),
        );

        if (cancelled) return;

        const mergedCourses = results.flatMap((result) =>
          Array.isArray(result?.courses) ? result.courses : [],
        );
        const byId = new Map(
          mergedCourses.map((course) => [
            String(course?._id || course?.id || ""),
            course,
          ]),
        );

        setCourses([...byId.values()]);
        setMeta(results.at(-1)?.meta || { totalPages: 1, total: 0 });
      } catch (err) {
        if (cancelled) return;
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            "بارگذاری کورس‌ها انجام نشد.",
            "Failed to load courses.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    };

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [activeCategoryFilter, currentPage, language, resolvedCategoryId, retrySeed, searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPage(INITIAL_PAGE_COUNT);
      setCourses([]);
      setSearchTerm("");
      setSearchInput("");
      setSelectedCategoryPath([]);
      setIsLoadingMore(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedCategoryId]);

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const totalPages = Number(meta?.totalPages || 1);
  const totalCourses = Number(meta?.total || 0);
  const categoryPath = currentCategory ? buildCourseCategoryPath(currentCategory) : "/live-courses";
  const categoryLabel = currentCategory?.name || (language === "fa" ? "کورس‌های آنلاین" : "Live Courses");
  const buildCourseDetailsPath = useCallback(
    (course) => {
      const searchParams = new URLSearchParams({
        from: categoryPath,
        fromLabel: categoryLabel,
      });
      return `${buildCoursePath(course)}?${searchParams.toString()}`;
    },
    [categoryLabel, categoryPath],
  );
  const scrollPageToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  return (
    <section className="min-w-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-20">
      <div className="mx-auto max-w-[1340px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link
            to="/live-courses"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
          >
            <BackIcon size={18} />
            {language === "fa" ? "برگشت به فهرست کورس‌ها" : "Back to course catalog"}
          </Link>

          <div className="relative mt-5 overflow-hidden rounded-3xl border border-primary-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_48%,#ECFEFF_100%)] p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-primary-200/35 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -start-20 h-52 w-52 rounded-full bg-teal-200/35 blur-3xl" />
            <div className="relative grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-primary-700 shadow-sm">
                  <BookOpen size={14} />
                  {language === "fa" ? "دسته‌بندی کورس‌ها" : "Course category"}
                </div>
                <h1 className="mt-4 break-words text-3xl font-black tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl">
                  {currentCategory?.name || (language === "fa" ? "کورس‌ها" : "Courses")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">
                  {language === "fa"
                    ? "کورس مناسب خود را در این دسته‌بندی پیدا کنید، فیلتر کنید و جزئیات آن را ببینید."
                    : "Find the right course in this category, refine the results, and explore its details."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-5 py-4 text-center shadow-[0_10px_28px_rgba(15,23,42,0.07)] backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {language === "fa" ? "کورس‌های موجود" : "Available courses"}
                </p>
                <p className="mt-1 text-3xl font-black text-primary-700">{totalCourses}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                  <SlidersHorizontal size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">
                    {language === "fa" ? "فیلترهای مرتبط" : "Related filters"}
                  </p>
                  <h2 className="mt-0.5 truncate text-lg font-black text-slate-950">
                    {currentCategory?.name || (language === "fa" ? "دسته‌بندی" : "Category")}
                  </h2>
                </div>
              </div>
              <Link
                to="/live-courses"
                className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-primary-50 hover:text-primary-700"
              >
                {language === "fa" ? "همه دسته‌بندی‌ها" : "All categories"}
              </Link>
            </div>

            <div className="mt-4 edutech-scrollbar flex gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(INITIAL_PAGE_COUNT);
                  setSelectedCategoryPath([]);
                }}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                  selectedCategoryPath.length === 0
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {language === "fa"
                  ? `همه ${currentCategory?.name || "کورس‌ها"}`
                  : `All ${currentCategory?.name || "courses"}`}
              </button>
            </div>

            {selectedPathNodes.length ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {language === "fa" ? "مسیر انتخابی" : "Selected path"}
                </p>
                <div className="mt-2 edutech-scrollbar flex gap-2 overflow-x-auto">
                  {selectedPathNodes.map((node, index) => (
                    <button
                      key={`${node._id}-${index}`}
                      type="button"
                      onClick={() => {
                        setCurrentPage(INITIAL_PAGE_COUNT);
                        setSelectedCategoryPath((previous) => previous.slice(0, index + 1));
                      }}
                      className="shrink-0 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-black text-primary-700 transition hover:border-primary-300 hover:bg-primary-50"
                    >
                      {node.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {currentFilterOptions.length ? (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {language === "fa" ? "زیر‌دسته‌های مرتبط" : "Related subcategories"}
                </p>
                <div className="edutech-scrollbar flex gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(INITIAL_PAGE_COUNT);
                      setSelectedCategoryPath((previous) => previous.slice(0, -1));
                    }}
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    {language === "fa" ? "همه" : "All"}
                  </button>
                  {currentFilterOptions.map((subcategory) => {
                    const isActive = String(subcategory?._id || "") === selectedCategoryPath.at(-1);
                    return (
                      <button
                        key={subcategory._id}
                        type="button"
                        onClick={() => {
                          setCurrentPage(INITIAL_PAGE_COUNT);
                          setSelectedCategoryPath((previous) => [
                            ...previous,
                            String(subcategory._id || ""),
                          ]);
                        }}
                        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                          isActive
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        }`}
                      >
                        {subcategory.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">
                  {language === "fa" ? "جستجو در همین دسته‌بندی" : "Search in this category"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {language === "fa"
                    ? "نام کامل لازم نیست؛ بخشی از نام یا کلیدواژهٔ فارسی و انگلیسی را بنویسید."
                    : "No full title needed—type part of a name or a Persian or English keyword."}
                </p>
              </div>
              <div className="flex gap-2 sm:w-[420px]">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-50">
                  <Search size={18} className="shrink-0 text-slate-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applySearch();
                      }
                    }}
                    placeholder={
                      language === "fa"
                        ? `جستجو در ${currentCategory?.name || "کورس‌ها"}`
                        : `Search in ${currentCategory?.name || "courses"}`
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        if (searchTerm) {
                          setSearchTerm("");
                          setCurrentPage(INITIAL_PAGE_COUNT);
                        }
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={language === "fa" ? "پاک‌کردن جستجو" : "Clear search"}
                    >
                      <X size={15} />
                    </button>
                  ) : null}
                </label>
                <button
                  type="button"
                  onClick={applySearch}
                  className="inline-flex h-auto shrink-0 items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-700"
                >
                  {language === "fa" ? "جستجو" : "Search"}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              <span>{error}</span>
              <button type="button" onClick={() => setRetrySeed((value) => value + 1)} className="rounded-xl bg-white px-4 py-2 text-xs font-black ring-1 ring-rose-200">
                {language === "fa" ? "تلاش دوباره" : "Try again"}
              </button>
            </div>
          ) : null}

          {!error && courses.length ? (
            <div className="mt-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-700">
                    {language === "fa" ? "نتایج کورس‌ها" : "Course results"}
                  </p>
                  <h2 className="mt-1 break-words text-xl font-black text-slate-950 [overflow-wrap:anywhere]">
                    {searchTerm
                      ? language === "fa"
                        ? `نتایج جستجو برای «${searchTerm}»`
                        : `Results for “${searchTerm}”`
                      : currentCategory?.name || (language === "fa" ? "همه کورس‌ها" : "All courses")}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                  {totalCourses} {language === "fa" ? "کورس" : totalCourses === 1 ? "course" : "courses"}
                </span>
              </div>
              <div className="grid min-w-0 items-stretch gap-4 px-3 sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
                {courses.map((course, index) => (
                  <div
                    key={course._id || course.id || `${course.title}-${index}`}
                    className="relative mx-auto h-full w-full max-w-[390px]"
                  >
                    <CourseCatalogCard
                      course={course}
                      dir={dir}
                      index={index}
                      labels={t.courseLabels}
                      language={language}
                      isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                      coursePathOverride={buildCourseDetailsPath(course)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {loading && courses.length === 0 ? (
            <FrontendPageLoader
              label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
              minHeight="min-h-[180px]"
              className="mt-5"
            />
          ) : null}

          {!loading && !error && courses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
              {language === "fa"
                ? "برای این بخش هنوز کورسی پیدا نشد."
                : "No courses were found for this category yet."}
            </div>
          ) : null}

          {currentPage < totalPages || isLoadingMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setIsLoadingMore(true);
                  setCurrentPage((previous) => previous + LOAD_MORE_PAGE_STEP);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary-500 bg-white px-7 py-3 text-sm font-black text-primary-700 transition hover:bg-primary-50 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore
                  ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{language === "fa" ? "در حال بارگذاری" : "Loading"}</span>
                    </>
                  )
                  : language === "fa"
                    ? `نمایش ${PAGE_SIZE * LOAD_MORE_PAGE_STEP} کورس دیگر`
                    : `Show ${PAGE_SIZE * LOAD_MORE_PAGE_STEP} more`}
              </button>
            </div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm leading-7 text-slate-700">
            {page.subtitle}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={scrollPageToTop}
        className={`fixed bottom-5 end-5 z-[90] grid h-12 w-12 place-items-center rounded-full border border-primary-400 bg-white text-primary-700 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:bg-primary-50 ${
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
        aria-label={language === "fa" ? "رفتن به بالای صفحه" : "Scroll to top"}
      >
        <ArrowUp size={20} />
      </button>
    </section>
  );
}
