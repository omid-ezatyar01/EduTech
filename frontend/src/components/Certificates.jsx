import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Calendar,
  Info,
  FileCheck,
} from "lucide-react";
import StudentLayout from "./StudentLayout.jsx";
import CertificateStatsCard from "./CertificateStatsCard.jsx";
import CertificateFilterBar from "./CertificateFilterBar.jsx";
import CertificateCard from "./CertificateCard.jsx";
import CertificateHelpCard from "./CertificateHelpCard.jsx";
import CertificateViewModal from "./CertificateViewModal.jsx";
import { fetchStudentEnrollments } from "../../services/courseService.js";
import { fetchPublicTeacherById } from "../../services/teacherService.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { resolveStudentCourseProgressPercent } from "../utils/courseProgress.js";

const mockStudent = {
  id: 1,
  nameFa: "امید عزتیار",
  email: "student@edutech.com",
  avatar: "",
};

const BORDER_COLORS = ["teal", "blue", "purple"];
const ALL_COURSES = "__all_courses__";
const ALL_STATUSES = "__all_statuses__";
const SORT_NEWEST = "newest";
const SORT_OLDEST = "oldest";
const SORT_COURSE = "course";
const SORT_STATUS = "status";

const formatIssueDate = (rawDate, locale) => {
  if (!rawDate) return "-";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const getOrdinalSuffix = (day) => {
  const value = Number(day);
  if (Number.isNaN(value)) return "th";
  if (value % 100 >= 11 && value % 100 <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
};

const formatCertificateIssueDate = (rawDate) => {
  if (!rawDate) return "-";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "-";

  const day = date.getDate();
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    date,
  );
  const year = date.getFullYear();
  const suffix = getOrdinalSuffix(day);

  return `${day}${suffix} day of ${month}, ${year}`;
};

const resolveTeacherProfile = (course = {}) => {
  const teacher =
    course?.teacher && typeof course.teacher === "object" ? course.teacher : null;
  if (teacher && String(teacher.name || "").trim()) return teacher;

  const createdBy =
    course?.createdBy && typeof course.createdBy === "object"
      ? course.createdBy
      : null;
  if (createdBy && String(createdBy.name || "").trim()) return createdBy;

  return null;
};

const createCertificateCode = (enrollmentId = "", issueDateRaw = null) => {
  const date = issueDateRaw ? new Date(issueDateRaw) : null;
  const year =
    date && !Number.isNaN(date.getTime())
      ? date.getUTCFullYear()
      : new Date().getUTCFullYear();
  const suffix = String(enrollmentId || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .slice(-8)
    .toUpperCase()
    .padStart(8, "0");
  return `ED-${year}-${suffix}`;
};

const isCertificateReady = (enrollment = {}) => {
  const course =
    enrollment?.courseId && typeof enrollment.courseId === "object"
      ? enrollment.courseId
      : {};
  return (
    String(enrollment?.enrollmentStatus || "") === "completed" &&
    Boolean(course?.classEndedAt)
  );
};

const mapEnrollmentToCertificate = (
  enrollment = {},
  studentName = "",
  {
    locale = "fa-AF",
    completedLabel = "تکمیل شده",
    inProgressLabel = "در حال پیشرفت",
    studentFallback = "محصل",
    teacherFallback = "EduTech Instructor",
  } = {},
) => {
  const course = enrollment.courseId || {};
  const teacher = resolveTeacherProfile(course);
  const rawStatus = enrollment.enrollmentStatus || "pending";
  const certificateReady = isCertificateReady(enrollment);
  const status = certificateReady ? "completed" : "in_progress";
  const issuedAtRaw =
    enrollment.certificateIssuedAt ||
    (certificateReady || rawStatus === "completed"
      ? enrollment.updatedAt || enrollment.createdAt
      : enrollment.createdAt || enrollment.updatedAt) ||
    null;
  const teacherName = String(teacher?.name || course.teacherName || "").trim();
  const safeTeacherName = teacherName || teacherFallback;
  const progress = resolveStudentCourseProgressPercent(enrollment, course, 0);

  return {
    id: enrollment._id,
    course: course.title || "Course",
    courseEn: course.title || "Course",
    student: studentName || studentFallback,
    teacher: safeTeacherName,
    teacherEn: safeTeacherName,
    teacherAvatar: resolveAvatarUrl(teacher?.avatar || ""),
    status,
    statusLabel: status === "completed" ? completedLabel : inProgressLabel,
    issueDate: formatIssueDate(issuedAtRaw, locale),
    issueDateRaw: issuedAtRaw,
    issueDateCertificate: formatCertificateIssueDate(issuedAtRaw),
    progress,
    certificateId:
      certificateReady
        ? String(enrollment.certificateId || "").trim().toUpperCase() ||
          createCertificateCode(enrollment._id, issuedAtRaw)
        : null,
    borderColor:
      BORDER_COLORS[
        Math.abs(
          String(enrollment._id || "")
            .split("")
            .reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
        ) % BORDER_COLORS.length
      ],
    createdAt: enrollment.createdAt || null,
  };
};

const hasExistingCourse = (enrollment = {}) => {
  const course = enrollment?.courseId;
  if (!course || typeof course !== "object") return false;
  return Boolean(String(course.title || "").trim());
};

const getTeacherIdFromCourse = (course = {}) => {
  const teacher = course?.teacher;
  if (typeof teacher === "string" && teacher.trim()) return teacher.trim();
  if (teacher && typeof teacher === "object" && String(teacher._id || "").trim()) {
    return String(teacher._id).trim();
  }

  const createdBy = course?.createdBy;
  if (typeof createdBy === "string" && createdBy.trim()) return createdBy.trim();
  if (createdBy && typeof createdBy === "object" && String(createdBy._id || "").trim()) {
    return String(createdBy._id).trim();
  }
  return "";
};

const hasTeacherName = (teacher = null) =>
  Boolean(String(teacher?.name || teacher?.username || "").trim());

const hasTeacherAvatar = (teacher = null) =>
  Boolean(String(teacher?.avatar || "").trim());

const hydrateEnrollmentsWithTeacherProfiles = async (rows = []) => {
  const teacherIds = Array.from(new Set(
    rows
      .map((enrollment) => {
        const course = enrollment?.courseId && typeof enrollment.courseId === "object"
          ? enrollment.courseId
          : {};
        const teacher = course?.teacher && typeof course.teacher === "object" ? course.teacher : null;
        const shouldHydrate = !hasTeacherName(teacher) || !hasTeacherAvatar(teacher);
        if (!shouldHydrate) return "";
        return getTeacherIdFromCourse(course);
      })
      .filter(Boolean),
  ));

  if (!teacherIds.length) return rows;

  const fetchedRows = await Promise.all(
    teacherIds.map(async (teacherId) => {
      try {
        const profile = await fetchPublicTeacherById(teacherId);
        return [teacherId, profile];
      } catch {
        return [teacherId, null];
      }
    }),
  );

  const teacherMap = new Map(fetchedRows);

  return rows.map((enrollment) => {
    const course = enrollment?.courseId && typeof enrollment.courseId === "object"
      ? enrollment.courseId
      : {};
    const teacherId = getTeacherIdFromCourse(course);
    if (!teacherId) return enrollment;

    const fetchedTeacher = teacherMap.get(teacherId);
    if (!fetchedTeacher) return enrollment;

    const currentTeacher =
      course?.teacher && typeof course.teacher === "object" ? course.teacher : {};
    const mergedTeacher = {
      ...currentTeacher,
      _id: currentTeacher?._id || teacherId,
      name:
        String(currentTeacher?.name || "").trim() ||
        String(fetchedTeacher?.name || "").trim() ||
        String(fetchedTeacher?.username || "").trim(),
      avatar:
        String(currentTeacher?.avatar || "").trim() ||
        String(fetchedTeacher?.avatar || "").trim(),
    };

    return {
      ...enrollment,
      courseId: {
        ...course,
        teacher: mergedTeacher,
        teacherName:
          String(course?.teacherName || "").trim() ||
          String(mergedTeacher?.name || "").trim(),
      },
    };
  });
};

export default function Certificates({ language = "fa" }) {
  const isFa = language === "fa";
  const locale = isFa ? "fa-AF" : "en-US";
  const t = {
    dashboard: isFa ? "داشبورد" : "Dashboard",
    certificates: isFa ? "سرتیفیکیت‌ها" : "Certificates",
    subtitle: isFa
      ? "سرتیفیکیت‌های دریافتی خود را مشاهده و دانلود کنید."
      : "View and download your earned certificates.",
    requestReview: isFa ? "درخواست بررسی سرتیفیکیت" : "Request Certificate Review",
    statsAllTitle: isFa ? "همه سرتیفیکیت‌ها" : "All Certificates",
    statsAllSubtitle: isFa ? "از تمام کورس‌ها" : "From all courses",
    statsCompletedTitle: isFa ? "تکمیل شده" : "Completed",
    statsCompletedSubtitle: isFa ? "کورس‌های تکمیل شده" : "Completed courses",
    statsInProgressTitle: isFa ? "در حال پیشرفت" : "In Progress",
    statsInProgressSubtitle: isFa ? "هنوز تکمیل نشده" : "Not completed yet",
    statsThisYearTitle: isFa ? "امسال" : "This Year",
    statsThisYearSubtitle: isFa ? "سرتیفیکیت دریافت شده" : "Certificates issued",
    loading: isFa ? "در حال بارگذاری سرتیفیکیت‌ها" : "Loading certificates",
    empty: isFa
      ? "سرتیفیکیتی مطابق فیلترها پیدا نشد."
      : "No certificates matched these filters.",
    autoIssueHint: isFa
      ? "سرتیفیکیت‌ها به صورت خودکار صادر می‌شوند. در صورت عدم دریافت، با پشتیبانی تماس بگیرید."
      : "Certificates are issued automatically. If you have not received one, please contact support.",
    allCourses: isFa ? "همه کورس‌ها" : "All Courses",
    allStatuses: isFa ? "همه وضعیت‌ها" : "All Statuses",
    completed: isFa ? "تکمیل شده" : "Completed",
    inProgress: isFa ? "در حال پیشرفت" : "In Progress",
    sortNewest: isFa ? "جدیدترین" : "Newest",
    sortOldest: isFa ? "قدیمی‌ترین" : "Oldest",
    sortCourse: isFa ? "نام کورس" : "Course Name",
    sortStatus: isFa ? "وضعیت" : "Status",
    downloadNotFound: isFa
      ? "خطا در پیدا کردن سرتیفیکیت."
      : "Could not find certificate preview.",
    downloadError: isFa
      ? "خطا در دانلود سرتیفیکیت. لطفاً مطمئن شوید که پکیج‌های html2canvas و jspdf نصب شده‌اند."
      : "Error downloading certificate. Please make sure html2canvas and jspdf are installed.",
    loadErrorFa: "بارگذاری سرتیفیکیت‌ها انجام نشد.",
    studentFallback: isFa ? "محصل" : "Student",
  };

  const user = getAuthUser() || mockStudent;
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const navigate = useNavigate();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState(ALL_COURSES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [sortFilter, setSortFilter] = useState(SORT_NEWEST);

  // Modals State
  const [viewCertificate, setViewCertificate] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadCertificates = async () => {
      try {
        setLoading(true);
        setError("");
        const enrollments = await fetchStudentEnrollments();
        if (!mounted) return;
        const validEnrollments = Array.isArray(enrollments)
          ? enrollments.filter(hasExistingCourse)
          : [];
        const hydratedEnrollments = await hydrateEnrollmentsWithTeacherProfiles(validEnrollments);
        if (!mounted) return;
        setCertificates(
          hydratedEnrollments.map((enrollment) => {
            const fullNameFa =
              user?.firstNameFa && user?.lastNameFa
                ? `${user.firstNameFa} ${user.lastNameFa}`
                : user?.nameFa || "";
            const studentName = fullNameFa || user?.name || "";
            return mapEnrollmentToCertificate(enrollment, studentName, {
              locale,
              completedLabel: t.completed,
              inProgressLabel: t.inProgress,
              studentFallback: t.studentFallback,
            });
          }),
        );
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
            "Failed to load certificates.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCertificates();

    return () => {
      mounted = false;
    };
  }, [
    language,
    locale,
    navigate,
    refreshSeed,
    t.completed,
    t.inProgress,
    t.loadErrorFa,
    t.studentFallback,
    user?.firstNameFa,
    user?.lastNameFa,
    user?.name,
    user?.nameFa,
  ]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  // Filter Options
  const courseOptions = useMemo(
    () => [
      { value: ALL_COURSES, label: t.allCourses },
      ...Array.from(new Set(certificates.map((c) => c.course))).map((course) => ({
        value: course,
        label: course,
      })),
    ],
    [certificates, t.allCourses],
  );
  const statusOptions = useMemo(
    () => [
      { value: ALL_STATUSES, label: t.allStatuses },
      { value: "completed", label: t.completed },
      { value: "in_progress", label: t.inProgress },
    ],
    [t.allStatuses, t.completed, t.inProgress],
  );
  const sortOptions = useMemo(
    () => [
      { value: SORT_NEWEST, label: t.sortNewest },
      { value: SORT_OLDEST, label: t.sortOldest },
      { value: SORT_COURSE, label: t.sortCourse },
      { value: SORT_STATUS, label: t.sortStatus },
    ],
    [t.sortCourse, t.sortNewest, t.sortOldest, t.sortStatus],
  );

  const filteredCertificates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const items = certificates.filter((c) => {
      const matchCourse = courseFilter === ALL_COURSES || c.course === courseFilter;
      const matchStatus = statusFilter === ALL_STATUSES || c.status === statusFilter;
      const matchSearch =
        !query ||
        c.course.toLowerCase().includes(query) ||
        c.teacher.toLowerCase().includes(query) ||
        String(c.certificateId || "")
          .toLowerCase()
          .includes(query);
      return matchCourse && matchStatus && matchSearch;
    });

    const sorted = [...items];
    if (sortFilter === SORT_OLDEST) {
      sorted.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return aTime - bTime;
      });
    } else if (sortFilter === SORT_COURSE) {
      sorted.sort((a, b) =>
        String(a.course || "").localeCompare(String(b.course || ""), locale),
      );
    } else if (sortFilter === SORT_STATUS) {
      sorted.sort((a, b) =>
        String(a.statusLabel || "").localeCompare(
          String(b.statusLabel || ""),
          locale,
        ),
      );
    } else {
      sorted.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    }
    return sorted;
  }, [certificates, courseFilter, statusFilter, searchQuery, sortFilter, locale]);

  const stats = useMemo(() => {
    const total = certificates.length;
    const completed = certificates.filter(
      (c) => c.status === "completed",
    ).length;
    const inProgress = certificates.filter(
      (c) => c.status === "in_progress",
    ).length;
    const currentYear = new Date().getFullYear();
    const thisYear = certificates.filter((c) => {
      if (!c.issueDateRaw) return false;
      const issuedDate = new Date(c.issueDateRaw);
      return (
        !Number.isNaN(issuedDate.getTime()) &&
        issuedDate.getFullYear() === currentYear
      );
    }).length;

    return {
      total,
      completed,
      inProgress,
      thisYear,
    };
  }, [certificates]);

  const handleDownload = async (cert) => {
    if (cert?.status !== "completed") {
      alert(
        isFa
          ? "دانلود سرتیفیکیت فقط بعد از پایان رسمی کورس فعال می‌شود."
          : "Certificate download is available only after the course is officially finished.",
      );
      return;
    }
    const elementId = `certificate-preview-${cert.id || cert.certificateId}`;
    const elements = document.querySelectorAll(`#${elementId}`);
    // If modal is open, grab the last instance (which is usually the larger modal version)
    const element = elements[elements.length - 1];

    if (!element) {
      alert(t.downloadNotFound);
      return;
    }

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Ensure web fonts are ready so text positions are stable in the PDF capture.
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(element, {
        scale: 5, // Ultra high quality scale
        useCORS: true,
        backgroundColor: "#FDFBF7",
        width: element.offsetWidth,
        height: element.offsetHeight,
      });

      // Use high-quality JPEG instead of uncompressed PNG
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true, // Enable PDF compression
      });

      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      const verifyLinkElement = element.querySelector(
        ".certificate-preview-verify-value",
      );
      if (verifyLinkElement) {
        const elementRect = element.getBoundingClientRect();
        const verifyRect = verifyLinkElement.getBoundingClientRect();
        const ratioX = canvas.width / elementRect.width;
        const ratioY = canvas.height / elementRect.height;
        const linkPaddingX = 4 * ratioX;
        const linkPaddingY = 3 * ratioY;
        const linkX =
          (verifyRect.left - elementRect.left) * ratioX - linkPaddingX;
        const linkY =
          (verifyRect.top - elementRect.top) * ratioY - linkPaddingY;
        const linkWidth = verifyRect.width * ratioX + linkPaddingX * 2;
        const linkHeight = verifyRect.height * ratioY + linkPaddingY * 2;

        const verifyUrl = cert?.certificateId
          ? `https://verify.edutech.study/verify/${encodeURIComponent(
              cert.certificateId,
            )}`
          : "https://verify.edutech.study";
        pdf.link(linkX, linkY, linkWidth, linkHeight, { url: verifyUrl });
      }
      pdf.save(`${cert.certificateId || "Certificate"}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(
        t.downloadError,
      );
    }
  };

  if (isRedirecting) return null;

  return (
    <StudentLayout
      language={language}
      user={user}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    >
      <div className="mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link
          className="transition hover:text-primary-700"
          to="/student/dashboard"
        >
          {t.dashboard}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{t.certificates}</span>
      </div>

      {/* Header */}
      <div className="mb-8 px-1 sm:px-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{t.certificates}</h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {t.subtitle}
          </p>
        </div>
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary-600 bg-primary-50 px-6 text-sm font-black text-primary-700 transition hover:-translate-y-0.5 hover:bg-primary-600 hover:text-white">
          <FileCheck size={18} /> {t.requestReview}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CertificateStatsCard
          title={t.statsAllTitle}
          value={String(stats.total)}
          subtitle={t.statsAllSubtitle}
          icon={Briefcase}
          colorClass="bg-purple-50 text-purple-600"
        />
        <CertificateStatsCard
          title={t.statsCompletedTitle}
          value={String(stats.completed)}
          subtitle={t.statsCompletedSubtitle}
          icon={CheckCircle}
          colorClass="bg-green-50 text-green-600"
        />
        <CertificateStatsCard
          title={t.statsInProgressTitle}
          value={String(stats.inProgress)}
          subtitle={t.statsInProgressSubtitle}
          icon={Clock}
          colorClass="bg-amber-50 text-amber-600"
        />
        <CertificateStatsCard
          title={t.statsThisYearTitle}
          value={String(stats.thisYear)}
          subtitle={t.statsThisYearSubtitle}
          icon={Calendar}
          colorClass="bg-primary-50 text-primary-600"
        />
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col gap-6">
        {/* Left Column: List */}
        <div className="min-w-0 flex flex-col gap-6">
          <CertificateFilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            courseFilter={courseFilter}
            setCourseFilter={setCourseFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortFilter={sortFilter}
            setSortFilter={setSortFilter}
            language={language}
            courses={courseOptions}
            statuses={statusOptions}
            sorts={sortOptions}
          />
          {error ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="grid gap-5">
            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                {t.loading}
              </div>
            ) : filteredCertificates.length ? (
              filteredCertificates.map((cert) => (
                <CertificateCard
                  key={cert.id}
                  certificate={cert}
                  language={language}
                  onView={setViewCertificate}
                  onDownload={handleDownload}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                {t.empty}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-50 p-4 text-sm font-semibold leading-7 text-primary-800">
            <Info className="shrink-0 text-primary-600" size={20} />{" "}
            {t.autoIssueHint}
          </div>
        </div>
        <div className="space-y-6">
          <CertificateHelpCard language={language} />
        </div>
      </div>
      <div className="h-8" aria-hidden="true" />

      {/* Modals */}
      <CertificateViewModal
        isOpen={!!viewCertificate}
        onClose={() => setViewCertificate(null)}
        certificate={viewCertificate}
        onDownload={handleDownload}
        language={language}
      />
    </StudentLayout>
  );
}
