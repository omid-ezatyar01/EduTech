import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  PenLine,
  CreditCard,
  CalendarDays,
  BellRing,
  Video,
  ClipboardList,
  MessageCircle,
  FolderOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import StudentLayout from "../components/StudentLayout.jsx";
import DashboardStatCard from "../components/DashboardStatCard.jsx";
import TodayClassCard from "../components/TodayClassCard.jsx";
import CourseProgressCard from "../components/CourseProgressCard.jsx";
import NotificationCard from "../components/NotificationCard.jsx";
import {
  fetchStudentEnrollments,
  fetchStudentLiveSessions,
} from "../../services/courseService.js";
import { getStudentPaymentHistory } from "../../services/paymentGateway.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import { isUnauthorizedError } from "../../services/http.js";
import { resolveStudentCourseProgressPercent } from "../utils/courseProgress.js";
import { buildCoursePath } from "../utils/routePaths.js";
import { formatUsd } from "../../services/purchaseService.js";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh.js";

const STATUS_ORDER = {
  active: 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
};

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

const isScheduleForToday = (dayValue, todayIndex = new Date().getDay()) => {
  const normalizedDay = normalizeDayLabel(dayValue);
  if (!normalizedDay) return false;
  const todayAliases = DAY_ALIASES[todayIndex] || [];
  return todayAliases.some((alias) => normalizedDay.includes(normalizeDayLabel(alias)));
};

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

const isSameLocalDay = (left, right = new Date()) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

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
    const partValue = (type) =>
      parts.find((part) => part.type === type)?.value || "";
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

const getTodaySessionPhase = (scheduleRow = null, now = new Date()) => {
  if (!scheduleRow) return "none";
  const start = parseTimeToMinutes(scheduleRow.startTime);
  const end = parseTimeToMinutes(scheduleRow.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "none";
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < start) return "before";
  if (current > end) return "ended";
  return "ongoing";
};

const toUser = (rawUser) => {
  if (!rawUser) {
    return { name: "User", nameFa: "کاربر" };
  }

  if (typeof rawUser === "object") {
    return rawUser;
  }

  try {
    const parsed = JSON.parse(rawUser);
    return parsed && typeof parsed === "object"
      ? parsed
      : { name: "User", nameFa: "کاربر" };
  } catch {
    return { name: "User", nameFa: "کاربر" };
  }
};

const toRelativeTime = (dateValue, language = "fa") => {
  if (!dateValue) return language === "fa" ? "تازه" : "Recently";

  const now = Date.now();
  const date = new Date(dateValue).getTime();
  if (Number.isNaN(date)) return language === "fa" ? "تازه" : "Recently";

  const diffSec = Math.round((date - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(language === "fa" ? "fa" : "en", {
    numeric: "auto",
  });

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
};

const getRequestErrorMessage = (reason, language = "fa", scope = "general") => {
  const message = String(reason?.message || reason || "");
  const isFa = language === "fa";
  const label =
    scope === "payments"
      ? isFa
        ? "پرداخت‌ها"
        : "payments"
      : isFa
        ? "کورس‌ها"
        : "courses";

  const normalized = message.toLowerCase();

  if (
    normalized.includes("not_authenticated") ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized")
  ) {
    return isFa
      ? `بارگذاری ${label} ناموفق بود. لطفاً دوباره وارد شوید.`
      : `Failed to load ${label}. Please login again.`;
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("connection refused") ||
    normalized.includes("networkerror") ||
    normalized.includes("failed to reach")
  ) {
    return isFa
      ? `بارگذاری ${label} ناموفق بود. سرور در دسترس نیست.`
      : `Failed to load ${label}. Backend server is unreachable.`;
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return isFa
      ? `بارگذاری ${label} زمان‌بر شد. لطفاً دوباره تلاش کنید.`
      : `Loading ${label} timed out. Please try again.`;
  }

  return isFa ? `بارگذاری ${label} ناموفق بود.` : `Failed to load ${label}.`;
};

function mapEnrollment(enrollment = {}, language = "fa") {
  const course = enrollment.courseId || {};
  const teacher = course.teacher || {};
  const status = enrollment.enrollmentStatus || "pending";

  const scheduleRows = Array.isArray(course.schedule) ? course.schedule : [];
  const todaySchedule = scheduleRows.find((row) => isScheduleForToday(row?.day));
  const firstSchedule = todaySchedule || scheduleRows[0] || null;
  const todayPhase = getTodaySessionPhase(todaySchedule);

  const nextScheduleText = resolveNextScheduleText(scheduleRows, language);
  const nextClass = nextScheduleText || (
    firstSchedule
      ? `${firstSchedule.day} ${firstSchedule.startTime} - ${firstSchedule.endTime}`
      : language === "fa"
        ? "زمان‌بندی این کورس به‌زودی اعلام می‌شود"
        : "Course schedule will be announced soon."
  );
  const description = course.shortDescription || course.description || "";
  const courseSlug = course.slug || course._id || "";
  const teacherName =
    teacher?.name ||
    course.teacherName ||
    course?.createdBy?.name ||
    "Teacher";

  const progress = resolveStudentCourseProgressPercent(enrollment, course, 0);

  return {
    id: enrollment._id,
    title: course.title || "Course",
    teacher: teacherName,
    description,
    courseSlug,
    courseLink: courseSlug ? buildCoursePath(course) : "/live-courses",
    progress,
    status,
    nextClass,
    hasClassToday: Boolean(todaySchedule),
    todayPhase,
    meetLink:
      status === "active" && todaySchedule && todayPhase === "ongoing"
        ? course.meetingLink || null
        : null,
    createdAt: enrollment.createdAt || null,
  };
}

function mapLiveSessionToTodayCourse(session = {}, language = "fa") {
  const startAt = new Date(session.startAt);
  const endAt = new Date(session.endAt);
  const isValidTime =
    !Number.isNaN(startAt.getTime()) &&
    !Number.isNaN(endAt.getTime());
  const dayLabel = isValidTime
    ? startAt.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
    : (language === "fa" ? "امروز" : "today");
  const startLabel = isValidTime
    ? startAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";
  const endLabel = isValidTime
    ? endAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  return {
    id: session._id || session.id,
    title: session?.course?.title || session.title || "Course",
    teacher: session?.course?.teacherName || (language === "fa" ? "استاد" : "Teacher"),
    description:
      session.description ||
      session.title ||
      (language === "fa"
        ? "موضوع جلسه توسط استاد اعلام می‌شود."
        : "The topic will be shared by the instructor."),
    nextClass: `${dayLabel} ${startLabel} - ${endLabel}`,
    meetLink: session.meetingLink || null,
    status: session.status || "scheduled",
    startAt: session.startAt,
    endAt: session.endAt,
  };
}

function mapLiveSessionToUpcoming(session = {}, language = "fa") {
  const startAt = new Date(session.startAt);
  const endAt = new Date(session.endAt);
  const isFa = language === "fa";
  const locale = isFa ? "fa-AF" : "en-US";
  const isValidTime =
    !Number.isNaN(startAt.getTime()) &&
    !Number.isNaN(endAt.getTime());
  const dateLabel = isValidTime
    ? startAt.toLocaleDateString(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";
  const startLabel = isValidTime
    ? startAt.toLocaleTimeString(isFa ? "fa-AF" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "--:--";
  const endLabel = isValidTime
    ? endAt.toLocaleTimeString(isFa ? "fa-AF" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "--:--";

  return {
    title: session?.course?.title || session.title || "Course",
    time: `${dateLabel} ${isFa ? "—" : "-"} ${startLabel} - ${endLabel}`,
    status:
      session.enrollmentStatus === "pending" ? "pending" : "upcoming",
    startAt: session.startAt || null,
    endAt: session.endAt || null,
  };
}

function mapPayment(payment = {}) {
  return {
    id: payment._id,
    reference: payment.paymentReference || payment.transactionId || payment._id,
    courseTitle: payment.courseId?.title || "Course",
    status: payment.status || payment.paymentStatus || "pending",
    amount: Number(payment.amount) || 0,
    currency: payment.currency || "USD",
    createdAt: payment.createdAt || payment.paidAt || null,
    expiresAt: payment.expiresAt || payment.paymentAttemptId?.expiresAt || null,
  };
}

export default function StudentDashboardPage({ language = "fa" }) {
  const user = toUser(getAuthUser());
  const userName =
    (language === "fa"
      ? user.firstNameFa || user.nameFa || user.name
      : user.firstName || user.name || user.nameFa || user.firstNameFa) ||
    user.username;

  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [upcomingSessionRows, setUpcomingSessionRows] = useState([]);
  const [todayCourse, setTodayCourse] = useState(null);
  const [upcomingWeekSessionCount, setUpcomingWeekSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const [enrollmentResult, paymentResult, liveSessionResult] = await Promise.allSettled([
          fetchStudentEnrollments(),
          getStudentPaymentHistory(),
          fetchStudentLiveSessions({ page: 1, limit: 100 }),
        ]);

        if (!mounted) return;
        const firstErrorReason =
          enrollmentResult.status === "rejected"
            ? enrollmentResult.reason
            : paymentResult.status === "rejected"
              ? paymentResult.reason
              : liveSessionResult.status === "rejected"
                ? liveSessionResult.reason
                : null;
        if (isUnauthorizedError(firstErrorReason)) {
          setAuthNotice("Not authorized for this resource");
          clearAuth();
          setIsRedirecting(true);
          navigate("/login", { replace: true });
          return;
        }

        if (enrollmentResult.status === "fulfilled") {
          const mapped = Array.isArray(enrollmentResult.value)
            ? enrollmentResult.value.map((row) => mapEnrollment(row, language))
            : [];
          mapped.sort((a, b) => {
            const aOrder = STATUS_ORDER[a.status] ?? 99;
            const bOrder = STATUS_ORDER[b.status] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          setEnrollments(mapped);
        } else {
          setEnrollments([]);
          setError(
            getRequestErrorMessage(
              enrollmentResult.reason,
              language,
              "courses",
            ),
          );
        }

        if (paymentResult.status === "fulfilled") {
          setPayments(
            Array.isArray(paymentResult.value)
              ? paymentResult.value.map(mapPayment)
              : [],
          );
        } else {
          setPayments([]);
          setError((prev) => {
            const msg = getRequestErrorMessage(
              paymentResult.reason,
              language,
              "payments",
            );
            return prev ? `${prev} ${msg}` : msg;
          });
        }

        if (liveSessionResult.status === "fulfilled") {
          const allSessions = Array.isArray(liveSessionResult.value?.sessions)
            ? liveSessionResult.value.sessions
            : [];
          const now = new Date();
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);
          const weekEnd = new Date(startOfToday);
          weekEnd.setDate(weekEnd.getDate() + 7);
          weekEnd.setHours(23, 59, 59, 999);
          const todaySessions = allSessions
            .filter((session) => {
              const startAt = new Date(session.startAt);
              if (Number.isNaN(startAt.getTime())) return false;
              if (!isSameLocalDay(startAt, now)) return false;
              return session.status === "live" || session.status === "scheduled";
            })
            .sort((a, b) => {
              if (a.status === "live" && b.status !== "live") return -1;
              if (b.status === "live" && a.status !== "live") return 1;
              return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
            });

          setTodayCourse(
            todaySessions.length
              ? mapLiveSessionToTodayCourse(todaySessions[0], language)
              : null,
          );
          const weekSessions = allSessions.filter((session) => {
            const startAt = new Date(session.startAt);
            if (Number.isNaN(startAt.getTime())) return false;
            if (!(session.status === "live" || session.status === "scheduled")) return false;
            return startAt >= startOfToday && startAt <= weekEnd;
          });
          setUpcomingWeekSessionCount(weekSessions.length);
          const upcomingSessions = allSessions
            .filter((session) => {
              const startAt = new Date(session.startAt);
              if (Number.isNaN(startAt.getTime())) return false;
              if (startAt.getTime() < (nowMs || Date.now())) return false;
              return session.status === "live" || session.status === "scheduled";
            })
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 3)
            .map((session) => mapLiveSessionToUpcoming(session, language));
          setUpcomingSessionRows(upcomingSessions);
        } else {
          setTodayCourse(null);
          setUpcomingWeekSessionCount(0);
          setUpcomingSessionRows([]);
        }
      } catch {
        if (!mounted) return;
        setError(
          language === "fa"
            ? "بارگذاری داشبورد انجام نشد."
            : "Unable to load dashboard data.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [language, navigate, refreshSeed]);
  

  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) => {
        const isPending = String(payment.status || "").toLowerCase() === "pending";
        const expiresAtMs = payment.expiresAt ? new Date(payment.expiresAt).getTime() : Number.NaN;
        return !(isPending && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs);
      }),
    [nowMs, payments],
  );

  useLiveDataRefresh(
    () => setRefreshSeed((prev) => prev + 1),
    {
      enabled: true,
      intervalMs: 0,
      refreshOnWindowFocus: false,
      refreshOnVisibility: false,
      events: ["auth_change", "edutech_data_changed"],
    },
  );

  const stats = useMemo(() => {
    const activeCourses = enrollments.filter(
      (row) => row.status === "active",
    ).length;
    const completedCourses = enrollments.filter(
      (row) => row.status === "completed",
    ).length;
    const paidStatuses = new Set(["paid", "success", "succeeded", "completed"]);
    const paidRows = visiblePayments.filter((payment) =>
      paidStatuses.has(String(payment?.status || "").toLowerCase()),
    );
    const totalPaid = paidRows.reduce(
      (sum, payment) => sum + (Number(payment?.amount) || 0),
      0,
    );
    const paidCurrency =
      String(paidRows[0]?.currency || visiblePayments[0]?.currency || "USD").toUpperCase();
    const totalPaidLabel = formatUsd(totalPaid, language, paidCurrency);

    return [
      {
        title: language === "fa" ? "کورس‌های فعال" : "Active Courses",
        value: String(activeCourses),
        icon: BookOpen,
        colorClass: "bg-teal-50 text-teal-600",
      },
      {
        title: language === "fa" ? "کورس‌های تکمیل‌شده" : "Completed Courses",
        value: String(completedCourses),
        icon: PenLine,
        colorClass: "bg-primary-50 text-primary-600",
      },
      {
        title: language === "fa" ? "مجموع پرداختی" : "Total Paid",
        value: totalPaidLabel,
        icon: CreditCard,
        colorClass: "bg-amber-50 text-amber-600",
      },
      {
        title: language === "fa" ? "جلسات ۷ روز آینده" : "Next 7 Days Classes",
        value: String(upcomingWeekSessionCount),
        icon: Video,
        colorClass: "bg-rose-50 text-rose-600",
      },
    ];
  }, [enrollments, language, upcomingWeekSessionCount, visiblePayments]);

  if (isRedirecting) return null;

  const upcomingClasses = upcomingSessionRows.length
    ? upcomingSessionRows
    : enrollments
      .filter((course) => course.status !== "completed" && course.status !== "cancelled")
      .slice(0, 3)
      .map((course) => {
      const isUpcoming = course.status === "active";
      return {
        title: course.title,
        time: course.nextClass,
        status: isUpcoming ? "upcoming" : "pending",
      };
    });
  const dashboardCourses = enrollments.slice(0, 2);

  const notifications = [
    ...enrollments.slice(0, 2).map((row) => ({
      text:
        language === "fa"
          ? `وضعیت کورس ${row.title}: ${row.status === "active" ? "فعال" : row.status === "completed" ? "تکمیل‌شده" : row.status === "cancelled" ? "لغو شده" : "در انتظار تایید"}`
          : `${row.title} status: ${row.status}`,
      time: toRelativeTime(row.createdAt, language),
      isNew: row.status === "pending",
    })),
    ...visiblePayments.slice(0, 2).map((payment) => ({
      text:
        language === "fa"
          ? `پرداخت ${payment.reference}: ${payment.status === "paid" ? "تایید شد" : payment.status === "failed" ? "ناموفق" : "در انتظار"}`
          : `Payment ${payment.reference}: ${payment.status}`,
      time: toRelativeTime(payment.createdAt, language),
      isNew: payment.status === "pending",
    })),
  ].slice(0, 4);

  return (
    <StudentLayout language={language} user={user}>
      <section className="relative mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="absolute -top-24 -start-16 h-64 w-64 rounded-full bg-primary-50 blur-3xl" />
        <div className="absolute -bottom-24 -end-16 h-64 w-64 rounded-full bg-teal-50 blur-3xl" />

        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
              {language === "fa" ? `سلام، ${userName}!` : `Hello, ${userName}!`}
            </h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {language === "fa"
                ? "این داشبورد، مرکز مدیریت کورس‌ها، صنف آنلاین، تمرین‌ها و پرداخت‌های شما است."
                : "This dashboard is your control center for courses, live classes, assignments, and payments."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {user?.studentId ? (
                <span className="inline-flex whitespace-nowrap rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-black text-primary-700 sm:text-sm">
                  {language === "fa" ? (
                    <>
                      <span>آیدی محصل:</span>
                      <bdi className="ms-1" dir="ltr">{user.studentId}</bdi>
                    </>
                  ) : (
                    <>
                      <span>Student ID:</span>
                      <span className="ms-1" dir="ltr">
                        {user.studentId}
                      </span>
                    </>
                  )}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <Link
              to="/student/live"
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-50"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                <Video size={18} />
              </div>
              <p className="text-sm font-black text-slate-900">
                {language === "fa" ? "صنف آنلاین" : "Live Class"}
              </p>
            </Link>
            <Link
              to="/student/assignments"
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-50"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                <ClipboardList size={18} />
              </div>
              <p className="text-sm font-black text-slate-900">
                {language === "fa" ? "تمرین‌ها" : "Assignments"}
              </p>
            </Link>
            <Link
              to="/student/messages"
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-50"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                <MessageCircle size={18} />
              </div>
              <p className="text-sm font-black text-slate-900">
                {language === "fa" ? "پیام‌ها" : "Messages"}
              </p>
            </Link>
            <Link
              to="/student/resources"
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-50"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                <FolderOpen size={18} />
              </div>
              <p className="text-sm font-black text-slate-900">
                {language === "fa" ? "منابع کورس" : "Course Resources"}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, idx) => (
          <DashboardStatCard key={idx} {...stat} />
        ))}
      </div>

      {loading || error ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          {loading ? (
            <p className="text-sm font-bold text-slate-500">
              {language === "fa"
                ? "در حال بارگذاری داشبورد"
                : "Loading dashboard"}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm font-bold text-rose-600">{error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-6">
        <TodayClassCard course={todayCourse} language={language} />

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">
              {language === "fa" ? "کورس‌های من" : "My Courses"}
            </h2>
            <Link
              to="/student/courses"
              className="text-sm font-bold text-primary-600 hover:text-primary-700"
            >
              {language === "fa" ? "همه کورس‌ها" : "All Courses"}
            </Link>
          </div>
          {enrollments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-bold text-slate-600">
                {language === "fa"
                  ? "هنوز کورسی برای شما ثبت نشده است."
                  : "No course is enrolled yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {dashboardCourses.map((course) => (
                <CourseProgressCard
                  key={course.id}
                  course={course}
                  language={language}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex h-[430px] flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <CalendarDays size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-950">
                {language === "fa" ? "برنامه آینده" : "Upcoming"}
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pe-1">
              {upcomingClasses.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  {language === "fa"
                    ? "صنف آینده‌ای پیدا نشد."
                    : "No upcoming class found."}
                </p>
              ) : (
                upcomingClasses.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.time}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${item.status === "upcoming" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {item.status === "upcoming"
                        ? language === "fa"
                          ? "پیش‌رو"
                          : "Upcoming"
                        : language === "fa"
                          ? "در انتظار"
                          : "Pending"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="flex h-[430px] flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <BellRing size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-950">
                {language === "fa" ? "اعلانات" : "Notifications"}
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pe-1">
              {notifications.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  {language === "fa"
                    ? "هنوز اعلانی وجود ندارد."
                    : "No notifications yet."}
                </p>
              ) : (
                notifications.map((item, idx) => (
                  <NotificationCard key={idx} {...item} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
      <div className="h-8" aria-hidden="true" />
    </StudentLayout>
  );
}
