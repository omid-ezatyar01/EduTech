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
  PlayCircle,
  Target,
  Video,
  Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import {
  fetchStudentAssignments,
  fetchStudentEnrollments,
  fetchStudentResources,
} from "../../services/courseService.js";
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
  return `${new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US").format(amount)} ${currency}`;
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

function normalizeList(rows = []) {
  return [...new Set((Array.isArray(rows) ? rows : []).map((item) => String(item || "").trim()).filter(Boolean))];
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

function formatShortDate(dateValue, language = "fa") {
  const date = new Date(dateValue || "");
  if (Number.isNaN(date.getTime())) return language === "fa" ? "به‌زودی" : "Soon";
  if (language === "fa") {
    return new Intl.DateTimeFormat("fa-AF-u-ca-persian", {
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildMockStudentWorkspaceData({
  course = {},
  enrollment = {},
  teacherName = "",
  learningPoints = [],
  requirementPoints = [],
  audiencePoints = [],
  scheduleRows = [],
  language = "fa",
}) {
  const isFa = language === "fa";
  const progress = Math.min(
    96,
    Math.max(
      12,
      Number(enrollment?.progressPercent || enrollment?.progress || 0) ||
        20 + ((learningPoints.length || 3) * 7),
    ),
  );
  const completedUnits = Math.max(1, Math.min(learningPoints.length || 4, Math.round(progress / 20)));
  const totalUnits = Math.max(completedUnits + 1, learningPoints.length || 6);
  const pendingAssignments = Math.max(1, Math.min(4, requirementPoints.length || 2));
  const downloadableFiles = Math.max(8, (learningPoints.length + requirementPoints.length) * 2 || 10);

  const studyModules = (learningPoints.length ? learningPoints : [
    isFa ? "مرور مفاهیم اصلی کورس" : "Review core course concepts",
    isFa ? "تمرین‌های هفتگی" : "Weekly practice tasks",
    isFa ? "پروژه عملی" : "Hands-on project",
    isFa ? "جلسه بازخورد" : "Feedback session",
  ]).slice(0, 6).map((item, index) => ({
    title: item,
    lessons: isFa ? `${index + 3} درس` : `${index + 3} lessons`,
    duration: isFa ? `${(index + 1) * 35} دقیقه` : `${(index + 1) * 35} min`,
    status:
      index < completedUnits
        ? (isFa ? "تکمیل شده" : "Completed")
        : index === completedUnits
          ? (isFa ? "در حال یادگیری" : "In progress")
          : (isFa ? "در صف مطالعه" : "Queued"),
    accent:
      index < completedUnits
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : index === completedUnits
          ? "bg-primary-50 text-primary-700 border-primary-200"
          : "bg-slate-50 text-slate-600 border-slate-200",
  }));

  const sessionTimeline = (scheduleRows.length ? scheduleRows : [
    { day: isFa ? "دوشنبه" : "Monday", startTime: "18:00", endTime: "19:30" },
    { day: isFa ? "چهارشنبه" : "Wednesday", startTime: "18:00", endTime: "19:30" },
    { day: isFa ? "جمعه" : "Friday", startTime: "17:00", endTime: "18:00" },
  ]).slice(0, 4).map((row, index) => ({
    title:
      index === 0
        ? (isFa ? "جلسه بعدی صنف" : "Next live session")
        : index === 1
          ? (isFa ? "لابراتوار تمرین" : "Practice lab")
          : index === 2
            ? (isFa ? "جلسه رفع اشکال" : "Q&A clinic")
            : (isFa ? "ارزیابی هفتگی" : "Weekly checkpoint"),
    date: `${row?.day || (isFa ? "به‌زودی" : "Soon")} • ${row?.startTime || "--"} - ${row?.endTime || "--"}`,
    note:
      index === 0
        ? (isFa ? "ورود مستقیم از بخش صنف آنلاین در زمان شروع." : "Join directly from the live class section at start time.")
        : index === 1
          ? (isFa ? "برای تمرین عملی و نمونه‌کار این جلسه را از دست ندهید." : "Use this session for practical work and guided exercises.")
          : index === 2
            ? (isFa ? "سوالات درس و تکلیف در این بخش بررسی می‌شود." : "Bring lesson and assignment questions to this session.")
            : (isFa ? "پیشرفت شما در پایان هفته مرور می‌شود." : "Your weekly progress is reviewed here."),
  }));

  const resourceGroups = [
    {
      title: isFa ? "ویدیوها و ضبط‌ها" : "Videos & Recordings",
      count: isFa ? `${Math.max(6, completedUnits + 4)} فایل` : `${Math.max(6, completedUnits + 4)} files`,
      text: isFa ? "جلسات ضبط‌شده، ویدیوهای کوتاه و مرور درس‌ها." : "Recorded classes, short lessons, and recap videos.",
    },
    {
      title: isFa ? "جزوه و اسلاید" : "Notes & Slides",
      count: isFa ? `${Math.max(4, completedUnits + 2)} فایل` : `${Math.max(4, completedUnits + 2)} files`,
      text: isFa ? "خلاصه درس، فایل‌های PDF و اسلایدهای استاد." : "Lesson summaries, PDFs, and instructor slide decks.",
    },
    {
      title: isFa ? "تمرین و پروژه" : "Practice & Projects",
      count: isFa ? `${pendingAssignments + 2} مورد` : `${pendingAssignments + 2} items`,
      text: isFa ? "تمرین‌های عملی، پروژه‌ها و نمونه‌کارهای ارزیابی." : "Hands-on tasks, projects, and graded practice work.",
    },
    {
      title: isFa ? "فایل‌های کمکی" : "Support Files",
      count: isFa ? `${downloadableFiles} دانلود` : `${downloadableFiles} downloads`,
      text: isFa ? "چک‌لیست‌ها، واژه‌نامه‌ها و فایل‌های کمکی کورس." : "Checklists, glossaries, and support documents for the course.",
    },
  ];

  const announcements = [
    {
      title: isFa ? "نقشه این هفته کورس" : "This Week's Learning Plan",
      date: formatShortDate(course?.updatedAt || course?.startDate, language),
      text: isFa
        ? `${teacherName} مسیر مطالعه این هفته را آپدیت کرده است. ابتدا محتوای ماژول جاری را بخوانید، سپس تمرین عملی را ارسال کنید.`
        : `${teacherName} updated this week's study flow. Review the current module first, then submit the practical exercise.`,
    },
    {
      title: isFa ? "تمرین جدید اضافه شد" : "New Assignment Added",
      date: formatShortDate(course?.createdAt || course?.startDate, language),
      text: isFa
        ? "یک تمرین جدید برای تثبیت مفاهیم این بخش اضافه شده و بهتر است پیش از جلسه بعدی تکمیل شود."
        : "A new practice task was added for this section and should ideally be completed before the next session.",
    },
    {
      title: isFa ? "منابع تکمیلی منتشر شد" : "Supplementary Resources Posted",
      date: isFa ? "امروز" : "Today",
      text: isFa
        ? "جزوه‌های کمکی و فایل‌های تکمیلی برای مرور بهتر مطالب در دسترس قرار گرفته است."
        : "Extra notes and support material are now available for stronger revision.",
    },
  ];

  const questionThreads = [
    {
      question: isFa ? "برای این بخش از کورس، اول ویدیوها را ببینیم یا تمرین را شروع کنیم؟" : "Should we watch the videos first or start with the exercise for this section?",
      answer: isFa
        ? `${teacherName}: بهتر است ویدیوی اصلی و خلاصه جزوه را ببینید، بعد تمرین را حل کنید تا بازخورد دقیق‌تری بگیرید.`
        : `${teacherName}: Start with the main lesson and notes, then do the exercise so your feedback is more accurate.`,
    },
    {
      question: isFa ? "اگر در جلسه زنده حاضر نشوم، آیا ضبط آن در دسترس می‌ماند؟" : "If I miss the live session, will the recording stay available?",
      answer: isFa
        ? "بله، ضبط جلسه همراه با فایل‌های مرتبط در بخش منابع کورس قرار می‌گیرد."
        : "Yes, the session recording and related files will be added to the course resources area.",
    },
    {
      question: isFa ? "برای آمادگی بهتر، کدام منابع این هفته مهم‌تر است؟" : "Which resources matter most for this week's preparation?",
      answer: isFa
        ? "ماژول جاری، تمرین هفتگی و جلسه رفع اشکال این هفته اولویت اصلی شما است."
        : "Prioritize the current module, the weekly assignment, and the upcoming Q&A clinic.",
    },
  ];

  const supportCards = [
  ];

  return {
    progress,
    completedUnits,
    totalUnits,
    pendingAssignments,
    downloadableFiles,
    studyModules,
    sessionTimeline,
    resourceGroups,
    announcements,
    questionThreads,
    supportCards,
    audienceHighlights: (audiencePoints.length ? audiencePoints : [
      isFa ? "دانشجویانی که می‌خواهند با برنامه مشخص پیش بروند." : "Students who want a structured study path.",
      isFa ? "کسانی که به تمرین، بازخورد و جلسه زنده نیاز دارند." : "Learners who benefit from practice, feedback, and live sessions.",
    ]).slice(0, 3),
  };
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

  useEffect(() => {
    let mounted = true;

    const loadCourse = async () => {
      try {
        setLoading(true);
        setError("");
        const [enrollmentResult, assignmentsResult, resourcesResult] = await Promise.allSettled([
          fetchStudentEnrollments(),
          fetchStudentAssignments(),
          fetchStudentResources(),
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
  }, [id, language, navigate]);

  const course = enrollment?.courseId || {};
  const teacher = course?.teacher || {};
  const teacherAvatar = resolveAvatarUrl(String(teacher?.avatar || "").trim());
  const teacherName = String(teacher?.name || (isFa ? "مدرس کورس" : "Course Instructor")).trim();
  const teacherInitials = getInitials(teacherName);
  const courseImage = resolveAvatarUrl(
    String(course?.thumbnail || "").trim(),
    course?.updatedAt || course?.createdAt || "",
  ) || COURSE_IMAGE_FALLBACK;
  const teacherPath = buildTeacherPath(teacher);
  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  const learningPoints = normalizeList(course?.whatYouWillLearn || course?.curriculumTopics || []);
  const requirementPoints = normalizeList(course?.requirements || []);
  const audiencePoints = normalizeList(course?.targetAudience || []);
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
      weeklySessions: Math.max(1, scheduleRows.length || 0),
      pendingAssignments,
      downloadableFiles,
    };
  }, [course, courseAssignments, courseResources, enrollment, scheduleRows.length]);
  const workspaceData = useMemo(
    () =>
      buildMockStudentWorkspaceData({
        course,
        enrollment,
        teacherName,
        learningPoints,
        requirementPoints,
        audiencePoints,
        scheduleRows,
        language,
      }),
    [
      audiencePoints,
      course,
      enrollment,
      language,
      learningPoints,
      requirementPoints,
      scheduleRows,
      teacherName,
    ],
  );
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

  if (loading) {
    return (
      <StudentLayout language={language}>
        <div className="rounded-[24px] border border-slate-200 bg-white py-20 text-center text-sm font-semibold text-slate-500">
          {isFa ? "در حال بارگذاری صفحه کورس" : "Loading course page"}
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout language={language}>
        <div className="rounded-[24px] border border-rose-200 bg-white p-8 text-center">
          <p className="text-sm font-bold text-rose-600">{error}</p>
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
          <div className="mt-5 space-y-3">
            {workspaceData.announcements.map((item) => (
              <div key={`${item.title}-${item.date}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{item.title}</p>
                  <span className="text-xs font-bold text-slate-500">{item.date}</span>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
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

      <div className="mt-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <PlayCircle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {isFa ? "جلسات و فعالیت‌های پیش رو" : "Upcoming Sessions & Activities"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isFa ? "آنچه در ادامه این کورس باید دنبال کنید." : "What to keep track of next in this course."}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {workspaceData.sessionTimeline.map((item) => (
              <div key={`${item.title}-${item.date}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {item.date}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-600">{item.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

    </StudentLayout>
  );
}
