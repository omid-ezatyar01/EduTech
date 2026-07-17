import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  ListChecks,
  ScanSearch,
  Search,
  XCircle,
  UploadCloud,
  Trash2,
  Plus,
  X,
  SquarePen,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  approveCourseCancellationRequest,
  approveCourseEndRequest,
  approveAdminCourse,
  createAdminCourse,
  deleteAdminCourse,
  fetchAdminCourseById,
  fetchAdminCourseSessions,
  fetchAdminCourses,
  fetchGoogleAuthUrl,
  fetchAdminTeachers,
  publishAdminCourse,
  rejectCourseCancellationRequest,
  rejectCourseEndRequest,
  rejectAdminCourse,
  updateAdminCourse,
  unpublishAdminCourse,
} from "../../services/courseService.js";
import { createAdminCategory, fetchAdminCategories } from "../../services/categoryService.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import {
  formatCategoryPathLabel,
  getParentCategories,
  getSubcategoriesForParent,
} from "../utils/categoryTree.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";

const statusOptions = ["all", "draft", "pending", "approved", "published", "rejected", "cancelled"];
const statusFilterOptions = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "draft" },
  { value: "pending", label: "pending" },
  { value: "approved", label: "approved" },
  { value: "published", label: "published" },
  { value: "rejected", label: "rejected" },
  { value: "cancelled", label: "cancelled" },
];
const PAGE_SIZE = 30;
const PAGE_TEXT = {
  "Course operations": "عملیات کورس‌ها",
  "Manage, approve, publish, and moderate all courses from one clear workspace.":
    "همه کورس‌ها را از یک فضای کاری روشن مدیریت، تایید، نشر و بررسی کنید.",
  Courses: "کورس‌ها",
  "Visible courses": "کورس‌های قابل نمایش",
  "Pending approval": "در انتظار تایید",
  Rejected: "ردشده",
  "Loaded this page": "موارد این صفحه",
  "Google connected": "گوگل متصل است",
  "Create Course": "ایجاد کورس",
  "Course directory": "فهرست کورس‌ها",
  "Search by course title and manage every course from one table.":
    "با عنوان کورس جستجو کنید و هر کورس را از یک جدول مدیریت کنید.",
  "Search by course title": "جستجو با عنوان کورس",
  "All Categories": "همه کتگوری‌ها",
  "All Statuses": "همه وضعیت‌ها",
  "All teachers": "همه مدرسان",
  "All pricing": "همه قیمت‌گذاری‌ها",
  Paid: "پولی",
  Course: "کورس",
  Teacher: "مدرس",
  Category: "کتگوری",
  Price: "قیمت",
  Students: "شاگردان",
  Status: "وضعیت",
  Actions: "اقدام‌ها",
  Free: "رایگان",
  Review: "بررسی",
  Approve: "تایید",
  Reject: "رد",
  Publish: "نشر",
  Unpublish: "لغو نشر",
  Sessions: "جلسات",
  Edit: "ویرایش",
  Delete: "حذف",
  "No courses found.": "کورس‌ای پیدا نشد.",
  "Loading courses": "در حال بارگذاری کورس‌ها",
  Previous: "قبلی",
  Next: "بعدی",
  Page: "صفحه",
  of: "از",
  draft: "پیش‌نویس",
  pending: "در انتظار",
  approved: "تاییدشده",
  published: "منتشرشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
  "Cancellation requested": "درخواست لغو",
  "End requested": "درخواست پایان",
  "Course details": "جزئیات کورس",
  "Loading full course details": "در حال بارگذاری کامل جزئیات کورس",
  Description: "توضیحات",
  "No description provided.": "توضیحی ارائه نشده است.",
  "Course profile": "پروفایل کورس",
  "Course activity": "فعالیت کورس",
  Price: "قیمت",
  Discount: "تخفیف",
  "Teacher discount": "تخفیف مدرس",
  Updated: "به‌روزرسانی",
  "Admin insights": "بینش مدیریتی",
  "Live on platform": "فعال در پلتفرم",
  "Not live yet": "هنوز فعال نشده",
  "Meeting type": "نوع جلسه",
  "Payment plan": "پلن پرداخت",
  "Minimum students to start": "حداقل شاگرد برای شروع",
  "Duration weeks": "مدت به هفته",
  "Total sessions": "تعداد جلسات",
  "Platform commission": "کمیسیون پلتفرم",
  "Created by": "ایجادشده توسط",
  "Creator email": "ایمیل ایجادکننده",
  "Publish state": "وضعیت نشر",
  Published: "منتشرشده",
  Unpublished: "منتشرنشده",
  Schedule: "زمان‌بندی",
  "Start date": "تاریخ شروع",
  "End date": "تاریخ ختم",
  "Class started": "شروع صنف",
  "Class ended": "ختم صنف",
  "Class cancelled": "لغو صنف",
  "No schedule submitted.": "هیچ زمان‌بندی ثبت نشده است.",
  "Media and access": "رسانه و دسترسی",
  "Meeting link": "لینک جلسه",
  "Promo video": "ویدیوی معرفی",
  Open: "باز کردن",
  "Preview video": "ویدیوی پیش‌نمایش",
  "Rejection Reason": "دلیل رد",
  "Cancellation Request": "درخواست لغو",
  Requested: "درخواست‌شده",
  "Teacher reason": "دلیل مدرس",
  "Admin response": "پاسخ ادمین",
  Close: "بستن",
  "Reject Course": "رد کورس",
  "Reject Cancellation": "رد لغو",
  "Approve Cancellation": "تایید لغو",
  "Approve Course": "تایید کورس",
  Status: "وضعیت",
  Pricing: "قیمت‌گذاری",
  Joined: "ایجاد",
  "Edit course": "ویرایش کورس",
  "Course content": "محتوای کورس",
  "Editable setup": "تنظیمات قابل ویرایش",
  Teacher: "مدرس",
  "Teacher email": "ایمیل مدرس",
  Level: "سطح",
  Language: "زبان",
  "Max students": "حداکثر شاگردان",
  Duration: "مدت",
  "Course title": "عنوان کورس",
  "Short description": "توضیح کوتاه",
  "Full description": "توضیح کامل",
  "Search teacher by email": "جستجوی مدرس با ایمیل",
  "No matching teachers": "مدرس مطابق پیدا نشد",
  "No subcategory": "بدون زیرکتگوری",
  Save: "ذخیره",
  Cancel: "لغو",
  "Save Changes": "ذخیره تغییرات",
  Saving: "در حال ذخیره...",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const statusBadgeClass = {
  draft: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  published: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-700",
};

const resolveAssetUrl = (rawPath = "") => {
  const value = String(rawPath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/")) {
    const backendOrigin = getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "");
    return `${backendOrigin}${value}`;
  }
  return value;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value, language = "en") =>
  new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(Number(value || 0));

const mapStatusLabel = (value, pageTr) => pageTr(String(value || "").toLowerCase() || "-");
const formatMeetingTypeLabel = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "google_meet") return "Google Meet";
  if (normalized === "zoom") return "Zoom";
  if (normalized === "physical") return "Physical";
  if (normalized === "recorded") return "Recorded";
  return normalized || "-";
};

const getPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) return [1, 2, 3, "...", totalPages];
  if (currentPage >= totalPages - 2) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", currentPage, "...", totalPages];
};

const DEFAULT_NOTIFICATION_PAYLOAD = {
  notificationAudience: "all",
  notificationChannels: {
    push: false,
    telegram: false,
  },
  confirmationChecked: false,
};

const DAY_OPTIONS = [
  { key: "monday", enumKey: "MONDAY", label: "Monday" },
  { key: "tuesday", enumKey: "TUESDAY", label: "Tuesday" },
  { key: "wednesday", enumKey: "WEDNESDAY", label: "Wednesday" },
  { key: "thursday", enumKey: "THURSDAY", label: "Thursday" },
  { key: "friday", enumKey: "FRIDAY", label: "Friday" },
  { key: "saturday", enumKey: "SATURDAY", label: "Saturday" },
  { key: "sunday", enumKey: "SUNDAY", label: "Sunday" },
];
const DESCRIPTION_MIN_CHARS = 120;
const DESCRIPTION_MAX_CHARS = 2000;
const TITLE_MIN_CHARS = 5;
const TITLE_MAX_CHARS = 120;
const COURSE_WEEKS_MIN = 1;
const COURSE_WEEKS_MAX = 104;
const COURSE_SESSIONS_MIN = 8;
const COURSE_SESSIONS_MAX = 728;
const PRICE_MAX_USD = 10000;
const LIST_ITEM_MIN_CHARS = 3;
const LIST_ITEM_MAX_CHARS = 180;
const LIST_MAX_ITEMS = 30;
const LIST_ROW_BREAK_REGEX = /\r\n?|\n|\u2028|\u2029/g;
const ADMIN_COURSES_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_COURSES_CATEGORIES_KEY = getAdminPageCacheKey("courses-categories");
const ADMIN_COURSES_TEACHERS_KEY = getAdminPageCacheKey("courses-teachers");
const getDefaultCoursesListCacheKey = (status = "all") =>
  getAdminPageCacheKey("courses-list", {
    page: 1,
    search: "",
    status,
    category: "all",
    teacher: "all",
    pricing: "all",
  });
const getAdminCoursesListCacheKey = ({
  page,
  search,
  status,
  category,
  teacher,
  pricing,
}) =>
  getAdminPageCacheKey("courses-list", {
    page,
    search,
    status,
    category,
    teacher,
    pricing,
  });
const DEFAULT_PRICING_SETTINGS = {
  minTeacherCoursePrice: 5,
  teacherDeductionPercentage: 15,
  globalCourseDiscountPercentage: 0,
};

const toMinutes = (value = "") => {
  if (!/^\d{2}:\d{2}$/.test(value)) return 0;
  const [h, m] = value.split(":").map((item) => Number(item));
  return h * 60 + m;
};

const normalizeTextareaRows = (raw = "") =>
  String(raw)
    .replace(LIST_ROW_BREAK_REGEX, "\n")
    .split("\n")
    .map((line) => line.trim());

const parseListLines = (raw = "") =>
  normalizeTextareaRows(raw)
    .map((line) => line.replace(/^[-*•●▪◦]\s*/u, "").trim())
    .filter(Boolean);

const linesFromArray = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join("\n") : "";

const parseVideoLinks = (raw = "") => normalizeTextareaRows(raw).filter(Boolean);

const getYouTubeVideoKey = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return id ? `youtube:${id}` : "";
    }
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname.startsWith("/watch")) {
        const id = url.searchParams.get("v") || "";
        return id ? `youtube:${id}` : "";
      }
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/").filter(Boolean)[1] || "";
        return id ? `youtube:${id}` : "";
      }
    }
    return "";
  } catch {
    return "";
  }
};

const isYouTubeLink = (value = "") => Boolean(getYouTubeVideoKey(value));

const getPreviewVideoError = (links = []) => {
  if (!links.length) return "";
  if (links.length > 5) return "Add up to 5 YouTube preview video links for the course.";
  if (!links.every(isYouTubeLink)) return "Course preview video links must be from YouTube or youtu.be.";
  const videoKeys = links.map(getYouTubeVideoKey);
  if (new Set(videoKeys).size !== videoKeys.length) {
    return "Duplicate video links are not allowed. Each video must be different.";
  }
  return "";
};

const validateListField = (items = []) => {
  if (!Array.isArray(items) || !items.length) return false;
  if (items.length > LIST_MAX_ITEMS) return false;
  return items.every(
    (item) =>
      String(item || "").trim().length >= LIST_ITEM_MIN_CHARS &&
      String(item || "").trim().length <= LIST_ITEM_MAX_CHARS,
  );
};

const getInvalidListField = (fields = []) =>
  fields.find(({ items }) => !validateListField(items)) || null;

const clampPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const normalizeMinimumCoursePrice = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const roundCurrencyAmount = (value, decimalPlaces = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round(numeric * factor) / factor;
};

const isWholeDollarAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  return Number.isInteger(numeric);
};

const formatUsdtAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
};

const buildPricingPreview = ({
  basePrice,
  teacherDiscountPercentage,
  globalDiscountPercentage,
  teacherDeductionPercentage,
}) => {
  const normalizedBasePrice = Number.isFinite(Number(basePrice)) ? Math.max(0, Number(basePrice)) : 0;
  const normalizedTeacherDiscount = clampPercentage(teacherDiscountPercentage);
  const normalizedGlobalDiscount = clampPercentage(globalDiscountPercentage);
  const normalizedTeacherDeduction = clampPercentage(teacherDeductionPercentage);
  const totalDiscountPercentage = Math.max(
    0,
    Math.min(100, normalizedTeacherDiscount + normalizedGlobalDiscount),
  );
  const studentFinalPrice = Math.max(
    0,
    roundCurrencyAmount(
      normalizedBasePrice - ((normalizedBasePrice * totalDiscountPercentage) / 100),
    ),
  );
  const platformDeductionAmount = roundCurrencyAmount(
    (studentFinalPrice * normalizedTeacherDeduction) / 100,
  );
  const teacherNetIncome = Math.max(
    0,
    roundCurrencyAmount(studentFinalPrice - platformDeductionAmount),
  );

  return {
    normalizedBasePrice,
    normalizedTeacherDiscount,
    normalizedGlobalDiscount,
    normalizedTeacherDeduction,
    totalDiscountPercentage,
    teacherEffectivePrice: Math.max(
      0,
      roundCurrencyAmount(
        normalizedBasePrice - ((normalizedBasePrice * normalizedTeacherDiscount) / 100),
      ),
    ),
    studentFinalPrice,
    platformDeductionAmount,
    teacherNetIncome,
  };
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const inferDurationWeeks = (startDateValue, endDateValue) => {
  const start = new Date(startDateValue || "");
  const end = new Date(endDateValue || "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 8;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 8;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.ceil(days / 7));
};

const normalizeDayKey = (value = "") => {
  const key = String(value).trim().toLowerCase();
  const map = {
    شنبه: "saturday",
    یکشنبه: "sunday",
    دوشنبه: "monday",
    سه‌شنبه: "tuesday",
    چهارشنبه: "wednesday",
    پنجشنبه: "thursday",
    جمعه: "friday",
  };
  return map[key] || key;
};

const resolveTeacherDiscountPercentage = (course = {}) => {
  const basePrice = Number(course?.price || 0);
  const rawTeacherDiscount = Number(course?.teacherDiscountPercentage);
  if (Number.isFinite(rawTeacherDiscount)) {
    return clampPercentage(rawTeacherDiscount);
  }
  const discountPrice = Number(course?.discountPrice || 0);
  if (basePrice > 0 && discountPrice > 0 && discountPrice <= basePrice) {
    return clampPercentage(((basePrice - discountPrice) / basePrice) * 100);
  }
  return 0;
};

const getInitialEditForm = (course = {}, fallbackTeacherId = "") => {
  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  const firstSchedule = scheduleRows[0] || {};
  const selectedDays = Array.from(
    new Set(
      scheduleRows
        .map((row) => normalizeDayKey(row?.day))
        .filter((dayKey) => DAY_OPTIONS.some((item) => item.key === dayKey)),
    ),
  );
  const isFree = Boolean(course?.isFree) || Number(course?.price || 0) <= 0;

  return {
    title: course?.title || "",
    description: course?.description || "",
    category: course?.category?._id || "",
    subcategory: course?.subcategory?._id || "",
    teacher:
      String(course?.teacher?._id || course?.teacherId || "").trim() || fallbackTeacherId,
    level: course?.level || "beginner",
    language: course?.language || "English",
    duration: course?.duration || "",
    durationWeeks: String(
      Number(course?.durationWeeks || 0) > 0
        ? Number(course.durationWeeks)
        : inferDurationWeeks(course?.startDate, course?.endDate),
    ),
    totalSessions: String(
      Number(course?.totalSessions || 0) >= COURSE_SESSIONS_MIN
        ? Number(course.totalSessions)
        : Math.max(COURSE_SESSIONS_MIN, selectedDays.length * 8),
    ),
    maxStudents: String(course?.maxStudents || 100),
    minimumStudentsToStart: String(course?.minimumStudentsToStart || 1),
    status: course?.status || "draft",
    pricingType: isFree ? "free" : "paid",
    paymentPlan: course?.paymentPlan === "whole_period" ? "whole_period" : "monthly",
    price: isFree ? "0" : String(course?.price ?? ""),
    teacherDiscountPercentage: String(resolveTeacherDiscountPercentage(course)),
    courseType: course?.courseType === "special" ? "special" : "general",
    meetingType: course?.meetingType || "google_meet",
    meetingLink: course?.meetingLink || "",
    startDate: toDateInputValue(course?.startDate),
    startTime: firstSchedule?.startTime || "18:00",
    endTime: firstSchedule?.endTime || "19:00",
    selectedDays: selectedDays.length ? selectedDays : ["monday", "wednesday", "friday"],
    targetAudienceText: linesFromArray(course?.targetAudience),
    whatYouWillLearnText: linesFromArray(course?.whatYouWillLearn),
    requirementsText: linesFromArray(course?.requirements),
    curriculumTopicsText: linesFromArray(course?.curriculumTopics),
    previewVideoUrlsText: linesFromArray(course?.previewVideoUrls),
    existingThumbnail: course?.thumbnail || "",
    thumbnailFile: null,
  };
};

export default function AdminCoursesPage() {
  const { t, language, isRTL } = useAdminI18n();
  const pageTr = useCallback((text) => translateText(t(text), language), [t, language]);
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const initialStatus =
    statusOptions.includes(requestedStatus) ? requestedStatus : "all";
  const initialCoursesCache = readAdminPageCache(
    getDefaultCoursesListCacheKey(initialStatus),
    { maxAgeMs: ADMIN_COURSES_CACHE_TTL_MS },
  );
  const [courses, setCourses] = useState(
    Array.isArray(initialCoursesCache?.courses) ? initialCoursesCache.courses : [],
  );
  const [categories, setCategories] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(initialCoursesCache?.meta || { totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(!initialCoursesCache);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState("");
  const [editingCoursePreview, setEditingCoursePreview] = useState(null);
  const [createTeacherQuery, setCreateTeacherQuery] = useState("");
  const [editTeacherQuery, setEditTeacherQuery] = useState("");
  const [sessionModalCourse, setSessionModalCourse] = useState(null);
  const [sessionRows, setSessionRows] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [reviewCourse, setReviewCourse] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [courseApprovalModal, setCourseApprovalModal] = useState({
    open: false,
    course: null,
    payload: DEFAULT_NOTIFICATION_PAYLOAD,
  });
  const [coursePublishModal, setCoursePublishModal] = useState({
    open: false,
    course: null,
    payload: DEFAULT_NOTIFICATION_PAYLOAD,
  });
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING_SETTINGS);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    teacher: "",
    level: "beginner",
    language: "English",
    duration: "",
    durationWeeks: "8",
    totalSessions: "24",
    maxStudents: "100",
    minimumStudentsToStart: "1",
    pricingType: "paid",
    paymentPlan: "monthly",
    price: "",
    teacherDiscountPercentage: "0",
    status: "draft",
    courseType: "general",
    meetingType: "google_meet",
    meetingLink: "",
    startDate: "",
    startTime: "18:00",
    endTime: "19:00",
    selectedDays: ["monday", "wednesday", "friday"],
    targetAudienceText: "",
    whatYouWillLearnText: "",
    requirementsText: "",
    curriculumTopicsText: "",
    previewVideoUrlsText: "",
    thumbnailFile: null,
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    teacher: "",
    level: "beginner",
    language: "English",
    duration: "",
    durationWeeks: "8",
    totalSessions: "24",
    maxStudents: "100",
    minimumStudentsToStart: "1",
    status: "draft",
    pricingType: "paid",
    paymentPlan: "monthly",
    price: "",
    teacherDiscountPercentage: "0",
    courseType: "general",
    meetingType: "google_meet",
    meetingLink: "",
    startDate: "",
    startTime: "18:00",
    endTime: "19:00",
    selectedDays: ["monday", "wednesday", "friday"],
    targetAudienceText: "",
    whatYouWillLearnText: "",
    requirementsText: "",
    curriculumTopicsText: "",
    previewVideoUrlsText: "",
    existingThumbnail: "",
    thumbnailFile: null,
  });
  const coursesRequest = useLatestRequest();

  const loadCourses = useCallback(async () => {
    const cacheKey = getAdminCoursesListCacheKey({
      page,
      search: debouncedSearch,
      status,
      category,
      teacher: teacherFilter,
      pricing: pricingFilter,
    });
    const cached = readAdminPageCache(cacheKey, { maxAgeMs: ADMIN_COURSES_CACHE_TTL_MS });
    if (cached) {
      setCourses(Array.isArray(cached.courses) ? cached.courses : []);
      setMeta(cached.meta || { totalPages: 1, total: 0 });
      setLoading(false);
      setError("");
    } else {
      setLoading(true);
      setError("");
    }

    await coursesRequest.runLatest(async () => fetchAdminCourses({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: status === "all" ? undefined : status,
      category: category === "all" ? undefined : category,
      teacher: teacherFilter === "all" ? undefined : teacherFilter,
      pricing: pricingFilter === "all" ? undefined : pricingFilter,
    }), {
      onSuccess: ({ courses: rows, meta: pageMeta }) => {
        setCourses(rows);
        setMeta(pageMeta || { totalPages: 1, total: 0 });
        writeAdminPageCache(cacheKey, {
          courses: rows,
          meta: pageMeta || { totalPages: 1, total: 0 },
        });
      },
      onError: (err) => {
        setError(err.message || "Failed to load courses");
      },
      onFinally: () => {
        setLoading(false);
      },
    });
  }, [
    category,
    coursesRequest,
    debouncedSearch,
    page,
    pricingFilter,
    status,
    teacherFilter,
  ]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    setPage(1);
  }, [category, debouncedSearch, pricingFilter, status, teacherFilter]);

  useEffect(() => {
    const loadCategories = async () => {
      const cached = readAdminPageCache(ADMIN_COURSES_CATEGORIES_KEY, {
        maxAgeMs: ADMIN_COURSES_CACHE_TTL_MS,
      });
      if (cached) {
        const parentRows = getParentCategories(cached);
        setCategories(cached);
        setCreateForm((prev) => ({
          ...prev,
          category: prev.category || parentRows?.[0]?._id || "",
        }));
        return;
      }
      try {
        const rows = await fetchAdminCategories();
        const parentRows = getParentCategories(rows);
        setCategories(rows);
        writeAdminPageCache(ADMIN_COURSES_CATEGORIES_KEY, rows);
        setCreateForm((prev) => ({
          ...prev,
          category: prev.category || parentRows?.[0]?._id || "",
        }));
      } catch {
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadTeachers = async () => {
      const cached = readAdminPageCache(ADMIN_COURSES_TEACHERS_KEY, {
        maxAgeMs: ADMIN_COURSES_CACHE_TTL_MS,
      });
      if (cached) {
        setTeachers(cached);
        setCreateForm((prev) => ({
          ...prev,
          teacher: prev.teacher || cached?.[0]?._id || "",
        }));
        return;
      }
      try {
        const rows = await fetchAdminTeachers();
        setTeachers(rows);
        writeAdminPageCache(ADMIN_COURSES_TEACHERS_KEY, rows);
        setCreateForm((prev) => ({
          ...prev,
          teacher: prev.teacher || rows?.[0]?._id || "",
        }));
      } catch {
        setTeachers([]);
      }
    };

    loadTeachers();
  }, []);

  useEffect(() => {
    const loadPricingSettings = async () => {
      try {
        const response = await fetch(`${getApiBase()}/admin/settings`, {
          headers: buildAuthHeaders(),
        });
        const data = await parseJsonResponse(response);
        setPricingSettings({
          minTeacherCoursePrice: normalizeMinimumCoursePrice(
            data?.data?.minTeacherCoursePrice ?? DEFAULT_PRICING_SETTINGS.minTeacherCoursePrice,
          ),
          teacherDeductionPercentage: clampPercentage(
            data?.data?.teacherDeductionPercentage ?? DEFAULT_PRICING_SETTINGS.teacherDeductionPercentage,
          ),
          globalCourseDiscountPercentage: clampPercentage(
            data?.data?.globalCourseDiscountPercentage ?? DEFAULT_PRICING_SETTINGS.globalCourseDiscountPercentage,
          ),
        });
      } catch {
        setPricingSettings(DEFAULT_PRICING_SETTINGS);
      }
    };

    loadPricingSettings();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => {
    const total = courses.length;
    return {
      total,
      published: courses.filter((c) => c.status === "published").length,
      pending: courses.filter((c) => c.status === "pending").length,
      rejected: courses.filter((c) => c.status === "rejected").length,
    };
  }, [courses]);

  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const createSubcategoryOptions = useMemo(
    () => getSubcategoriesForParent(categories, createForm.category),
    [categories, createForm.category],
  );
  const editSubcategoryOptions = useMemo(
    () => getSubcategoriesForParent(categories, editForm.category),
    [categories, editForm.category],
  );
  const selectedEditTeacher = useMemo(
    () => teachers.find((item) => String(item?._id || "") === String(editForm.teacher || "")) || null,
    [teachers, editForm.teacher],
  );
  const selectedEditCategory = useMemo(
    () => parentCategories.find((item) => String(item?._id || "") === String(editForm.category || "")) || null,
    [parentCategories, editForm.category],
  );
  const selectedEditSubcategory = useMemo(
    () =>
      editSubcategoryOptions.find(
        (item) => String(item?._id || "") === String(editForm.subcategory || ""),
      ) || null,
    [editSubcategoryOptions, editForm.subcategory],
  );
  const editPricingPreview = useMemo(
    () =>
      buildPricingPreview({
        basePrice: editForm.price,
        teacherDiscountPercentage: editForm.teacherDiscountPercentage,
        globalDiscountPercentage: pricingSettings.globalCourseDiscountPercentage,
        teacherDeductionPercentage: pricingSettings.teacherDeductionPercentage,
      }),
    [editForm.price, editForm.teacherDiscountPercentage, pricingSettings],
  );
  const editListFieldConfigs = useMemo(
    () => [
      { key: "targetAudienceText", items: parseListLines(editForm.targetAudienceText), label: "Target audience" },
      { key: "whatYouWillLearnText", items: parseListLines(editForm.whatYouWillLearnText), label: "What students will learn" },
      { key: "requirementsText", items: parseListLines(editForm.requirementsText), label: "Requirements" },
      { key: "curriculumTopicsText", items: parseListLines(editForm.curriculumTopicsText), label: "Curriculum topics" },
    ],
    [
      editForm.targetAudienceText,
      editForm.whatYouWillLearnText,
      editForm.requirementsText,
      editForm.curriculumTopicsText,
    ],
  );
  const createPricingPreview = useMemo(
    () =>
      buildPricingPreview({
        basePrice: createForm.price,
        teacherDiscountPercentage: createForm.teacherDiscountPercentage,
        globalDiscountPercentage: pricingSettings.globalCourseDiscountPercentage,
        teacherDeductionPercentage: pricingSettings.teacherDeductionPercentage,
      }),
    [createForm.price, createForm.teacherDiscountPercentage, pricingSettings],
  );
  const createListFieldConfigs = useMemo(
    () => [
      { key: "targetAudienceText", items: parseListLines(createForm.targetAudienceText), label: "Target audience" },
      { key: "whatYouWillLearnText", items: parseListLines(createForm.whatYouWillLearnText), label: "What students will learn" },
      { key: "requirementsText", items: parseListLines(createForm.requirementsText), label: "Requirements" },
      { key: "curriculumTopicsText", items: parseListLines(createForm.curriculumTopicsText), label: "Curriculum topics" },
    ],
    [
      createForm.targetAudienceText,
      createForm.whatYouWillLearnText,
      createForm.requirementsText,
      createForm.curriculumTopicsText,
    ],
  );

  useEffect(() => {
    if (!createForm.subcategory) return;
    if (createSubcategoryOptions.some((item) => String(item._id) === String(createForm.subcategory))) return;
    const timer = setTimeout(() => {
      setCreateForm((prev) => ({ ...prev, subcategory: "" }));
    }, 0);
    return () => clearTimeout(timer);
  }, [createForm.subcategory, createSubcategoryOptions]);

  useEffect(() => {
    if (!editForm.subcategory) return;
    if (editSubcategoryOptions.some((item) => String(item._id) === String(editForm.subcategory))) return;
    const timer = setTimeout(() => {
      setEditForm((prev) => ({ ...prev, subcategory: "" }));
    }, 0);
    return () => clearTimeout(timer);
  }, [editForm.subcategory, editSubcategoryOptions]);

  const normalizeTeacherId = (value) => String(value || "").trim();

  const hasTeacherId = useCallback(
    (teacherId) => teachers.some((teacher) => String(teacher?._id || "") === teacherId),
    [teachers],
  );

  const filterTeachers = useCallback((query = "") => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((teacher) => {
      const email = String(teacher?.email || "").toLowerCase();
      const name = String(teacher?.name || "").toLowerCase();
      const id = String(teacher?._id || "").toLowerCase();
      return email.includes(q) || name.includes(q) || id.includes(q);
    });
  }, [teachers]);

  const createTeacherOptions = useMemo(
    () => {
      const options = filterTeachers(createTeacherQuery);
      const selectedId = normalizeTeacherId(createForm.teacher);
      if (!selectedId || options.some((item) => String(item?._id || "") === selectedId)) {
        return options;
      }
      const selectedTeacher = teachers.find(
        (item) => String(item?._id || "") === selectedId,
      );
      return selectedTeacher ? [selectedTeacher, ...options] : options;
    },
    [teachers, createTeacherQuery, createForm.teacher, filterTeachers],
  );

  const editTeacherOptions = useMemo(
    () => {
      const options = filterTeachers(editTeacherQuery);
      const selectedId = normalizeTeacherId(editForm.teacher);
      if (!selectedId || options.some((item) => String(item?._id || "") === selectedId)) {
        return options;
      }
      const selectedTeacher = teachers.find(
        (item) => String(item?._id || "") === selectedId,
      );
      return selectedTeacher ? [selectedTeacher, ...options] : options;
    },
    [teachers, editTeacherQuery, editForm.teacher, filterTeachers],
  );

  useEffect(() => {
    if (!teachers.length) return;
    const firstTeacherId = String(teachers[0]?._id || "");
    if (!firstTeacherId) return;
    const timer = setTimeout(() => {
      setCreateForm((prev) => {
        const currentId = normalizeTeacherId(prev.teacher);
        if (currentId && hasTeacherId(currentId)) return prev;
        return { ...prev, teacher: firstTeacherId };
      });

      setEditForm((prev) => {
        const currentId = normalizeTeacherId(prev.teacher);
        if (!currentId) return isEditOpen ? { ...prev, teacher: firstTeacherId } : prev;
        if (hasTeacherId(currentId)) return prev;
        return { ...prev, teacher: firstTeacherId };
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [teachers, isEditOpen, hasTeacherId]);

  const handleAction = async (fn, successMessage) => {
    try {
      await fn();
      setToast(successMessage);
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Action failed");
    }
  };

  const openCourseApprovalModal = (course) => {
    if (!course?._id) return;
    setCourseApprovalModal({
      open: true,
      course,
      payload: DEFAULT_NOTIFICATION_PAYLOAD,
    });
  };

  const openCoursePublishModal = (course) => {
    if (!course?._id) return;
    setCoursePublishModal({
      open: true,
      course,
      payload: DEFAULT_NOTIFICATION_PAYLOAD,
    });
  };

  const closeCourseApprovalModal = () => {
    setCourseApprovalModal({
      open: false,
      course: null,
      payload: DEFAULT_NOTIFICATION_PAYLOAD,
    });
  };

  const closeCoursePublishModal = () => {
    setCoursePublishModal({
      open: false,
      course: null,
      payload: DEFAULT_NOTIFICATION_PAYLOAD,
    });
  };

  const buildNotificationRequestPayload = (payload = {}) => ({
    notificationAudience: payload.notificationAudience || "all",
    notificationChannels: {
      push: Boolean(payload.notificationChannels?.push),
      telegram: Boolean(payload.notificationChannels?.telegram),
    },
  });

  const toggleCreateDay = (dayKey) => {
    setCreateForm((prev) => {
      if (prev.selectedDays.includes(dayKey)) {
        return {
          ...prev,
          selectedDays: prev.selectedDays.filter((item) => item !== dayKey),
        };
      }
      return {
        ...prev,
        selectedDays: [...prev.selectedDays, dayKey],
      };
    });
  };

  const toggleEditDay = (dayKey) => {
    setEditForm((prev) => {
      if (prev.selectedDays.includes(dayKey)) {
        return {
          ...prev,
          selectedDays: prev.selectedDays.filter((item) => item !== dayKey),
        };
      }
      return {
        ...prev,
        selectedDays: [...prev.selectedDays, dayKey],
      };
    });
  };

  const handleConnectGoogle = async () => {
    try {
      const url = await fetchGoogleAuthUrl();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setToast(err?.message || "Failed to open Google OAuth");
    }
  };

  const openSessionsModal = async (course) => {
    if (!course?._id) return;
    setSessionModalCourse(course);
    setSessionRows([]);
    try {
      setSessionLoading(true);
      const rows = await fetchAdminCourseSessions(course._id);
      setSessionRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setToast(err?.message || "Failed to load sessions");
    } finally {
      setSessionLoading(false);
    }
  };

  const openReviewModal = async (course) => {
    if (!course?._id) return;
    setReviewCourse(course);
    try {
      setReviewLoading(true);
      const fullCourse = await fetchAdminCourseById(course._id);
      setReviewCourse(fullCourse || course);
    } catch (err) {
      setToast(err?.message || "Failed to load course details");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReviewDecision = async (decision) => {
    if (!reviewCourse?._id) return;

    try {
      if (decision === "approved") {
        openCourseApprovalModal(reviewCourse);
        return;
      } else {
        const reason = window.prompt("Rejection reason:", "Needs improvement");
        if (!reason) return;
        await rejectAdminCourse(reviewCourse._id, reason);
        setToast("Course rejected");
      }

      setReviewCourse(null);
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Review action failed");
    }
  };

  const handleApproveCourseWithModal = async () => {
    if (!courseApprovalModal.course?._id) return;
    if (!courseApprovalModal.payload.confirmationChecked) {
      setToast("Please confirm that everything was checked before approval.");
      return;
    }

    try {
      await approveAdminCourse(
        courseApprovalModal.course._id,
        buildNotificationRequestPayload(courseApprovalModal.payload),
      );
      closeCourseApprovalModal();
      setReviewCourse(null);
      setToast("Course approved");
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Review action failed");
    }
  };

  const handlePublishCourseWithModal = async () => {
    if (!coursePublishModal.course?._id) return;
    if (!coursePublishModal.payload.confirmationChecked) {
      setToast("Please confirm that everything was checked before publishing.");
      return;
    }

    try {
      await publishAdminCourse(
        coursePublishModal.course._id,
        buildNotificationRequestPayload(coursePublishModal.payload),
      );
      closeCoursePublishModal();
      setToast("Course published");
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Publish action failed");
    }
  };

  const handleCancellationDecision = async (course, decision) => {
    if (!course?._id) return;
    const promptLabel =
      decision === "approved"
        ? "Admin note for approval (optional):"
        : "Reason for rejecting cancellation request (optional):";
    const adminResponse = window.prompt(promptLabel, "");
    if (adminResponse === null) return;

    try {
      if (decision === "approved") {
        await approveCourseCancellationRequest(course._id, adminResponse);
        setToast("Cancellation request approved");
      } else {
        await rejectCourseCancellationRequest(course._id, adminResponse);
        setToast("Cancellation request rejected");
      }
      if (reviewCourse?._id === course._id) {
        setReviewCourse(null);
      }
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Cancellation review failed");
    }
  };

  const handleEndRequestDecision = async (course, decision) => {
    if (!course?._id) return;
    const promptLabel =
      decision === "approved"
        ? "Admin note for end approval (optional):"
        : "Reason for rejecting end request (optional):";
    const adminResponse = window.prompt(promptLabel, "");
    if (adminResponse === null) return;

    try {
      if (decision === "approved") {
        await approveCourseEndRequest(course._id, adminResponse);
        setToast("End request approved");
      } else {
        await rejectCourseEndRequest(course._id, adminResponse);
        setToast("End request rejected");
      }
      if (reviewCourse?._id === course._id) {
        setReviewCourse(null);
      }
      await loadCourses();
    } catch (err) {
      setToast(err.message || "End request review failed");
    }
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();

    try {
      setCreateLoading(true);

      if (!createForm.category) {
        setToast("Please create/select a category first");
        return;
      }
      const selectedTeacherId = normalizeTeacherId(createForm.teacher);
      if (!selectedTeacherId) {
        setToast("Please select a teacher");
        return;
      }

      const isFree = createForm.pricingType === "free";
      const price = Number(createForm.price || 0);
      const teacherDiscountPercentage = Number(createForm.teacherDiscountPercentage || 0);
      const durationWeeks = Number(createForm.durationWeeks || 0);
      const totalSessions = Number(createForm.totalSessions || 0);
      const maxStudents = Number(createForm.maxStudents || 100);
      const minimumStudentsToStart = Number(createForm.minimumStudentsToStart || 1);
      const normalizedTeacherDiscountPercentage = clampPercentage(
        Number.isFinite(teacherDiscountPercentage) ? teacherDiscountPercentage : 0,
      );
      const titleLength = String(createForm.title || "").trim().length;
      const descriptionLength = String(createForm.description || "").trim().length;
      const targetAudience = createListFieldConfigs[0].items;
      const whatYouWillLearn = createListFieldConfigs[1].items;
      const requirements = createListFieldConfigs[2].items;
      const curriculumTopics = createListFieldConfigs[3].items;
      const previewVideoUrls = parseVideoLinks(createForm.previewVideoUrlsText);

      if (titleLength < TITLE_MIN_CHARS || titleLength > TITLE_MAX_CHARS) {
        setToast(`Course title must be between ${TITLE_MIN_CHARS} and ${TITLE_MAX_CHARS} characters.`);
        return;
      }
      if (descriptionLength < DESCRIPTION_MIN_CHARS || descriptionLength > DESCRIPTION_MAX_CHARS) {
        setToast(
          `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`,
        );
        return;
      }
      if (!isFree && price <= 0) {
        setToast("Paid course must have a price greater than 0");
        return;
      }
      if (
        !isFree &&
        (
          price < normalizeMinimumCoursePrice(pricingSettings.minTeacherCoursePrice) ||
          price > PRICE_MAX_USD ||
          !isWholeDollarAmount(price)
        )
      ) {
        setToast(
          `For a paid course, price must be at least ${pricingSettings.minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`,
        );
        return;
      }
      if (!isFree && (normalizedTeacherDiscountPercentage < 0 || normalizedTeacherDiscountPercentage > 100)) {
        setToast("Teacher discount percentage must be between 0 and 100.");
        return;
      }

      if (!Array.isArray(createForm.selectedDays) || new Set(createForm.selectedDays).size < 2) {
        setToast("Select at least two teaching days per week.");
        return;
      }

      if (!/^\d{2}:\d{2}$/.test(createForm.startTime) || !/^\d{2}:\d{2}$/.test(createForm.endTime)) {
        setToast("Please set valid class start/end time");
        return;
      }

      const startMinutes = toMinutes(createForm.startTime);
      const endMinutes = toMinutes(createForm.endTime);
      if (endMinutes <= startMinutes) {
        setToast("End time must be after start time");
        return;
      }

      if (!createForm.startDate) {
        setToast("Select a course start date.");
        return;
      }

      if (!Number.isInteger(durationWeeks) || durationWeeks < COURSE_WEEKS_MIN || durationWeeks > COURSE_WEEKS_MAX) {
        setToast(`Course duration in weeks must be between ${COURSE_WEEKS_MIN} and ${COURSE_WEEKS_MAX}.`);
        return;
      }

      if (!Number.isInteger(totalSessions) || totalSessions < COURSE_SESSIONS_MIN || totalSessions > COURSE_SESSIONS_MAX) {
        setToast(`Total sessions must be between ${COURSE_SESSIONS_MIN} and ${COURSE_SESSIONS_MAX}.`);
        return;
      }

      if (!Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 2000) {
        setToast("Max students must be between 1 and 2000.");
        return;
      }

      if (!Number.isInteger(minimumStudentsToStart) || minimumStudentsToStart < 1 || minimumStudentsToStart > maxStudents) {
        setToast("Minimum students to start must be at least 1 and cannot exceed course capacity.");
        return;
      }

      const invalidListField = getInvalidListField(createListFieldConfigs);
      if (invalidListField) {
        setToast(
          `${invalidListField.label} must have 1-${LIST_MAX_ITEMS} items, and each item must be ${LIST_ITEM_MIN_CHARS}-${LIST_ITEM_MAX_CHARS} characters.`,
        );
        return;
      }

      const previewVideoError = getPreviewVideoError(previewVideoUrls);
      if (previewVideoError) {
        setToast(previewVideoError);
        return;
      }

      const startDateTime = new Date(`${createForm.startDate}T${createForm.startTime}:00`);
      if (Number.isNaN(startDateTime.getTime())) {
        setToast("Course start date/time is invalid.");
        return;
      }

      const computedEndDate = new Date(startDateTime);
      computedEndDate.setDate(computedEndDate.getDate() + durationWeeks * 7 - 1);
      const [endHours, endMinutesOnly] = createForm.endTime.split(":").map((value) => Number(value));
      computedEndDate.setHours(endHours || 0, endMinutesOnly || 0, 0, 0);

      const schedule = Array.from(new Set(createForm.selectedDays)).map((day) => ({
        day,
        startTime: createForm.startTime,
        endTime: createForm.endTime,
      }));

      const payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        subcategory: createForm.subcategory || null,
        teacher: selectedTeacherId,
        level: createForm.level,
        language: createForm.language,
        duration: createForm.duration.trim(),
        durationWeeks,
        totalSessions,
        maxStudents,
        minimumStudentsToStart,
        price: isFree ? 0 : price,
        teacherDiscountPercentage: isFree ? 0 : normalizedTeacherDiscountPercentage,
        currency: "USD",
        isFree,
        status: createForm.status,
        paymentPlan: createForm.paymentPlan,
        courseType: createForm.courseType,
        meetingType: createForm.meetingType,
        meetingLink: createForm.meetingType === "zoom" ? createForm.meetingLink : "",
        startDate: startDateTime.toISOString(),
        endDate: computedEndDate.toISOString(),
        schedule,
        previewVideoUrls,
        targetAudience,
        whatYouWillLearn,
        requirements,
        curriculumTopics,
        thumbnailFile: createForm.thumbnailFile || null,
      };

      await createAdminCourse(payload);
      setIsCreateOpen(false);
      setCreateTeacherQuery("");
      setCreateForm({
        title: "",
        description: "",
        category: parentCategories?.[0]?._id || "",
        subcategory: "",
        teacher: teachers?.[0]?._id || "",
        level: "beginner",
        language: "English",
        duration: "",
        durationWeeks: "8",
        totalSessions: "24",
        maxStudents: "100",
        minimumStudentsToStart: "1",
        pricingType: "paid",
        paymentPlan: "monthly",
        price: "",
        teacherDiscountPercentage: "0",
        status: "draft",
        courseType: "general",
        meetingType: "google_meet",
        meetingLink: "",
        startDate: "",
        startTime: "18:00",
        endTime: "19:00",
        selectedDays: ["monday", "wednesday", "friday"],
        targetAudienceText: "",
        whatYouWillLearnText: "",
        requirementsText: "",
        curriculumTopicsText: "",
        previewVideoUrlsText: "",
        thumbnailFile: null,
      });
      setToast("Course created successfully");
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Failed to create course");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleQuickCreateCategory = async () => {
    const name = window.prompt("Category name:");
    if (!name) return;

    try {
      const category = await createAdminCategory({
        name: name.trim(),
        description: "",
        isActive: true,
      });

      const rows = await fetchAdminCategories();
      setCategories(rows);
      setCreateForm((prev) => ({
        ...prev,
        category: category?._id || rows?.[0]?._id || "",
        subcategory: "",
      }));
      setToast("Category created");
    } catch (err) {
      setToast(err.message || "Failed to create category");
    }
  };

  const openEditModal = async (course) => {
    if (!course?._id) return;
    const fallbackTeacherId = String(teachers?.[0]?._id || "");
    setEditingCourseId(course._id);
    setEditingCoursePreview(course || null);
    setEditTeacherQuery("");
    setIsEditOpen(true);
    setEditLoading(true);

    try {
      const fullCourse = await fetchAdminCourseById(course._id);
      setEditingCoursePreview(fullCourse || course || null);
      setEditForm(getInitialEditForm(fullCourse || course, fallbackTeacherId));
    } catch (err) {
      setEditForm(getInitialEditForm(course, fallbackTeacherId));
      setToast(err?.message || "Failed to load full course details");
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdateCourse = async (event) => {
    event.preventDefault();
    if (!editingCourseId) return;

    try {
      setEditLoading(true);

      if (!editForm.category) {
        setToast("Please select a category");
        return;
      }
      const selectedTeacherId = normalizeTeacherId(editForm.teacher);
      const teacherIdForUpdate = selectedTeacherId || String(teachers?.[0]?._id || "");
      if (!teacherIdForUpdate) {
        setToast("Please select a teacher");
        return;
      }

      const isFree = editForm.pricingType === "free";
      const price = Number(editForm.price || 0);
      const teacherDiscountPercentage = Number(editForm.teacherDiscountPercentage || 0);
      const maxStudents = Number(editForm.maxStudents || 100);
      const minimumStudentsToStart = Number(editForm.minimumStudentsToStart || 1);
      const durationWeeks = Number(editForm.durationWeeks || 0);
      const totalSessions = Number(editForm.totalSessions || 0);
      const normalizedTeacherDiscountPercentage = clampPercentage(
        Number.isFinite(teacherDiscountPercentage) ? teacherDiscountPercentage : 0,
      );
      const titleLength = String(editForm.title || "").trim().length;
      const descriptionLength = String(editForm.description || "").trim().length;
      const targetAudience = editListFieldConfigs[0].items;
      const whatYouWillLearn = editListFieldConfigs[1].items;
      const requirements = editListFieldConfigs[2].items;
      const curriculumTopics = editListFieldConfigs[3].items;
      const previewVideoUrls = parseVideoLinks(editForm.previewVideoUrlsText);

      if (titleLength < TITLE_MIN_CHARS || titleLength > TITLE_MAX_CHARS) {
        setToast(`Course title must be between ${TITLE_MIN_CHARS} and ${TITLE_MAX_CHARS} characters.`);
        return;
      }

      if (descriptionLength < DESCRIPTION_MIN_CHARS || descriptionLength > DESCRIPTION_MAX_CHARS) {
        setToast(
          `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`,
        );
        return;
      }

      if (!isFree && price <= 0) {
        setToast("Paid course must have a price greater than 0");
        return;
      }

      if (
        !isFree &&
        (
          price < normalizeMinimumCoursePrice(pricingSettings.minTeacherCoursePrice) ||
          price > PRICE_MAX_USD ||
          !isWholeDollarAmount(price)
        )
      ) {
        setToast(
          `For a paid course, price must be at least ${pricingSettings.minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`,
        );
        return;
      }

      if (!isFree && (normalizedTeacherDiscountPercentage < 0 || normalizedTeacherDiscountPercentage > 100)) {
        setToast("Teacher discount percentage must be between 0 and 100.");
        return;
      }

      if (!Array.isArray(editForm.selectedDays) || new Set(editForm.selectedDays).size < 2) {
        setToast("Select at least two teaching days per week.");
        return;
      }

      if (!Number.isInteger(totalSessions) || totalSessions < COURSE_SESSIONS_MIN || totalSessions > COURSE_SESSIONS_MAX) {
        setToast(`Total sessions must be between ${COURSE_SESSIONS_MIN} and ${COURSE_SESSIONS_MAX}.`);
        return;
      }

      if (!Number.isInteger(durationWeeks) || durationWeeks < COURSE_WEEKS_MIN || durationWeeks > COURSE_WEEKS_MAX) {
        setToast(`Course duration in weeks must be between ${COURSE_WEEKS_MIN} and ${COURSE_WEEKS_MAX}.`);
        return;
      }

      if (
        !Number.isInteger(maxStudents) ||
        maxStudents < 1 ||
        maxStudents > 2000
      ) {
        setToast("Max students must be between 1 and 2000.");
        return;
      }

      if (
        !Number.isInteger(minimumStudentsToStart) ||
        minimumStudentsToStart < 1 ||
        minimumStudentsToStart > maxStudents
      ) {
        setToast("Minimum students to start must be at least 1 and cannot exceed course capacity.");
        return;
      }

      const invalidListField = getInvalidListField(editListFieldConfigs);
      if (invalidListField) {
        setToast(
          `${invalidListField.label} must have 1-${LIST_MAX_ITEMS} items, and each item must be ${LIST_ITEM_MIN_CHARS}-${LIST_ITEM_MAX_CHARS} characters.`,
        );
        return;
      }

      const previewVideoError = getPreviewVideoError(previewVideoUrls);
      if (previewVideoError) {
        setToast(previewVideoError);
        return;
      }

      const startMinutes = toMinutes(editForm.startTime);
      const endMinutes = toMinutes(editForm.endTime);
      if (endMinutes <= startMinutes) {
        setToast("End time must be after start time.");
        return;
      }

      const startDateTime = new Date(`${editForm.startDate}T${editForm.startTime}:00`);
      if (Number.isNaN(startDateTime.getTime())) {
        setToast("Start date/time is invalid.");
        return;
      }

      const computedEndDate = new Date(startDateTime);
      computedEndDate.setDate(computedEndDate.getDate() + durationWeeks * 7 - 1);
      const [endHours, endMinutesOnly] = editForm.endTime.split(":").map((value) => Number(value));
      computedEndDate.setHours(endHours || 0, endMinutesOnly || 0, 0, 0);

      const schedule = editForm.selectedDays.map((dayKey) => ({
        day: dayKey,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
      }));

      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
        subcategory: editForm.subcategory || null,
        teacher: teacherIdForUpdate,
        level: editForm.level,
        language: editForm.language,
        durationWeeks,
        totalSessions,
        maxStudents: Number.isFinite(maxStudents) && maxStudents > 0 ? maxStudents : 100,
        minimumStudentsToStart,
        status: editForm.status,
        isFree,
        paymentPlan: editForm.paymentPlan,
        price: isFree ? 0 : price,
        teacherDiscountPercentage: isFree ? 0 : normalizedTeacherDiscountPercentage,
        courseType: editForm.courseType,
        meetingType: editForm.meetingType,
        meetingLink: editForm.meetingType === "zoom" ? editForm.meetingLink.trim() : "",
        startDate: startDateTime.toISOString(),
        endDate: computedEndDate.toISOString(),
        schedule,
        previewVideoUrls,
        targetAudience,
        whatYouWillLearn,
        requirements,
        curriculumTopics,
        thumbnailFile: editForm.thumbnailFile || null,
        currency: "USD",
      };

      await updateAdminCourse(editingCourseId, payload);
      setIsEditOpen(false);
      setEditingCourseId("");
      setEditingCoursePreview(null);
      setToast("Course updated successfully");
      await loadCourses();
    } catch (err) {
      setToast(err.message || "Failed to update course");
    } finally {
      setEditLoading(false);
    }
  };

  const paginationItems = getPaginationItems(page, meta?.totalPages || 1);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${isRTL ? "text-right" : "text-left"}`}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">{pageTr("Course operations")}</p>
          <h1 className="mt-3 text-3xl font-black">{t("pages.courses.title") || pageTr("Courses")}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-slate-800">
            {pageTr("Manage, approve, publish, and moderate all courses from one clear workspace.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-slate-900 transition hover:bg-blue-50"
          >
            <Plus size={16} /> {pageTr("Create Course")}
          </button>
        </div>
      </div>
      </div>

      <div className="flex flex-nowrap gap-4">
        {[
          { title: pageTr("Visible courses"), value: formatNumber(summary.published, language), tone: "bg-blue-50 text-blue-700", icon: Eye },
          { title: pageTr("Pending approval"), value: formatNumber(summary.pending, language), tone: "bg-amber-50 text-amber-700", icon: Clock3 },
          { title: pageTr("Rejected"), value: formatNumber(summary.rejected, language), tone: "bg-rose-50 text-rose-700", icon: XCircle },
          { title: pageTr("Loaded this page"), value: formatNumber(summary.total, language), tone: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
        ].map((card) => (
          <article key={card.title} className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-black text-slate-900">{card.title}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">{pageTr("Course directory")}</h2>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {pageTr("Search by course title and manage every course from one table.")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-slate-400">
            <Search size={16} className="text-slate-400" />
            </span>
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="block h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
              placeholder={pageTr("Search by course title")}
            />
          </label>

          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All Categories")}</option>
            {parentCategories.map((item) => (
              <option key={item._id} value={item._id}>{formatCategoryPathLabel(item)}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            {statusFilterOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value === "all" ? pageTr(item.label) : mapStatusLabel(item.label, pageTr)}
              </option>
            ))}
          </select>

          <select
            value={teacherFilter}
            onChange={(e) => {
              setPage(1);
              setTeacherFilter(e.target.value);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All teachers")}</option>
            {teachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.name || teacher.email || "-"}
              </option>
            ))}
          </select>

          <select
            value={pricingFilter}
            onChange={(e) => {
              setPage(1);
              setPricingFilter(e.target.value);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
          >
            <option value="all">{pageTr("All pricing")}</option>
            <option value="free">{pageTr("Free")}</option>
            <option value="paid">{pageTr("Paid")}</option>
          </select>

        </div>
      </section>

      {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</div> : null}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Course")}</th>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Teacher")}</th>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Category")}</th>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Price")}</th>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Students")}</th>
                <th className={`px-5 py-4 font-black ${isRTL ? "text-right" : "text-left"}`}>{pageTr("Status")}</th>
                <th className="px-5 py-4 text-center font-black text-slate-500">{pageTr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <AdminPageLoader
                      label={pageTr("Loading courses")}
                      minHeight="min-h-[160px]"
                      className="border-0 bg-transparent p-0"
                    />
                  </td>
                </tr>
              ) : null}
              {courses.map((course) => (
                <tr key={course._id} className="align-middle transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex min-w-[260px] items-center gap-3">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img
                          src={resolveAssetUrl(course.thumbnail) || "/logo-en.png"}
                          alt={course.title || "Course"}
                          className={`h-full w-full ${course.thumbnail ? "object-cover" : "object-contain p-2"}`}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/logo-en.png";
                            event.currentTarget.className = "h-full w-full object-contain p-2";
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{course.title}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">{course.shortDescription || "-"}</p>
                        {course.cancellationRequest?.status === "pending" ? (
                          <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-700">
                            {pageTr("Cancellation requested")}
                          </span>
                        ) : null}
                        {course.endRequest?.status === "pending" ? (
                          <span className="mt-1 ml-2 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-700">
                            {pageTr("End requested")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{course.teacher?.name || "-"}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                    {course.subcategory?.name
                      ? `${course.category?.name || "-"} / ${course.subcategory.name}`
                      : course.category?.name || "-"}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{course.isFree ? pageTr("Free") : `${course.price || 0} ${course.currency || "USD"}`}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatNumber(course.enrolledStudentsCount || 0, language)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass[course.status] || "bg-slate-100 text-slate-700"}`}>
                      {mapStatusLabel(course.status, pageTr)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap">
                      <div className="inline-flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => openReviewModal(course)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                          title={pageTr("Review")}
                        >
                          <ScanSearch size={18} />
                        </button>

                        <button
                          onClick={() => openEditModal(course)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
                          title={pageTr("Edit")}
                        >
                          <SquarePen size={18} />
                        </button>
                      </div>

                      {course.status === "pending" ? (
                        <>
                          <button
                            onClick={() => openCourseApprovalModal(course)}
                            className="rounded-xl p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                            title={pageTr("Approve")}
                          >
                            <BadgeCheck size={18} />
                          </button>
                          <button
                            onClick={() => {
                              const reason = window.prompt("Rejection reason:", "Needs improvement");
                              if (!reason) return;
                              handleAction(() => rejectAdminCourse(course._id, reason), "Course rejected");
                            }}
                            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title={pageTr("Reject")}
                          >
                            <Ban size={18} />
                          </button>
                        </>
                      ) : null}

                      {course.status === "approved" || course.status === "draft" ? (
                        <button
                          onClick={() => openCoursePublishModal(course)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                          title={pageTr("Publish")}
                        >
                          <Globe2 size={18} />
                        </button>
                      ) : null}

                      {course.status === "published" ? (
                        <button
                          onClick={() => handleAction(() => unpublishAdminCourse(course._id), "Course unpublished")}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                          title={pageTr("Unpublish")}
                        >
                          <XCircle size={18} />
                        </button>
                      ) : null}

                      {course.cancellationRequest?.status === "pending" ? (
                        <>
                          <button
                            onClick={() => handleCancellationDecision(course, "approved")}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700"
                          >
                            <CheckCircle2 size={14} /> Accept Cancel
                          </button>
                          <button
                            onClick={() => handleCancellationDecision(course, "rejected")}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700"
                          >
                            <XCircle size={14} /> Reject Cancel
                          </button>
                        </>
                      ) : null}
                      {course.endRequest?.status === "pending" ? (
                        <>
                          <button
                            onClick={() => handleEndRequestDecision(course, "approved")}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs font-bold text-sky-700"
                          >
                            <CheckCircle2 size={14} /> Approve End
                          </button>
                          <button
                            onClick={() => handleEndRequestDecision(course, "rejected")}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700"
                          >
                            <Ban size={14} /> Reject End
                          </button>
                        </>
                      ) : null}

                      <button
                        onClick={() => openSessionsModal(course)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                        title={pageTr("Sessions")}
                      >
                        <ListChecks size={18} />
                      </button>

                      <button
                        onClick={() => {
                          if (!window.confirm("Delete this course?")) return;
                          handleAction(() => deleteAdminCourse(course._id), "Course deleted");
                        }}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title={pageTr("Delete")}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && courses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center font-bold text-slate-900">
                    {pageTr("No courses found.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-700">
            {pageTr("Page")} <span className="text-slate-950">{formatNumber(page, language)}</span> {pageTr("of")} <span className="text-slate-950">{formatNumber(meta?.totalPages || 1, language)}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1}
            >
              {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {paginationItems.map((item, idx) =>
              item === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-sm font-black text-slate-400">...</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(Number(item))}
                  className={`h-9 min-w-[2.25rem] rounded-xl px-3 text-sm font-black transition ${
                    Number(item) === page
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {formatNumber(item, language)}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(meta?.totalPages || 1, p + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition enabled:hover:bg-slate-50 enabled:hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page >= (meta?.totalPages || 1)}
            >
              {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[120] rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-xl">{toast}</div>
      ) : null}

      {sessionModalCourse ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-black text-slate-900">
                Sessions - {sessionModalCourse?.title || "Course"}
              </h3>
              <button
                type="button"
                onClick={() => setSessionModalCourse(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {sessionLoading ? (
                <p className="text-sm font-semibold text-slate-500">در حال بارگذاری جلسات</p>
              ) : null}
              {!sessionLoading && sessionRows.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No sessions generated yet.</p>
              ) : null}
              {!sessionLoading && sessionRows.length > 0 ? (
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Meet Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessionRows.map((session) => {
                      const start = new Date(session.startAt);
                      const end = new Date(session.endAt);
                      return (
                        <tr key={session._id}>
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {Number.isNaN(start.getTime())
                              ? "-"
                              : start.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                              ? "-"
                              : `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass[session.status] || "bg-slate-100 text-slate-700"}`}>
                              {session.status || "scheduled"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {session.meetingLink ? (
                              <a
                                href={session.meetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary-700 hover:underline"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reviewCourse ? (
        <div className="fixed inset-0 z-[128] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="max-h-[90vh] overflow-hidden [direction:ltr]">
              <div className="max-h-[90vh] overflow-y-auto [direction:ltr]">
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <div className="border-b border-slate-200 bg-white">
                    <div className="bg-gradient-to-br from-slate-950 via-[#0B4FD8] to-[#0EA5E9] px-6 py-6 text-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
                            <img
                              src={resolveAssetUrl(reviewCourse.thumbnail) || "/logo-en.png"}
                              alt={reviewCourse.title || "Course"}
                              className={`h-full w-full ${
                                reviewCourse.thumbnail ? "object-cover" : "object-contain p-2"
                              }`}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/logo-en.png";
                                event.currentTarget.className = "h-full w-full object-contain p-2";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                              {pageTr("Course details")}
                            </p>
                            <h3 className="mt-2 truncate text-2xl font-black">
                              {reviewCourse.title || "-"}
                            </h3>
                            <p className="mt-1 truncate text-sm font-medium text-blue-50/95">
                              {reviewCourse.teacher?.name || reviewCourse.teacher?.email || "-"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReviewCourse(null)}
                          className="rounded-xl bg-white/12 p-2 text-white transition hover:bg-white/20"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-6">
              {reviewLoading ? (
                <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  {pageTr("Loading full course details")}
                </p>
              ) : null}

                      <div className="grid gap-3 md:grid-cols-4">
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Status")}</p>
                          <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusBadgeClass[reviewCourse.status] || "bg-slate-100 text-slate-700"}`}>
                            {reviewCourse.status || "draft"}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Pricing")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {reviewCourse.isFree ? pageTr("Free") : pageTr("Paid")}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Students")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {formatNumber(reviewCourse.enrolledStudentsCount || 0, language)}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Joined")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {formatDateTime(reviewCourse.createdAt)}
                          </p>
                        </article>
                      </div>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-base font-black text-slate-950">{pageTr("Description")}</h4>
                    <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm font-semibold leading-7 text-slate-600">
                      {reviewCourse.description || pageTr("No description provided.")}
                    </p>
                  </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Course profile")}</h4>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <InfoRow label={pageTr("Teacher")} value={reviewCourse.teacher?.name || "-"} />
                          <InfoRow label={pageTr("Teacher email")} value={reviewCourse.teacher?.email || "-"} dir="ltr" />
                          <InfoRow
                            label={pageTr("Category")}
                            value={
                              reviewCourse.subcategory?.name
                                ? `${reviewCourse.category?.name || "-"} / ${reviewCourse.subcategory.name}`
                                : reviewCourse.category?.name || "-"
                            }
                          />
                          <InfoRow label={pageTr("Level")} value={reviewCourse.level || "-"} />
                          <InfoRow label={pageTr("Language")} value={reviewCourse.language || "-"} />
                          <InfoRow label={pageTr("Max students")} value={reviewCourse.maxStudents || 0} />
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-base font-black text-slate-950">{pageTr("Course activity")}</h4>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatTile
                        label={pageTr("Price")}
                        value={
                          reviewCourse.isFree
                            ? pageTr("Free")
                            : `${reviewCourse.price || 0} ${reviewCourse.currency || "USD"}`
                        }
                        tone="blue"
                      />
                      <StatTile
                        label={pageTr("Discount")}
                        value={formatNumber(reviewCourse.discountPrice || 0, language)}
                        tone="emerald"
                      />
                      <StatTile
                        label={pageTr("Teacher discount")}
                        value={`${formatNumber(reviewCourse.teacherDiscountPercentage || 0, language)}%`}
                        tone="violet"
                      />
                      <StatTile
                        label={pageTr("Updated")}
                        value={formatDateTime(reviewCourse.updatedAt)}
                        tone="amber"
                      />
                    </div>
                  </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-base font-black text-slate-950">{pageTr("Admin insights")}</h4>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            {reviewCourse.isPublished ? pageTr("Live on platform") : pageTr("Not live yet")}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <InfoRow label={pageTr("Meeting type")} value={formatMeetingTypeLabel(reviewCourse.meetingType)} />
                          <InfoRow label={pageTr("Payment plan")} value={reviewCourse.paymentPlan || "-"} />
                          <InfoRow
                            label={pageTr("Minimum students to start")}
                            value={formatNumber(reviewCourse.minimumStudentsToStart || 0, language)}
                          />
                          <InfoRow
                            label={pageTr("Duration weeks")}
                            value={formatNumber(reviewCourse.durationWeeks || 0, language)}
                          />
                          <InfoRow
                            label={pageTr("Total sessions")}
                            value={formatNumber(reviewCourse.totalSessions || 0, language)}
                          />
                          <InfoRow
                            label={pageTr("Platform commission")}
                            value={`${formatNumber(reviewCourse.commissionPercentage || 0, language)}%`}
                          />
                          <InfoRow
                            label={pageTr("Created by")}
                            value={reviewCourse.createdBy?.name || reviewCourse.createdBy?.email || "-"}
                          />
                          <InfoRow
                            label={pageTr("Creator email")}
                            value={reviewCourse.createdBy?.email || "-"}
                            dir="ltr"
                          />
                          <InfoRow
                            label={pageTr("Publish state")}
                            value={reviewCourse.isPublished ? pageTr("Published") : pageTr("Unpublished")}
                          />
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-base font-black text-slate-950">{pageTr("Schedule")}</h4>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InfoRow label={pageTr("Start date")} value={formatDateTime(reviewCourse.startDate)} />
                      <InfoRow label={pageTr("End date")} value={formatDateTime(reviewCourse.endDate)} />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <InfoRow label={pageTr("Class started")} value={formatDateTime(reviewCourse.classStartedAt)} />
                      <InfoRow label={pageTr("Class ended")} value={formatDateTime(reviewCourse.classEndedAt)} />
                      <InfoRow label={pageTr("Class cancelled")} value={formatDateTime(reviewCourse.classCancelledAt)} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {Array.isArray(reviewCourse.schedule) && reviewCourse.schedule.length ? (
                        reviewCourse.schedule.map((row, index) => (
                          <div key={`${row.day}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                              <span>{row.day}</span>
                              <span>{row.startTime} - {row.endTime}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm font-semibold text-slate-500">{pageTr("No schedule submitted.")}</p>
                      )}
                    </div>
                  </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Media and access")}</h4>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <InfoRow
                            label={pageTr("Meeting link")}
                            value={reviewCourse.meetingLink || "-"}
                            dir="ltr"
                          />
                          <InfoRow
                            label={pageTr("Promo video")}
                            value={reviewCourse.promoVideo || "-"}
                            dir="ltr"
                          />
                        </div>
                        {Array.isArray(reviewCourse.previewVideoUrls) && reviewCourse.previewVideoUrls.length ? (
                          <div className="mt-4 space-y-3">
                            {reviewCourse.previewVideoUrls.map((link, index) => (
                              <a
                                key={`${link}-${index}`}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <span className="truncate" dir="ltr">
                                  {pageTr("Preview video")} {index + 1}: {link}
                                </span>
                                <span className="shrink-0">{pageTr("Open")}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </section>

                      {reviewCourse.rejectionReason ? (
                    <section className="border border-rose-200 bg-rose-50 p-5 shadow-sm">
                      <h4 className="text-base font-black text-rose-900">{pageTr("Rejection Reason")}</h4>
                      <p className="mt-2 text-sm font-semibold leading-6 text-rose-800">
                        {reviewCourse.rejectionReason}
                      </p>
                    </section>
                  ) : null}

                      {reviewCourse.cancellationRequest?.status &&
                      reviewCourse.cancellationRequest.status !== "none" ? (
                    <section className="border border-rose-200 bg-rose-50 p-5 shadow-sm">
                      <h4 className="text-base font-black text-rose-900">{pageTr("Cancellation Request")}</h4>
                      <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
                        <InfoRow label={pageTr("Status")} value={reviewCourse.cancellationRequest.status} />
                        <InfoRow
                          label={pageTr("Requested")}
                          value={formatDateTime(reviewCourse.cancellationRequest.requestedAt)}
                        />
                        <InfoRow
                          label={pageTr("Teacher reason")}
                          value={reviewCourse.cancellationRequest.reason || "-"}
                        />
                        {reviewCourse.cancellationRequest.adminResponse ? (
                          <InfoRow
                            label={pageTr("Admin response")}
                            value={reviewCourse.cancellationRequest.adminResponse}
                          />
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                      {reviewCourse.endRequest?.status &&
                      reviewCourse.endRequest.status !== "none" ? (
                    <section className="border border-sky-200 bg-sky-50 p-5 shadow-sm">
                      <h4 className="text-base font-black text-sky-900">{pageTr("End requested")}</h4>
                      <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
                        <InfoRow label={pageTr("Status")} value={reviewCourse.endRequest.status} />
                        <InfoRow
                          label={pageTr("Requested")}
                          value={formatDateTime(reviewCourse.endRequest.requestedAt)}
                        />
                        <InfoRow
                          label={pageTr("Teacher reason")}
                          value={reviewCourse.endRequest.reason || "-"}
                        />
                        {reviewCourse.endRequest.adminResponse ? (
                          <InfoRow
                            label={pageTr("Admin response")}
                            value={reviewCourse.endRequest.adminResponse}
                          />
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setReviewCourse(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {pageTr("Close")}
              </button>
              <button
                type="button"
                onClick={() => handleReviewDecision("rejected")}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
              >
                {pageTr("Reject Course")}
              </button>
              {reviewCourse.cancellationRequest?.status === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleCancellationDecision(reviewCourse, "rejected")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {pageTr("Reject Cancellation")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancellationDecision(reviewCourse, "approved")}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
                  >
                    {pageTr("Approve Cancellation")}
                  </button>
                </>
              ) : null}
              {reviewCourse.endRequest?.status === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleEndRequestDecision(reviewCourse, "rejected")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Reject End Request
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEndRequestDecision(reviewCourse, "approved")}
                    className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
                  >
                    Approve End Request
                  </button>
                </>
              ) : null}
                <button
                  type="button"
                  onClick={() => handleReviewDecision("approved")}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                {pageTr("Approve Course")}
              </button>
            </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-black text-slate-900">Create Course</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="grid gap-3 p-4 sm:grid-cols-2">
              <input
                required
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none sm:col-span-2"
                placeholder="Course title"
              />
              <textarea
                required
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none sm:col-span-2"
                placeholder="Full description"
              />
              <div className="space-y-2">
              <select
                required
                value={createForm.category}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                >
                  {categories.length === 0 ? (
                    <option value="">No categories available</option>
                  ) : null}
                  {parentCategories.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={createForm.subcategory}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, subcategory: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                >
                  <option value="">No subcategory</option>
                  {createSubcategoryOptions.map((item) => (
                    <option key={item._id} value={item._id}>
                      {formatCategoryPathLabel(item)}
                    </option>
                  ))}
                </select>
                {categories.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleQuickCreateCategory}
                    className="text-xs font-bold text-primary-700 hover:text-primary-800"
                  >
                    + Create category now
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                <input
                  value={createTeacherQuery}
                  onChange={(e) => setCreateTeacherQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                  placeholder="Search teacher by email"
                />
                <select
                  required
                  value={createForm.teacher}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, teacher: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                >
                  {createTeacherOptions.length === 0 ? (
                    <option value="">No matching teachers</option>
                  ) : null}
                  {createTeacherOptions.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.email} {item.name ? `(${item.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={createForm.level}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, level: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
              </select>
              <select
                value={createForm.language}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, language: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="English">English</option>
                <option value="Persian">Persian</option>
                <option value="Pashto">Pashto</option>
                <option value="Arabic">Arabic</option>
              </select>
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
              <select
                value={createForm.courseType}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, courseType: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="general">General</option>
                <option value="special">Special</option>
              </select>
              <select
                value={createForm.meetingType}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    meetingType: e.target.value,
                    meetingLink: e.target.value === "zoom" ? prev.meetingLink : "",
                  }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="physical">Physical</option>
                <option value="recorded">Recorded</option>
              </select>
              {createForm.meetingType === "zoom" ? (
                <input
                  value={createForm.meetingLink}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                  placeholder="Zoom link"
                  required
                />
              ) : null}
              <input
                value={createForm.duration}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, duration: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                placeholder="Duration"
              />
              <input
                type="number"
                min="1"
                value={createForm.durationWeeks}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, durationWeeks: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                placeholder="Duration weeks"
              />
              <input
                type="number"
                min="8"
                value={createForm.totalSessions}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, totalSessions: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                placeholder="Total sessions"
              />
              <input
                type="number"
                min="1"
                value={createForm.maxStudents}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, maxStudents: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                placeholder="Max students"
              />
              <input
                type="number"
                min="1"
                value={createForm.minimumStudentsToStart}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, minimumStudentsToStart: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                placeholder="Minimum students to start"
              />
              <select
                value={createForm.paymentPlan}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, paymentPlan: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="whole_period">Whole period</option>
              </select>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-bold text-slate-600">Teaching days</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {DAY_OPTIONS.map((day) => (
                    <label key={day.key} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={createForm.selectedDays.includes(day.key)}
                        onChange={() => toggleCreateDay(day.key)}
                        className="h-4 w-4"
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <input
                type="date"
                value={createForm.startDate}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              />
              <input
                type="time"
                value={createForm.startTime}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, startTime: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                required
              />
              <input
                type="time"
                value={createForm.endTime}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, endTime: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                required
              />
              <select
                value={createForm.pricingType}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    pricingType: e.target.value,
                    price: e.target.value === "free" ? "0" : prev.price,
                    teacherDiscountPercentage:
                      e.target.value === "free" ? "0" : prev.teacherDiscountPercentage,
                  }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
              >
                <option value="paid">Paid</option>
                <option value="free">Free</option>
              </select>
              <input
                type="number"
                min="0"
                value={createForm.price}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, price: e.target.value }))}
                className={`h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none ${
                  createForm.pricingType === "free"
                    ? "bg-slate-100 text-slate-400"
                    : "bg-slate-50"
                }`}
                placeholder="Price (USD)"
                required={createForm.pricingType !== "free"}
                disabled={createForm.pricingType === "free"}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={createForm.teacherDiscountPercentage}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, teacherDiscountPercentage: e.target.value }))
                }
                className={`h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none ${
                  createForm.pricingType === "free"
                    ? "bg-slate-100 text-slate-400"
                    : "bg-slate-50"
                }`}
                placeholder="Teacher discount %"
                disabled={createForm.pricingType === "free"}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoRow label="Teacher effective price" value={`${formatUsdtAmount(createPricingPreview.teacherEffectivePrice)} USD`} />
                  <InfoRow label="Platform discount" value={`${formatNumber(pricingSettings.globalCourseDiscountPercentage, language)}%`} />
                  <InfoRow label="Final student price" value={`${formatUsdtAmount(createPricingPreview.studentFinalPrice)} USD`} />
                  <InfoRow label="Teacher payout" value={`${formatUsdtAmount(createPricingPreview.teacherNetIncome)} USD`} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, thumbnailFile: e.target.files?.[0] || null }))}
                  className="block w-full text-sm font-semibold text-slate-700"
                />
              </div>
              <textarea
                value={createForm.targetAudienceText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, targetAudienceText: e.target.value }))}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                placeholder="Target audience, one line per item"
              />
              <textarea
                value={createForm.whatYouWillLearnText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, whatYouWillLearnText: e.target.value }))}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                placeholder="What students will learn, one line per item"
              />
              <textarea
                value={createForm.requirementsText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, requirementsText: e.target.value }))}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                placeholder="Requirements, one line per item"
              />
              <textarea
                value={createForm.curriculumTopicsText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, curriculumTopicsText: e.target.value }))}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                placeholder="Curriculum topics, one line per item"
              />
              <textarea
                value={createForm.previewVideoUrlsText}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, previewVideoUrlsText: e.target.value }))}
                className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none sm:col-span-2"
                placeholder="YouTube preview video links, one per line"
              />

              <div className="mt-1 flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="h-11 flex-1 rounded-xl bg-primary-600 text-sm font-bold text-white disabled:opacity-60"
                >
                  {createLoading ? "Creating" : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="max-h-[90vh] overflow-hidden [direction:ltr]">
              <div className="max-h-[90vh] overflow-y-auto [direction:ltr]">
                <div dir={isRTL ? "rtl" : "ltr"}>
                  <div className="border-b border-slate-200 bg-white">
                    <div className="bg-gradient-to-br from-slate-950 via-[#0B4FD8] to-[#0EA5E9] px-6 py-6 text-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
                            <img
                              src={resolveAssetUrl(editingCoursePreview?.thumbnail) || "/logo-en.png"}
                              alt={editForm.title || "Course"}
                              className={`h-full w-full ${
                                editingCoursePreview?.thumbnail ? "object-cover" : "object-contain p-2"
                              }`}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/logo-en.png";
                                event.currentTarget.className = "h-full w-full object-contain p-2";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                              {pageTr("Edit course")}
                            </p>
                            <h3 className="mt-2 truncate text-2xl font-black">
                              {editForm.title || editingCoursePreview?.title || "-"}
                            </h3>
                            <p className="mt-1 truncate text-sm font-medium text-blue-50/95">
                              {selectedEditTeacher?.name || selectedEditTeacher?.email || "-"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditOpen(false);
                            setEditingCoursePreview(null);
                          }}
                          className="rounded-xl bg-white/12 p-2 text-white transition hover:bg-white/20"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateCourse} className="p-6">
                    <div className="space-y-6">
                      <div className="grid gap-3 md:grid-cols-4">
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Status")}</p>
                          <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusBadgeClass[editForm.status] || "bg-slate-100 text-slate-700"}`}>
                            {editForm.status || "draft"}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Pricing")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {editForm.pricingType === "free" ? pageTr("Free") : pageTr("Paid")}
                          </p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Teacher discount")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">{editForm.teacherDiscountPercentage || 0}%</p>
                        </article>
                        <article className="border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{pageTr("Price")}</p>
                          <p className="mt-2 text-sm font-black text-slate-900">
                            {editForm.pricingType === "free" ? pageTr("Free") : `${formatUsdtAmount(editPricingPreview.studentFinalPrice)} USD`}
                          </p>
                        </article>
                      </div>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Course content")}</h4>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <FieldLabel>{pageTr("Course title")}</FieldLabel>
                            <input
                              required
                              value={editForm.title}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              placeholder={pageTr("Course title")}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <FieldLabel>{pageTr("Full description")}</FieldLabel>
                            <textarea
                              required
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              className="min-h-[136px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder={pageTr("Full description")}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Course profile")}</h4>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <InfoRow
                            label={pageTr("Teacher")}
                            value={selectedEditTeacher?.name || selectedEditTeacher?.email || "-"}
                          />
                          <InfoRow label={pageTr("Teacher email")} value={selectedEditTeacher?.email || "-"} dir="ltr" />
                          <InfoRow
                            label={pageTr("Category")}
                            value={
                              selectedEditSubcategory?.name
                                ? `${selectedEditCategory?.name || "-"} / ${selectedEditSubcategory.name}`
                                : selectedEditCategory?.name || "-"
                            }
                          />
                          <InfoRow label={pageTr("Level")} value={editForm.level || "-"} />
                          <InfoRow label={pageTr("Language")} value={editForm.language || "-"} />
                          <InfoRow label={pageTr("Status")} value={editForm.status || "-"} />
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Editable setup")}</h4>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <FieldLabel>{pageTr("Category")}</FieldLabel>
                            <select
                              required
                              value={editForm.category}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))
                              }
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              {parentCategories.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("No subcategory") === "No subcategory" ? "Subcategory" : "زیرکتگوری"}</FieldLabel>
                            <select
                              value={editForm.subcategory}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, subcategory: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="">{pageTr("No subcategory")}</option>
                              {editSubcategoryOptions.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {formatCategoryPathLabel(item)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <div>
                              <FieldLabel>{pageTr("Search teacher by email")}</FieldLabel>
                              <input
                                value={editTeacherQuery}
                                onChange={(e) => setEditTeacherQuery(e.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                                placeholder={pageTr("Search teacher by email")}
                              />
                            </div>
                            <div>
                              <FieldLabel>{pageTr("Teacher")}</FieldLabel>
                              <select
                                required
                                value={editForm.teacher}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, teacher: e.target.value }))}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              >
                                {editTeacherOptions.length === 0 ? (
                                  <option value="">{pageTr("No matching teachers")}</option>
                                ) : null}
                                {editTeacherOptions.map((item) => (
                                  <option key={item._id} value={item._id}>
                                    {item.email} {item.name ? `(${item.name})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Level")}</FieldLabel>
                            <select
                              value={editForm.level}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, level: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="beginner">beginner</option>
                              <option value="intermediate">intermediate</option>
                              <option value="advanced">advanced</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Language")}</FieldLabel>
                            <select
                              value={editForm.language}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, language: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="English">English</option>
                              <option value="Persian">Persian</option>
                              <option value="Pashto">Pashto</option>
                              <option value="Arabic">Arabic</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Status")}</FieldLabel>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="draft">draft</option>
                              <option value="pending">pending</option>
                              <option value="approved">approved</option>
                              <option value="published">published</option>
                              <option value="rejected">rejected</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Course type") || "Course type"}</FieldLabel>
                            <select
                              value={editForm.courseType}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, courseType: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="general">General</option>
                              <option value="special">Special</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Max students")}</FieldLabel>
                            <input
                              type="number"
                              min="1"
                              value={editForm.maxStudents}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, maxStudents: e.target.value }))
                              }
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              placeholder="Max students"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Minimum students to start")}</FieldLabel>
                            <input
                              type="number"
                              min="1"
                              value={editForm.minimumStudentsToStart}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, minimumStudentsToStart: e.target.value }))
                              }
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              placeholder="Minimum students to start"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Payment plan")}</FieldLabel>
                            <select
                              value={editForm.paymentPlan}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, paymentPlan: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="whole_period">Whole period</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Duration weeks")}</FieldLabel>
                            <input
                              type="number"
                              min="1"
                              value={editForm.durationWeeks}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, durationWeeks: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              placeholder="Duration weeks"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Total sessions")}</FieldLabel>
                            <input
                              type="number"
                              min="8"
                              value={editForm.totalSessions}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, totalSessions: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                              placeholder="Total sessions"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Start date")}</FieldLabel>
                            <input
                              type="date"
                              value={editForm.startDate}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, startDate: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Meeting type")}</FieldLabel>
                            <select
                              value={editForm.meetingType}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  meetingType: e.target.value,
                                  meetingLink: e.target.value === "zoom" ? prev.meetingLink : "",
                                }))
                              }
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="google_meet">Google Meet</option>
                              <option value="zoom">Zoom</option>
                              <option value="physical">Physical</option>
                              <option value="recorded">Recorded</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Start date") === "Start date" ? "Start time" : "زمان شروع"}</FieldLabel>
                            <input
                              type="time"
                              value={editForm.startTime}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("End date") === "End date" ? "End time" : "زمان ختم"}</FieldLabel>
                            <input
                              type="time"
                              value={editForm.endTime}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            />
                          </div>
                          {editForm.meetingType === "zoom" ? (
                            <div className="md:col-span-2">
                              <FieldLabel>{pageTr("Meeting link")}</FieldLabel>
                              <input
                                value={editForm.meetingLink}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                                placeholder="Zoom link"
                              />
                            </div>
                          ) : null}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                            <FieldLabel>Teaching days</FieldLabel>
                            <p className="text-xs font-bold text-slate-600">Teaching days</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-4">
                              {DAY_OPTIONS.map((day) => (
                                <label key={day.key} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={editForm.selectedDays.includes(day.key)}
                                    onChange={() => toggleEditDay(day.key)}
                                    className="h-4 w-4"
                                  />
                                  <span>{day.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <FieldLabel>Course image</FieldLabel>
                            <div className="flex items-center gap-3">
                              <div className="h-16 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                <img
                                  src={
                                    editForm.thumbnailFile
                                      ? URL.createObjectURL(editForm.thumbnailFile)
                                      : resolveAssetUrl(editForm.existingThumbnail) || "/logo-en.png"
                                  }
                                  alt={editForm.title || "Course"}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    thumbnailFile: e.target.files?.[0] || null,
                                  }))
                                }
                                className="block w-full text-sm font-semibold text-slate-700"
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">{pageTr("Pricing")}</h4>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div>
                            <FieldLabel>{pageTr("Pricing")}</FieldLabel>
                            <select
                              value={editForm.pricingType}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  pricingType: e.target.value,
                                  price: e.target.value === "free" ? "0" : prev.price,
                                  teacherDiscountPercentage: e.target.value === "free" ? "0" : prev.teacherDiscountPercentage,
                                }))
                              }
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
                            >
                              <option value="paid">Paid</option>
                              <option value="free">Free</option>
                            </select>
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Price")}</FieldLabel>
                            <input
                              type="number"
                              min="0"
                              value={editForm.price}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                              className={`h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none ${
                                editForm.pricingType === "free" ? "bg-slate-100 text-slate-400" : "bg-slate-50"
                              }`}
                              placeholder={`${pageTr("Price")} (USD)`}
                              required={editForm.pricingType !== "free"}
                              disabled={editForm.pricingType === "free"}
                            />
                          </div>
                          <div>
                            <FieldLabel>{pageTr("Teacher discount")}</FieldLabel>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.teacherDiscountPercentage}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, teacherDiscountPercentage: e.target.value }))
                              }
                              className={`h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none ${
                                editForm.pricingType === "free" ? "bg-slate-100 text-slate-400" : "bg-slate-50"
                              }`}
                              placeholder="Teacher discount %"
                              disabled={editForm.pricingType === "free"}
                            />
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <InfoRow label="Teacher effective price" value={`${formatUsdtAmount(editPricingPreview.teacherEffectivePrice)} USD`} />
                              <InfoRow label="Platform discount" value={`${formatNumber(pricingSettings.globalCourseDiscountPercentage, language)}%`} />
                              <InfoRow label="Final student price" value={`${formatUsdtAmount(editPricingPreview.studentFinalPrice)} USD`} />
                              <InfoRow label="Teacher payout" value={`${formatUsdtAmount(editPricingPreview.teacherNetIncome)} USD`} />
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="border border-slate-200 bg-white p-5 shadow-sm">
                        <h4 className="text-base font-black text-slate-950">Course lists and preview media</h4>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <FieldLabel>Target audience</FieldLabel>
                            <textarea
                              value={editForm.targetAudienceText}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, targetAudienceText: e.target.value }))}
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder="Target audience, one line per item"
                            />
                          </div>
                          <div>
                            <FieldLabel>What students will learn</FieldLabel>
                            <textarea
                              value={editForm.whatYouWillLearnText}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, whatYouWillLearnText: e.target.value }))}
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder="What students will learn, one line per item"
                            />
                          </div>
                          <div>
                            <FieldLabel>Requirements</FieldLabel>
                            <textarea
                              value={editForm.requirementsText}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, requirementsText: e.target.value }))}
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder="Requirements, one line per item"
                            />
                          </div>
                          <div>
                            <FieldLabel>Curriculum topics</FieldLabel>
                            <textarea
                              value={editForm.curriculumTopicsText}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, curriculumTopicsText: e.target.value }))}
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder="Curriculum topics, one line per item"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <FieldLabel>Preview video links</FieldLabel>
                            <textarea
                              value={editForm.previewVideoUrlsText}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, previewVideoUrlsText: e.target.value }))}
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                              placeholder="YouTube preview video links, one per line"
                            />
                          </div>
                        </div>
                      </section>

                      <div className="border-t border-slate-200 bg-white pt-4">
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditOpen(false);
                              setEditingCoursePreview(null);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            {pageTr("Cancel")}
                          </button>
                          <button
                            type="submit"
                            disabled={editLoading}
                            className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {editLoading ? pageTr("Saving") : pageTr("Save Changes")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <AdminNotificationModal
        open={courseApprovalModal.open}
        title="Approve course"
        description="Confirm you checked everything needed, then choose whether to send notifications now."
        payload={courseApprovalModal.payload}
        onChange={(updater) =>
          setCourseApprovalModal((prev) => ({
            ...prev,
            payload: typeof updater === "function" ? updater(prev.payload) : updater,
          }))
        }
        onClose={closeCourseApprovalModal}
        onConfirm={handleApproveCourseWithModal}
        confirmLabel="Approve course"
      />
      <AdminNotificationModal
        open={coursePublishModal.open}
        title="Publish course"
        description="Confirm this course is ready to go live, then choose which notifications to send."
        payload={coursePublishModal.payload}
        onChange={(updater) =>
          setCoursePublishModal((prev) => ({
            ...prev,
            payload: typeof updater === "function" ? updater(prev.payload) : updater,
          }))
        }
        onClose={closeCoursePublishModal}
        onConfirm={handlePublishCourseWithModal}
        confirmLabel="Publish course"
      />
    </div>
  );
}

function AdminNotificationModal({
  open,
  title,
  description,
  payload,
  onChange,
  onClose,
  onConfirm,
  confirmLabel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <input
              type="checkbox"
              checked={Boolean(payload.confirmationChecked)}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, confirmationChecked: event.target.checked }))
              }
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm font-bold text-emerald-900">
              I checked everything needed before continuing.
            </span>
          </label>

          <div>
            <FieldLabel>Notification audience</FieldLabel>
            <select
              value={payload.notificationAudience}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, notificationAudience: event.target.value }))
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none"
            >
              <option value="all">All</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(payload.notificationChannels?.push)}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    notificationChannels: {
                      ...prev.notificationChannels,
                      push: event.target.checked,
                    },
                  }))
                }
                className="h-4 w-4"
              />
              Send web push
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(payload.notificationChannels?.telegram)}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    notificationChannels: {
                      ...prev.notificationChannels,
                      telegram: event.target.checked,
                    },
                  }))
                }
                className="h-4 w-4"
              />
              Send Telegram announcement
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700"
          >
            {confirmLabel}
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

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-bold text-slate-600">
      {children}
    </label>
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
