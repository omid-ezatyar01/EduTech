import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  fetchStudentEnrollments,
} from "../../services/courseService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";

const benefitIcons = [UsersRound, GraduationCap, Video, Headphones];
const MOBILE_BATCH_SIZE = 20;
const EXCLUDED_ENROLLMENT_STATUSES = new Set(["cancelled", "canceled", "failed", "rejected", "refunded"]);

const hasActiveEnrollmentAccess = (row = {}) => {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (EXCLUDED_ENROLLMENT_STATUSES.has(status)) return false;
  if (!["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
};

const buildEnrolledCourseIdSet = (rows = []) => {
  const ids = new Set();
  rows.forEach((row) => {
    if (!hasActiveEnrollmentAccess(row)) return;

    const course = row?.courseId;
    const courseId =
      typeof course === "object"
        ? course?._id || course?.id
        : course;

    if (courseId) ids.add(String(courseId));
  });
  return ids;
};

function FilterSelect({ label, value, onChange, options, setCurrentPage }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-black text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          setCurrentPage(1);
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

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const coursesTopRef = useRef(null);
  const category = categoryPath.at(-1) || "all";

  useEffect(() => {
    window.scrollTo(0, 0);
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
        if (cancelled) return;
        setLoading(true);
        setError("");

        const { courses: rows, meta: pageMeta } = await fetchPublishedCourses({
          page: currentPage,
          limit: MOBILE_BATCH_SIZE,
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
        });
        if (cancelled) return;

        setCourses((previous) => {
          if (currentPage === 1) return rows;
          const byId = new Map(
            [...previous, ...rows].map((course) => [
              String(course?._id || course?.id || ""),
              course,
            ]),
          );
          return [...byId.values()];
        });
        setMeta(pageMeta || { totalPages: 1 });
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
  const resetFilters = () => {
    setCurrentPage(1);
    setSearchTerm("");
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
                  <span className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500 transition focus-within:border-teal-400 focus-within:bg-white">
                    <Search size={19} className="text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => {
                        setCurrentPage(1);
                        setSearchTerm(event.target.value);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder={page.searchPlaceholder}
                      type="search"
                    />
                  </span>
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
                            setCurrentPage(1);
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
                            setCurrentPage(1);
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

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

            {loading ? (
              <FrontendPageLoader
                label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
                minHeight="min-h-[180px]"
                className="mt-4"
              />
            ) : null}

            {!loading && courses.length === 0 ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-600">
                {noCoursesText}
              </div>
            ) : null}

            {currentPage < totalPages ? (
              <div className="mt-7 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setCurrentPage((previous) => previous + 1);
                  }}
                  className="inline-flex h-12 min-w-48 items-center justify-center rounded-xl border border-primary-500 bg-white px-6 text-sm font-black text-primary-700 transition hover:bg-primary-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading
                    ? language === "fa"
                      ? "در حال بارگذاری"
                      : "Loading"
                    : language === "fa"
                      ? `نمایش ${MOBILE_BATCH_SIZE} کورس دیگر`
                      : `Show ${MOBILE_BATCH_SIZE} more`}
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
    </section>
  );
}
