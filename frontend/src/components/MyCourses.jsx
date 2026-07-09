import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Info, Headphones } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import CourseFilterTabs from "./CourseFilterTabs.jsx";
import StudentCourseCard from "./StudentCourseCard.jsx";
import RegistrationStatusModal from "./RegistrationStatusModal.jsx";
import InfoCard from "./InfoCard.jsx";
import { fetchStudentEnrollments } from "../../services/courseService.js";
import { confirmStudentPaymentRedirect } from "../../services/paymentGateway.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { resolveStudentCourseProgressPercent } from "../utils/courseProgress.js";
import { buildCoursePath } from "../utils/routePaths.js";
import {
  getLocalizedRequestErrorMessage,
  invalidateApiCache,
  isUnauthorizedError,
} from "../../services/http.js";

const DAY_ALIASES = [
  ["sunday", "یکشنبه", "يكشنبه"],
  ["monday", "دوشنبه"],
  ["tuesday", "سه‌شنبه", "سه شنبه"],
  ["wednesday", "چهارشنبه"],
  ["thursday", "پنجشنبه", "پنج‌شنبه"],
  ["friday", "جمعه"],
  ["saturday", "شنبه"],
];

const normalizeDayLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ");

const getScheduleDayIndex = (dayValue) => {
  const normalizedDay = normalizeDayLabel(dayValue);
  if (!normalizedDay) return null;
  for (let i = 0; i < DAY_ALIASES.length; i += 1) {
    const aliases = DAY_ALIASES[i] || [];
    const hit = aliases.some((alias) =>
      normalizedDay.includes(normalizeDayLabel(alias)),
    );
    if (hit) return i;
  }
  return null;
};

const parseTimeToMinutes = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?(AM|PM|am|pm))?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const meridiem = String(match[3] || "").toLowerCase();
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatFullDateLabel = (dateValue, language = "fa") => {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return "-";
  if (language === "fa") {
    const formatter = new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const parts = formatter.formatToParts(dateValue);
    const partValue = (type) => parts.find((part) => part.type === type)?.value || "";
    const year = partValue("year");
    const month = partValue("month");
    const day = partValue("day");
    const weekday = partValue("weekday");
    return `${year} ${month} ${day}، ${weekday}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateValue);
};

const formatTimeRange = (startDate, endDate, language = "fa") => {
  const locale = language === "fa" ? "fa-AF" : "en-GB";
  const startLabel = startDate.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endLabel = endDate.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${startLabel} - ${endLabel}`;
};

const resolveNextScheduleText = (scheduleRows = [], language = "fa", now = new Date()) => {
  const candidates = (Array.isArray(scheduleRows) ? scheduleRows : [])
    .map((row) => {
      const dayIndex = getScheduleDayIndex(row?.day);
      const startMinutes = parseTimeToMinutes(row?.startTime);
      const endMinutes = parseTimeToMinutes(row?.endTime);
      if (dayIndex === null || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return null;
      }

      let daysAhead = (dayIndex - now.getDay() + 7) % 7;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (daysAhead === 0 && startMinutes <= nowMinutes) {
        daysAhead = 7;
      }

      const startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() + daysAhead);
      startDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      return { startDate, endDate };
    })
    .filter(Boolean)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  if (!candidates.length) return "";
  const next = candidates[0];
  return `${formatFullDateLabel(next.startDate, language)} - ${formatTimeRange(next.startDate, next.endDate, language)}`;
};

const formatLevelLabel = (levelValue, language = "fa") => {
  const key = String(levelValue || "").trim().toLowerCase();
  const map = {
    beginner: { fa: "مبتدی", en: "Beginner" },
    intermediate: { fa: "متوسط", en: "Intermediate" },
    advanced: { fa: "پیشرفته", en: "Advanced" },
    all: { fa: "همه سطوح", en: "All Levels" },
  };
  const hit = map[key];
  if (hit) return language === "fa" ? hit.fa : hit.en;
  if (!key) return language === "fa" ? "نامشخص" : "Unknown";
  return levelValue;
};

const formatCourseDuration = (course = {}, language = "fa") => {
  const isFa = language === "fa";
  const durationWeeks = Number(course?.durationWeeks || 0);
  const formatNumber = (value) =>
    new Intl.NumberFormat(isFa ? "fa-AF" : "en-US", {
      maximumFractionDigits: 0,
    }).format(value);

  if (Number.isFinite(durationWeeks) && durationWeeks > 0) {
    return isFa
      ? `${formatNumber(durationWeeks)} هفته`
      : `${formatNumber(durationWeeks)} weeks`;
  }

  const rawDuration = String(course?.duration || "").trim();
  if (rawDuration && rawDuration !== "-") {
    return rawDuration;
  }

  const start = new Date(course?.startDate || "");
  const end = new Date(course?.endDate || "");
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
    const diffMs = end.getTime() - start.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
    const weeks = Math.max(1, Math.ceil(days / 7));
    return isFa ? `${formatNumber(weeks)} هفته` : `${formatNumber(weeks)} weeks`;
  }

  return isFa ? "نامشخص" : "N/A";
};

function mapEnrollmentToCourse(enrollment = {}, language = "fa") {
  const isFa = language === "fa";
  const course = enrollment.courseId || {};
  const teacher = course.teacher || {};
  const statusMap = {
    active: "active",
    pending: "pending",
    completed: "completed",
    cancelled: "cancelled",
  };

  const status = statusMap[enrollment.enrollmentStatus] || "pending";

  const scheduleRows = Array.isArray(course.schedule) ? course.schedule : [];
  const nextScheduleText = resolveNextScheduleText(scheduleRows, language);

  const nextClass = nextScheduleText
    ? nextScheduleText
    : isFa
      ? "زمان‌بندی این کورس به‌زودی اعلام می‌شود"
      : "Course schedule will be announced soon.";

  const progress = resolveStudentCourseProgressPercent(enrollment, course, 0);

  return {
    id: enrollment._id,
    title: course.title || "Course",
    titleEn: course.title || "Course",
    description: course.shortDescription || course.description || "",
    teacher: teacher.name || "Teacher",
    teacherAvatar: resolveAvatarUrl(teacher.avatar || ""),
    thumbnail: resolveAvatarUrl(course.thumbnail || ""),
    courseSlug: course.slug || "",
    courseLink: course.slug || course._id ? buildCoursePath(course) : "/live-courses",
    status,
    statusLabel:
      status === "active"
        ? isFa
          ? "فعال"
          : "Active"
        : status === "completed"
          ? isFa
            ? "تکمیل شده"
            : "Completed"
          : status === "cancelled"
            ? isFa
              ? "لغو شده"
              : "Cancelled"
            : isFa
              ? "در انتظار تایید"
              : "Pending approval",
    level: formatLevelLabel(course.level || "all", language),
    duration: formatCourseDuration(course, language),
    progress,
    nextClass,
    meetLink: status === "active" ? course.meetingLink || null : null,
    bannerType: course.level === "advanced" ? "mern" : "english",
  };
}

export default function MyCourses({ language = "fa" }) {
  const isFa = language === "fa";
  const user = getAuthUser() || { nameFa: "کاربر", email: "", avatar: "" };

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [modalCourse, setModalCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentReturn = useMemo(
    () => ({
      reference:
        searchParams.get("paymentRef") ||
        searchParams.get("paymentReference") ||
        searchParams.get("ref") ||
        searchParams.get("reference") ||
        "",
      sessionId:
        searchParams.get("sessionId") ||
        searchParams.get("session_id") ||
        searchParams.get("checkoutSessionId") ||
        searchParams.get("id") ||
        "",
      courseId: searchParams.get("courseId") || "",
    }),
    [searchParams],
  );
  const hasPaymentReturn = Boolean(
    paymentReturn.reference ||
      paymentReturn.sessionId ||
      paymentReturn.courseId ||
      searchParams.get("payment") === "success",
  );

  useEffect(() => {
    if (!hasPaymentReturn) return undefined;

    let mounted = true;

    const confirmPayment = async () => {
      try {
        await confirmStudentPaymentRedirect(paymentReturn);
        if (!mounted) return;
        invalidateApiCache((key) =>
          key.includes("/student/enrollments") ||
          key.includes("/student/learning-stats") ||
          key.includes("/student/live-sessions") ||
          key.includes("/student/payments") ||
          key.includes("/courses"),
        );
        window.dispatchEvent(new Event("edutech_data_changed"));
        setRefreshSeed((prev) => prev + 1);
      } catch (err) {
        if (!mounted) return;
        if (err?.status !== 409) {
          setError(
            getLocalizedRequestErrorMessage(
              err,
              language,
              "تایید پرداخت انجام نشد.",
              "Payment confirmation failed.",
            ),
          );
        }
      } finally {
        if (mounted) {
          navigate("/student/courses", { replace: true });
        }
      }
    };

    confirmPayment();

    return () => {
      mounted = false;
    };
  }, [hasPaymentReturn, language, navigate, paymentReturn]);

  const loadEnrollments = useCallback(async (mountedRef) => {
    try {
      setLoading(true);
      const enrollments = await fetchStudentEnrollments();
      if (mountedRef && !mountedRef.current) return;
      setCourses(enrollments.map((item) => mapEnrollmentToCourse(item, language)));
    } catch (err) {
      if (mountedRef && !mountedRef.current) return;
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
          "بارگذاری کورس‌ها انجام نشد.",
          "Failed to load courses.",
        ),
      );
    } finally {
      if (!mountedRef || mountedRef.current) {
        setLoading(false);
      }
    }
  }, [language, navigate]);

  useEffect(() => {
    const mountedRef = { current: true };
    loadEnrollments(mountedRef);

    const handleEnrollmentRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", handleEnrollmentRefresh);
    window.addEventListener("edutech_data_changed", handleEnrollmentRefresh);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("auth_change", handleEnrollmentRefresh);
      window.removeEventListener("edutech_data_changed", handleEnrollmentRefresh);
    };
  }, [loadEnrollments]);

  useEffect(() => {
    const mountedRef = { current: true };
    if (refreshSeed > 0) {
      loadEnrollments(mountedRef);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [loadEnrollments, refreshSeed]);

  const tabs = useMemo(
    () => [
      { id: "all", label: isFa ? "همه" : "All", count: courses.length },
      {
        id: "active",
        label: isFa ? "فعال" : "Active",
        count: courses.filter((c) => c.status === "active").length,
      },
      {
        id: "completed",
        label: isFa ? "تکمیل شده" : "Completed",
        count: courses.filter((c) => c.status === "completed").length,
      },
      {
        id: "cancelled",
        label: isFa ? "لغو شده" : "Cancelled",
        count: courses.filter((c) => c.status === "cancelled").length,
      },
    ],
    [courses, isFa],
  );

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesTab = activeTab === "all" || course.status === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.teacher.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [courses, activeTab, searchQuery]);

  if (isRedirecting) return null;

  return (
    <StudentLayout language={language} user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery}>
      <div className="mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link className="transition hover:text-primary-700" to="/student/dashboard">
          {isFa ? "داشبورد" : "Dashboard"}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{isFa ? "کورس‌های من" : "My Courses"}</span>
      </div>

      <div className="mb-8 px-1 sm:px-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">
            {isFa ? "کورس‌های من" : "My Courses"}
          </h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {isFa
              ? "تمام کورس‌هایی که در آن ثبت‌نام کرده‌اید را اینجا ببینید."
              : "View all courses you are enrolled in here."}
          </p>
        </div>
        <Link to="/live-courses" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700">
          {isFa ? "دیدن کورس‌های آنلاین" : "Browse Live Courses"}{" "}
          {isFa ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
        </Link>
      </div>

      <CourseFilterTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {error ? <p className="mb-4 mt-4 text-sm font-bold text-rose-600">{error}</p> : null}

      <div className="space-y-4 mt-4">
        {loading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
            {isFa ? "در حال بارگذاری کورس‌های شما" : "Loading your courses"}
          </div>
        ) : filteredCourses.length > 0 ? (
          filteredCourses.map((course) => (
            <StudentCourseCard
              key={course.id}
              course={course}
              language={language}
              onOpenStatusModal={(row) => setModalCourse(row)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <BookOpen size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {isFa ? "هیچ کورسی پیدا نشد" : "No courses found"}
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {isFa
                ? "در این بخش هنوز کورسی وجود ندارد."
                : "There are no courses to show in this section yet."}
            </p>
            <Link to="/live-courses" className="mt-6 rounded-xl bg-primary-50 px-6 py-3 text-sm font-black text-primary-700 transition hover:bg-primary-100">
              {isFa ? "دیدن کورس‌های آنلاین" : "Browse Live Courses"}
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8">
        <InfoCard
          title={isFa ? "نکته مهم" : "Important Note"}
          text={
            isFa
              ? "لینک‌های Google Meet فقط در زمان برگزاری صنف فعال می‌شوند."
              : "Google Meet links are activated only during class time."
          }
          icon={Info}
          bgClass="bg-primary-50"
          textClass="text-primary-800"
          iconClass="text-primary-600"
        />
      </div>
      <div className="mt-4">
        <InfoCard
          title={isFa ? "به کمک نیاز دارید؟" : "Need Help?"}
          text={
            isFa
              ? "اگر سوالی دارید، با پشتیبانی در تماس باشید."
              : "If you have any questions, contact support."
          }
          icon={Headphones}
          buttonText={isFa ? "تماس با پشتیبانی" : "Contact Support"}
          buttonHref="/student/messages"
          bgClass="border border-slate-200 bg-white"
          textClass="text-slate-600"
          iconClass="text-primary-600"
        />
      </div>
      <div className="h-8" aria-hidden="true" />

      <RegistrationStatusModal
        isOpen={!!modalCourse}
        onClose={() => setModalCourse(null)}
        course={modalCourse}
        language={language}
      />
    </StudentLayout>
  );
}
