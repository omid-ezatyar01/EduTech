import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Headphones,
  PlusCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import CourseCatalogCard from "../components/CourseCatalogCard.jsx";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import {
  fetchPublicCategories,
  fetchPublishedCourses,
  getCachedPublicCategories,
  fetchStudentEnrollments,
} from "../../services/courseService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";
import { buildCourseCategoryPath } from "../utils/routePaths.js";
import { buildEnrolledCourseIdSet } from "../utils/courseEnrollmentAccess.js";

const benefitIcons = [UsersRound, GraduationCap, Video, Headphones];
const MOBILE_BATCH_SIZE = 20;
const MOBILE_SECTION_LIMIT = 20;
const COURSE_PAGE_SIZE = 20;
const INITIAL_LIST_PAGE_COUNT = 3;
const LOAD_MORE_PAGE_STEP = 2;

const chunkRows = (items = [], size = MOBILE_BATCH_SIZE) => {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

function FilterSelect({ label, value, onChange, options, setCurrentPage }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-black text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          setCurrentPage(INITIAL_LIST_PAGE_COUNT);
          onChange(event.target.value);
        }}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function LiveCoursesPage({ t }) {
  const dir = t.meta.dir;
  const page = t.liveCoursesPage;
  const language = t.meta.lang === "fa" ? "fa" : "en";
  const noCoursesText =
    language === "fa"
      ? "در حال حاضر هیچ کورس موجود نیست."
      : "There are no available courses right now.";

  const [currentPage, setCurrentPage] = useState(INITIAL_LIST_PAGE_COUNT);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryPath, setCategoryPath] = useState([]);
  const [level, setLevel] = useState("all");
  const [courseLanguage, setCourseLanguage] = useState("all");
  const [pricing, setPricing] = useState("all");
  const [courseType, setCourseType] = useState("all");
  const [paymentPlan, setPaymentPlan] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortMode, setSortMode] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState(() => getCachedPublicCategories() || []);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const [mobileSections, setMobileSections] = useState([]);
  const [mobileSectionsLoading, setMobileSectionsLoading] = useState(false);
  const [mobileSectionsError, setMobileSectionsError] = useState("");
  const [sectionRowNav, setSectionRowNav] = useState({});
  const [listRowNav, setListRowNav] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const coursesTopRef = useRef(null);
  const sectionRowRefs = useRef([]);
  const listRowRefs = useRef([]);
  const category = categoryPath.at(-1) || "all";
  const filtersAtDefault =
    categoryPath.length === 0 &&
    level === "all" &&
    courseLanguage === "all" &&
    pricing === "all" &&
    courseType === "all" &&
    paymentPlan === "all" &&
    minPrice === "" &&
    maxPrice === "" &&
    sortMode === "popular";
  const isRootSectionMode = filtersAtDefault && searchTerm.trim() === "";

  const applySearch = useCallback(() => {
    setCurrentPage(INITIAL_LIST_PAGE_COUNT);
    setSearchTerm(searchInput.trim());
  }, [searchInput]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 520);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        if (isRootSectionMode) {
          setCourses([]);
          setMeta({ totalPages: 1, total: 0 });
          return;
        }
        const sharedQuery = {
          limit: COURSE_PAGE_SIZE,
          search: searchTerm,
          category: category === "all" ? undefined : category,
          level: level === "all" ? undefined : level,
          language: courseLanguage === "all" ? undefined : courseLanguage,
          pricing: pricing === "all" ? undefined : pricing,
          courseType: courseType === "all" ? undefined : courseType,
          paymentPlan: paymentPlan === "all" ? undefined : paymentPlan,
          minPrice: minPrice === "" ? undefined : minPrice,
          maxPrice: maxPrice === "" ? undefined : maxPrice,
          sortBy:
            sortMode === "price_low" || sortMode === "price_high"
              ? "price"
              : sortMode === "startDate"
                ? "startDate"
                : sortMode === "newest"
                  ? "newest"
                  : "popular",
          sortOrder:
            sortMode === "price_low" || sortMode === "startDate" ? "asc" : "desc",
        };

        if (cancelled) return;
        setLoading(true);
        setError("");

        const results = await Promise.all(
          Array.from({ length: currentPage }, (_, index) =>
            fetchPublishedCourses({
              ...sharedQuery,
              page: index + 1,
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
        setMeta(results.at(-1)?.meta || { totalPages: 1 });
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
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isRootSectionMode,
    currentPage,
    searchTerm,
    category,
    level,
    courseLanguage,
    pricing,
    courseType,
    paymentPlan,
    minPrice,
    maxPrice,
    sortMode,
    language,
  ]);

  useEffect(() => {
    const loadCategories = async () => {
      const cachedCategories = getCachedPublicCategories();
      if (cachedCategories?.length) {
        setCategories(cachedCategories);
        return;
      }

      try {
        const rows = await fetchPublicCategories();
        setCategories(rows);
      } catch {
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  const loadEnrollments = useCallback(async (mountedRef) => {
    if (localStorage.getItem("edutech_auth") !== "true") {
      if (!mountedRef || mountedRef.current) {
        setEnrolledCourseIds(new Set());
      }
      return;
    }

    try {
      const rows = await fetchStudentEnrollments();
      if (mountedRef && !mountedRef.current) return;
      setEnrolledCourseIds(buildEnrolledCourseIdSet(rows));
    } catch {
      if (mountedRef && !mountedRef.current) return;
      setEnrolledCourseIds(new Set());
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };

    loadEnrollments(mountedRef);

    const handleEnrollmentRefresh = () => {
      loadEnrollments(mountedRef);
    };

    window.addEventListener("auth_change", handleEnrollmentRefresh);
    window.addEventListener("edutech_data_changed", handleEnrollmentRefresh);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("auth_change", handleEnrollmentRefresh);
      window.removeEventListener("edutech_data_changed", handleEnrollmentRefresh);
    };
  }, [loadEnrollments]);

  const totalPages = Number(meta?.totalPages || 1);

  const levelOptions = useMemo(
    () => [
      {
        value: "all",
        label: language === "fa" ? "همه سطوح" : page.filters?.allLevels || "All Levels",
      },
      { value: "beginner", label: language === "fa" ? "مبتدی" : "Beginner" },
      { value: "intermediate", label: language === "fa" ? "متوسط" : "Intermediate" },
      { value: "advanced", label: language === "fa" ? "پیشرفته" : "Advanced" },
    ],
    [language, page.filters],
  );
  const categoriesByParent = new Map();
  categories.forEach((item) => {
    const parentId = String(item?.parent?._id || item?.parent || "");
    const children = categoriesByParent.get(parentId) || [];
    children.push(item);
    categoriesByParent.set(parentId, children);
  });
  categoriesByParent.forEach((rows) => {
    rows.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  });

  const categoryFilterLevels = [];
  let categoryParentId = "";
  for (let index = 0; index < 20; index += 1) {
    const options = categoriesByParent.get(categoryParentId) || [];
    if (!options.length) break;
    const selectedValue = categoryPath[index] || "all";
    const parentCategory = categories.find(
      (item) => String(item?._id || "") === categoryParentId,
    );
    categoryFilterLevels.push({
      value: selectedValue,
      label:
        index === 0
          ? language === "fa"
            ? "عنوان اصلی"
            : "Main subject"
          : index === 1
            ? language === "fa"
              ? "زیرعنوان"
              : "Direct subcategory"
            : language === "fa"
              ? `زیرعنوان سطح ${index + 1}`
              : `Subcategory level ${index + 1}`,
      options: [
        {
          value: "all",
          label:
            index === 0
              ? language === "fa"
                ? "همه موضوعات"
                : page.filters?.allTopics || "All subjects"
              : language === "fa"
                ? `همه موارد ${parentCategory?.name || ""}`
                : `All in ${parentCategory?.name || ""}`,
        },
        ...options.map((item) => ({ value: item._id, label: item.name })),
      ],
    });
    if (selectedValue === "all") break;
    categoryParentId = selectedValue;
  }
  const languageOptions = [
    {
      value: "all",
      label: language === "fa" ? "همه زبان‌ها" : "All languages",
    },
    ...(Array.isArray(meta?.facets?.languages) ? meta.facets.languages : []).map((item) => ({
      value: item.value,
      label: `${item.value} (${item.count})`,
    })),
  ];
  const advancedFilterCount = [
    category,
    level,
    courseLanguage,
    pricing,
    courseType,
    paymentPlan,
  ].filter((value) => value !== "all").length +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0);
  const activeFilterCount = advancedFilterCount +
    (searchTerm.trim() ? 1 : 0) +
    (sortMode !== "popular" ? 1 : 0);
  const rootCategories = useMemo(
    () => categories.filter((item) => !item?.parent),
    [categories],
  );

  useEffect(() => {
    let cancelled = false;

    const loadMobileSections = async () => {
      if (!isRootSectionMode || !rootCategories.length) {
        if (!isRootSectionMode) {
          setMobileSections([]);
          setMobileSectionsError("");
        }
        return;
      }

      try {
        setMobileSectionsLoading(true);
        setMobileSectionsError("");

        const sections = await Promise.all(
          rootCategories.map(async (rootCategory) => {
            const result = await fetchPublishedCourses({
              page: 1,
              limit: MOBILE_SECTION_LIMIT,
              category: rootCategory._id,
              sortBy: "popular",
              sortOrder: "desc",
            });

            return {
              category: rootCategory,
              courses: Array.isArray(result?.courses) ? result.courses : [],
              total: Number(result?.meta?.total || 0),
            };
          }),
        );

        if (cancelled) return;
        setMobileSections(sections.filter((section) => section.courses.length > 0));
      } catch (err) {
        if (cancelled) return;
        setMobileSectionsError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            "بارگذاری بخش‌های کورس انجام نشد.",
            "Failed to load course sections.",
          ),
        );
      } finally {
        if (!cancelled) setMobileSectionsLoading(false);
      }
    };

    loadMobileSections();

    return () => {
      cancelled = true;
    };
  }, [isRootSectionMode, language, rootCategories]);

  const resetFilters = () => {
    setCurrentPage(INITIAL_LIST_PAGE_COUNT);
    setSearchTerm("");
    setSearchInput("");
    setCategoryPath([]);
    setLevel("all");
    setCourseLanguage("all");
    setPricing("all");
    setCourseType("all");
    setPaymentPlan("all");
    setMinPrice("");
    setMaxPrice("");
    setSortMode("popular");
  };
  const totalCourses = Number(meta?.total || 0);
  const courseRows = useMemo(
    () => chunkRows(courses, MOBILE_BATCH_SIZE),
    [courses],
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
  const updateSectionRowNav = useCallback((key, rowElement) => {
    const nextState = getRowNavState(rowElement);
    setSectionRowNav((previous) => {
      const current = previous[key];
      if (current?.canPrev === nextState.canPrev && current?.canNext === nextState.canNext) {
        return previous;
      }
      return { ...previous, [key]: nextState };
    });
  }, [getRowNavState]);
  const updateListRowNav = useCallback((key, rowElement) => {
    const nextState = getRowNavState(rowElement);
    setListRowNav((previous) => {
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
    mobileSections.forEach((section) => {
      const element = sectionRowRefs.current[section.category._id];
      if (element) {
        updateSectionRowNav(section.category._id, element);
      }
    });
  }, [mobileSections, updateSectionRowNav]);

  useEffect(() => {
    courseRows.forEach((_, rowIndex) => {
      const element = listRowRefs.current[rowIndex];
      if (element) {
        updateListRowNav(rowIndex, element);
      }
    });
  }, [courseRows, updateListRowNav]);

  return (
    <section id="live-courses" className="bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-20">
      <div className="mx-auto max-w-[1536px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative min-h-[150px] overflow-hidden rounded-3xl bg-white">
          <img className="mx-auto h-32 w-auto object-contain sm:absolute sm:start-8 sm:top-4 sm:h-36" src="/courses-hero.png" alt={page.titleHighlight} />
          <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 text-center sm:py-10">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
              {page.titleBefore} <span className="text-teal-500">{page.titleHighlight}</span> {page.titleAfter}
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">{page.subtitle}</p>
          </div>
        </div>

        <div className="mt-5 space-y-6" ref={coursesTopRef}>
          <div className="min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                    <SlidersHorizontal size={19} className="text-teal-600" />
                    {language === "fa" ? "جستجو و فیلتر کورس‌ها" : "Search & Filter Courses"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {language === "fa"
                      ? `${totalCourses} کورس یافت شد`
                      : `${totalCourses} courses found`}
                  </p>
                </div>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <RotateCcw size={14} />
                    {language === "fa"
                      ? `پاک‌کردن فیلترها (${activeFilterCount})`
                      : `Clear filters (${activeFilterCount})`}
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
                <label>
                  <span className="mb-1.5 block text-xs font-black text-slate-600">
                    {language === "fa" ? "جستجو" : "Search"}
                  </span>
                  <div className="flex gap-2">
                    <span className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500 transition focus-within:border-teal-400 focus-within:bg-white">
                      <Search size={19} className="text-slate-400" />
                      <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            applySearch();
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
                        placeholder={page.searchPlaceholder}
                        type="search"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={applySearch}
                      className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-black text-white transition hover:bg-teal-700"
                    >
                      {language === "fa" ? "جستجو" : "Search"}
                    </button>
                  </div>
                </label>

                <FilterSelect
                  label={language === "fa" ? "مرتب‌سازی" : "Sort by"}
                  value={sortMode}
                  onChange={setSortMode}
                  setCurrentPage={setCurrentPage}
                  options={[
                    { value: "popular", label: language === "fa" ? "محبوب‌ترین" : "Most popular" },
                    { value: "newest", label: language === "fa" ? "جدیدترین" : "Newest" },
                    { value: "price_low", label: language === "fa" ? "کمترین قیمت" : "Lowest price" },
                    { value: "price_high", label: language === "fa" ? "بیشترین قیمت" : "Highest price" },
                    { value: "startDate", label: language === "fa" ? "نزدیک‌ترین تاریخ شروع" : "Start date" },
                  ]}
                />
                <div className="sm:col-span-2 lg:col-span-1">
                  <span className="mb-1.5 block text-xs font-black text-slate-600">
                    {language === "fa" ? "فیلترهای بیشتر" : "More filters"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-teal-700 lg:min-w-40"
                  >
                    <SlidersHorizontal size={17} />
                    {language === "fa" ? "باز کردن فیلترها" : "Open filters"}
                    {advancedFilterCount > 0 ? (
                      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-teal-400 px-1.5 text-xs text-slate-950">
                        {advancedFilterCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
            </div>

            {filtersOpen ? (
              <div
                className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-6"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setFiltersOpen(false);
                }}
                role="presentation"
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="course-filter-title"
                  className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                      <h2 id="course-filter-title" className="text-xl font-black text-slate-950">
                        {language === "fa" ? "فیلتر کورس‌ها" : "Filter courses"}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {language === "fa"
                          ? `${totalCourses} کورس مطابق فیلتر شما`
                          : `${totalCourses} courses match your filters`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      aria-label={language === "fa" ? "بستن" : "Close"}
                      className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 sm:col-span-2">
                        <div className="mb-3">
                          <h3 className="text-sm font-black text-slate-900">
                            {language === "fa" ? "موضوع و زیرعنوان‌ها" : "Subject hierarchy"}
                          </h3>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                            {language === "fa"
                              ? "ابتدا عنوان اصلی را انتخاب کنید؛ زیرعنوان بعدی به‌صورت خودکار نمایش داده می‌شود."
                              : "Choose a main subject first. Its direct subcategory field will appear automatically."}
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {categoryFilterLevels.map((filterLevel, index) => (
                            <FilterSelect
                              key={`${index}-${categoryPath[index - 1] || "root"}`}
                              label={filterLevel.label}
                              value={filterLevel.value}
                              onChange={(value) => {
                                setCategoryPath((previous) =>
                                  value === "all"
                                    ? previous.slice(0, index)
                                    : [...previous.slice(0, index), value],
                                );
                              }}
                              options={filterLevel.options}
                              setCurrentPage={setCurrentPage}
                            />
                          ))}
                        </div>
                      </div>
                      <FilterSelect
                        label={language === "fa" ? "زبان تدریس" : "Language"}
                        value={courseLanguage}
                        onChange={setCourseLanguage}
                        options={languageOptions}
                        setCurrentPage={setCurrentPage}
                      />
                      <FilterSelect
                        label={language === "fa" ? "سطح" : "Level"}
                        value={level}
                        onChange={setLevel}
                        options={levelOptions}
                        setCurrentPage={setCurrentPage}
                      />
                      <FilterSelect
                        label={language === "fa" ? "قیمت" : "Price type"}
                        value={pricing}
                        onChange={setPricing}
                        setCurrentPage={setCurrentPage}
                        options={[
                          { value: "all", label: language === "fa" ? "رایگان و پولی" : "Free & paid" },
                          { value: "free", label: language === "fa" ? "فقط رایگان" : "Free only" },
                          { value: "paid", label: language === "fa" ? "فقط پولی" : "Paid only" },
                        ]}
                      />
                      <FilterSelect
                        label={language === "fa" ? "نوع کورس" : "Course type"}
                        value={courseType}
                        onChange={setCourseType}
                        setCurrentPage={setCurrentPage}
                        options={[
                          { value: "all", label: language === "fa" ? "همه انواع" : "All types" },
                          { value: "general", label: language === "fa" ? "عمومی" : "General" },
                          { value: "special", label: language === "fa" ? "ویژه" : "Special" },
                        ]}
                      />
                      <FilterSelect
                        label={language === "fa" ? "روش پرداخت" : "Payment plan"}
                        value={paymentPlan}
                        onChange={setPaymentPlan}
                        setCurrentPage={setCurrentPage}
                        options={[
                          { value: "all", label: language === "fa" ? "همه روش‌ها" : "All plans" },
                          { value: "monthly", label: language === "fa" ? "پرداخت ماهانه" : "Monthly" },
                          { value: "whole_period", label: language === "fa" ? "پرداخت تمام دوره" : "Whole period" },
                        ]}
                      />
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {language === "fa" ? "قیمت از (USD)" : "Min price (USD)"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={meta?.facets?.priceRange?.max || 10000}
                          value={minPrice}
                          onChange={(event) => {
                            setCurrentPage(INITIAL_LIST_PAGE_COUNT);
                            setMinPrice(event.target.value);
                          }}
                          placeholder={String(meta?.facets?.priceRange?.min ?? 0)}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {language === "fa" ? "قیمت تا (USD)" : "Max price (USD)"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={maxPrice}
                          onChange={(event) => {
                            setCurrentPage(INITIAL_LIST_PAGE_COUNT);
                            setMaxPrice(event.target.value);
                          }}
                          placeholder={String(meta?.facets?.priceRange?.max ?? 0)}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex sm:justify-end sm:px-6">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <RotateCcw size={15} />
                      {language === "fa" ? "پاک‌کردن" : "Clear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-black text-white transition hover:bg-teal-700"
                    >
                      {language === "fa"
                        ? `نمایش ${totalCourses} کورس`
                        : `Show ${totalCourses} courses`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm font-bold text-rose-600">{error}</p> : null}
            {mobileSectionsError ? <p className="mt-4 text-sm font-bold text-rose-600">{mobileSectionsError}</p> : null}

            <div className="mt-5 space-y-4 sm:space-y-0">
              {isRootSectionMode ? (
                <div className="space-y-5">
                  {mobileSections.map((section) => (
                    <div
                      key={section.category._id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-black text-slate-950">{section.category.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {language === "fa"
                              ? `${section.total} کورس در این بخش`
                              : `${section.total} courses in this subject`}
                          </p>
                        </div>
                      </div>

                      <div className="relative">
                        <div
                          ref={(element) => {
                            sectionRowRefs.current[section.category._id] = element;
                          }}
                          onScroll={(event) => updateSectionRowNav(section.category._id, event.currentTarget)}
                          className="edutech-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
                          dir={language === "fa" ? "rtl" : "ltr"}
                        >
                        {section.courses.map((course, itemIndex) => (
                          <div
                            key={course._id || course.id || `${course.title}-${itemIndex}`}
                            className="w-[min(82vw,280px)] min-w-[min(82vw,280px)] shrink-0 snap-start"
                          >
                            <CourseCatalogCard
                              course={course}
                              dir={dir}
                              index={itemIndex}
                              labels={t.courseLabels}
                              language={language}
                              isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                            />
                          </div>
                        ))}
                        </div>
                        {sectionRowNav[section.category._id]?.canPrev ? (
                          <button
                            type="button"
                            onClick={() => scrollRowBackward(sectionRowRefs.current[section.category._id])}
                            className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                            aria-label={language === "fa" ? "نمایش موارد قبلی" : "Show previous items"}
                          >
                            <ChevronLeft size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                          </button>
                        ) : null}
                        {sectionRowNav[section.category._id]?.canNext ? (
                          <button
                            type="button"
                            onClick={() => scrollRowForward(sectionRowRefs.current[section.category._id])}
                            className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                            aria-label={language === "fa" ? "نمایش موارد بعدی" : "Show next items"}
                          >
                            <ChevronRight size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex justify-center">
                        <Link
                          to={buildCourseCategoryPath(section.category)}
                          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-500 bg-white px-7 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-50"
                        >
                          {language === "fa" ? "نمایش بیشتر" : "Show more"}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 sm:hidden">
                {courseRows.map((row, rowIndex) => (
                  <div key={`course-row-${rowIndex + 1}`} className="relative">
                    <div
                      ref={(element) => {
                        listRowRefs.current[rowIndex] = element;
                      }}
                      onScroll={(event) => updateListRowNav(rowIndex, event.currentTarget)}
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
                            index={(rowIndex * MOBILE_BATCH_SIZE) + itemIndex}
                            labels={t.courseLabels}
                            language={language}
                            isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                          />
                        </div>
                      ))}
                    </div>
                    {listRowNav[rowIndex]?.canPrev ? (
                      <button
                        type="button"
                        onClick={() => scrollRowBackward(listRowRefs.current[rowIndex])}
                        className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                        aria-label={language === "fa" ? "نمایش موارد قبلی" : "Show previous items"}
                      >
                        <ChevronLeft size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                      </button>
                    ) : null}
                    {listRowNav[rowIndex]?.canNext ? (
                      <button
                        type="button"
                        onClick={() => scrollRowForward(listRowRefs.current[rowIndex])}
                        className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:border-violet-200 hover:text-violet-700"
                        aria-label={language === "fa" ? "نمایش موارد بعدی" : "Show next items"}
                      >
                        <ChevronRight size={18} className={dir === "rtl" ? "rotate-180" : ""} />
                      </button>
                    ) : null}
                  </div>
                ))}
                </div>
              )}

              <div className={`${isRootSectionMode ? "hidden" : "hidden"} grid-cols-2 gap-4 sm:grid xl:grid-cols-3`}>
                {courses.map((course, index) => (
                  <div
                    key={course._id || course.id || `${course.title}-${index}`}
                    className="w-full"
                  >
                    <CourseCatalogCard
                      course={course}
                      dir={dir}
                      index={index}
                      labels={t.courseLabels}
                      language={language}
                      isEnrolled={enrolledCourseIds.has(String(course?._id || course?.id || ""))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <FrontendPageLoader
                label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
                minHeight="min-h-[180px]"
                className="mt-4"
              />
            ) : null}
            {mobileSectionsLoading ? (
              <FrontendPageLoader
                label={language === "fa" ? "در حال بارگذاری بخش‌های کورس" : "Loading course sections"}
                minHeight="min-h-[180px]"
                className="mt-4"
              />
            ) : null}

            {!loading && !mobileSectionsLoading && !isRootSectionMode && courses.length === 0 ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600">
                {noCoursesText}
              </div>
            ) : null}
            {!loading && !mobileSectionsLoading && isRootSectionMode && mobileSections.length === 0 ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600">
                {noCoursesText}
              </div>
            ) : null}

            {!isRootSectionMode && currentPage < totalPages ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setCurrentPage((previous) => previous + LOAD_MORE_PAGE_STEP);
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-500 bg-white px-7 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading
                    ? language === "fa"
                      ? "در حال بارگذاری"
                      : "Loading"
                    : language === "fa"
                      ? "نمایش بیشتر"
                      : "Show more"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] lg:col-span-2">
              <h2 className="text-xl font-black leading-tight text-slate-950 md:text-2xl">{page.sidebarTitle}</h2>
              <div className="mt-4 space-y-4">
                {page.benefits.map((benefit, index) => {
                  const Icon = benefitIcons[index];
                  return (
                    <div className="flex gap-3" key={benefit.title}>
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${index % 2 === 0 ? "bg-primary-50 text-primary-700" : "bg-teal-50 text-teal-700"}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-black leading-tight text-slate-950">{benefit.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600 break-normal">{benefit.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex h-full min-h-[180px] flex-col rounded-2xl border border-primary-100 bg-primary-50 p-5 text-center shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:text-start lg:col-span-2">
              <div>
                <h2 className="text-xl font-black leading-tight text-slate-950">{page.suggestTitle}</h2>
                <p className="mx-auto mt-2.5 text-sm leading-7 text-slate-600 break-normal sm:mx-0">{page.suggestText}</p>
              </div>
              <Link
                to="/contact"
                className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 sm:w-auto sm:min-w-[170px]"
              >
                <PlusCircle size={17} />
                {page.suggestButton}
              </Link>
            </div>
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
