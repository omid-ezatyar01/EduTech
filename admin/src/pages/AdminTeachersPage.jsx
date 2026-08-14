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
  Video,
  Link as LinkIcon,
  Clock,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { useSearchParams } from "react-router";
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
const ADMIN_TEACHERS_STATS_CACHE_KEY = getAdminPageCacheKey("teachers-stats");
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
  "Review submitted profile": "بررسی پروفایل ارسال‌شده",
  "A decision is waiting": "یک تصمیم در انتظار است",
  "Review the application, documents, links, and experience before making a decision.":
    "پیش از تصمیم‌گیری، درخواست، اسناد، لینک‌ها و تجربه مدرس را بررسی کنید.",
  "Approve teacher profile": "تایید پروفایل مدرس",
  "Reject teacher profile": "رد پروفایل مدرس",
  "Approve this application and give the teacher access to continue.":
    "این درخواست را تایید کنید تا مدرس بتواند ادامه دهد.",
  "Return this application with a clear reason the teacher can act on.":
    "این درخواست را با یک دلیل روشن و قابل اقدام برای مدرس بازگردانید.",
  "Review checklist": "فهرست بررسی",
  "I reviewed the profile, experience, documents, and provided links.":
    "پروفایل، تجربه، اسناد و لینک‌های ارائه‌شده را بررسی کرده‌ام.",
  "Approval note": "یادداشت تایید",
  "Optional note for this approval": "یادداشت اختیاری برای این تایید",
  "Rejection reason": "دلیل رد",
  "Explain what the teacher needs to fix before submitting again.":
    "توضیح دهید مدرس پیش از ارسال دوباره چه چیزی را باید اصلاح کند.",
  "A rejection reason is required.": "دلیل رد الزامی است.",
  "Notifications": "اعلان‌ها",
  "Notifications are optional. The profile can be approved without sending an announcement.":
    "اعلان‌ها اختیاری‌اند. پروفایل می‌تواند بدون ارسال اعلان تایید شود.",
  "Notification audience": "دریافت‌کنندگان اعلان",
  Everyone: "همه کاربران",
  Teachers: "مدرسان",
  Optional: "اختیاری",
  "Send web push": "ارسال اعلان وب",
  "Send Telegram announcement": "ارسال اعلان تلگرام",
  "No announcement selected": "هیچ اعلانی انتخاب نشده است",
  "The teacher will be approved without a public announcement.":
    "مدرس بدون اعلان عمومی تایید خواهد شد.",
  "Confirm approval": "تایید نهایی",
  "Confirm rejection": "تایید رد",
  "Application already reviewed": "درخواست قبلاً بررسی شده است",
  Documents: "اسناد",
  Links: "لینک‌ها",
  Experience: "تجربه",
  "Create teacher": "ایجاد مدرس",
  "Create a teacher account with the email address they will use to sign in.":
    "یک حساب مدرس با همان ایمیلی ایجاد کنید که برای ورود استفاده خواهد شد.",
  "Teacher created successfully": "حساب مدرس با موفقیت ایجاد شد",
  "Share these credentials with the teacher": "این اطلاعات ورود را با مدرس شریک کنید",
  "This temporary password is shown only once. Ask the teacher to change it after signing in.":
    "این رمز عبور موقت فقط یک بار نمایش داده می‌شود. از مدرس بخواهید پس از ورود آن را تغییر دهد.",
  "Sign-in email": "ایمیل ورود",
  "Temporary password": "رمز عبور موقت",
  "Copy password": "کپی رمز عبور",
  Copied: "کپی شد",
  "I have saved the password": "رمز عبور را ذخیره کردم",
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
  const isoDate = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1];
  if (isoDate) return isoDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatPlainNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);

const getFileName = (value = "") => {
  const normalized = String(value || "").split("?")[0];
  const filename = normalized.split("/").filter(Boolean).pop();
  if (!filename) return "Document";
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
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

  const certificateFiles = [...new Set([
    ...(Array.isArray(application.certifications)
      ? application.certifications.filter((item) =>
          /(?:\/uploads\/|\.pdf(?:$|[?#]))/i.test(String(item || "").trim()),
        )
      : []),
    application.certificatesFileUrl,
  ].map((item) => String(item || "").trim()).filter(Boolean))];

  certificateFiles.forEach((fileUrl, index) => {
    documents.push({
      label: `Certificate ${index + 1}`,
      href: getPublicFileUrl(fileUrl),
      fileName: getFileName(fileUrl),
    });
  });

  return documents;
};

const buildApplicationLinks = (application = {}) => {
  const rows = [
    { label: "Portfolio", href: application.portfolioUrl, icon: LinkIcon },
    { label: "Intro video", href: application.introVideoUrl, icon: Video },
    ...(Array.isArray(application.courseIntroVideoUrls)
      ? application.courseIntroVideoUrls.map((href, index) => ({
          label: `Course video ${index + 1}`,
          href,
          icon: Video,
        }))
      : []),
  ].filter((item) => isLikelyUrl(item.href));

  const seen = new Set();
  return rows.filter((item) => {
    const key = String(item.href).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildTeacherSocialLinks = (teacher = {}) =>
  [
    { label: "LinkedIn", href: teacher?.socialLinks?.linkedin, icon: LinkIcon },
    { label: "YouTube", href: teacher?.socialLinks?.youtube, icon: Video },
    { label: "Instagram", href: teacher?.socialLinks?.instagram, icon: LinkIcon },
    { label: "Facebook", href: teacher?.socialLinks?.facebook, icon: LinkIcon },
    { label: "WhatsApp", href: teacher?.socialLinks?.whatsapp, icon: LinkIcon },
    { label: "GitHub", href: teacher?.socialLinks?.github, icon: LinkIcon },
  ].filter((item) => isLikelyUrl(item.href));

const dedupeProvidedLinks = (rows = []) => {
  const seen = new Set();
  return rows.filter((item) => {
    const key = String(item?.href || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

const DEFAULT_APPROVAL_NOTIFICATION_PAYLOAD = {
  note: "",
  notificationAudience: "all",
  notificationChannels: {
    push: false,
    telegram: false,
  },
  confirmationChecked: false,
};

export default function AdminTeachersPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const [searchParams] = useSearchParams();
  const requestedSearch = searchParams.get("q") || "";
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
  const [searchText, setSearchText] = useState(requestedSearch);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherContractDate, setNewTeacherContractDate] = useState("");
  const [newTeacherValidUntil, setNewTeacherValidUntil] = useState("");
  const [createTeacherError, setCreateTeacherError] = useState("");
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [createdTeacherCredentials, setCreatedTeacherCredentials] = useState(null);
  const [didCopyTemporaryPassword, setDidCopyTemporaryPassword] = useState(false);
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
  const [teacherApprovalModal, setTeacherApprovalModal] = useState({
    open: false,
    teacherId: "",
    decision: "approved",
    payload: DEFAULT_APPROVAL_NOTIFICATION_PAYLOAD,
  });
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: Number(initialTeachersCache?.pagination?.page) || 1,
    limit: Number(initialTeachersCache?.pagination?.limit) || PAGE_SIZE,
    totalUsers: Number(initialTeachersCache?.pagination?.totalUsers) || 0,
    totalPages: Number(initialTeachersCache?.pagination?.totalPages) || 1,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchText(requestedSearch);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);
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
            linkCount: dedupeProvidedLinks([...links, ...socialLinks]).length,
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
  }, [applicationStatusFilter, debouncedSearch, page, pageTr, refreshKey, statusFilter, teachersRequest]);

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
    const data = await parseJsonResponse(response);

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

  const openTeacherReviewModal = (teacherId, decision) => {
    if (!teacherId) return;
    setTeacherApprovalModal({
      open: true,
      teacherId,
      decision,
      payload: DEFAULT_APPROVAL_NOTIFICATION_PAYLOAD,
    });
  };

  const closeTeacherApprovalModal = () => {
    setTeacherApprovalModal({
      open: false,
      teacherId: "",
      decision: "approved",
      payload: DEFAULT_APPROVAL_NOTIFICATION_PAYLOAD,
    });
  };

  const handleReviewTeacherApplication = async (teacherId, decision, options = {}) => {
    const note = String(options.note || "").trim();

    const notificationPayload = {
      notificationAudience: options.notificationAudience || "all",
      notificationChannels: {
        push: Boolean(options.notificationChannels?.push),
        telegram: Boolean(options.notificationChannels?.telegram),
      },
    };

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
          ...notificationPayload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || pageTr("Failed to review teacher application"));
      }

      clearAdminPageCache("admin:teachers");
      setRefreshKey((prev) => prev + 1);
      if (data?.teacher) {
        setSelectedTeacher((prev) => ({
          ...(prev || {}),
          ...data.teacher,
          teacherInsights: prev?.teacherInsights || {},
        }));
      }
      closeTeacherApprovalModal();
      try {
        const teacher = await loadTeacherDetails(teacherId);
        if (teacher) setSelectedTeacher(teacher);
      } catch (detailsError) {
        console.error("Teacher review succeeded, but refreshed details could not be loaded:", detailsError);
      }
    } catch (error) {
      alert(error.message || pageTr("Unable to review teacher application"));
    } finally {
      setActionLoadingId("");
    }
  };

  const handleTeacherReviewWithModal = async () => {
    if (!teacherApprovalModal.teacherId) return;
    if (!teacherApprovalModal.payload.confirmationChecked) {
      return;
    }

    if (teacherApprovalModal.decision === "rejected" && !teacherApprovalModal.payload.note.trim()) {
      return;
    }

    await handleReviewTeacherApplication(teacherApprovalModal.teacherId, teacherApprovalModal.decision, {
      note: teacherApprovalModal.payload.note,
      notificationAudience: teacherApprovalModal.payload.notificationAudience,
      notificationChannels:
        teacherApprovalModal.decision === "approved"
          ? teacherApprovalModal.payload.notificationChannels
          : { push: false, telegram: false },
    });
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

      const createdEmail = String(data?.teacher?.email || newTeacherEmail).trim();
      const temporaryPassword = String(data?.temporaryPassword || "").trim();

      setNewTeacherEmail("");
      setNewTeacherContractDate("");
      setNewTeacherValidUntil("");
      setIsCreateModalOpen(false);
      setDidCopyTemporaryPassword(false);
      setCreatedTeacherCredentials(
        temporaryPassword ? { email: createdEmail, temporaryPassword } : null,
      );
      setPage(1);
      clearAdminPageCache("admin:teachers");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setCreateTeacherError(error.message || pageTr("Unable to create teacher"));
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!createdTeacherCredentials?.temporaryPassword) return;

    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(createdTeacherCredentials.temporaryPassword);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = createdTeacherCredentials.temporaryPassword;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          copied = document.execCommand("copy");
        } finally {
          textarea.remove();
        }
      }

      if (!copied) throw new Error("Clipboard copy failed");
      setDidCopyTemporaryPassword(true);
    } catch {
      setDidCopyTemporaryPassword(false);
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
          <table className="min-w-[1120px] table-fixed text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700">
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Teacher")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Email")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Application")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Joined")}</th>
                <th className={`px-5 py-4 font-bold ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Contract end date")}</th>
                <th className="px-5 py-4 text-center font-bold text-slate-500">{pageTr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading teachers")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center font-bold text-slate-900">
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
                    <td className="px-5 py-4 align-middle">
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${getApplicationStatusStyle(teacher.apiApplicationStatus)}`}>
                        {teacher.apiApplicationStatus === "submitted" ? <Clock size={13} /> : null}
                        {mapApplicationStatusToLabel(teacher.apiApplicationStatus, pageTr)}
                      </span>
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
                          className={`rounded-xl p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            teacher.apiApplicationStatus === "submitted"
                              ? "bg-primary-50 text-primary-700 hover:bg-primary-100"
                              : "text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          }`}
                          title={
                            teacher.apiApplicationStatus === "submitted"
                              ? pageTr("Review application")
                              : pageTr("View details")
                          }
                        >
                          {teacher.apiApplicationStatus === "submitted" ? <BadgeCheck size={18} /> : <Eye size={18} />}
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

      {createdTeacherCredentials ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          dir={isRTL ? "rtl" : "ltr"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="created-teacher-credentials-title"
        >
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  {pageTr("Teacher created successfully")}
                </p>
                <h3
                  id="created-teacher-credentials-title"
                  className="mt-2 text-xl font-extrabold text-slate-800"
                >
                  {pageTr("Share these credentials with the teacher")}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  {pageTr("This temporary password is shown only once. Ask the teacher to change it after signing in.")}
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-4">
              <div>
                <dt className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {pageTr("Sign-in email")}
                </dt>
                <dd className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-slate-800" dir="ltr">
                  {createdTeacherCredentials.email}
                </dd>
              </div>
              <div>
                <dt className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {pageTr("Temporary password")}
                </dt>
                <dd className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdTeacherCredentials.temporaryPassword}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
                    dir="ltr"
                    aria-label={pageTr("Temporary password")}
                  />
                  <button
                    type="button"
                    onClick={copyTemporaryPassword}
                    className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
                  >
                    {didCopyTemporaryPassword ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                    {pageTr(didCopyTemporaryPassword ? "Copied" : "Copy password")}
                  </button>
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCreatedTeacherCredentials(null);
                  setDidCopyTemporaryPassword(false);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                {pageTr("I have saved the password")}
              </button>
            </div>
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
            const allProvidedLinks = dedupeProvidedLinks([...externalLinks, ...socialLinks]);
            const avatarUrl = selectedTeacher.avatar ? getPublicFileUrl(selectedTeacher.avatar) : "";
            const relatedCourses = Array.isArray(teacherInsights.relatedCourses)
              ? teacherInsights.relatedCourses
              : [];
            const certificationNotes = Array.isArray(application.certifications)
              ? application.certifications.filter(
                  (item) =>
                    !/(?:\/uploads\/|\.pdf(?:$|[?#]))/i.test(String(item || "").trim()),
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

                            {applicationStatusRaw === "submitted" ? (
                              <section className="flex flex-col gap-4 border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                                    <Clock size={19} />
                                  </span>
                                  <div>
                                    <p className="text-sm font-black text-amber-950">
                                      {pageTr("A decision is waiting")}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                                      {pageTr("Review the application, documents, links, and experience before making a decision.")}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">
                                  {pageTr("Review submitted profile")}
                                </span>
                              </section>
                            ) : null}

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
                      {applicationStatusRaw === "submitted" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openTeacherReviewModal(selectedTeacher._id, "rejected")}
                            disabled={actionLoadingId === selectedTeacher._id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <UserX size={17} />
                            {pageTr("Reject profile")}
                          </button>
                          <button
                            type="button"
                            onClick={() => openTeacherReviewModal(selectedTeacher._id, "approved")}
                            disabled={actionLoadingId === selectedTeacher._id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 size={17} />
                            {pageTr("Approve profile")}
                          </button>
                        </>
                      ) : (
                        <span className="self-center text-xs font-bold text-slate-500">
                          {pageTr("Application already reviewed")}
                        </span>
                      )}
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
      <TeacherReviewDecisionModal
        open={teacherApprovalModal.open}
        decision={teacherApprovalModal.decision}
        teacher={selectedTeacher}
        payload={teacherApprovalModal.payload}
        onChange={(updater) =>
          setTeacherApprovalModal((prev) => ({
            ...prev,
            payload: typeof updater === "function" ? updater(prev.payload) : updater,
          }))
        }
        onClose={closeTeacherApprovalModal}
        onConfirm={handleTeacherReviewWithModal}
        isSubmitting={actionLoadingId === teacherApprovalModal.teacherId}
        pageTr={pageTr}
        isRTL={isRTL}
        language={language}
      />
    </div>
  );
}

function TeacherReviewDecisionModal({
  open,
  decision,
  teacher,
  payload,
  onChange,
  onClose,
  onConfirm,
  isSubmitting,
  pageTr,
  isRTL,
  language,
}) {
  if (!open) return null;

  const isApproval = decision === "approved";
  const hasRejectionReason = Boolean(payload.note.trim());
  const canConfirm =
    payload.confirmationChecked && (isApproval || hasRejectionReason) && !isSubmitting;
  const sendsNotification =
    Boolean(payload.notificationChannels?.push) ||
    Boolean(payload.notificationChannels?.telegram);
  const application = teacher?.teacherApplication || {};

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      dir={isRTL ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-review-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[28px]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              isApproval ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}>
              {isApproval ? <BadgeCheck size={22} /> : <UserX size={22} />}
            </span>
            <div className="min-w-0">
              <h3 id="teacher-review-title" className="text-lg font-black text-slate-950 sm:text-xl">
                {pageTr(isApproval ? "Approve teacher profile" : "Reject teacher profile")}
              </h3>
              <p className="mt-1 truncate text-sm font-bold text-slate-500">
                {teacher?.name || teacher?.email || pageTr("Teacher")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={pageTr("Close")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className={`rounded-2xl border p-4 ${
            isApproval
              ? "border-emerald-100 bg-emerald-50/70"
              : "border-rose-100 bg-rose-50/70"
          }`}>
            <p className={`text-sm font-black ${isApproval ? "text-emerald-950" : "text-rose-950"}`}>
              {pageTr(
                isApproval
                  ? "Approve this application and give the teacher access to continue."
                  : "Return this application with a clear reason the teacher can act on.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">
                {pageTr("Experience")}: {formatNumber(application.yearsExperience || 0, language)} {pageTr("years")}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">
                {pageTr("Documents")}: {formatNumber(buildApplicationDocuments(application).length, language)}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">
                {pageTr("Submitted")}: {formatDateOnly(application.submittedAt, language)}
              </span>
            </div>
          </div>

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition ${
            payload.confirmationChecked
              ? isApproval
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
              : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}>
            <input
              type="checkbox"
              checked={Boolean(payload.confirmationChecked)}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, confirmationChecked: event.target.checked }))
              }
              className={`mt-0.5 h-5 w-5 shrink-0 ${isApproval ? "accent-emerald-600" : "accent-rose-600"}`}
            />
            <span>
              <span className="block text-sm font-black text-slate-900">{pageTr("Review checklist")}</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                {pageTr("I reviewed the profile, experience, documents, and provided links.")}
              </span>
            </span>
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-xs font-black text-slate-700">
                {pageTr(isApproval ? "Approval note" : "Rejection reason")}
              </label>
              {!isApproval ? (
                <span className="text-[11px] font-bold text-rose-600">{pageTr("A rejection reason is required.")}</span>
              ) : null}
            </div>
            <textarea
              value={payload.note}
              onChange={(event) => onChange((prev) => ({ ...prev, note: event.target.value }))}
              className={`min-h-[112px] w-full resize-y rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
                !isApproval && !hasRejectionReason
                  ? "border-rose-200 focus:border-rose-400 focus:ring-rose-500/10"
                  : "border-slate-200 focus:border-primary-500 focus:ring-primary-500/10"
              }`}
              placeholder={pageTr(
                isApproval
                  ? "Optional note for this approval"
                  : "Explain what the teacher needs to fix before submitting again.",
              )}
            />
          </div>

          {isApproval ? (
            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <BellRing size={18} className="mt-0.5 shrink-0 text-primary-600" />
                  <div>
                    <p className="text-sm font-black text-slate-900">{pageTr("Notifications")}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      {pageTr("Notifications are optional. The profile can be approved without sending an announcement.")}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                  sendsNotification ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {sendsNotification ? pageTr("Active") : pageTr("Optional")}
                </span>
              </div>

              <label className="mb-1.5 block text-xs font-black text-slate-700">
                {pageTr("Notification audience")}
              </label>
              <select
                value={payload.notificationAudience}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    notificationAudience: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-primary-500"
              >
                <option value="all">{pageTr("Everyone")}</option>
                <option value="students">{pageTr("Students")}</option>
                <option value="teachers">{pageTr("Teachers")}</option>
              </select>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  ["push", pageTr("Send web push")],
                  ["telegram", pageTr("Send Telegram announcement")],
                ].map(([channel, label]) => (
                  <label
                    key={channel}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-bold transition ${
                      payload.notificationChannels?.[channel]
                        ? "border-primary-200 bg-primary-50 text-primary-800"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(payload.notificationChannels?.[channel])}
                      onChange={(event) =>
                        onChange((prev) => ({
                          ...prev,
                          notificationChannels: {
                            ...prev.notificationChannels,
                            [channel]: event.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 accent-primary-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

              {!sendsNotification ? (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {pageTr("No announcement selected")}. {pageTr("The teacher will be approved without a public announcement.")}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {pageTr("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
              isApproval ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {isSubmitting ? (
              "..."
            ) : (
              <>
                {isApproval ? <CheckCircle2 size={17} /> : <UserX size={17} />}
                {pageTr(isApproval ? "Confirm approval" : "Confirm rejection")}
              </>
            )}
          </button>
        </div>
      </div>
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
  const [failedAvatarUrl, setFailedAvatarUrl] = useState("");
  const initial = (String(name || "-").trim().charAt(0) || "-").toUpperCase();

  if (avatarUrl && avatarUrl !== failedAvatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Teacher"}
        className={`shrink-0 object-cover ${className}`}
        onError={() => setFailedAvatarUrl(avatarUrl)}
      />
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center ${className} ${fallbackClassName}`}>
      {initial}
    </div>
  );
}
