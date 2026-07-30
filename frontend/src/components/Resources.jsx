import { useEffect, useMemo, useState } from "react";
import {
  Folder,
  FileText,
  PlaySquare,
  Headphones,
  Image as ImageIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import ResourceStatsCard from "./ResourceStatsCard.jsx";
import ResourceFilterBar from "./ResourceFilterBar.jsx";
import ResourceTable from "./ResourceTable.jsx";
import ResourcePreviewModal from "./ResourcePreviewModal.jsx";
import { fetchStudentResources } from "../../services/courseService.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import {
  getApiBase,
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";

const mockStudent = {
  id: "",
  nameFa: "",
  email: "",
  avatar: "",
};

const ITEMS_PER_PAGE = 3;
const ALL_COURSES = "__all_courses__";
const ALL_TYPES = "__all_types__";
const SORT_NEWEST = "newest";
const SORT_OLDEST = "oldest";
const SORT_MOST_DOWNLOADED = "most_downloaded";
const SORT_NAME = "name";

const formatAddedDate = (value, locale, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatAddedTime = (value, locale, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const resolveResourceUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) {
    try {
      return `${new URL(getApiBase()).origin}${value}`;
    } catch {
      return value;
    }
  }
  return "";
};

const isEndedCourseResource = (row = {}) =>
  Boolean(row?.classEndedAt || row?.course?.classEndedAt || row?.courseId?.classEndedAt);

export default function Resources({ language = "fa" }) {
  const isFa = language === "fa";
  const locale = isFa ? "fa-AF" : "en-US";
  const t = {
    unknownDate: isFa ? "نامشخص" : "Unknown",
    unknownTime: "—",
    allCourses: isFa ? "همه کورس‌ها" : "All Courses",
    allTypes: isFa ? "همه انواع" : "All Types",
    sortNewest: isFa ? "جدیدترین" : "Newest",
    sortOldest: isFa ? "قدیمی‌ترین" : "Oldest",
    sortMostDownloaded: isFa ? "بیشترین دانلود" : "Most Downloaded",
    sortName: isFa ? "نام فایل" : "File Name",
    statsAllTitle: isFa ? "همه منابع" : "All Resources",
    statsAllSubtitle: isFa ? "از تمام کورس‌ها" : "From all courses",
    statsTextTitle: isFa ? "مقالات و جزوه‌ها" : "Articles & Notes",
    statsTextSubtitle: isFa ? "فایل متنی" : "Text files",
    statsVideoTitle: isFa ? "ویدیوها" : "Videos",
    statsVideoSubtitle: isFa ? "فایل ویدیویی" : "Video files",
    statsAudioTitle: isFa ? "فایل‌های صوتی" : "Audio Files",
    statsAudioSubtitle: isFa ? "فایل صوتی" : "Audio files",
    statsOtherTitle: isFa ? "تصاویر و دیگر" : "Images & Others",
    statsOtherSubtitle: isFa ? "فایل" : "Files",
    downloadSoon: isFa
      ? "دانلود فایل \"%s\" به زودی فعال می‌شود"
      : "Download for \"%s\" will be available soon.",
    dashboard: isFa ? "داشبورد" : "Dashboard",
    resources: isFa ? "منابع درسی" : "Resources",
    subtitle: isFa
      ? "به تمام منابع و مواد آموزشی کورس‌های خود دسترسی داشته باشید."
      : "Access all learning materials and resources for your courses.",
    loading: isFa ? "در حال دریافت منابع" : "Loading resources",
    prev: isFa ? "قبلی" : "Previous",
    next: isFa ? "بعدی" : "Next",
    emptyTitle: isFa ? "منبعی یافت نشد" : "No resources found",
    emptySubtitle: isFa
      ? "با این فیلترها فایل یا منبعی پیدا نشد."
      : "No files or resources matched these filters.",
    loadErrorFa: "بارگذاری منابع درسی انجام نشد.",
  };

  const user = getAuthUser() || mockStudent;
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const navigate = useNavigate();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState(ALL_COURSES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [sortFilter, setSortFilter] = useState(SORT_NEWEST);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals State
  const [previewResource, setPreviewResource] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadResources = async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await fetchStudentResources();
        if (!mounted) return;
        const mapped = (Array.isArray(rows) ? rows : [])
          .filter((row) => !isEndedCourseResource(row))
          .map((row, index) => ({
            ...row,
            id:
              row.id ||
              row._id ||
              `${String(row.course || "resource")}-${String(row.title || "file")}-${index}`,
            size: row.size || "-",
            type: row.type || "PDF",
            addedDate: formatAddedDate(row.addedAt, locale, t.unknownDate),
            addedTime: formatAddedTime(row.addedAt, locale, t.unknownTime),
            url: resolveResourceUrl(row.url),
            addedAt: row.addedAt || null,
          }));
        setResources(mapped);
      } catch (err) {
        if (!mounted) return;
        if (isUnauthorizedError(err)) {
          setAuthNotice("Not authorized for this resource");
          clearAuth();
          setIsRedirecting(true);
          navigate("/login", { replace: true });
          return;
        }
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            t.loadErrorFa,
            "Failed to load resources.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadResources();
    return () => {
      mounted = false;
    };
  }, [language, locale, navigate, refreshSeed, t.loadErrorFa, t.unknownDate, t.unknownTime]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  const courseOptions = useMemo(
    () => [ALL_COURSES, ...new Set(resources.map((r) => r.course).filter(Boolean))],
    [resources],
  );
  const typeOptions = useMemo(
    () => [ALL_TYPES, ...new Set(resources.map((r) => r.type).filter(Boolean))],
    [resources],
  );
  const sortOptions = useMemo(
    () => [
      { value: SORT_NEWEST, label: t.sortNewest },
      { value: SORT_OLDEST, label: t.sortOldest },
      { value: SORT_MOST_DOWNLOADED, label: t.sortMostDownloaded },
      { value: SORT_NAME, label: t.sortName },
    ],
    [t.sortMostDownloaded, t.sortName, t.sortNewest, t.sortOldest],
  );
  const courseOptionsWithLabel = useMemo(
    () =>
      courseOptions.map((value) => ({
        value,
        label: value === ALL_COURSES ? t.allCourses : value,
      })),
    [courseOptions, t.allCourses],
  );
  const typeOptionsWithLabel = useMemo(
    () =>
      typeOptions.map((value) => ({
        value,
        label: value === ALL_TYPES ? t.allTypes : value,
      })),
    [typeOptions, t.allTypes],
  );

  const filteredResources = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    const rows = resources.filter((res) => {
      const matchCourse = courseFilter === ALL_COURSES || res.course === courseFilter;
      const matchType = typeFilter === ALL_TYPES || res.type === typeFilter;
      const matchSearch =
        !q ||
        String(res.title || "").toLowerCase().includes(q) ||
        String(res.description || "").toLowerCase().includes(q) ||
        String(res.course || "").toLowerCase().includes(q);
      return matchCourse && matchType && matchSearch;
    });

    const sorted = [...rows];
    if (sortFilter === SORT_OLDEST) {
      sorted.sort(
        (a, b) => new Date(a.addedAt || 0).getTime() - new Date(b.addedAt || 0).getTime(),
      );
    } else if (sortFilter === SORT_NAME) {
      sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), locale));
    } else if (sortFilter === SORT_MOST_DOWNLOADED) {
      sorted.sort((a, b) => {
        const aDownloads = Number(a.downloadCount ?? a.downloads ?? 0);
        const bDownloads = Number(b.downloadCount ?? b.downloads ?? 0);
        return bDownloads - aDownloads;
      });
    } else {
      sorted.sort(
        (a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime(),
      );
    }

    return sorted;
  }, [resources, searchQuery, courseFilter, typeFilter, sortFilter, locale]);

  const stats = useMemo(() => {
    const textCount = resources.filter((r) => ["PDF", "DOCX"].includes(r.type)).length;
    const videoCount = resources.filter((r) => ["MP4", "Video"].includes(r.type)).length;
    const audioCount = resources.filter((r) => r.type === "MP3").length;
    const imageOtherCount = resources.length - textCount - videoCount - audioCount;

    return [
      {
        title: t.statsAllTitle,
        value: resources.length,
        subtitle: t.statsAllSubtitle,
        icon: Folder,
        colorClass: "bg-purple-50 text-purple-600",
      },
      {
        title: t.statsTextTitle,
        value: textCount,
        subtitle: t.statsTextSubtitle,
        icon: FileText,
        colorClass: "bg-green-50 text-green-600",
      },
      {
        title: t.statsVideoTitle,
        value: videoCount,
        subtitle: t.statsVideoSubtitle,
        icon: PlaySquare,
        colorClass: "bg-orange-50 text-orange-600",
      },
      {
        title: t.statsAudioTitle,
        value: audioCount,
        subtitle: t.statsAudioSubtitle,
        icon: Headphones,
        colorClass: "bg-blue-50 text-blue-600",
      },
      {
        title: t.statsOtherTitle,
        value: Math.max(0, imageOtherCount),
        subtitle: t.statsOtherSubtitle,
        icon: ImageIcon,
        colorClass: "bg-teal-50 text-teal-600",
      },
    ];
  }, [
    resources,
    t.statsAllSubtitle,
    t.statsAllTitle,
    t.statsAudioSubtitle,
    t.statsAudioTitle,
    t.statsOtherSubtitle,
    t.statsOtherTitle,
    t.statsTextSubtitle,
    t.statsTextTitle,
    t.statsVideoSubtitle,
    t.statsVideoTitle,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredResources.length / ITEMS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedResources = filteredResources.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE,
  );

  const handleDownload = (res) => {
    if (res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
      return;
    }
    alert(t.downloadSoon.replace("%s", res.title));
  };

  const handleSearchQuery = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCourseFilter = (value) => {
    setCourseFilter(value);
    setCurrentPage(1);
  };

  const handleTypeFilter = (value) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handleSortFilter = (value) => {
    setSortFilter(value);
    setCurrentPage(1);
  };

  if (isRedirecting) return null;

  return (
    <StudentLayout
      language={language}
      user={user}
      searchQuery={searchQuery}
      setSearchQuery={handleSearchQuery}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link
          className="transition hover:text-primary-700"
          to="/student/dashboard"
        >
          {t.dashboard}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{t.resources}</span>
      </div>

      {/* Header */}
      <div className="mb-8 px-1 sm:px-0">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{t.resources}</h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat, idx) => (
          <ResourceStatsCard key={idx} {...stat} />
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="min-w-0 flex flex-col gap-6">
        {/* Resources List */}
        <div className="min-w-0 flex flex-col gap-6">
          <ResourceFilterBar
            searchQuery={searchQuery}
            setSearchQuery={handleSearchQuery}
            courseFilter={courseFilter}
            setCourseFilter={handleCourseFilter}
            typeFilter={typeFilter}
            setTypeFilter={handleTypeFilter}
            sortFilter={sortFilter}
            setSortFilter={handleSortFilter}
            courseOptions={courseOptionsWithLabel}
            typeOptions={typeOptionsWithLabel}
            sortOptions={sortOptions}
            language={language}
          />
          {error ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              <p>{error}</p>
              <button type="button" onClick={() => setRefreshSeed((value) => value + 1)} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black ring-1 ring-rose-200">
                {isFa ? "تلاش دوباره" : "Try again"}
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
              <h3 className="text-xl font-black text-slate-900">
                {t.loading}
              </h3>
            </div>
          ) : error ? null : filteredResources.length > 0 ? (
            <>
              <ResourceTable
                resources={paginatedResources}
                onPreview={setPreviewResource}
                onDownload={handleDownload}
                language={language}
              />
              {totalPages > 1 ? (
                <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                      disabled={activePage === 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t.prev}
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`h-9 min-w-9 rounded-lg px-3 text-xs font-black transition ${
                            activePage === page
                              ? "bg-primary-600 text-white"
                              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                      disabled={activePage === totalPages}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t.next}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                <Folder size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {t.emptyTitle}
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {t.emptySubtitle}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="h-8" aria-hidden="true" />

      {/* Modals */}
      <ResourcePreviewModal
        isOpen={!!previewResource}
        onClose={() => setPreviewResource(null)}
        resource={previewResource}
        onDownload={handleDownload}
        language={language}
      />
    </StudentLayout>
  );
}
