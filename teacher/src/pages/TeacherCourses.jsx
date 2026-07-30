import {
  BookOpen,
  ClipboardList,
  Plus,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import TeacherCourseStatsCard from "../components/courses/TeacherCourseStatsCard";
import TeacherCourseFilterBar from "../components/courses/TeacherCourseFilterBar";
import TeacherCoursesTable from "../components/courses/TeacherCoursesTable";
import CreateCourseModal from "../components/courses/CreateCourseModal";
import EditCourseModal from "../components/courses/EditCourseModal";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import {
  calculateCourseProgress,
  formatProgressLabel,
} from "../utils/courseProgress";
import {
  createTeacherCourse,
  fetchCategories,
  fetchTeacherCourseById,
  fetchTeacherCoursePricingSettings,
  fetchTeacherCourses,
  requestTeacherCourseEndReview,
  requestTeacherCourseCancellation,
  startTeacherCourseClass,
  updateTeacherCourse,
} from "../../services/courseService";
import { isNetworkError } from "../../services/http";
import {
  fetchGoogleAccountStatus,
  fetchGoogleAuthUrl,
} from "../../services/liveSessionService";
import { getApiBase } from "../../services/http";
import { getAuthUser } from "../../services/portal";
import {
  clearTeacherPageCache,
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import { formatCategoryPathLabel } from "../utils/categoryTree";

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

function getStatusLabel(status, language) {
  const map = {
    draft: { fa: "پیش‌نویس", en: "Draft" },
    pending: { fa: "در انتظار", en: "Pending" },
    approved: { fa: "تایید شده", en: "Approved" },
    published: { fa: "منتشر شده", en: "Published" },
    rejected: { fa: "رد شده", en: "Rejected" },
    cancelled: { fa: "لغو شده", en: "Cancelled" },
  };

  return map[status]?.[language] || (language === "fa" ? "پیش‌نویس" : "Draft");
}

function getLifecycleLabel(status, language) {
  const map = {
    draft: { fa: "پیش‌نویس", en: "Draft" },
    pending_review: { fa: "در انتظار بررسی مدیر", en: "Pending admin review" },
    changes_requested: { fa: "نیازمند اصلاح", en: "Changes requested" },
    approved: { fa: "تأییدشده", en: "Approved" },
    enrollment_open: { fa: "ثبت‌نام باز است", en: "Enrollment open" },
    enrollment_closed: { fa: "ثبت‌نام بسته است", en: "Enrollment closed" },
    minimum_not_reached: { fa: "حداقل شاگرد تکمیل نشده", en: "Minimum not reached" },
    ready_to_start: { fa: "آماده شروع", en: "Ready to start" },
    in_progress: { fa: "در حال برگزاری", en: "In progress" },
    paused: { fa: "موقتاً متوقف", en: "Paused" },
    awaiting_completion: { fa: "آماده تکمیل", en: "Awaiting completion" },
    completed: { fa: "تکمیل‌شده", en: "Completed" },
    canceled: { fa: "لغوشده", en: "Cancelled" },
    archived: { fa: "آرشیوشده", en: "Archived" },
  };
  return map[status]?.[language] || "";
}

function getPublicStatusLabel(publicState, language) {
  const label = publicState?.label;
  if (typeof label === "string") return label;
  return label?.[language === "fa" ? "fa" : "en"] || "";
}

function getTeacherTeachingLanguages(teacher) {
  const rows = Array.isArray(teacher?.teacherApplication?.languages)
    ? teacher.teacherApplication.languages
    : [];
  const seen = new Set();
  return rows
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const DEFAULT_PRICING_SETTINGS = {
  minTeacherCoursePrice: null,
  teacherDeductionPercentage: 0,
  globalCourseDiscountPercentage: 0,
};
const DEFAULT_COURSE_SUMMARY = {
  total: 0,
  published: 0,
  pending: 0,
  totalStudents: 0,
};
const TEACHER_COURSES_PAGE_SIZE = 3;
const TEACHER_SPECIAL_STATUS_FETCH_LIMIT = 100;
const COURSE_AUX_CACHE_TTL_MS = 5 * 60 * 1000;
const COURSE_CATEGORIES_CACHE_KEY = getTeacherPageCacheKey("courses-categories");
const COURSE_PRICING_CACHE_KEY = getTeacherPageCacheKey("courses-pricing");
const COURSE_GOOGLE_STATUS_CACHE_KEY = getTeacherPageCacheKey("courses-google-status");
const TEACHER_UI_SPECIAL_STATUSES = new Set([
  "class_started",
  "class_ended",
  "cancellation_pending",
]);
const isEndedCourse = (course = {}) => Boolean(course?.classEndedAt);
const normalizeCourseIdentityText = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const hasMatchingCreatedCourse = (course, payload) => {
  const existingTitle = normalizeCourseIdentityText(course?.title);
  const nextTitle = normalizeCourseIdentityText(payload?.title);
  if (!existingTitle || !nextTitle || existingTitle !== nextTitle) return false;

  const existingCategory = String(course?.category?._id || course?.category || "");
  const nextCategory = String(payload?.category || "");
  if (existingCategory && nextCategory && existingCategory !== nextCategory) return false;

  const existingLanguage = normalizeCourseIdentityText(course?.language);
  const nextLanguage = normalizeCourseIdentityText(payload?.language);
  if (existingLanguage && nextLanguage && existingLanguage !== nextLanguage) return false;

  const existingCourseType = normalizeCourseIdentityText(course?.courseType);
  const nextCourseType = normalizeCourseIdentityText(payload?.courseType);
  if (existingCourseType && nextCourseType && existingCourseType !== nextCourseType) return false;

  return true;
};

const getCoursesCacheKey = ({ search, category, status, page, language }) =>
  getTeacherPageCacheKey("courses", {
    search: String(search || "").trim(),
    category,
    status,
    page,
    language,
  });

const normalizeNumberSetting = (value, fallback = 0) => {
  const rawValue = value ?? fallback;
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric)) return numeric;

  const fallbackNumeric = Number(fallback);
  return Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0;
};

const normalizePricingSettings = (settings = {}, fallback = DEFAULT_PRICING_SETTINGS) => ({
  minTeacherCoursePrice: normalizeNumberSetting(
    settings?.minTeacherCoursePrice,
    fallback?.minTeacherCoursePrice ?? 0,
  ),
  teacherDeductionPercentage: normalizeNumberSetting(
    settings?.teacherDeductionPercentage,
    fallback?.teacherDeductionPercentage ?? 0,
  ),
  globalCourseDiscountPercentage: normalizeNumberSetting(
    settings?.globalCourseDiscountPercentage,
    fallback?.globalCourseDiscountPercentage ?? 0,
  ),
});

const clampPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

function resolveTeacherDiscountPercentage(course) {
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
}

const paginateRows = (rows = [], page = 1, limit = TEACHER_COURSES_PAGE_SIZE) => {
  const safeLimit = Math.max(1, Number(limit) || TEACHER_COURSES_PAGE_SIZE);
  const safePage = Math.max(1, Number(page) || 1);
  const total = Array.isArray(rows) ? rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safeLimit;
  return {
    rows: (Array.isArray(rows) ? rows : []).slice(start, start + safeLimit),
    meta: {
      page: currentPage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
};

const filterTeacherCoursesByUiStatus = (rows = [], status = "all") => {
  if (status === "class_started") {
    return rows.filter((course) =>
      Boolean(course?.classStartedAt) &&
      !course?.classEndedAt &&
      !course?.classCancelledAt &&
      String(course?.cancellationRequest?.status || "") !== "pending",
    );
  }

  if (status === "class_ended") {
    return rows.filter((course) => Boolean(course?.classEndedAt));
  }

  if (status === "cancellation_pending") {
    return rows.filter((course) =>
      String(course?.cancellationRequest?.status || "") === "pending" &&
      !course?.classCancelledAt,
    );
  }

  return rows;
};

function resolveTeacherReceiveAmount(course, pricingSettings = {}) {
  const basePrice = Number(course?.price || 0);
  if (Boolean(course?.isFree) || basePrice <= 0) {
    return {
      teacherDiscountPercentage: 0,
      teacherEffectivePrice: 0,
      finalPriceForStudents: 0,
      teacherReceiveAmount: 0,
    };
  }

  const teacherDiscountPercentage = resolveTeacherDiscountPercentage(course);
  const globalDiscountPercentage = clampPercentage(
    pricingSettings?.globalCourseDiscountPercentage,
  );
  const deductionPercentage = clampPercentage(
    pricingSettings?.teacherDeductionPercentage,
  );
  const teacherEffectivePrice = Math.max(
    0,
    Math.round((basePrice - ((basePrice * teacherDiscountPercentage) / 100)) * 100) / 100,
  );
  const totalDiscountPercentage = Math.min(100, teacherDiscountPercentage + globalDiscountPercentage);
  const finalPriceForStudents = Math.max(
    0,
    Math.round((basePrice - ((basePrice * totalDiscountPercentage) / 100)) * 100) / 100,
  );
  const platformDeductionAmount =
    Math.round(((finalPriceForStudents * deductionPercentage) / 100) * 100) / 100;

  return {
    teacherDiscountPercentage,
    teacherEffectivePrice,
    finalPriceForStudents,
    teacherReceiveAmount:
      Math.round(Math.max(0, finalPriceForStudents - platformDeductionAmount) * 100) / 100,
  };
}

function mapCourse(course, language, pricingSettings = {}) {
  const students = Number(course.enrolledStudentsCount || 0);
  const maxStudents = Number(course.maxStudents || 0);
  const minimumStudentsToStart = Math.max(1, Number(course.minimumStudentsToStart || 1));
  const classEndedAt = course.classEndedAt || null;
  const classStartedAt = course.classStartedAt || null;
  const classCancelledAt = course.classCancelledAt || null;
  const cancellationRequest = course.cancellationRequest || {};
  const endRequest = course.endRequest || {};
  const lifecycleStatus = String(course.lifecycleStatus || "");
  const progress = calculateCourseProgress(course);
  const receivePricing = resolveTeacherReceiveAmount(course, pricingSettings);

  return {
    ...course,
    id: course._id,
    title: course.title,
    category: course.subcategory?.name
      ? `${course.category?.name || "General"} / ${course.subcategory.name}`
      : course.category?.name || "General",
    categoryId:
      typeof course.category === "object"
        ? (course.category?._id || "")
        : (course.category || ""),
    subcategoryId:
      typeof course.subcategory === "object"
        ? (course.subcategory?._id || "")
        : (course.subcategory || ""),
    categoryPathLabel:
      course.subcategory
        ? formatCategoryPathLabel({
            pathLabel: `${course.category?.name || "General"} / ${course.subcategory?.name || ""}`,
          })
        : course.category?.name || "General",
    students,
    progress,
    progressLabel: formatProgressLabel(progress, language),
    status: course.status,
    lifecycleStatus,
    publicStatusLabel: getPublicStatusLabel(course.publicState, language),
    statusLabel: getLifecycleLabel(lifecycleStatus, language) || (course.status === "cancelled" || classCancelledAt
      ? language === "fa"
        ? "صنف لغو شد"
        : "Class cancelled"
      : cancellationRequest?.status === "pending"
        ? language === "fa"
          ? "درخواست لغو در انتظار"
          : "Cancellation pending"
      : endRequest?.status === "pending"
        ? language === "fa"
          ? "درخواست پایان در انتظار"
          : "End request pending"
      : classEndedAt
      ? language === "fa"
        ? "صنف پایان یافت"
        : "Class ended"
      : classStartedAt
        ? language === "fa"
          ? "صنف شروع شد"
          : "Class started"
      : getStatusLabel(course.status, language)),
    createdAt: new Date(course.createdAt).toLocaleDateString(),
    thumbnailUrl: resolveAssetUrl(course.thumbnail),
    thumbnailType: course.level === "advanced" ? "python" : course.level === "intermediate" ? "api" : "mern",
    price: course.price || 0,
    paymentPlan:
      course.paymentPlan === "whole_period" ? "whole_period" : "monthly",
    duration: course.duration || "",
    level: course.level || "beginner",
    language: course.language || "English",
    maxStudents: maxStudents || 30,
    minimumStudentsToStart,
    minimumStudentsReached: students >= minimumStudentsToStart,
    globalCourseDiscountPercentage: Number(course.globalCourseDiscountPercentage || 0),
    teacherDiscountPercentage: Number(
      course.teacherDiscountPercentage ?? receivePricing.teacherDiscountPercentage,
    ),
    teacherEffectivePrice: Number(
      course.teacherEffectivePrice ?? receivePricing.teacherEffectivePrice,
    ),
    finalPriceForStudents: Number(
      course.finalPriceForStudents ?? receivePricing.finalPriceForStudents,
    ),
    teacherReceiveAmount: Number(
      course.teacherReceiveAmount ?? receivePricing.teacherReceiveAmount,
    ),
    endDate: course.endDate || null,
    canStartToday: ["ready_to_start", "minimum_not_reached"].includes(lifecycleStatus),
    canEndNow: Boolean(classStartedAt) && !classEndedAt && endRequest?.status !== "pending",
    cancellationRequest,
    endRequest,
    classCancelledAt,
    classStartedAt,
    classEndedAt,
    previewVideoUrls: Array.isArray(course.previewVideoUrls) && course.previewVideoUrls.length
      ? course.previewVideoUrls
      : course.promoVideo
        ? [course.promoVideo]
        : [],
  };
}

export default function TeacherCourses() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, isRTL, setLanguage } = useTeacherLanguage();

  const teacher = useMemo(
    () => getAuthUser() || { name: "Teacher", email: "teacher@edutech.study" },
    [],
  );
  const teacherLanguages = useMemo(() => getTeacherTeachingLanguages(teacher), [teacher]);
  const requestedSearch = new URLSearchParams(location.search).get("q") || "";
  const initialCoursesCache = readTeacherPageCache(getCoursesCacheKey({
    search: requestedSearch,
    category: "all",
    status: "all",
    page: 1,
    language,
  }));

  const [courses, setCourses] = useState(initialCoursesCache?.courses || []);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(requestedSearch);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(initialCoursesCache?.pagination || {
    page: 1,
    limit: TEACHER_COURSES_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createFormSession, setCreateFormSession] = useState(0);
  const [editingCourse, setEditingCourse] = useState(null);
  const [cancellationCourse, setCancellationCourse] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initialCoursesCache);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ connected: false, googleEmail: "" });
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING_SETTINGS);
  const [courseSummary, setCourseSummary] = useState(
    initialCoursesCache?.courseSummary || DEFAULT_COURSE_SUMMARY,
  );
  const [refreshSeed, setRefreshSeed] = useState(0);
  const createCourseRequestRef = useRef(false);
  const coursesRequestRef = useRef(0);
  const pricingSettingsRef = useRef(
    normalizePricingSettings(initialCoursesCache?.pricingSettings, DEFAULT_PRICING_SETTINGS),
  );

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(requestedSearch);
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);

  const applyPricingSettings = (settings, fallback = pricingSettingsRef.current) => {
    const nextPricingSettings = normalizePricingSettings(settings, fallback);
    const currentPricingSettings = normalizePricingSettings(
      pricingSettingsRef.current,
      DEFAULT_PRICING_SETTINGS,
    );

    const isSameSettings =
      currentPricingSettings.minTeacherCoursePrice === nextPricingSettings.minTeacherCoursePrice &&
      currentPricingSettings.teacherDeductionPercentage === nextPricingSettings.teacherDeductionPercentage &&
      currentPricingSettings.globalCourseDiscountPercentage === nextPricingSettings.globalCourseDiscountPercentage;

    if (!isSameSettings) {
      pricingSettingsRef.current = nextPricingSettings;
      setPricingSettings(nextPricingSettings);
      return nextPricingSettings;
    }

    return currentPricingSettings;
  };

  const refreshPricingSettings = async () => {
    try {
      const settings = await fetchTeacherCoursePricingSettings();
      return applyPricingSettings(settings);
    } catch {
      return pricingSettingsRef.current;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const loadCourses = async () => {
        const requestId = ++coursesRequestRef.current;
        const cacheKey = getCoursesCacheKey({ search, category, status, page, language });
        const cached = readTeacherPageCache(cacheKey);
        if (cached) {
          setCourses(cached.courses || []);
          setPagination((previous) => cached.pagination || previous);
          setCourseSummary(cached.courseSummary || DEFAULT_COURSE_SUMMARY);
          if (cached.pricingSettings) applyPricingSettings(cached.pricingSettings);
          setLoading(false);
        } else {
          setLoading(true);
        }

        try {
          setError("");
          const isSpecialStatus = TEACHER_UI_SPECIAL_STATUSES.has(status);
          const query = {
            search,
            category: category === "all" ? undefined : category,
            page: isSpecialStatus ? 1 : page,
            limit: isSpecialStatus
              ? TEACHER_SPECIAL_STATUS_FETCH_LIMIT
              : TEACHER_COURSES_PAGE_SIZE,
          };

          if (status === "cancellation_pending") {
            query.cancellationRequestStatus = "pending";
          } else if (!isSpecialStatus && status !== "all") {
            query.status = status;
          }

          const { courses: rows, meta, extra } = await fetchTeacherCourses(query);
          if (requestId !== coursesRequestRef.current) return;

          let nextPricingSettings = pricingSettingsRef.current;
          if (extra && typeof extra === "object") {
            nextPricingSettings = applyPricingSettings(extra);
            if (extra.courseSummary) {
              setCourseSummary({
                ...DEFAULT_COURSE_SUMMARY,
                ...extra.courseSummary,
              });
            }
          }

          const mappedRows = rows.map((course) =>
            mapCourse(course, language, nextPricingSettings),
          );
          const filteredRows = isSpecialStatus
            ? filterTeacherCoursesByUiStatus(mappedRows, status)
            : mappedRows;
          const pagedSpecialRows = isSpecialStatus
            ? paginateRows(filteredRows, page, TEACHER_COURSES_PAGE_SIZE)
            : null;
          const nextCourses = isSpecialStatus
            ? pagedSpecialRows.rows
            : filteredRows;
          const nextPagination = isSpecialStatus
            ? pagedSpecialRows.meta
            : {
                page: Number(meta?.page || page),
                limit: Number(meta?.limit || TEACHER_COURSES_PAGE_SIZE),
                total: Number(meta?.total || rows.length),
                totalPages: Math.max(1, Number(meta?.totalPages || 1)),
              };

          setCourses(nextCourses);
          setPagination(nextPagination);
          writeTeacherPageCache(cacheKey, {
            courses: nextCourses,
            pagination: nextPagination,
            pricingSettings: nextPricingSettings,
            courseSummary: {
              ...DEFAULT_COURSE_SUMMARY,
              ...(extra?.courseSummary || {}),
            },
          });
        } catch (err) {
          if (requestId !== coursesRequestRef.current) return;
          setError(err.message || "Failed to load courses");
        } finally {
          if (requestId === coursesRequestRef.current) setLoading(false);
        }
      };

      loadCourses();
    }, 250);

    return () => {
      clearTimeout(timer);
      coursesRequestRef.current += 1;
    };
  }, [category, language, page, refreshSeed, search, status]);

  useEffect(() => {
    const loadCategories = async () => {
      const cached = readTeacherPageCache(COURSE_CATEGORIES_CACHE_KEY, {
        maxAgeMs: COURSE_AUX_CACHE_TTL_MS,
      });
      if (cached) {
        setCategories(cached);
        return;
      }
      try {
        const rows = await fetchCategories();
        setCategories(rows);
        writeTeacherPageCache(COURSE_CATEGORIES_CACHE_KEY, rows);
      } catch {
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const loadPricingSettings = async () => {
        const cached = readTeacherPageCache(COURSE_PRICING_CACHE_KEY, {
          maxAgeMs: COURSE_AUX_CACHE_TTL_MS,
        });
        if (cached) {
          applyPricingSettings(cached);
          return;
        }
        try {
          const settings = await fetchTeacherCoursePricingSettings();
          if (!active) return;
          applyPricingSettings(settings);
          writeTeacherPageCache(COURSE_PRICING_CACHE_KEY, settings);
        } catch {
          // Ignore pricing settings refresh failures and keep the latest known values.
        }
      };

      loadPricingSettings();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const loadGoogleStatus = async () => {
      const cached = readTeacherPageCache(COURSE_GOOGLE_STATUS_CACHE_KEY, {
        maxAgeMs: COURSE_AUX_CACHE_TTL_MS,
      });
      if (cached) {
        setGoogleStatus(cached);
      }
      try {
        const status = await fetchGoogleAccountStatus();
        const nextStatus = {
          connected: Boolean(status?.connected),
          googleEmail: status?.googleEmail || "",
        };
        setGoogleStatus(nextStatus);
        writeTeacherPageCache(COURSE_GOOGLE_STATUS_CACHE_KEY, nextStatus);
      } catch {
        if (!cached) setGoogleStatus({ connected: false, googleEmail: "" });
      }
    };

    loadGoogleStatus();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const stats = useMemo(() => {
    return [
      {
        id: "published-courses",
        title: language === "fa" ? "کورس‌های منتشر شده" : "Published Courses",
        value: String(courseSummary.published),
        subtitle: language === "fa" ? `از مجموع ${courseSummary.total} کورس` : `${courseSummary.total} courses in total`,
        icon: BookOpen,
        tone: "teal",
      },
      {
        id: "students",
        title: language === "fa" ? "شاگردان کل" : "Total Students",
        value: String(courseSummary.totalStudents),
        subtitle: language === "fa" ? "در همه کورس‌ها" : "Across all courses",
        icon: Users,
        tone: "purple",
      },
      {
        id: "pending-courses",
        title: language === "fa" ? "کورس‌های در انتظار" : "Pending Courses",
        value: String(courseSummary.pending),
        subtitle: language === "fa" ? "منتظر تایید مدیر" : "Waiting admin approval",
        icon: ClipboardList,
        tone: "orange",
      },
    ];
  }, [courseSummary, language]);

  const handleCreateCourse = async (form) => {
    if (createCourseRequestRef.current) return;

    try {
      createCourseRequestRef.current = true;
      setCreateSubmitting(true);
      const createdCourse = await createTeacherCourse(form);
      clearTeacherPageCache("teacher:courses");
      localStorage.removeItem("edutech:teacher:create-course-draft:v2");
      setRefreshSeed((prev) => prev + 1);

      setToast(language === "fa" ? "کورس ایجاد شد" : "Course created");
      window.dispatchEvent(new Event("edutech_data_changed"));
      return createdCourse;
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          const { courses: recentCourses } = await fetchTeacherCourses({
            search: form?.title || "",
            page: 1,
            limit: 25,
          });
          const matchingCourse = recentCourses.find((course) =>
            hasMatchingCreatedCourse(course, form),
          );

          if (matchingCourse) {
            clearTeacherPageCache("teacher:courses");
            localStorage.removeItem("edutech:teacher:create-course-draft:v2");
            setRefreshSeed((prev) => prev + 1);
            setToast(language === "fa" ? "کورس ایجاد شد" : "Course created");
            window.dispatchEvent(new Event("edutech_data_changed"));
            return matchingCourse;
          }
        } catch {
          // If verification also fails, keep the original error handling below.
        }
      }
      setToast(err.message || "Create failed");
      throw err;
    } finally {
      createCourseRequestRef.current = false;
      setCreateSubmitting(false);
    }
  };

  const handleOpenCreateCourse = async () => {
    await refreshPricingSettings();
    setCreateOpen(true);
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

  const handleEditCourse = async (payload) => {
    if (!editingCourse?.id) return;

    try {
      const updatedCourse = await updateTeacherCourse(editingCourse.id, payload);
      clearTeacherPageCache("teacher:courses");
      if (updatedCourse?._id) {
        const mappedCourse = mapCourse(updatedCourse, language, pricingSettings);
        setCourses((prevCourses) =>
          prevCourses.map((course) => (course.id === mappedCourse.id ? mappedCourse : course)),
        );
      }
      setRefreshSeed((prev) => prev + 1);
      setToast(language === "fa" ? "تغییرات ذخیره شد" : "Changes saved");
      window.dispatchEvent(new Event("edutech_data_changed"));
      return updatedCourse;
    } catch (err) {
      setToast(err.message || "Update failed");
      throw err;
    }
  };

  const handleRequestEndReview = async (course) => {
    if (!course?.id) return;
    if (course?.classEndedAt) {
      setToast(language === "fa" ? "این صنف قبلاً پایان یافته است." : "This class is already ended.");
      return;
    }
    if (!course?.classStartedAt) {
      setToast(language === "fa" ? "اول صنف را شروع کنید." : "Start the class first.");
      return;
    }
    if (course?.endRequest?.status === "pending") {
      setToast(language === "fa" ? "درخواست پایان این صنف قبلاً ارسال شده است." : "An end request is already pending for this class.");
      return;
    }

    const reason = window.prompt(
      language === "fa"
        ? "دلیل درخواست پایان صنف را بنویسید:"
        : "Enter the reason for requesting to end this class:",
      "",
    );
    if (reason === null) return;
    if (String(reason || "").trim().length < 10) {
      setToast(language === "fa" ? "دلیل باید حداقل ۱۰ حرف باشد." : "Reason must be at least 10 characters.");
      return;
    }

    try {
      await requestTeacherCourseEndReview(course.id, reason);
      setToast(
        language === "fa"
          ? "درخواست پایان صنف به ادمین ارسال شد."
          : "Class end request was sent to admin.",
      );
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (err) {
      setToast(err?.message || (language === "fa" ? "ارسال درخواست پایان ناموفق بود" : "Failed to send end request"));
    }
  };

  const handleStartCourseClass = async (course) => {
    if (!course?.id) return;
    if (course?.classStartedAt) {
      setToast(language === "fa" ? "این صنف قبلاً شروع شده است." : "This class has already started.");
      return;
    }
    if (course?.classEndedAt) {
      setToast(language === "fa" ? "این صنف قبلاً پایان یافته است." : "This class is already ended.");
      return;
    }
    if (course?.status !== "published") {
      setToast(language === "fa" ? "فقط کورس منتشرشده قابل شروع است." : "Only published courses can be started.");
      return;
    }
    if (!course?.canStartToday) {
      setToast(
        language === "fa"
          ? "کورس پس از رسیدن تاریخ و زمان برنامه‌ریزی‌شده قابل شروع است."
          : "The course can be started after its scheduled date and time.",
      );
      return;
    }

    const shouldStart = window.confirm(
      !course?.minimumStudentsReached
        ? language === "fa"
          ? "حداقل شاگرد برای شروع این کورس هنوز تکمیل نشده است، اما شما می‌توانید صنف را دستی شروع کنید. اگر ادامه دهید، تاریخ و زمان شروع دیگر قابل تغییر نیست. آیا مطمئن هستید؟"
          : "The minimum students required for this course has not been reached yet, but you can still start the class manually. If you continue, the start date and start time cannot be changed. Are you sure?"
        : language === "fa"
          ? "اگر این صنف را شروع کنید، تاریخ شروع و زمان شروع درس دیگر هرگز قابل تغییر نیست و صنف جریان پیدا می‌کند. آیا مطمئن هستید؟"
          : "If you start this class, the course start date and lesson start time can never be changed again and the class will begin. Are you sure?",
    );
    if (!shouldStart) return;

    try {
      await startTeacherCourseClass(course.id, {
        startBelowMinimum: !course.minimumStudentsReached,
      });
      setToast(language === "fa" ? "کورس به‌صورت رسمی آغاز شد. هر جلسه جداگانه شروع می‌شود." : "Course officially started. Each live session is started separately.");
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (err) {
      setToast(err?.message || (language === "fa" ? "شروع صنف ناموفق بود" : "Failed to start class"));
    }
  };

  const openCancellationRequest = (course) => {
    if (!course?.id) return;
    if (course?.status === "cancelled" || course?.classCancelledAt) {
      setToast(language === "fa" ? "این صنف قبلاً لغو شده است." : "This class is already cancelled.");
      return;
    }
    if (course?.classEndedAt) {
      setToast(language === "fa" ? "صنف پایان‌یافته قابل لغو نیست." : "Ended classes cannot be cancelled.");
      return;
    }
    if (course?.cancellationRequest?.status === "pending") {
      setToast(language === "fa" ? "درخواست لغو قبلاً به مدیر ارسال شده است." : "A cancellation request is already pending.");
      return;
    }
    setCancellationCourse(course);
    setCancellationReason("");
  };

  const submitCancellationRequest = async (event) => {
    event.preventDefault();
    if (!cancellationCourse?.id || cancellationSubmitting) return;
    const reason = String(cancellationReason || "").trim();
    if (reason.length < 10) {
      setToast(language === "fa" ? "دلیل لغو باید حداقل ۱۰ کاراکتر باشد." : "Cancellation reason must be at least 10 characters.");
      return;
    }

    try {
      setCancellationSubmitting(true);
      await requestTeacherCourseCancellation(cancellationCourse.id, reason);
      setToast(language === "fa" ? "درخواست لغو به مدیر ارسال شد." : "Cancellation request sent to admin.");
      setCancellationCourse(null);
      setCancellationReason("");
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (err) {
      setToast(err?.message || (language === "fa" ? "ارسال درخواست لغو ناموفق بود" : "Failed to send cancellation request"));
    } finally {
      setCancellationSubmitting(false);
    }
  };

  const handleFilterSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterCategoryChange = (value) => {
    setCategory(value);
    setPage(1);
  };

  const handleFilterStatusChange = (value) => {
    setStatus(value);
    setPage(1);
  };

  const handleOpenCourseDetails = (course) => {
    if (!course?.id) return;
    navigate(`/teacher/courses/${encodeURIComponent(course.id)}`);
  };

  const handleOpenEditCourse = async (course) => {
    if (!course?.id) return;
    if (isEndedCourse(course)) {
      setToast(language === "fa" ? "ویرایش کورس پایان‌یافته غیرفعال است." : "Editing is disabled for ended courses.");
      return;
    }

    try {
      const latestPricingSettings = await refreshPricingSettings();
      const fullCourse = await fetchTeacherCourseById(course.id);
      if (!fullCourse) {
        setToast(language === "fa" ? "اطلاعات کورس پیدا نشد" : "Course data not found");
        return;
      }
      const mappedCourse = mapCourse(fullCourse, language, latestPricingSettings);
      if (mappedCourse?.classStartedAt) {
        setToast(
          language === "fa"
            ? "قیمت کورس قفل است، چون صنف قبلاً شروع شده است."
            : "Course price is locked because the class has already started.",
        );
      }
      setEditingCourse(mappedCourse);
    } catch (err) {
      setToast(err?.message || (language === "fa" ? "بارگذاری کورس ناموفق بود" : "Failed to load course"));
    }
  };

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <div className={isRTL ? "text-right" : "text-left"}>
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-extrabold text-slate-500">{language === "fa" ? "داشبورد / کورس‌های من" : "Dashboard / My Courses"}</p>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#0B4FD8]/10 p-2 text-[#0B4FD8]"><BookOpen size={18} /></span>
                <h1 className="text-2xl font-black text-[#0F172A]">{language === "fa" ? "کورس‌های من" : "My Courses"}</h1>
              </div>
              <p className="mt-3 max-w-3xl text-sm font-medium text-slate-600">
                {language === "fa" ? "مدیریت کامل کورس‌ها و محتوای آموزشی" : "Manage and organize your courses and content."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateCourse}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] px-4 text-sm font-bold text-white"
            >
              <Plus size={16} />
              {language === "fa" ? "ایجاد کورس جدید" : "Create New Course"}
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {googleStatus.connected
              ? language === "fa"
                ? `Google متصل است: ${googleStatus.googleEmail}`
                : `Google connected: ${googleStatus.googleEmail}`
              : language === "fa"
                ? "Google متصل نیست. برای تولید خودکار لینک Meet، حساب Google را وصل کنید."
                : "Google not connected. Connect it to auto-generate Meet links."}
          </p>
          {!googleStatus.connected ? (
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="mt-2 inline-flex h-9 items-center justify-center rounded-lg border border-[#0B4FD8]/30 px-3 text-xs font-bold text-[#0B4FD8]"
            >
              {language === "fa" ? "وصل کردن Google" : "Connect Google Account"}
            </button>
          ) : null}
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((item) => (
            <TeacherCourseStatsCard key={item.id} title={item.title} value={item.value} subtitle={item.subtitle} icon={item.icon} tone={item.tone} />
          ))}
        </section>

        <TeacherCourseFilterBar
          search={search}
          setSearch={handleFilterSearchChange}
          category={category}
          setCategory={handleFilterCategoryChange}
          status={status}
          setStatus={handleFilterStatusChange}
          language={language}
          isRTL={isRTL}
          categories={categories}
        />

        {error ? <p className="mt-3 text-sm font-bold text-rose-600">{error}</p> : null}
        {loading ? (
          <TeacherPageLoader
            label={language === "fa" ? "در حال بارگذاری کورس‌ها" : "Loading courses"}
            className="mt-5"
          />
        ) : null}

        {!loading ? (
          <TeacherCoursesTable
            courses={courses}
            language={language}
            onEdit={handleOpenEditCourse}
            onDetails={handleOpenCourseDetails}
            onStartClass={handleStartCourseClass}
            onRequestEndReview={handleRequestEndReview}
            onRequestCancel={openCancellationRequest}
            pagination={pagination}
            onPageChange={setPage}
          />
        ) : null}

      </div>

      <CreateCourseModal
        key={createFormSession}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateFormSession((previous) => previous + 1);
        }}
        onSubmit={handleCreateCourse}
        isSubmitting={createSubmitting}
        language={language}
        isRTL={isRTL}
        categories={categories}
        pricingSettings={pricingSettings}
        teacherLanguages={teacherLanguages}
        defaultTimeZone={teacher?.timezone || ""}
      />

      {editingCourse ? (
        <EditCourseModal
          key={editingCourse.id}
          open={Boolean(editingCourse)}
          course={editingCourse}
          categories={categories}
          onClose={() => setEditingCourse(null)}
          onSubmit={handleEditCourse}
          language={language}
          isRTL={isRTL}
          pricingSettings={pricingSettings}
          teacherLanguages={teacherLanguages}
          defaultTimeZone={teacher?.timezone || ""}
        />
      ) : null}

      {cancellationCourse ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0F172A]/55 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submitCancellationRequest}
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <h3 className="text-lg font-black text-[#0F172A]">
              {language === "fa" ? "درخواست لغو صنف" : "Request Class Cancellation"}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {language === "fa"
                ? "دلیل لغو را بنویسید. مدیر این درخواست را تایید یا رد می‌کند."
                : "Write the cancellation reason. Admin will approve or reject this request."}
            </p>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
              {cancellationCourse.title}
            </p>
            <textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              className="mt-3 min-h-[120px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm font-semibold outline-none"
              placeholder={language === "fa" ? "دلیل لغو صنف..." : "Cancellation reason..."}
              minLength={10}
              maxLength={1000}
              required
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setCancellationCourse(null);
                  setCancellationReason("");
                }}
                className="h-11 rounded-xl border border-[#E2E8F0] bg-white text-sm font-bold text-slate-700"
              >
                {language === "fa" ? "لغو" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={cancellationSubmitting}
                className="h-11 rounded-xl bg-rose-600 text-sm font-bold text-white disabled:opacity-60"
              >
                {cancellationSubmitting
                  ? language === "fa"
                    ? "در حال ارسال"
                    : "Sending"
                  : language === "fa"
                    ? "ارسال به مدیر"
                    : "Send to Admin"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-5 z-[110] inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-bold text-white shadow-xl ${isRTL ? "right-5" : "left-5"}`}>
          <CheckCircle2 size={16} />
          {toast}
        </div>
      ) : null}
    </TeacherLayout>
  );
}
