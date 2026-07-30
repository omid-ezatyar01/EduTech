import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BellRing,
  CalendarDays,
  ClipboardList,
  Clock3,
  Download,
  FolderOpen,
  MonitorPlay,
  MessageSquareHeart,
  Star,
  Target,
  Video,
  Wallet,
} from "lucide-react";
import { formatDisplayCurrencyAmount } from "../utils/currencyDisplay.js";
import { Link, useNavigate, useParams } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import {
  fetchStudentAssignments,
  fetchStudentEnrollments,
  fetchPendingCourseRatings,
  fetchStudentResources,
  fetchStudentRatings,
} from "../../services/courseService.js";
import InlineRatingModal from "./InlineRatingModal.jsx";
import { clearAuth, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import { buildTeacherPath } from "../utils/routePaths.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { resolveStudentCourseProgressPercent } from "../utils/courseProgress.js";
import {
  formatTimeZoneOffset,
  getDualTimeDetails,
} from "../utils/timezone.js";
import {
  getPublicStateLabel,
  getPublicStateTone,
} from "../utils/coursePublicState.js";

const COURSE_IMAGE_FALLBACK = "/logo.png";

function formatMeetingType(typeValue, language = "fa") {
  const key = String(typeValue || "").trim().toLowerCase();
  const map = {
    google_meet: { fa: "Google Meet", en: "Google Meet" },
    zoom: { fa: "Zoom", en: "Zoom" },
    recorded: { fa: "ضبط‌شده", en: "Recorded" },
    physical: { fa: "حضوری", en: "In Person" },
  };
  const hit = map[key];
  if (hit) return language === "fa" ? hit.fa : hit.en;
  return typeValue || (language === "fa" ? "نامشخص" : "Unknown");
}

function formatDate(dateValue, language = "fa") {
  const date = new Date(dateValue || "");
  if (Number.isNaN(date.getTime())) return language === "fa" ? "نامشخص" : "Unknown";
  if (language === "fa") {
    return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatCurrency(price, currency = "USD", language = "fa") {
  const amount = Number(price || 0);
  if (!Number.isFinite(amount)) return language === "fa" ? "نامشخص" : "Unknown";
  if (amount <= 0) return language === "fa" ? "رایگان" : "Free";
  return formatDisplayCurrencyAmount(amount, currency, language);
}

function formatDuration(course = {}, language = "fa") {
  const durationWeeks = Number(course?.durationWeeks || 0);
  if (Number.isFinite(durationWeeks) && durationWeeks > 0) {
    return language === "fa"
      ? `${new Intl.NumberFormat("fa-AF").format(durationWeeks)} هفته`
      : `${durationWeeks} weeks`;
  }
  return String(course?.duration || "").trim() || (language === "fa" ? "نامشخص" : "Unknown");
}

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "T";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function matchesCourseRoute(course = {}, routeId = "") {
  const value = String(routeId || "").trim();
  if (!value) return false;
  return [
    course?._id,
    course?.id,
    course?.slug,
  ].some((item) => String(item || "").trim() === value);
}

function matchesCourseValue(value, course = {}) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return false;
  return [
    course?._id,
    course?.id,
    course?.slug,
    course?.title,
  ].some((item) => String(item || "").trim() === normalizedValue);
}

function rowBelongsToCourse(row = {}, course = {}) {
  return (
    matchesCourseValue(row?.courseId, course) ||
    matchesCourseValue(row?.course?._id, course) ||
    matchesCourseValue(row?.course?.id, course) ||
    matchesCourseValue(row?.course?.slug, course) ||
    matchesCourseValue(row?.course?.title, course) ||
    matchesCourseValue(row?.course, course) ||
    matchesCourseValue(row?.title, course)
  );
}

export default function StudentCourseWorkspace({ language = "fa" }) {
  const isFa = language === "fa";
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrollment, setEnrollment] = useState(null);
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [courseResources, setCourseResources] = useState([]);
  const [ratingPrompts, setRatingPrompts] = useState([]);
  const [studentRatings, setStudentRatings] = useState([]);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingNotice, setRatingNotice] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadCourse = async () => {
      try {
        setLoading(true);
        setError("");
        const [
          enrollmentResult,
          assignmentsResult,
          resourcesResult,
          ratingPromptsResult,
          studentRatingsResult,
        ] = await Promise.allSettled([
          fetchStudentEnrollments(),
          fetchStudentAssignments(),
          fetchStudentResources(),
          fetchPendingCourseRatings(),
          fetchStudentRatings(),
        ]);
        if (!mounted) return;
        if (enrollmentResult.status === "rejected") {
          throw enrollmentResult.reason;
        }
        const rows = enrollmentResult.value;
        const hit =
          (Array.isArray(rows) ? rows : []).find((row) =>
            matchesCourseRoute(row?.courseId || {}, id),
          ) || null;
        setEnrollment(hit);
        const matchedCourse = hit?.courseId || {};
        const assignmentRows = assignmentsResult.status === "fulfilled"
          ? (Array.isArray(assignmentsResult.value) ? assignmentsResult.value : []).filter((row) =>
            rowBelongsToCourse(row, matchedCourse),
          )
          : [];
        const resourceRows = resourcesResult.status === "fulfilled"
          ? (Array.isArray(resourcesResult.value) ? resourcesResult.value : []).filter((row) =>
            rowBelongsToCourse(row, matchedCourse),
          )
          : [];
        setCourseAssignments(assignmentRows);
        setCourseResources(resourceRows);
        let nextRatingPrompts =
          ratingPromptsResult.status === "fulfilled" &&
          Array.isArray(ratingPromptsResult.value)
            ? ratingPromptsResult.value
            : [];
        const matchedCourseId = String(matchedCourse?._id || matchedCourse?.id || "");
        const hasCoursePrompt = nextRatingPrompts.some(
          (item) => String(item?.courseId || "") === matchedCourseId,
        );
        if (matchedCourseId && !hasCoursePrompt) {
          try {
            const exactPrompts = await fetchPendingCourseRatings(matchedCourseId);
            if (!mounted) return;
            if (Array.isArray(exactPrompts) && exactPrompts.length) {
              nextRatingPrompts = exactPrompts;
            }
          } catch {
            // The course remains usable if the optional rating prompt cannot load.
          }
        }
        setRatingPrompts(nextRatingPrompts);
        setStudentRatings(
          studentRatingsResult.status === "fulfilled" &&
          Array.isArray(studentRatingsResult.value)
            ? studentRatingsResult.value
            : [],
        );
      } catch (err) {
        if (!mounted) return;
        if (isUnauthorizedError(err)) {
          setAuthNotice("Not authorized for this resource");
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            "بارگذاری صفحه کورس انجام نشد.",
            "Unable to load the course page.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCourse();

    return () => {
      mounted = false;
    };
  }, [id, language, navigate, refreshSeed]);

  const course = useMemo(() => enrollment?.courseId || {}, [enrollment?.courseId]);
  const courseId = String(course?._id || course?.id || "");
  const ratingPrompt = ratingPrompts.find(
    (item) => String(item?.courseId || "") === courseId,
  );
  const existingRating = studentRatings.find(
    (item) => String(item?.courseId || "") === courseId,
  );
  const teacher = course?.teacher || {};
  const teacherAvatar = resolveAvatarUrl(String(teacher?.avatar || "").trim());
  const teacherName = String(teacher?.name || (isFa ? "مدرس کورس" : "Course Instructor")).trim();
  const enrollmentCanRate = ["active", "completed"].includes(
    String(enrollment?.enrollmentStatus || "").toLowerCase(),
  ) && String(enrollment?.accessStatus || "allowed").toLowerCase() === "allowed";
  const courseRatingOption =
    ratingPrompt ||
    (!existingRating && enrollmentCanRate && courseId
      ? {
          courseId,
          courseTitle: course?.title || (isFa ? "کورس" : "Course"),
        }
      : null);
  const teacherInitials = getInitials(teacherName);
  const courseImage = resolveAvatarUrl(
    String(course?.thumbnail || "").trim(),
    course?.updatedAt || course?.createdAt || "",
  ) || COURSE_IMAGE_FALLBACK;
  const teacherPath = buildTeacherPath(teacher);
  const scheduleRows = useMemo(
    () => (Array.isArray(course?.schedule) ? course.schedule : []),
    [course],
  );
  const statusLabel = useMemo(() => {
    const status = String(enrollment?.enrollmentStatus || "").toLowerCase();
    if (status === "active") return isFa ? "فعال" : "Active";
    if (status === "completed") return isFa ? "تکمیل شده" : "Completed";
    if (status === "cancelled") return isFa ? "لغو شده" : "Cancelled";
    return isFa ? "در انتظار تایید" : "Pending approval";
  }, [enrollment?.enrollmentStatus, isFa]);
  const courseTimeDetails = course?.startDate
    ? getDualTimeDetails(
        course.startDate,
        null,
        course?.timezone || "Asia/Kabul",
        language,
      )
    : null;
  const publicStateLabel = getPublicStateLabel(course, language);
  const quickFacts = [
    {
      icon: CalendarDays,
      label: isFa ? "شروع به وقت استاد" : "Start in teacher time",
      value: courseTimeDetails?.teacherDate || formatDate(course?.startDate, language),
      secondary: courseTimeDetails
        ? formatTimeZoneOffset(
            courseTimeDetails.teacherZone,
            language,
            new Date(course.startDate),
          )
        : "",
    },
    {
      icon: Clock3,
      label: isFa ? "مدت کورس" : "Course Duration",
      value: formatDuration(course, language),
    },
    {
      icon: MonitorPlay,
      label: isFa ? "نوع برگزاری" : "Delivery Type",
      value: formatMeetingType(course?.meetingType, language),
    },
    {
      icon: Wallet,
      label: isFa ? "هزینه کورس" : "Course Fee",
      value: formatCurrency(course?.price, course?.currency || "USD", language),
    },
  ];
  const courseStats = useMemo(() => {
    const progress = resolveStudentCourseProgressPercent(enrollment || {}, course || {}, 0);
    const pendingAssignments = courseAssignments.filter((item) =>
      String(item?.status || "").toLowerCase() === "pending",
    ).length;
    const downloadableFiles = courseResources.filter((item) =>
      Boolean(String(item?.url || item?.fileUrl || item?.downloadUrl || "").trim()),
    ).length;

    return {
      progress,
      weeklySessions: scheduleRows.length,
      pendingAssignments,
      downloadableFiles,
    };
  }, [course, courseAssignments, courseResources, enrollment, scheduleRows.length]);
  const workspaceLinks = [
    {
      to: "/student/live",
      icon: Video,
      title: isFa ? "صنف آنلاین" : "Live Class",
      text: isFa ? "ورود به صنف و جلسات زنده کورس." : "Open the live class and join sessions.",
    },
    {
      to: "/student/assignments",
      icon: ClipboardList,
      title: isFa ? "تمرین‌ها" : "Assignments",
      text: isFa ? "مشاهده تمرین‌ها، وظایف و کارهای عملی." : "Review assignments, tasks, and practice work.",
    },
    {
      to: "/student/resources",
      icon: FolderOpen,
      title: isFa ? "منابع کورس" : "Course Resources",
      text: isFa ? "فایل‌ها، منابع و مواد درسی کورس." : "Files, resources, and supporting course material.",
    },
    {
      to: "/student/certificates",
      icon: Award,
      title: isFa ? "سرتیفیکیت‌ها" : "Certificates",
      text: isFa ? "مشاهده سرتیفیکیت‌ها و وضعیت تکمیل کورس‌ها." : "View your certificates and course completion status.",
    },
  ];

  const refreshCourseRating = async () => {
    const [nextPrompts, nextRatings] = await Promise.all([
      fetchPendingCourseRatings(),
      fetchStudentRatings(),
    ]);
    setRatingPrompts(Array.isArray(nextPrompts) ? nextPrompts : []);
    setStudentRatings(Array.isArray(nextRatings) ? nextRatings : []);
    setRatingNotice(
      isFa
        ? "امتیاز و نظر شما فوراً ثبت و منتشر شد."
        : "Your rating and comment were published immediately.",
    );
  };

  if (loading) {
    return (
      <StudentLayout language={language}>
        <div
          className="animate-pulse space-y-5"
          aria-label={isFa ? "در حال بارگذاری صفحه کورس" : "Loading course page"}
        >
          <div className="h-72 rounded-[28px] border border-slate-200 bg-slate-100" />
          <div className="grid gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout language={language}>
        <div className="rounded-[24px] border border-rose-200 bg-white p-8 text-center">
          <p className="text-sm font-bold text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshSeed((value) => value + 1)}
            className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white"
          >
            {isFa ? "تلاش دوباره" : "Try again"}
          </button>
        </div>
      </StudentLayout>
    );
  }

  if (!enrollment) {
    return (
      <StudentLayout language={language}>
        <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-bold text-slate-600">
            {isFa ? "این کورس در کورس‌های شما پیدا نشد." : "This course was not found in your enrolled courses."}
          </p>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout language={language}>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link className="transition hover:text-primary-700" to="/student/dashboard">
          {isFa ? "داشبورد" : "Dashboard"}
        </Link>
        <span>/</span>
        <Link className="transition hover:text-primary-700" to="/student/courses">
          {isFa ? "کورس‌های من" : "My Courses"}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{course?.title || (isFa ? "صفحه کورس" : "Course Page")}</span>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <img
              src={courseImage}
              alt={course?.title || "Course"}
              className={courseImage === COURSE_IMAGE_FALLBACK
                ? "block h-auto max-h-[360px] w-auto max-w-full object-contain p-6"
                : "block h-auto max-h-[360px] w-auto max-w-full object-contain"}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                {statusLabel}
              </span>
              {publicStateLabel ? (
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getPublicStateTone(course)}`}>
                  {publicStateLabel}
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {course?.level || (isFa ? "همه سطوح" : "All Levels")}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {course?.title || (isFa ? "کورس بدون نام" : "Untitled course")}
            </h1>

            <Link
              to={teacherPath}
              className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-primary-100 hover:bg-primary-50"
            >
              {teacherAvatar ? (
                <img
                  src={teacherAvatar}
                  alt={teacherName}
                  className="h-11 w-11 rounded-full border border-slate-200 bg-white object-cover object-center"
                />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-sm font-black text-slate-700">
                  {teacherInitials}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-500">{isFa ? "مدرس کورس" : "Course Instructor"}</p>
                <p className="text-sm font-black text-slate-900">{teacherName}</p>
              </div>
            </Link>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {workspaceLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    to={item.to}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary-100 hover:bg-primary-50"
                  >
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                      <Icon size={18} />
                    </div>
                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">{item.text}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] border border-primary-100 bg-primary-50 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            {
              icon: Target,
              label: isFa ? "پیشرفت فعلی" : "Current Progress",
              value: `${courseStats.progress}%`,
            },
            {
              icon: CalendarDays,
              label: isFa ? "جلسات هفتگی" : "Weekly Sessions",
              value: String(courseStats.weeklySessions),
            },
            {
              icon: ClipboardList,
              label: isFa ? "تمرین باز" : "Open Assignments",
              value: String(courseStats.pendingAssignments),
            },
            {
              icon: Download,
              label: isFa ? "فایل قابل دانلود" : "Downloadable Files",
              value: String(courseStats.downloadableFiles),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500">{item.label}</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{item.value}</p>
                  </div>
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(courseRatingOption || existingRating) ? (
        <section className="mt-6 overflow-hidden rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-primary-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <MessageSquareHeart size={22} />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  {existingRating
                    ? isFa
                      ? "نظر شما درباره این کورس"
                      : "Your review of this course"
                    : isFa
                      ? "تجربه خود را با ما شریک کنید"
                      : "Share your course experience"}
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  {existingRating
                    ? isFa
                      ? "نظر شما منتشر شده است و هر زمان می‌توانید آن را ویرایش کنید."
                      : "Your review is published. You can edit it whenever needed."
                    : isFa
                      ? "به کورس امتیاز بدهید و نظر خود را بنویسید؛ نتیجه فوراً منتشر می‌شود."
                      : "Rate the course and add a comment. It will be published immediately."}
                </p>
                {existingRating ? (
                  <div className="mt-3 flex items-center gap-1" dir="ltr">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Star
                        key={score}
                        size={18}
                        className="text-amber-500"
                        fill={score <= Number(existingRating.courseRating || 0) ? "currentColor" : "none"}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRatingNotice("");
                setRatingModalOpen(true);
              }}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-black text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
            >
              <Star size={18} />
              {existingRating
                ? isFa
                  ? "ویرایش امتیاز و نظر"
                  : "Edit rating and comment"
                : isFa
                  ? "ثبت امتیاز و نظر"
                  : "Rate and comment"}
            </button>
          </div>
          {ratingNotice ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              {ratingNotice}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickFacts.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                    <Icon size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{item.value}</p>
                  {item.secondary ? (
                    <p className="mt-1 break-all text-[10px] font-bold text-slate-500" dir="ltr">
                      {item.secondary}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <BellRing size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {isFa ? "اعلان‌ها و پیام‌های استاد" : "Instructor Announcements"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isFa ? "آپدیت‌های تازه، راهنمایی استاد و موارد مهم کورس." : "Fresh updates, instructor guidance, and key course notes."}
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            {isFa
              ? "هنوز اعلانی برای این کورس ثبت نشده است."
              : "No announcements have been posted for this course yet."}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {isFa ? "برنامه جلسات کورس" : "Course Session Schedule"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isFa ? "زمان‌بندی و جلسات مهمی که برای این کورس ثبت شده است." : "Schedule and important sessions registered for this course."}
              </p>
            </div>
          </div>
          {courseTimeDetails ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-xs font-black text-blue-700">
                  {isFa ? "وقت تعیین‌شده استاد" : "Teacher’s scheduled time"}
                </p>
                <p className="mt-1.5 text-sm font-black text-slate-950">
                  {courseTimeDetails.teacherDate}
                </p>
              </div>
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                <p className="text-xs font-black text-teal-700">
                  {isFa ? "وقت محل فعلی شما" : "Your local time"}
                </p>
                <p className="mt-1.5 text-sm font-black text-slate-950">
                  {courseTimeDetails.localDate}
                </p>
                <p className="mt-1 break-all text-[10px] font-bold text-slate-500" dir="ltr">
                  {formatTimeZoneOffset(
                    courseTimeDetails.localZone,
                    language,
                    new Date(course.startDate),
                  )}
                </p>
              </div>
            </div>
          ) : null}
          {scheduleRows.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
                <span>{isFa ? "روز" : "Day"}</span>
                <span>{isFa ? "شروع" : "Start"}</span>
                <span>{isFa ? "پایان" : "End"}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {scheduleRows.map((row, index) => (
                  <div key={`${row?.day || "day"}-${index}`} className="grid grid-cols-[1.2fr_1fr_1fr] px-4 py-3 text-sm font-semibold text-slate-700">
                    <span>{row?.day || "-"}</span>
                    <span dir="ltr">{row?.startTime || "-"}</span>
                    <span dir="ltr">{row?.endTime || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
              {isFa ? "هنوز برنامه مشخصی برای این کورس ثبت نشده است." : "No fixed schedule has been added for this course yet."}
            </div>
          )}
        </section>
      </div>

      <InlineRatingModal
        open={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        courses={courseRatingOption ? [courseRatingOption] : []}
        existingRatings={existingRating ? [existingRating] : []}
        initialCourseId={courseId}
        language={language}
        onSaved={refreshCourseRating}
      />

    </StudentLayout>
  );
}
