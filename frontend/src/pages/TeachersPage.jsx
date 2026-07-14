import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  Headphones,
  MessageCircle,
  Rocket,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import TeacherCard from "../components/TeacherCard.jsx";
import { fetchPublicPlatformStats } from "../../services/courseService.js";
import { fetchPublicTeachers } from "../../services/teacherService.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";

const benefitIcons = [BriefcaseBusiness, MessageCircle, Headphones, Rocket];
const MOBILE_BATCH_SIZE = 20;

const resolveTeacherExperienceYears = (teacher = {}) => {
  const hasApplicationYears =
    teacher?.teacherApplication &&
    teacher.teacherApplication.yearsExperience !== undefined &&
    teacher.teacherApplication.yearsExperience !== null;
  const applicationYears = Number(teacher?.teacherApplication?.yearsExperience);
  if (hasApplicationYears && Number.isFinite(applicationYears)) {
    return Math.max(0, Math.round(applicationYears));
  }

  const explicitYears = Number(teacher?.yearsExperience);
  if (Number.isFinite(explicitYears)) {
    return Math.max(0, Math.round(explicitYears));
  }

  return 0;
};

const mapTeacherForCard = (item, language) => {
  const isFa = language === "fa";
  const numberFormatter = new Intl.NumberFormat(isFa ? "fa-AF" : "en-US");
  const experienceYears = resolveTeacherExperienceYears(item);
  const experienceYearsLabel = numberFormatter.format(experienceYears);

  return {
    _id: item._id,
    name: item.name,
    role: isFa ? "مدرس ارشد" : "Senior Instructor",
    avatar: item.avatar || "",
    bio:
      item.bio ||
      (isFa
        ? "مدرس با تجربه با تمرکز روی آموزش عملی و رشد مهارت‌های واقعی شاگردان."
        : "Experienced instructor focused on practical teaching and real skill development."),
    tags:
      Array.isArray(item.tags) && item.tags.length
        ? item.tags
        : [isFa ? "تدریس آنلاین" : "Online Teaching"],
    tagsRaw: Array.isArray(item.tags) ? item.tags : [],
    rating: Number(item.rating || 0),
    ratingCount: Math.max(0, Number(item.ratingCount || 0)),
    experienceYears,
    experienceYearsLabel,
    teacherApplication: item.teacherApplication || {},
    isFa,
    experienceText: isFa
      ? `${experienceYearsLabel} سال`
      : `${experienceYearsLabel} Years`,
    studentsLabel: isFa ? "شاگردان" : "Students",
    ratingLabel: isFa ? "امتیاز" : "Rating",
    experienceLabel: isFa ? "تجربه" : "Experience",
    courses: isFa
      ? `${numberFormatter.format(item.publishedCoursesCount || 0)} کورس`
      : `${numberFormatter.format(item.publishedCoursesCount || 0)} courses`,
    students: isFa
      ? `${numberFormatter.format(item.totalStudents || 0)} شاگرد`
      : `${numberFormatter.format(item.totalStudents || 0)} students`,
    specialization:
      (Array.isArray(item.tags) && item.tags[0]) ||
      (isFa ? "آموزش آنلاین" : "Online Education"),
    location:
      item.city && item.country
        ? `${item.city}, ${item.country}`
        : item.country || item.city || (isFa ? "افغانستان" : "Afghanistan"),
    socialLinks: {
      linkedin: item.socialLinks?.linkedin || "",
      youtube: item.socialLinks?.youtube || "",
      instagram: item.socialLinks?.instagram || "",
      facebook: item.socialLinks?.facebook || "",
      whatsapp: item.socialLinks?.whatsapp || "",
      twitter: item.socialLinks?.twitter || "",
      github: item.socialLinks?.github || "",
      email: item.email || "",
    },
    publishedCoursesCount: Number(item.publishedCoursesCount || 0),
    totalStudents: Number(item.totalStudents || 0),
    joinedAt: item.joinedAt,
  };
};

function FilterSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={17}
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}

export default function TeachersPage({ t }) {
  const page = t.teachersPage;
  const [teacherPage, setTeacherPage] = useState(1);
  const [search, setSearch] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [teacherMeta, setTeacherMeta] = useState({ total: 0, facets: {} });
  const [experienceFilter, setExperienceFilter] = useState("most_experience");
  const [teacherLanguage, setTeacherLanguage] = useState("all");
  const [expertise, setExpertise] = useState("all");
  const [teachingLevel, setTeachingLevel] = useState("all");
  const [country, setCountry] = useState("all");
  const [minExperience, setMinExperience] = useState("all");
  const [introVideo, setIntroVideo] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [platformStats, setPlatformStats] = useState({
    activeCourses: 0,
    expertTeachers: 0,
    happyStudents: 0,
  });

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
        const { teachers: rows, meta } = await fetchPublicTeachers({
          page: teacherPage,
          limit: MOBILE_BATCH_SIZE,
          search,
          language: teacherLanguage === "all" ? undefined : teacherLanguage,
          expertise: expertise === "all" ? undefined : expertise,
          teachingLevel: teachingLevel === "all" ? undefined : teachingLevel,
          country: country === "all" ? undefined : country,
          minExperience: minExperience === "all" ? undefined : minExperience,
          hasIntroVideo: introVideo === "all" ? undefined : introVideo === "yes",
          sortBy:
            experienceFilter === "most_experience"
              ? "experience"
              : "newest",
          sortOrder: "desc",
        });
        if (cancelled) return;
        setTeacherMeta(meta || { total: rows.length, facets: {} });

        const mappedTeachers = rows.map((item) =>
          mapTeacherForCard(item, t.meta.lang),
        );
        setTeachers((previous) => {
          if (teacherPage === 1) return mappedTeachers;
          const byId = new Map(
            [...previous, ...mappedTeachers].map((teacher) => [
              String(teacher._id),
              teacher,
            ]),
          );
          return [...byId.values()];
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          getLocalizedRequestErrorMessage(
            err,
            t.meta.lang === "fa" ? "fa" : "en",
            "بارگذاری مدرسان انجام نشد.",
            "Failed to load teachers.",
          ),
        );
        setTeachers([]);
        setTeacherMeta({ total: 0, facets: {} });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    search,
    teacherPage,
    teacherLanguage,
    expertise,
    teachingLevel,
    country,
    minExperience,
    introVideo,
    experienceFilter,
    t.meta.lang,
  ]);

  useEffect(() => {
    let mounted = true;

    const loadPlatformStats = async () => {
      try {
        const stats = await fetchPublicPlatformStats();
        if (!mounted) return;
        setPlatformStats({
          activeCourses: Number(stats?.activeCourses || 0),
          expertTeachers: Number(stats?.expertTeachers || 0),
          happyStudents: Number(stats?.happyStudents || 0),
        });
      } catch {
        if (!mounted) return;
        setPlatformStats({
          activeCourses: 0,
          expertTeachers: 0,
          happyStudents: 0,
        });
      }
    };

    loadPlatformStats();

    return () => {
      mounted = false;
    };
  }, []);

  const experienceOptions = useMemo(
    () => [
      {
        value: "most_experience",
        label: t.meta.lang === "fa" ? "بیشترین تجربه" : "Most Experience",
      },
      {
        value: "newest",
        label: t.meta.lang === "fa" ? "جدیدترین مدرس" : "Newest Teacher",
      },
      {
        value: "most_students",
        label: t.meta.lang === "fa" ? "بیشترین شاگرد" : "Most Students",
      },
    ],
    [t.meta.lang],
  );
  const isFa = t.meta.lang === "fa";
  const buildFacetOptions = (values, allLabel) => [
    { value: "all", label: allLabel },
    ...(Array.isArray(values) ? values : []).map((value) => ({
      value,
      label: value,
    })),
  ];
  const languageOptions = buildFacetOptions(
    teacherMeta?.facets?.languages,
    isFa ? "همه زبان‌ها" : "All languages",
  );
  const expertiseOptions = buildFacetOptions(
    teacherMeta?.facets?.expertiseAreas,
    isFa ? "همه تخصص‌ها" : "All expertise areas",
  );
  const teachingLevelOptions = buildFacetOptions(
    teacherMeta?.facets?.teachingLevels,
    isFa ? "همه سطوح تدریس" : "All teaching levels",
  );
  const countryOptions = buildFacetOptions(
    teacherMeta?.facets?.countries,
    isFa ? "همه کشورها" : "All countries",
  );
  const advancedFilterCount = [
    teacherLanguage,
    expertise,
    teachingLevel,
    country,
    minExperience,
    introVideo,
  ].filter((value) => value !== "all").length;
  const resetTeacherFilters = () => {
    setTeacherPage(1);
    setSearch("");
    setExperienceFilter("most_experience");
    setTeacherLanguage("all");
    setExpertise("all");
    setTeachingLevel("all");
    setCountry("all");
    setMinExperience("all");
    setIntroVideo("all");
  };
  const changeTeacherFilter = (setter) => (event) => {
    setTeacherPage(1);
    setter(event.target.value);
  };

  const filteredTeachers = useMemo(() => {
    let rows = [...teachers];

    if (experienceFilter === "most_students") {
      rows.sort((a, b) => b.totalStudents - a.totalStudents);
    } else if (experienceFilter === "newest") {
      rows.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    } else {
      rows.sort((a, b) => Number(b.experienceYears || 0) - Number(a.experienceYears || 0));
    }

    return rows;
  }, [teachers, experienceFilter]);
  const teacherTotalPages = Math.max(1, Number(teacherMeta?.totalPages || 1));

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(t.meta.lang === "fa" ? "fa-AF" : "en-US", {
      maximumFractionDigits: 0,
    }),
    [t.meta.lang],
  );

  const statCards = [
    {
      label: t.meta.lang === "fa" ? "مدرس فعال" : "Active Teachers",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.expertTeachers))),
    },
    {
      label: t.meta.lang === "fa" ? "کورس فعال" : "Published Courses",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.activeCourses))),
    },
    {
      label: t.meta.lang === "fa" ? "شاگردان" : "Students",
      value: numberFormatter.format(Math.max(0, Math.round(platformStats.happyStudents))),
    },
  ];

  const faqFallbackAnswers =
    t.meta.lang === "fa"
      ? [
          "برای همکاری، روی گزینه «درخواست همکاری» کلیک کنید. تیم ایجوتک معلومات شما را بررسی کرده و نتیجه را از طریق ایمیل با شما شریک می‌کند.",
          "بله، کلاس‌ها به‌صورت آنلاین و تعاملی برگزار می‌شوند. بعد از ثبت‌نام، زمان‌بندی و لینک جلسه از طریق داشبورد در اختیار شما قرار می‌گیرد.",
          "بله، مدرسان در جریان تمرین‌ها و پروژه‌ها بازخورد دقیق ارائه می‌کنند تا شاگردان مسیر پیشرفت خود را بهتر دنبال کنند.",
        ]
      : [
          "Click “Apply to Teach” and submit your details. The EduTech team reviews your profile and contacts you by email.",
          "Yes. Classes are held online in an interactive format. After enrollment, schedule and meeting access are shared in your dashboard.",
          "Yes. Teachers provide practical feedback on exercises and projects to help students improve step by step.",
        ];

  return (
    <section
      id="teachers"
      className="bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] pb-16"
    >
      <div className="mx-auto max-w-[1536px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-white">
          <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 text-center sm:py-10">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
              {page.titleBefore}{" "}
              <span className="text-teal-500">{page.titleHighlight}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">
              {page.subtitle}
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {statCards.map((stat) => (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  key={stat.label}
                >
                  <div className="mx-auto flex min-h-[48px] w-[180px] items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-black text-primary-700">
                        {stat.value}
                      </p>
                      <p className="whitespace-nowrap text-xs font-bold text-slate-500">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-8">
          <div className="min-w-0">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
              <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 shadow-sm">
                <Search size={19} className="text-slate-400" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder={page.filters.search}
                    type="search"
                    value={search}
                    onChange={changeTeacherFilter(setSearch)}
                  />
                </label>
              <FilterSelect
                value={experienceFilter}
                onChange={changeTeacherFilter(setExperienceFilter)}
                options={experienceOptions}
              />
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="relative inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-teal-700 sm:col-span-2 lg:col-span-1"
              >
                <SlidersHorizontal size={17} />
                {isFa ? "فیلتر مدرسان" : "Filter teachers"}
                {advancedFilterCount > 0 ? (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-teal-400 px-1.5 text-xs text-slate-950">
                    {advancedFilterCount}
                  </span>
                ) : null}
              </button>
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
                  aria-labelledby="teacher-filter-title"
                  className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                      <h2 id="teacher-filter-title" className="text-xl font-black text-slate-950">
                        {isFa ? "فیلتر مدرسان" : "Filter teachers"}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {isFa
                          ? `${Number(teacherMeta?.total || 0)} مدرس مطابق فیلتر شما`
                          : `${Number(teacherMeta?.total || 0)} teachers match your filters`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      aria-label={isFa ? "بستن" : "Close"}
                      className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "زبان تدریس" : "Teaching language"}
                        </span>
                        <FilterSelect
                          value={teacherLanguage}
                          onChange={changeTeacherFilter(setTeacherLanguage)}
                          options={languageOptions}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "حوزه تخصص" : "Expertise area"}
                        </span>
                        <FilterSelect
                          value={expertise}
                          onChange={changeTeacherFilter(setExpertise)}
                          options={expertiseOptions}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "سطح تدریس" : "Teaching level"}
                        </span>
                        <FilterSelect
                          value={teachingLevel}
                          onChange={changeTeacherFilter(setTeachingLevel)}
                          options={teachingLevelOptions}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "کشور" : "Country"}
                        </span>
                        <FilterSelect
                          value={country}
                          onChange={changeTeacherFilter(setCountry)}
                          options={countryOptions}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "حداقل تجربه" : "Minimum experience"}
                        </span>
                        <FilterSelect
                          value={minExperience}
                          onChange={changeTeacherFilter(setMinExperience)}
                          options={[
                            { value: "all", label: isFa ? "هر مقدار تجربه" : "Any experience" },
                            { value: "1", label: isFa ? "حداقل ۱ سال" : "1+ years" },
                            { value: "3", label: isFa ? "حداقل ۳ سال" : "3+ years" },
                            { value: "5", label: isFa ? "حداقل ۵ سال" : "5+ years" },
                            { value: "10", label: isFa ? "حداقل ۱۰ سال" : "10+ years" },
                          ]}
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black text-slate-600">
                          {isFa ? "ویدیوی معرفی" : "Introduction video"}
                        </span>
                        <FilterSelect
                          value={introVideo}
                          onChange={changeTeacherFilter(setIntroVideo)}
                          options={[
                            { value: "all", label: isFa ? "همه مدرسان" : "All teachers" },
                            { value: "yes", label: isFa ? "دارای ویدیوی معرفی" : "Has intro video" },
                            { value: "no", label: isFa ? "بدون ویدیوی معرفی" : "No intro video" },
                          ]}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex sm:justify-end sm:px-6">
                    <button
                      type="button"
                      onClick={resetTeacherFilters}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <RotateCcw size={15} />
                      {isFa ? "پاک‌کردن" : "Clear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-black text-white transition hover:bg-teal-700"
                    >
                      {isFa
                        ? `نمایش ${Number(teacherMeta?.total || 0)} مدرس`
                        : `Show ${Number(teacherMeta?.total || 0)} teachers`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              id="teacher-results"
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              {filteredTeachers.map((teacher, index) => (
                <div
                  key={teacher._id || teacher.name}
                  className="w-full"
                >
                  <TeacherCard labels={page} teacher={teacher} index={index} />
                </div>
              ))}
            </div>

            {loading ? (
              <FrontendPageLoader
                label={isFa ? "در حال بارگذاری مدرسان" : "Loading teachers"}
                minHeight="min-h-[180px]"
                className="mt-4"
              />
            ) : null}

            {!loading && !filteredTeachers.length ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-bold text-slate-600">
                {t.meta.lang === "fa"
                  ? "هیچ مدرسی برای نمایش یافت نشد."
                  : "No teachers found to display."}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            {teacherPage < teacherTotalPages ? (
              <div className="mt-7 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setTeacherPage((previous) => previous + 1);
                  }}
                  className="inline-flex h-12 min-w-48 items-center justify-center rounded-xl border border-primary-500 bg-white px-6 text-sm font-black text-primary-700 transition hover:bg-primary-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading
                    ? isFa
                      ? "در حال بارگذاری"
                      : "Loading"
                    : isFa
                      ? `نمایش ${MOBILE_BATCH_SIZE} مورد بیشتر`
                      : `Show ${MOBILE_BATCH_SIZE} more`}
                </button>
              </div>
            ) : null}

          </div>

          <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
            <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
              <h2 className="text-xl font-black text-slate-950">
                {page.sidebarTitle}
              </h2>
              <div className="mt-6 space-y-5">
                {page.benefits.map((benefit, index) => {
                  const Icon = benefitIcons[index];
                  return (
                    <div className="flex gap-4" key={benefit.title}>
                      <div
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                          index % 2 === 0
                            ? "bg-primary-50 text-primary-700"
                            : "bg-teal-50 text-teal-700"
                        }`}
                      >
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-950">
                          {benefit.title}
                        </h3>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          {benefit.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
                <h2 className="mb-4 text-xl font-black text-primary-700">
                  {page.faqTitle}
                </h2>
                <div className="space-y-2">
                  {page.faqs.map((faq, index) => {
                    const question = typeof faq === "string" ? faq : faq?.q || "";
                    const answer =
                      typeof faq === "string"
                        ? faqFallbackAnswers[index] || (t.meta.lang === "fa" ? "پاسخ این سوال به‌زودی اضافه می‌شود." : "This answer will be added soon.")
                        : faq?.a || (t.meta.lang === "fa" ? "پاسخ این سوال به‌زودی اضافه می‌شود." : "This answer will be added soon.");
                    const isOpen = openFaqIndex === index;

                    return (
                      <div key={`${question}-${index}`} className="rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenFaqIndex((prev) => (prev === index ? null : index))
                          }
                          className="flex w-full items-center justify-between px-4 py-3 text-start text-sm font-bold text-slate-800 transition hover:bg-primary-50/40"
                        >
                          {question}
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen ? (
                          <div className="border-t border-slate-100 px-4 py-3 text-sm leading-7 text-slate-600">
                            {answer}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-black text-slate-950">
              {page.becomeTitle}
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              {page.becomeText}
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-black text-white shadow-glow transition hover:bg-primary-700"
            >
              <UsersRound size={17} />
              {page.becomeButton}
            </Link>
          </section>
          </div>
        </div>
    </section>
  );
}
