import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  GraduationCap,
  UserX,
  UserCheck,
  Search,
  Plus,
  Download,
  Trash2,
  SquarePen,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ExternalLink,
  FileText,
  Star,
  Languages,
  Award,
  Video,
  Link as LinkIcon,
  Clock,
  BadgeCheck,
  Phone,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import {
  clearAdminPageCache,
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";
import { getToken } from "../../services/portal.js";

const PAGE_SIZE = 30;
const FALLBACK_STATS = {
  totalTeachers: 0,
  activeTeachers: 0,
  blockedTeachers: 0,
};
const ADMIN_TEACHERS_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_TEACHERS_REQUEST_GUARD_TTL_MS = 15 * 1000;
const ADMIN_TEACHERS_STATS_CACHE_KEY = getAdminPageCacheKey("teachers-stats");
const recentTeachersRequestKeys = new Map();
const DEFAULT_TEACHERS_LIST_CACHE_KEY = getAdminPageCacheKey("teachers-list", {
  page: 1,
  search: "",
  statusFilter: "all",
  applicationStatusFilter: "all",
});
const getAdminTeachersListCacheKey = ({ page, search, statusFilter, applicationStatusFilter }) =>
  getAdminPageCacheKey("teachers-list", {
    page,
    search,
    statusFilter,
    applicationStatusFilter,
  });
const getAdminTeacherDetailsCacheKey = (teacherId) =>
  getAdminPageCacheKey("teacher-details", { teacherId });

const PAGE_TEXT = {
  "Teacher operations": "عملیات مدرسان",
  "Track teacher profiles, application progress, account health, and approvals from one clear workspace.":
    "پروفایل مدرسان، روند درخواست، وضعیت حساب و تاییدها را از یک فضای کاری روشن مدیریت کنید.",
  "Total teachers": "مجموع مدرسان",
  "Active teachers": "مدرسان فعال",
  "Blocked teachers": "مدرسان مسدود",
  "All teacher accounts in the platform": "همه حساب‌های مدرسان در پلتفرم",
  "Teachers with access and active status": "مدرسانی که دسترسی و وضعیت فعال دارند",
  "Teachers blocked by the system": "مدرسانی که توسط سیستم مسدود شده‌اند",
  "Teacher directory": "فهرست مدرسان",
  "Search by name, email, or phone and review every teacher from one table.":
    "با نام، ایمیل یا شماره تماس جستجو کنید و هر مدرس را از یک جدول بررسی کنید.",
  "Search name, email, or phone": "جستجوی نام، ایمیل یا شماره تماس",
  "All statuses": "همه وضعیت‌ها",
  "All applications": "همه درخواست‌ها",
  "Add teacher": "افزودن مدرس",
  Teacher: "مدرس",
  Contact: "راه تماس",
  Expertise: "تخصص",
  Application: "درخواست",
  Status: "وضعیت",
  Joined: "تاریخ عضویت",
  Actions: "اقدام‌ها",
  Active: "فعال",
  Blocked: "مسدود",
  Submitted: "ارسال‌شده",
  Approved: "تاییدشده",
  Rejected: "ردشده",
  Draft: "پیش‌نویس",
  "Application status": "وضعیت درخواست",
  Unknown: "نامشخص",
  "No title yet": "هنوز عنوانی ثبت نشده",
  years: "سال",
  "No teachers found for the current filters.": "برای فیلترهای فعلی مدرسی پیدا نشد.",
  "Loading teachers": "در حال بارگذاری مدرسان",
  "View details": "مشاهده جزئیات",
  "Edit teacher": "ویرایش مدرس",
  "Block teacher": "مسدود کردن مدرس",
  "Activate teacher": "فعال‌سازی مدرس",
  "Delete teacher": "حذف مدرس",
  "Review application": "بررسی درخواست",
  Documents: "اسناد",
  Links: "لینک‌ها",
  Experience: "تجربه",
  "Create teacher": "ایجاد مدرس",
  "Create a teacher account with the email address they will use to sign in.":
    "یک حساب مدرس با همان ایمیلی ایجاد کنید که برای ورود استفاده خواهد شد.",
  "Teacher email": "ایمیل مدرس",
  "Contract date": "تاریخ قرارداد",
  "Contract end date": "تاریخ پایان قرارداد",
  "Valid until": "اعتبار تا",
  "Contract date & time": "تاریخ قرارداد",
  "Valid until date & time": "اعتبار تا",
  "Leave the valid date empty if this teacher account should not expire automatically.":
    "اگر این حساب مدرس نباید خودکار منقضی شود، تاریخ اعتبار را خالی بگذارید.",
  "Contract valid date must be on or after the contract date.":
    "تاریخ اعتبار باید برابر یا بعد از تاریخ قرارداد باشد.",
  "Teacher details": "جزئیات مدرس",
  "Teacher activity": "فعالیت مدرس",
  "Related courses": "کورس‌های مرتبط",
  "Total courses": "مجموع کورس‌ها",
  "Active courses": "کورس‌های فعال",
  "Published courses": "کورس‌های منتشرشده",
  "Completed courses": "کورس‌های ختم‌شده",
  "Unique students": "شاگردان یکتا",
  "Active students": "شاگردان فعال",
  "Total enrollments": "مجموع ثبت‌نام‌ها",
  Students: "شاگرد",
  "Course start date": "تاریخ شروع کورس",
  "Course end date": "تاریخ پایان کورس",
  "No related courses yet.": "هنوز کورس مرتبطی ثبت نشده است.",
  "Application overview": "نمای کلی درخواست",
  "Teacher profile": "پروفایل مدرس",
  "Application form": "فورم درخواست",
  "Expertise profile": "پروفایل تخصص",
  "Review timeline": "زمان‌بندی بررسی",
  "Review note": "یادداشت بررسی",
  "Provided links": "لینک‌های ارائه‌شده",
  "Professional summary": "خلاصه حرفه‌ای",
  "Teacher bio": "زندگی‌نامه مدرس",
  Motivation: "انگیزه",
  "Country / City": "کشور / شهر",
  "Years of experience": "سال‌های تجربه",
  "Teaching languages": "زبان‌های تدریس",
  "Skills & expertise": "مهارت‌ها و تخصص‌ها",
  "Intro video for students": "ویدیوی معرفی برای شاگردان",
  "View video": "دیدن ویدیو",
  Portfolio: "پورتفولیو",
  "Full name": "نام کامل",
  "Province / State": "ولایت / ایالت",
  "Professional title": "عنوان حرفه‌ای",
  Education: "تحصیلات",
  "Expertise areas": "زمینه‌های تخصص",
  "Teaching levels": "سطوح تدریس",
  Languages: "زبان‌ها",
  "Certification notes": "یادداشت‌های تصدیق‌نامه",
  "Skill ratings": "امتیاز مهارت‌ها",
  Reviewed: "بررسی‌شده",
  Close: "بستن",
  Open: "باز کردن",
  Download: "دانلود",
  "Approve profile": "تایید پروفایل",
  "Reject profile": "رد پروفایل",
  "No uploaded PDFs yet.": "هنوز فایل PDF بارگذاری نشده است.",
  "No portfolio, video, LinkedIn, or GitHub link provided.":
    "هنوز لینک پورتفولیو، ویدیو، لینکدین یا گیت‌هاب ارائه نشده است.",
  "No teacher bio provided.": "هنوز زندگی‌نامه مدرس ثبت نشده است.",
  "No motivation statement provided.": "هنوز متن انگیزه ثبت نشده است.",
  "Teacher application": "درخواست مدرس",
  Name: "نام",
  Email: "ایمیل",
  Phone: "شماره تماس",
  Cancel: "انصراف",
  Create: "ایجاد",
  Save: "ذخیره",
  "Name and email are required.": "نام و ایمیل الزامی است.",
  "Email is required.": "ایمیل الزامی است.",
  "Teacher details not found": "جزئیات مدرس پیدا نشد",
  "Failed to fetch teachers list.": "گرفتن فهرست مدرسان ناموفق بود.",
  "Failed to fetch teacher statistics": "گرفتن آمار مدرسان ناموفق بود.",
  "Failed to fetch teacher details": "گرفتن جزئیات مدرس ناموفق بود",
  "Failed to update teacher status": "به‌روزرسانی وضعیت مدرس ناموفق بود",
  "Failed to delete teacher": "حذف مدرس ناموفق بود",
  "Failed to review teacher application": "بررسی درخواست مدرس ناموفق بود",
  "Failed to update teacher": "به‌روزرسانی مدرس ناموفق بود",
  "Unable to open teacher details": "باز کردن جزئیات مدرس ممکن نشد",
  "Unable to update teacher status": "به‌روزرسانی وضعیت مدرس ممکن نشد",
  "Unable to delete teacher": "حذف مدرس ممکن نشد",
  "Unable to review teacher application": "بررسی درخواست مدرس ممکن نشد",
  "Unable to update teacher": "به‌روزرسانی مدرس ممکن نشد",
  "Unable to create teacher": "ایجاد مدرس ممکن نشد",
  Showing: "نمایش",
  to: "تا",
  of: "از",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const shouldSkipRecentTeachersRequest = (key) => {
  const now = Date.now();
  const lastTime = Number(recentTeachersRequestKeys.get(key) || 0);
  if (lastTime && now - lastTime < ADMIN_TEACHERS_REQUEST_GUARD_TTL_MS) {
    return true;
  }
  recentTeachersRequestKeys.set(key, now);
  return false;
};

const formatNumber = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(Number(value || 0));

const formatDate = (value, language = "en") => {
  if (!value) return "-";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    if (language === "fa") {
      return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
};

const formatDateOnly = (value, language = "en") => {
  if (!value) return "-";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    if (language === "fa") {
      return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const formatPlainNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);

const getFileName = (value = "") => {
  const normalized = String(value || "").split("?")[0];
  const filename = normalized.split("/").filter(Boolean).pop();
  return filename ? decodeURIComponent(filename) : "Document";
};

const getPublicFileUrl = (value = "") => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^https?:\/\//i.test(rawValue) || rawValue.startsWith("data:")) return rawValue;

  const apiOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/api$/i, "");
  const normalizedPath = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;

  return `${apiOrigin}${normalizedPath}`;
};

const isLikelyUrl = (value = "") => /^https?:\/\//i.test(String(value || "").trim());

const mapStatusToLabel = (status, pageTr) =>
  status === "active" ? pageTr("Active") : pageTr("Blocked");
const mapApplicationStatusToLabel = (status, pageTr) => {
  if (status === "submitted") return pageTr("Submitted");
  if (status === "approved") return pageTr("Approved");
  if (status === "rejected") return pageTr("Rejected");
  return pageTr("Draft");
};

const buildApplicationDocuments = (application = {}) => {
  const documents = [];

  if (application.cvUrl) {
    documents.push({
      label: "CV / Resume",
      href: getPublicFileUrl(application.cvUrl),
      fileName: getFileName(application.cvUrl),
    });
  }

  const certificateFiles = [
    ...(Array.isArray(application.certifications)
      ? application.certifications.filter((item) => String(item || "").trim().startsWith("/uploads/"))
      : []),
    application.certificatesFileUrl,
  ].filter(Boolean);

  certificateFiles.forEach((fileUrl, index) => {
    documents.push({
      label: `Certificate ${index + 1}`,
      href: getPublicFileUrl(fileUrl),
      fileName: getFileName(fileUrl),
    });
  });

  return documents;
};

const buildApplicationLinks = (application = {}) =>
  [
    { label: "Portfolio", href: application.portfolioUrl, icon: LinkIcon },
    { label: "Intro video", href: application.introVideoUrl, icon: Video },
  ].filter((item) => isLikelyUrl(item.href));

const buildTeacherSocialLinks = (teacher = {}) =>
  [
    { label: "LinkedIn", href: teacher?.socialLinks?.linkedin, icon: LinkIcon },
    { label: "GitHub", href: teacher?.socialLinks?.github, icon: LinkIcon },
  ].filter((item) => isLikelyUrl(item.href));

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage, "...", totalPages];
};

export default function AdminTeachersPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const initialStatsCache = readAdminPageCache(ADMIN_TEACHERS_STATS_CACHE_KEY, {
    maxAgeMs: ADMIN_TEACHERS_CACHE_TTL_MS,
  });
  const initialTeachersCache = readAdminPageCache(DEFAULT_TEACHERS_LIST_CACHE_KEY, {
    maxAgeMs: ADMIN_TEACHERS_CACHE_TTL_MS,
  });
  const [dashboardStats, setDashboardStats] = useState(initialStatsCache || FALLBACK_STATS);
  const [teachers, setTeachers] = useState(
    Array.isArray(initialTeachersCache?.teachers) ? initialTeachersCache.teachers : [],
  );
  const [isLoading, setIsLoading] = useState(!initialTeachersCache);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherContractDate, setNewTeacherContractDate] = useState("");
  const [newTeacherValidUntil, setNewTeacherValidUntil] = useState("");
  const [createTeacherError, setCreateTeacherError] = useState("");
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTeacherError, setEditTeacherError] = useState("");
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editTeacherForm, setEditTeacherForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "active",
    contractStartDate: "",
    contractValidUntil: "",
  });
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: Number(initialTeachersCache?.pagination?.page) || 1,
    limit: Number(initialTeachersCache?.pagination?.limit) || PAGE_SIZE,
    totalUsers: Number(initialTeachersCache?.pagination?.totalUsers) || 0,
    totalPages: Number(initialTeachersCache?.pagination?.totalPages) || 1,
  });
  const statsRequest = useLatestRequest();
  const teachersRequest = useLatestRequest();
  const lastStatsRequestKeyRef = useRef("");
  const lastTeachersRequestKeyRef = useRef("");

  useEffect(() => {
    const fetchDashboardStats = async () => {
      const cached = readAdminPageCache(ADMIN_TEACHERS_STATS_CACHE_KEY, {
        maxAgeMs: ADMIN_TEACHERS_CACHE_TTL_MS,
      });
      if (cached) {
        setDashboardStats(cached);
        if (refreshKey === 0) {
          return;
        }
      }

      const requestKey = `teachers-stats:${refreshKey}`;
      if (lastStatsRequestKeyRef.current === requestKey) {
        return;
      }
      if (shouldSkipRecentTeachersRequest(requestKey)) {
        return;
      }
      lastStatsRequestKeyRef.current = requestKey;
      await statsRequest.runLatest(async () => {
        const apiUrl = getApiBase();
        const requestConfig = {
          headers: buildAuthHeaders(),
        };

        const [dashboardRes, activeRes, blockedRes] = await Promise.all([
          fetch(`${apiUrl}/admin/dashboard`, requestConfig),
          fetch(`${apiUrl}/admin/users?role=teacher&status=active&page=1&limit=1`, requestConfig),
          fetch(`${apiUrl}/admin/users?role=teacher&status=blocked&page=1&limit=1`, requestConfig),
        ]);

        if (!dashboardRes.ok || !activeRes.ok || !blockedRes.ok) {
          throw new Error("Failed to fetch teacher statistics");
        }

        return Promise.all([
          dashboardRes.json(),
          activeRes.json(),
          blockedRes.json(),
        ]);
      }, {
        onSuccess: ([dashboardData, activeData, blockedData]) => {
          const nextStats = {
            totalTeachers: Number(dashboardData?.stats?.totalTeachers) || 0,
            activeTeachers: Number(activeData?.pagination?.totalUsers) || 0,
            blockedTeachers: Number(blockedData?.pagination?.totalUsers) || 0,
          };
          setDashboardStats(nextStats);
          writeAdminPageCache(ADMIN_TEACHERS_STATS_CACHE_KEY, nextStats);
        },
        onError: (error) => {
          console.error("Error fetching teacher statistics:", error);
        },
      });
    };

    fetchDashboardStats();
  }, [refreshKey, statsRequest]);

  useEffect(() => {
    const fetchTeachers = async () => {
      const cacheKey = getAdminTeachersListCacheKey({
        page,
        search: debouncedSearch,
        statusFilter,
        applicationStatusFilter,
      });
      const cached = readAdminPageCache(cacheKey, {
        maxAgeMs: ADMIN_TEACHERS_CACHE_TTL_MS,
      });
      if (cached) {
        setTeachers(Array.isArray(cached.teachers) ? cached.teachers : []);
        setPagination(cached.pagination || { page: 1, limit: PAGE_SIZE, totalUsers: 0, totalPages: 1 });
        setIsLoading(false);
        setErrorMessage("");
        if (refreshKey === 0) {
          return;
        }
      } else {
        setIsLoading(true);
        setErrorMessage("");
      }

      const requestKey = JSON.stringify({
        page,
        search: debouncedSearch,
        statusFilter,
        applicationStatusFilter,
        refreshKey,
      });
      if (lastTeachersRequestKeyRef.current === requestKey) {
        return;
      }
      if (shouldSkipRecentTeachersRequest(`teachers-list:${requestKey}`)) {
        return;
      }
      lastTeachersRequestKeyRef.current = requestKey;

      await teachersRequest.runLatest(async () => {
        const apiUrl = getApiBase();
        const query = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (statusFilter !== "all") {
          query.set("status", statusFilter);
        }

        if (applicationStatusFilter !== "all") {
          query.set("applicationStatus", applicationStatusFilter);
        }

        if (debouncedSearch) {
          query.set("search", debouncedSearch);
        }

        const response = await fetch(`${apiUrl}/admin/teachers?${query.toString()}`, {
          headers: buildAuthHeaders(),
        });
        return parseJsonResponse(response);
      }, {
        onSuccess: (data) => {
          const mappedTeachers = (data?.teachers || []).map((teacher) => {
          const emailPrefix = teacher.email?.split("@")[0] || "teacher";
          const application = teacher?.teacherApplication || {};
          const documents = buildApplicationDocuments(application);
          const links = buildApplicationLinks(application);
          const socialLinks = buildTeacherSocialLinks(teacher);
          return {
            id: teacher._id,
            name: teacher.name || "-",
            username: `@${emailPrefix}`,
            specialty: application.professionalTitle || "",
            email: teacher.email || "-",
            phone: teacher.phone || "-",
            avatarUrl: getPublicFileUrl(teacher.avatar || ""),
            apiStatus: teacher.status,
            contractStartDate: teacher.contractStartDate || null,
            contractValidUntil: teacher.contractValidUntil || null,
            apiApplicationStatus: String(
              teacher?.teacherApplication?.status || "draft",
            ),
            application,
            documentCount: documents.length,
            linkCount: links.length + socialLinks.length,
            yearsExperience: Number(application.yearsExperience || 0),
            createdAt: teacher.createdAt || null,
          };
        });

          setTeachers(mappedTeachers);
          const nextPagination = {
            page: Number(data?.pagination?.page) || 1,
            limit: Number(data?.pagination?.limit) || PAGE_SIZE,
            totalUsers:
              Number(data?.pagination?.totalTeachers ?? data?.pagination?.totalUsers) || 0,
            totalPages: Number(data?.pagination?.totalPages) || 1,
          };
          setPagination(nextPagination);
          writeAdminPageCache(cacheKey, {
            teachers: mappedTeachers,
            pagination: nextPagination,
          });
        },
        onError: (error) => {
          console.error("Error fetching teachers:", error);
          setTeachers([]);
          setPagination({ page: 1, limit: PAGE_SIZE, totalUsers: 0, totalPages: 1 });
          setErrorMessage(error.message || pageTr("Failed to fetch teachers list."));
        },
        onFinally: () => {
          setIsLoading(false);
        },
      });
    };

    fetchTeachers();
  }, [applicationStatusFilter, debouncedSearch, page, refreshKey, statusFilter, teachersRequest]);

  const statsCards = useMemo(
    () => [
      {
        title: pageTr("Total teachers"),
        value: formatNumber(dashboardStats.totalTeachers, language),
        icon: Users,
        tone: "bg-blue-50 text-blue-700",
      },
      {
        title: pageTr("Active teachers"),
        value: formatNumber(dashboardStats.activeTeachers, language),
        icon: GraduationCap,
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        title: pageTr("Blocked teachers"),
        value: formatNumber(dashboardStats.blockedTeachers, language),
        icon: UserX,
        tone: "bg-rose-50 text-rose-700",
      },
    ],
    [dashboardStats, language, pageTr],
  );

  const getStatusStyle = (status) => {
    return status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-rose-50 text-rose-700 border-rose-200";
  };

  const getApplicationStatusStyle = (status) => {
    if (status === "submitted") return "bg-amber-50 text-amber-600 border-amber-200";
    if (status === "approved") return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (status === "rejected") return "bg-rose-50 text-rose-600 border-rose-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const loadTeacherDetails = async (teacherId) => {
    const cacheKey = getAdminTeacherDetailsCacheKey(teacherId);
    const cached = readAdminPageCache(cacheKey, {
      maxAgeMs: ADMIN_TEACHERS_CACHE_TTL_MS,
    });
    if (cached) return cached;

    const apiUrl = getApiBase();
    const token = getToken();
    const response = await fetch(`${apiUrl}/admin/teachers/${teacherId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || pageTr("Failed to fetch teacher details"));
    }

    const teacher = data?.teacher
      ? {
          ...data.teacher,
          teacherInsights: data?.teacherInsights || {
            totalCoursesCount: 0,
            activeCoursesCount: 0,
            completedCoursesCount: 0,
            publishedCoursesCount: 0,
            uniqueStudentsCount: 0,
            uniqueActiveStudentsCount: 0,
            totalEnrollmentsCount: 0,
            relatedCourses: [],
          },
        }
      : null;
    writeAdminPageCache(cacheKey, teacher);
    return teacher;
  };

  const handleViewTeacher = async (teacherId) => {
    try {
      setActionLoadingId(teacherId);
      const teacher = await loadTeacherDetails(teacherId);
      if (!teacher) {
        throw new Error(pageTr("Teacher details not found"));
      }
      setSelectedTeacher(teacher);
      setIsDetailsOpen(true);
    } catch (error) {
      alert(error.message || pageTr("Unable to open teacher details"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleToggleTeacherStatus = async (teacher) => {
    const nextStatus = teacher.apiStatus === "blocked" ? "active" : "blocked";
    const confirmText =
      nextStatus === "blocked"
        ? `Block teacher ${teacher.name}?`
        : `Activate teacher ${teacher.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      setActionLoadingId(teacher.id);
      const apiUrl = getApiBase();
      const token = getToken();
      const response = await fetch(`${apiUrl}/admin/teachers/${teacher.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || pageTr("Failed to update teacher status"));
      }

      clearAdminPageCache("admin:teachers");
      clearAdminPageCache(getAdminTeacherDetailsCacheKey(teacher.id));
      setSelectedTeacher((prev) =>
        prev?._id === teacher.id ? { ...prev, status: nextStatus } : prev,
      );
      setEditingTeacher((prev) =>
        prev?.id === teacher.id ? { ...prev, apiStatus: nextStatus } : prev,
      );
      setEditTeacherForm((prev) => ({ ...prev, status: nextStatus }));
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      alert(error.message || pageTr("Unable to update teacher status"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (!window.confirm(`Delete teacher ${teacher.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingId(teacher.id);
      const apiUrl = getApiBase();
      const token = getToken();
      const response = await fetch(`${apiUrl}/admin/teachers/${teacher.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || pageTr("Failed to delete teacher"));
      }

      clearAdminPageCache("admin:teachers");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      alert(error.message || pageTr("Unable to delete teacher"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleReviewTeacherApplication = async (teacherId, decision) => {
    const note =
      decision === "rejected"
        ? window.prompt("Rejection reason:", "Please complete required profile fields.") || ""
        : window.prompt("Approval note (optional):", "") || "";

    try {
      setActionLoadingId(teacherId);
      const apiUrl = getApiBase();
      const token = getToken();
      const response = await fetch(`${apiUrl}/admin/teachers/${teacherId}/application-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || pageTr("Failed to review teacher application"));
      }

      clearAdminPageCache("admin:teachers");
      setRefreshKey((prev) => prev + 1);
      const teacher = await loadTeacherDetails(teacherId);
      setSelectedTeacher(teacher);
    } catch (error) {
      alert(error.message || pageTr("Unable to review teacher application"));
    } finally {
      setActionLoadingId("");
    }
  };

  const openEditTeacherModal = (teacher) => {
    setEditingTeacher(teacher);
    setEditTeacherError("");
    setEditTeacherForm({
      name: teacher.name || "",
      email: teacher.email || "",
      phone: teacher.phone || "",
      status: teacher.apiStatus || "active",
      contractStartDate: toDateInputValue(teacher.contractStartDate),
      contractValidUntil: toDateInputValue(teacher.contractValidUntil),
    });
    setIsEditModalOpen(true);
  };

  const handleEditTeacherSubmit = async (event) => {
    event.preventDefault();

    if (!editingTeacher?.id) {
      setEditTeacherError("Teacher ID is missing.");
      return;
    }

    if (!editTeacherForm.name.trim() || !editTeacherForm.email.trim()) {
      setEditTeacherError(pageTr("Name and email are required."));
      return;
    }

    if (
      editTeacherForm.contractStartDate &&
      editTeacherForm.contractValidUntil &&
      new Date(editTeacherForm.contractValidUntil) < new Date(editTeacherForm.contractStartDate)
    ) {
      setEditTeacherError(pageTr("Contract valid date must be on or after the contract date."));
      return;
    }

    setIsSavingTeacher(true);
    setEditTeacherError("");

    try {
      const apiUrl = getApiBase();
      const token = getToken();
      const response = await fetch(`${apiUrl}/admin/teachers/${editingTeacher.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editTeacherForm.name.trim(),
          email: editTeacherForm.email.trim().toLowerCase(),
          phone: editTeacherForm.phone.trim(),
          status: editTeacherForm.status,
          contractStartDate: editTeacherForm.contractStartDate || null,
          contractValidUntil: editTeacherForm.contractValidUntil || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || pageTr("Failed to update teacher"));
      }

      const updatedTeacher = data?.teacher || null;
      setIsEditModalOpen(false);
      clearAdminPageCache("admin:teachers");
      clearAdminPageCache(getAdminTeacherDetailsCacheKey(editingTeacher.id));
      if (updatedTeacher?._id) {
        setSelectedTeacher((prev) =>
          prev?._id === updatedTeacher._id
            ? {
                ...prev,
                ...updatedTeacher,
                teacherInsights: prev?.teacherInsights ?? null,
              }
            : prev,
        );
      }
      setEditingTeacher(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setEditTeacherError(error.message || pageTr("Unable to update teacher"));
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const paginationItems = getPaginationItems(pagination.page, pagination.totalPages);

  const startItem = pagination.totalUsers === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.totalUsers);

  const handleCreateTeacher = async (event) => {
    event.preventDefault();
    setCreateTeacherError("");

    if (!newTeacherEmail.trim()) {
      setCreateTeacherError(pageTr("Email is required."));
      return;
    }

    if (
      newTeacherContractDate &&
      newTeacherValidUntil &&
      new Date(newTeacherValidUntil) < new Date(newTeacherContractDate)
    ) {
      setCreateTeacherError(pageTr("Contract valid date must be on or after the contract date."));
      return;
    }

    setIsCreatingTeacher(true);

    try {
      const apiUrl = getApiBase();
      const token = getToken();

      const response = await fetch(`${apiUrl}/admin/teachers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: newTeacherEmail.trim().toLowerCase(),
          contractStartDate: newTeacherContractDate || null,
          contractValidUntil: newTeacherValidUntil || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || pageTr("Unable to create teacher"));
      }

      setNewTeacherEmail("");
      setNewTeacherContractDate("");
      setNewTeacherValidUntil("");
      setIsCreateModalOpen(false);
      setPage(1);
      clearAdminPageCache("admin:teachers");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setCreateTeacherError(error.message || pageTr("Unable to create teacher"));
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">{pageTr("Teacher operations")}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">{t("pages.teachers.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Track teacher profiles, application progress, account health, and approvals from one clear workspace.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setCreateTeacherError("");
                setNewTeacherEmail("");
                setNewTeacherContractDate("");
                setNewTeacherValidUntil("");
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-blue-50"
            >
              <Plus size={16} />
              {pageTr("Add teacher")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-nowrap gap-4">
        {statsCards.map((card) => (
          <article key={card.title} className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{card.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Teacher directory")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by name, email, or phone and review every teacher from one table.")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(180px,0.4fr))]">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setPage(1);
              }}
              placeholder={pageTr("Search name, email, or phone")}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All statuses")}</option>
            <option value="active">{pageTr("Active")}</option>
            <option value="blocked">{pageTr("Blocked")}</option>
          </select>

          <select
            value={applicationStatusFilter}
            onChange={(event) => {
              setApplicationStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All applications")}</option>
            <option value="draft">{pageTr("Draft")}</option>
            <option value="submitted">{pageTr("Submitted")}</option>
            <option value="approved">{pageTr("Approved")}</option>
            <option value="rejected">{pageTr("Rejected")}</option>
          </select>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Teacher")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Email")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Joined")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Contract end date")}</th>
                <th className="px-5 py-4 text-center font-bold text-slate-500">{pageTr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading teachers")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No teachers found for the current filters.")}
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="align-middle transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <TeacherAvatar
                          name={teacher.name}
                          avatarUrl={teacher.avatarUrl}
                          className="h-11 w-11 rounded-2xl"
                          fallbackClassName="rounded-2xl bg-slate-100 font-bold text-slate-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{teacher.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="truncate font-semibold text-slate-700" dir="ltr">{teacher.email}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex min-h-[44px] flex-col justify-center">
                        <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black ${getStatusStyle(teacher.apiStatus)}`}>
                          {mapStatusToLabel(teacher.apiStatus, pageTr)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle font-semibold text-slate-600">
                      <span className="whitespace-nowrap">{formatDate(teacher.createdAt, language)}</span>
                    </td>
                    <td className="px-5 py-4 align-middle font-semibold text-slate-600">
                      <span className="whitespace-nowrap">
                        {formatDate(teacher.contractValidUntil, language)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewTeacher(teacher.id)}
                          disabled={actionLoadingId === teacher.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("View details")}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTeacherModal(teacher)}
                          disabled={actionLoadingId === teacher.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("Edit teacher")}
                        >
                          <SquarePen size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTeacherStatus(teacher)}
                          disabled={actionLoadingId === teacher.id}
                          className={`rounded-xl p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            teacher.apiStatus === "blocked"
                              ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                              : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                          }`}
                          title={teacher.apiStatus === "blocked" ? pageTr("Activate teacher") : pageTr("Block teacher")}
                        >
                          {teacher.apiStatus === "blocked" ? <UserCheck size={18} /> : <UserX size={18} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(teacher)}
                          disabled={actionLoadingId === teacher.id}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={pageTr("Delete teacher")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">
            {pageTr("Showing")} <span className="text-slate-950">{formatNumber(startItem, language)}</span> {pageTr("to")}{" "}
            <span className="text-slate-950">{formatNumber(endItem, language)}</span> {pageTr("of")}{" "}
            <span className="text-slate-950">{formatNumber(pagination.totalUsers, language)}</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {paginationItems.map((pageItem, idx) => {
              if (pageItem === "...") {
                return (
                  <span key={`dots-${idx}`} className="px-2 text-sm font-bold text-slate-400">
                    ...
                  </span>
                );
              }

              const itemPage = Number(pageItem);
              const isActivePage = itemPage === pagination.page;

              return (
                <button
                  key={`page-${itemPage}`}
                  type="button"
                  onClick={() => setPage(itemPage)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition ${
                    isActivePage
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {formatNumber(itemPage, language)}
                </button>
              );
            })}
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
      </section>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
                  {pageTr("Create teacher")}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-800">{pageTr("Create teacher")}</h3>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {pageTr("Create a teacher account with the email address they will use to sign in.")}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Teacher email")}</label>
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(event) => setNewTeacherEmail(event.target.value)}
                  placeholder="teacher@edutech.com"
                  className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  dir="ltr"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Contract date & time")}</label>
                  <input
                    type="date"
                    value={newTeacherContractDate}
                    onChange={(event) => setNewTeacherContractDate(event.target.value)}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Valid until date & time")}</label>
                  <input
                    type="date"
                    value={newTeacherValidUntil}
                    min={newTeacherContractDate || undefined}
                    onChange={(event) => setNewTeacherValidUntil(event.target.value)}
                    className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />
                </div>
              </div>

              <p className="text-xs font-semibold leading-6 text-slate-500">
                {pageTr("Leave the valid date empty if this teacher account should not expire automatically.")}
              </p>

              {createTeacherError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-600">
                  {createTeacherError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {pageTr("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTeacher}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingTeacher ? "..." : pageTr("Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditModalOpen && editingTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="max-h-[90vh] overflow-hidden [direction:ltr]">
              <div className="max-h-[90vh] overflow-y-auto [direction:ltr]">
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <div className="border-b border-slate-200 bg-white">
                    <div className="bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] px-6 py-6 text-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <TeacherAvatar
                            name={editingTeacher.name}
                            avatarUrl={editingTeacher.avatarUrl || ""}
                            className="h-14 w-14 rounded-2xl ring-1 ring-white/15"
                            fallbackClassName="rounded-2xl bg-white/12 text-lg font-bold text-slate-50"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-50/80">
                              {pageTr("Edit teacher")}
                            </p>
                            <h3 className="mt-2 truncate text-2xl font-extrabold text-slate-50">
                              {editingTeacher.name || "-"}
                            </h3>
                            <p className="mt-1 truncate text-sm font-normal text-slate-100/85" dir="ltr">
                              {editingTeacher.email || "-"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setIsEditModalOpen(false);
                            setEditingTeacher(null);
                          }}
                          className="rounded-xl bg-white/10 p-2 text-slate-50 transition hover:bg-white/16"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleEditTeacherSubmit} className="p-6">
                    <div className="space-y-6">
                      <div className="grid gap-3 md:grid-cols-4">
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Status")}</p>
                          <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${getStatusStyle(editTeacherForm.status)}`}>
                            {mapStatusToLabel(editTeacherForm.status, pageTr)}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Joined")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {formatDate(editingTeacher.createdAt, language)}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Contract date & time")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {formatDateOnly(editTeacherForm.contractStartDate, language)}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Valid until date & time")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {formatDateOnly(editTeacherForm.contractValidUntil, language)}
                          </p>
                        </article>
                      </div>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Teacher profile")}</h4>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Name")}</label>
                            <input
                              type="text"
                              value={editTeacherForm.name}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                              required
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Email")}</label>
                            <input
                              type="email"
                              value={editTeacherForm.email}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({ ...prev, email: event.target.value }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                              dir="ltr"
                              required
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Phone")}</label>
                            <input
                              type="text"
                              value={editTeacherForm.phone}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({ ...prev, phone: event.target.value }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                              dir="ltr"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Status")}</label>
                            <select
                              value={editTeacherForm.status}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({ ...prev, status: event.target.value }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                            >
                              <option value="active">{pageTr("Active")}</option>
                              <option value="blocked">{pageTr("Blocked")}</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Contract date & time")}</label>
                            <input
                              type="date"
                              value={editTeacherForm.contractStartDate}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({
                                  ...prev,
                                  contractStartDate: event.target.value,
                                }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700">{pageTr("Valid until date & time")}</label>
                            <input
                              type="date"
                              value={editTeacherForm.contractValidUntil}
                              min={editTeacherForm.contractStartDate || undefined}
                              onChange={(event) =>
                                setEditTeacherForm((prev) => ({
                                  ...prev,
                                  contractValidUntil: event.target.value,
                                }))
                              }
                              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                            />
                          </div>
                        </div>
                      </section>

                      {editTeacherError ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">
                          {editTeacherError}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditModalOpen(false);
                            setEditingTeacher(null);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          {pageTr("Cancel")}
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingTeacher}
                          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSavingTeacher ? "Saving" : pageTr("Save")}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDetailsOpen && selectedTeacher
        ? (() => {
            const application = selectedTeacher.teacherApplication || {};
            const teacherInsights = selectedTeacher.teacherInsights || {};
            const applicationStatusRaw = String(application.status || "draft");
            const applicationStatus = mapApplicationStatusToLabel(applicationStatusRaw, pageTr);
            const documents = buildApplicationDocuments(application);
            const externalLinks = buildApplicationLinks(application);
            const socialLinks = buildTeacherSocialLinks(selectedTeacher);
            const allProvidedLinks = [...externalLinks, ...socialLinks];
            const avatarUrl = selectedTeacher.avatar ? getPublicFileUrl(selectedTeacher.avatar) : "";
            const relatedCourses = Array.isArray(teacherInsights.relatedCourses)
              ? teacherInsights.relatedCourses
              : [];
            const certificationNotes = Array.isArray(application.certifications)
              ? application.certifications.filter(
                  (item) => !String(item || "").trim().startsWith("/uploads/"),
                )
              : [];

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
                <div className="w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
                  <div className="max-h-[90vh] overflow-hidden [direction:ltr]">
                    <div className="max-h-[90vh] overflow-y-auto [direction:ltr]">
                      <div dir={isRTL ? "rtl" : "ltr"}>
                        <div className="border-b border-slate-200 bg-white">
                          <div className="bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] px-6 py-6 text-slate-50">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-4">
                                <TeacherAvatar
                                  name={selectedTeacher.name}
                                  avatarUrl={avatarUrl}
                                  className="h-14 w-14 rounded-2xl ring-1 ring-white/15"
                                  fallbackClassName="rounded-2xl bg-white/12 text-lg font-bold text-slate-50"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-50/80">{pageTr("Teacher details")}</p>
                                  <h3 className="mt-2 truncate text-2xl font-extrabold text-slate-50">{selectedTeacher.name || "-"}</h3>
                                  <p className="mt-1 truncate text-sm font-normal text-slate-100/85" dir="ltr">{selectedTeacher.email || "-"}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDetailsOpen(false);
                                  setSelectedTeacher(null);
                                }}
                                className="rounded-xl bg-white/10 p-2 text-slate-50 transition hover:bg-white/16"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="space-y-6">
                            <div className="grid gap-3 md:grid-cols-4">
                              <article className="border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Status")}</p>
                                <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusStyle(selectedTeacher.status)}`}>
                                  {mapStatusToLabel(selectedTeacher.status, pageTr)}
                                </p>
                              </article>
                              <article className="border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Application")}</p>
                                <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getApplicationStatusStyle(applicationStatusRaw)}`}>
                                  {applicationStatus}
                                </p>
                              </article>
                              <article className="border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Role")}</p>
                                <p className="mt-2 text-sm font-bold text-slate-700">{selectedTeacher.role || "-"}</p>
                              </article>
                              <article className="border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{pageTr("Joined")}</p>
                                <p className="mt-2 text-sm font-bold text-slate-700">{formatDate(selectedTeacher.createdAt, language)}</p>
                              </article>
                            </div>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <h4 className="text-base font-extrabold text-slate-800">{pageTr("Teacher profile")}</h4>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <InfoRow label={pageTr("Full name")} value={selectedTeacher.name} />
                                <InfoRow label={pageTr("Email")} value={selectedTeacher.email} dir="ltr" />
                                <InfoRow label={pageTr("Phone")} value={selectedTeacher.phone} dir="ltr" />
                                <InfoRow
                                  label={pageTr("Contract date & time")}
                                  value={formatDateOnly(selectedTeacher.contractStartDate, language)}
                                />
                                <InfoRow
                                  label={pageTr("Valid until date & time")}
                                  value={formatDateOnly(selectedTeacher.contractValidUntil, language)}
                                />
                                <InfoRow
                                  label={pageTr("Country / City")}
                                  value={[selectedTeacher.country, selectedTeacher.city].filter(Boolean).join(" / ")}
                                />
                              </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <h4 className="text-base font-extrabold text-slate-800">{pageTr("Teacher activity")}</h4>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <StatTile
                                  label={pageTr("Total courses")}
                                  value={formatNumber(teacherInsights.totalCoursesCount || 0, language)}
                                  tone="blue"
                                />
                                <StatTile
                                  label={pageTr("Active courses")}
                                  value={formatNumber(teacherInsights.activeCoursesCount || 0, language)}
                                  tone="emerald"
                                />
                                <StatTile
                                  label={pageTr("Completed courses")}
                                  value={formatNumber(teacherInsights.completedCoursesCount || 0, language)}
                                  tone="violet"
                                />
                                <StatTile
                                  label={pageTr("Unique students")}
                                  value={formatNumber(teacherInsights.uniqueStudentsCount || 0, language)}
                                  tone="amber"
                                />
                                <StatTile
                                  label={pageTr("Active students")}
                                  value={formatNumber(teacherInsights.uniqueActiveStudentsCount || 0, language)}
                                  tone="emerald"
                                />
                                <StatTile
                                  label={pageTr("Total enrollments")}
                                  value={formatNumber(teacherInsights.totalEnrollmentsCount || 0, language)}
                                  tone="blue"
                                />
                              </div>

                              <div className="mt-6">
                                <h5 className="text-sm font-extrabold text-slate-800">{pageTr("Related courses")}</h5>
                                {relatedCourses.length ? (
                                  <div className="mt-3 space-y-3">
                                    {relatedCourses.map((course) => (
                                      <div
                                        key={course.id}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                                      >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-800">
                                              {course.title || "-"}
                                            </p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getApplicationStatusStyle(course.status)}`}>
                                                {course.status || "-"}
                                              </span>
                                              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                                                {formatNumber(course.enrolledStudentsCount || 0, language)} {pageTr("Students")}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2 lg:min-w-[260px]">
                                            <span>{pageTr("Course start date")}: {formatDate(course.startDate, language)}</span>
                                            <span>{pageTr("Course end date")}: {formatDate(course.endDate, language)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm font-bold text-slate-600">
                                    {pageTr("No related courses yet.")}
                                  </p>
                                )}
                              </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                              <h4 className="text-base font-extrabold text-slate-800">{pageTr("Application overview")}</h4>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                  {pageTr("Submitted")} {formatDate(application.submittedAt, language)}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <StatTile label={pageTr("Documents")} value={formatNumber(documents.length, language)} tone="blue" />
                                <StatTile label={pageTr("Links")} value={formatNumber(allProvidedLinks.length, language)} tone="emerald" />
                                <StatTile label={pageTr("Experience")} value={`${formatPlainNumber(application.yearsExperience)} ${pageTr("years")}`} tone="violet" />
                              </div>

                              <div className="mt-6 space-y-6">
                                <div className="space-y-6">
                                  <div>
                                    <h5 className="text-sm font-extrabold text-slate-800">{pageTr("Application form")}</h5>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <InfoRow label={pageTr("Professional title")} value={application.professionalTitle || pageTr("Teacher application")} />
                                      <InfoRow label={pageTr("Years of experience")} value={`${formatPlainNumber(application.yearsExperience || 0)} ${pageTr("years")}`} />
                                      <InfoRow label={pageTr("Education")} value={application.education} />
                                      <InfoRow label={pageTr("National ID")} value={application.nationalId} />
                                    </div>
                                  </div>

                                  <div>
                                    <h5 className="text-sm font-extrabold text-slate-800">{pageTr("Expertise profile")}</h5>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      <TagGroup
                                        label={pageTr("Teaching languages")}
                                        items={application.languages || []}
                                        tone="violet"
                                      />
                                      <TagGroup
                                        label={pageTr("Expertise areas")}
                                        items={application.expertiseAreas || []}
                                        tone="blue"
                                      />
                                      <TagGroup
                                        label={pageTr("Teaching levels")}
                                        items={application.teachingLevels || []}
                                        tone="emerald"
                                      />
                                      <TagGroup
                                        label={pageTr("Certification notes")}
                                        items={certificationNotes}
                                        tone="amber"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <h5 className="text-sm font-extrabold text-slate-800">{pageTr("Skills & expertise")}</h5>
                                    {Array.isArray(application.skillRatings) && application.skillRatings.length ? (
                                      <div className="mt-3 space-y-3">
                                        {application.skillRatings.map((skill, index) => {
                                          const percentage = Math.max(
                                            0,
                                            Math.min(100, Number(skill?.percentage || 0)),
                                          );

                                          return (
                                            <div
                                              key={`${skill?.name || "skill"}-${index}`}
                                              className="rounded-2xl bg-slate-50 px-4 py-3"
                                            >
                                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                <span>{skill?.name || "-"}</span>
                                                <span>{percentage}%</span>
                                              </div>
                                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                  className="h-full rounded-full bg-primary-600"
                                                  style={{ width: `${percentage}%` }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm font-bold text-slate-900">-</p>
                                    )}
                                  </div>

                                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                                    <h5 className="text-sm font-black text-slate-900">{pageTr("Teacher bio")}</h5>
                                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                                      {selectedTeacher.bio || pageTr("No teacher bio provided.")}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                                    <h5 className="text-sm font-black text-slate-900">{pageTr("Motivation")}</h5>
                                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">
                                      {application.motivation || pageTr("No motivation statement provided.")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <h4 className="text-base font-black text-slate-950">{pageTr("Documents")}</h4>
                              <div className="mt-4 space-y-3">
                                {documents.length ? (
                                  documents.map((document) => (
                                    <div key={`${document.label}-${document.href}`} className="border border-slate-200 bg-slate-50 px-4 py-3">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                          <p className="truncate font-black text-slate-900">{document.label}</p>
                                          <p className="mt-1 truncate text-xs font-semibold text-slate-700">{document.fileName}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <a
                                            href={document.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                                          >
                                            <ExternalLink size={14} />
                                            {pageTr("Open")}
                                          </a>
                                          <a
                                            href={document.href}
                                            download
                                            className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-primary-700"
                                          >
                                            <Download size={14} />
                                            {pageTr("Download")}
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm font-semibold text-slate-800">{pageTr("No uploaded PDFs yet.")}</p>
                                )}
                              </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <h4 className="text-base font-black text-slate-950">{pageTr("Provided links")}</h4>
                              <div className="mt-4 space-y-3">
                                {allProvidedLinks.length ? (
                                  allProvidedLinks.map((link) => (
                                    <a
                                      key={`${link.label}-${link.href}`}
                                      href={link.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <link.icon size={16} className="shrink-0" />
                                        <span className="truncate">{link.label}</span>
                                      </span>
                                      <ExternalLink size={15} className="shrink-0" />
                                    </a>
                                  ))
                                ) : (
                                  <p className="text-sm font-semibold text-slate-800">
                                    {pageTr("No portfolio, video, LinkedIn, or GitHub link provided.")}
                                  </p>
                                )}
                              </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5 shadow-sm">
                              <h4 className="text-base font-black text-slate-950">{pageTr("Review timeline")}</h4>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Submitted")}</p>
                                  <p className="mt-1 text-sm font-bold text-slate-900">{formatDate(application.submittedAt, language)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Reviewed")}</p>
                                  <p className="mt-1 text-sm font-bold text-slate-900">{formatDate(application.reviewedAt, language)}</p>
                                </div>
                              </div>
                              {application.reviewNote ? (
                                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">{pageTr("Review note")}</p>
                                  <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{application.reviewNote}</p>
                                </div>
                              ) : null}
                            </section>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailsOpen(false);
                          setSelectedTeacher(null);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        {pageTr("Close")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewTeacherApplication(selectedTeacher._id, "rejected")}
                        disabled={actionLoadingId === selectedTeacher._id}
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pageTr("Reject profile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewTeacherApplication(selectedTeacher._id, "approved")}
                        disabled={actionLoadingId === selectedTeacher._id}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pageTr("Approve profile")}
                      </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        : null}
    </div>
  );
}

function InfoRow({ label, value, dir }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900" dir={dir || undefined}>
        {value || "-"}
      </p>
    </div>
  );
}

function StatTile({ label, value, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone] || "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TagGroup({ label, items = [], tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone] || "bg-slate-50 text-slate-700";

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`rounded-full px-3 py-1 text-xs font-bold ${toneClass}`}>
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm font-semibold text-slate-500">-</span>
        )}
      </div>
    </div>
  );
}

function TeacherAvatar({
  name,
  avatarUrl,
  className = "h-10 w-10 rounded-full",
  fallbackClassName = "rounded-full bg-slate-100 font-black text-slate-700",
}) {
  const [hasError, setHasError] = useState(false);
  const initial = (String(name || "-").trim().charAt(0) || "-").toUpperCase();

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Teacher"}
        className={`shrink-0 object-cover ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center ${className} ${fallbackClassName}`}>
      {initial}
    </div>
  );
}
