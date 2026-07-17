import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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

const ROW_SIZE = 20;
const INITIAL_PAGE_COUNT = 3;
const LOAD_MORE_PAGE_STEP = 2;

function chunkRows(items = [], size = ROW_SIZE) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

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
  const [rowNav, setRowNav] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rowRefs = useRef([]);

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
        return;
      }

      try {
        const rows = await fetchPublicCategories();
        setCategories(Array.isArray(rows) ? rows : []);
      } catch {
        setCategories([]);
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
    loadEnrollments();
  }, [loadEnrollments]);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      try {
        if (!resolvedCategoryId) return;
        setLoading(true);
        setError("");

        const results = await Promise.all(
          Array.from({ length: currentPage }, (_, index) =>
            fetchPublishedCourses({
              page: index + 1,
              limit: ROW_SIZE,
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
  }, [activeCategoryFilter, currentPage, language, resolvedCategoryId, searchTerm]);

  useEffect(() => {
    setCurrentPage(INITIAL_PAGE_COUNT);
    setCourses([]);
    setSearchTerm("");
    setSearchInput("");
    setSelectedCategoryPath([]);
    setIsLoadingMore(false);
  }, [resolvedCategoryId]);

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const totalPages = Number(meta?.totalPages || 1);
  const totalCourses = Number(meta?.total || 0);
  const courseRows = useMemo(
    () => chunkRows(courses, ROW_SIZE),
    [courses],
  );
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
  const getRowNavState = useCallback((rowElement) => {
    if (!rowElement) return { canPrev: false, canNext: false };
    const maxScroll = Math.max(0, rowElement.scrollWidth - rowElement.clientWidth);
    if (dir === "rtl") {
      const progress = Math.min(maxScroll, Math.abs(rowElement.scrollLeft || 0));
      return {
        canPrev: progress > 8,
        canNext: progress < maxScroll - 8,
      };
    }

    const progress = rowElement.scrollLeft || 0;
    return {
      canPrev: progress > 8,
      canNext: progress < maxScroll - 8,
    };
  }, [dir]);
  const scrollRowForward = useCallback((rowElement) => {
    if (!rowElement) return;
    const scrollAmount = Math.max(280, Math.round(rowElement.clientWidth * 0.82));
    rowElement.scrollBy({
      left: dir === "rtl" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, [dir]);
  const scrollRowBackward = useCallback((rowElement) => {
    if (!rowElement) return;
    const scrollAmount = Math.max(280, Math.round(rowElement.clientWidth * 0.82));
    rowElement.scrollBy({
      left: dir === "rtl" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  }, [dir]);
  const updateRowNav = useCallback((key, rowElement) => {
    const nextState = getRowNavState(rowElement);
    setRowNav((previous) => {
      const current = previous[key];
      if (current?.canPrev === nextState.canPrev && current?.canNext === nextState.canNext) {
        return previous;
      }
      return { ...previous, [key]: nextState };
    });
  }, [getRowNavState]);
  const scrollPageToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    courseRows.forEach((_, rowIndex) => {
      const element = rowRefs.current[rowIndex];
      if (element) {
        updateRowNav(rowIndex, element);
      }
    });
  }, [courseRows, updateRowNav]);

  return (
    <section className="bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-20">
      <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-7">
          <Link
            to="/live-courses"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            <BackIcon size={18} />
            {language === "fa" ? "برگشت به فهرست کورس‌ها" : "Back to course catalog"}
          </Link>

          <div className="mt-5 rounded-3xl bg-[linear-gradient(135deg,#F8FAFC_0%,#EEF2FF_52%,#ECFEFF_100%)] p-5 sm:p-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-teal-700 sm:text-xs">
                {language === "fa" ? "دسته‌بندی کورس‌ها" : "Course category"}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {currentCategory?.name || (language === "fa" ? "کورس‌ها" : "Courses")}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">
                {language === "fa"
                  ? "در این بخش می‌توانید تمام کورس‌های مربوط به همین دسته‌بندی را جستجو و بررسی کنید."
                  : "Explore and search all courses related to this category in one place."}
              </p>
            </div>
            <div className="mt-4 w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-center shadow-[0_8px_20px_rgba(15,23,42,0.05)] backdrop-blur sm:px-5 sm:py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                {language === "fa" ? "کورس‌های موجود" : "Available courses"}
              </p>
              <p className="mt-1.5 text-2xl font-black text-slate-950 sm:text-3xl">{totalCourses}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                  {language === "fa" ? "فیلترهای مرتبط" : "Related filters"}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {currentCategory?.name || (language === "fa" ? "دسته‌بندی" : "Category")}
                </h2>
              </div>
              <Link
                to="/live-courses"
                className="text-xs font-black text-slate-500 transition hover:text-violet-700"
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
                    ? "border-violet-500 bg-violet-50 text-violet-700"
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
                        setSelectedCategoryPath((previous) => previous.slice(0, index));
                      }}
                      className="shrink-0 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
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
                            ? "border-violet-500 bg-violet-50 text-violet-700"
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
                    ? "نتایج فقط از همین دسته‌بندی و فیلترهای انتخابی نمایش داده می‌شود."
                    : "Results are limited to this category and the selected suggestions."}
                </p>
              </div>
              <div className="flex gap-2 sm:w-[420px]">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
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
                </label>
                <button
                  type="button"
                  onClick={applySearch}
                  className="inline-flex h-auto shrink-0 items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700"
                >
                  {language === "fa" ? "جستجو" : "Search"}
                </button>
              </div>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm font-bold text-rose-600">{error}</p> : null}

          <div className="mt-6 space-y-4">
            {courseRows.map((row, rowIndex) => (
              <div key={`category-course-row-${rowIndex + 1}`} className="relative">
                <div
                  ref={(element) => {
                    rowRefs.current[rowIndex] = element;
                  }}
                  onScroll={(event) => updateRowNav(rowIndex, event.currentTarget)}
                  className="edutech-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
                  dir={language === "fa" ? "rtl" : "ltr"}
                >
                  {row.map((course, itemIndex) => (
                    <div
                      key={course._id || course.id || `${course.title}-${rowIndex}-${itemIndex}`}
                      className="w-[min(82vw,280px)] min-w-[min(82vw,280px)] shrink-0 snap-start"
                    >
                      <CourseCatalogCard
                        course={course}
                        dir={dir}
                        index={(rowIndex * ROW_SIZE) + itemIndex}
                        labels={t.courseLabels}
                        language={language}
                        isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                        coursePathOverride={buildCourseDetailsPath(course)}
                      />
                    </div>
                  ))}
                </div>
                {rowNav[rowIndex]?.canPrev ? (
                  <button
                    type="button"
                    onClick={() => scrollRowBackward(rowRefs.current[rowIndex])}
                    className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                    aria-label={language === "fa" ? "نمایش موارد قبلی" : "Show previous items"}
                  >
                    <ChevronLeft size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                  </button>
                ) : null}
                {rowNav[rowIndex]?.canNext ? (
                  <button
                    type="button"
                    onClick={() => scrollRowForward(rowRefs.current[rowIndex])}
                    className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                    aria-label={language === "fa" ? "نمایش موارد بعدی" : "Show next items"}
                  >
                    <ChevronRight size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {loading && courses.length === 0 ? (
            <FrontendPageLoader
              label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
              minHeight="min-h-[180px]"
              className="mt-5"
            />
          ) : null}

          {!loading && courses.length === 0 ? (
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
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-500 bg-white px-7 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore
                  ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{language === "fa" ? "در حال بارگذاری" : "Loading"}</span>
                    </>
                  )
                  : language === "fa"
                    ? `نمایش ${ROW_SIZE * LOAD_MORE_PAGE_STEP} کورس دیگر`
                    : `Show ${ROW_SIZE * LOAD_MORE_PAGE_STEP} more`}
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
        className={`fixed bottom-5 right-5 z-[90] grid h-12 w-12 place-items-center rounded-full border border-violet-500 bg-white text-violet-700 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:bg-violet-50 ${
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
