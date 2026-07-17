import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Clock,
  CheckSquare,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import AssignmentStatsCard from "./AssignmentStatsCard.jsx";
import AssignmentItem from "./AssignmentItem.jsx";
import AssignmentStatusChart from "./AssignmentStatusChart.jsx";
import AssignmentHelpCard from "./AssignmentHelpCard.jsx";
import SubmitAssignmentModal from "./SubmitAssignmentModal.jsx";
import TeacherFeedbackModal from "./TeacherFeedbackModal.jsx";
import AssignmentDetailsModal from "./AssignmentDetailsModal.jsx";
import {
  fetchStudentAssignments,
  fetchStudentEnrollments,
  submitStudentAssignment,
} from "../../services/courseService.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";

const mockStudent = {
  id: "",
  nameFa: "",
  email: "",
  avatar: "",
};

const isEndedCourseRow = (row = {}) =>
  Boolean(row?.classEndedAt || row?.course?.classEndedAt || row?.courseId?.classEndedAt);

export default function Assignments({ language = "fa" }) {
  const isFa = language === "fa";
  const ALL_COURSES = "__all_courses__";
  const t = {
    allCourses: isFa ? "همه کورس‌ها" : "All Courses",
    loadErrorFa: "بارگذاری تمرین‌ها انجام نشد.",
    tabAll: isFa ? "همه" : "All",
    tabPending: isFa ? "در انتظار ارسال" : "Pending Submission",
    tabSubmitted: isFa ? "ارسال شده" : "Submitted",
    tabReviewed: isFa ? "بررسی شده" : "Reviewed",
    tabLocked: isFa ? "قفل شده" : "Locked",
    statusPending: isFa ? "در انتظار ارسال" : "Pending Submission",
    statusSubmitted: isFa ? "ارسال شده" : "Submitted",
    statusReviewed: isFa ? "بررسی شده" : "Reviewed",
    statusLocked: isFa ? "قفل شده" : "Locked",
    submitSuccess: isFa
      ? "تمرین شما موفقانه ارسال شد."
      : "Your assignment was submitted successfully.",
    dashboard: isFa ? "داشبورد" : "Dashboard",
    assignments: isFa ? "تمرین‌ها" : "Assignments",
    subtitle: isFa
      ? "تمرین‌های کورس‌های خود را ارسال و پیگیری کنید."
      : "Submit and track your course assignments.",
    guide: isFa ? "راهنمای تمرین‌ها" : "Assignment Guide",
    statsAllTitle: isFa ? "همه تمرین‌ها" : "All Assignments",
    statsAllSubtitle: isFa ? "از تمام کورس‌ها" : "From all courses",
    statsPendingTitle: isFa ? "در انتظار ارسال" : "Pending Submission",
    statsPendingSubtitle: isFa ? "نیاز به اقدام شما" : "Needs your action",
    statsSubmittedTitle: isFa ? "ارسال شده" : "Submitted",
    statsSubmittedSubtitle: isFa ? "در انتظار بررسی" : "Awaiting review",
    statsReviewedTitle: isFa ? "بررسی شده" : "Reviewed",
    statsReviewedSubtitle: isFa ? "با بازخورد استاد" : "With teacher feedback",
    loading: isFa ? "در حال دریافت تمرین‌ها" : "Loading assignments",
    emptyTitle: isFa ? "هیچ تمرینی پیدا نشد" : "No assignments found",
    emptySubtitle: isFa
      ? "با این فیلترها نتیجه‌ای یافت نشد."
      : "No results were found with these filters.",
  };
  const user = getAuthUser() || mockStudent;
  const [assignments, setAssignments] = useState([]);
  const [registeredCourses, setRegisteredCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState(ALL_COURSES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Modals state
  const [submitModalObj, setSubmitModalObj] = useState(null);
  const [feedbackModalObj, setFeedbackModalObj] = useState(null);
  const [detailsModalObj, setDetailsModalObj] = useState(null);

  const loadAssignments = useCallback(async (mountedRef) => {
    try {
      setLoading(true);
      setError("");
      const [rows, enrollments] = await Promise.all([
        fetchStudentAssignments(),
        fetchStudentEnrollments(),
      ]);
      if (mountedRef && !mountedRef.current) return;
      const statusLabelMap = {
        pending: t.statusPending,
        submitted: t.statusSubmitted,
        reviewed: t.statusReviewed,
        locked: t.statusLocked,
      };
      setAssignments(
        (Array.isArray(rows) ? rows : [])
          .filter((row) => !isEndedCourseRow(row))
          .map((row) => ({
            ...row,
            statusLabel: statusLabelMap[row.status] || row.statusLabel || row.status || "-",
          })),
      );
      const courseMap = new Map();
      (Array.isArray(enrollments) ? enrollments : []).forEach((enrollment) => {
        const course = enrollment?.courseId || {};
        if (course?.classEndedAt) return;
        const id = String(course?._id || course?.id || "").trim();
        const title = String(course?.title || "").trim();
        if (!id || !title) return;
        courseMap.set(id, { id, title });
      });
      setRegisteredCourses(Array.from(courseMap.values()));
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
          t.loadErrorFa,
          "Failed to load assignments.",
        ),
      );
    } finally {
      if (!mountedRef || mountedRef.current) setLoading(false);
    }
  }, [language, navigate, t.loadErrorFa, t.statusLocked, t.statusPending, t.statusReviewed, t.statusSubmitted]);

  useEffect(() => {
    const mountedRef = { current: true };
    loadAssignments(mountedRef);
    const handleRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", handleRefresh);
    window.addEventListener("edutech_data_changed", handleRefresh);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("auth_change", handleRefresh);
      window.removeEventListener("edutech_data_changed", handleRefresh);
    };
  }, [loadAssignments]);

  useEffect(() => {
    const mountedRef = { current: true };
    if (refreshSeed > 0) {
      loadAssignments(mountedRef);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [loadAssignments, refreshSeed]);

  const stats = useMemo(
    () => ({
      total: assignments.length,
      pending: assignments.filter((a) => a.status === "pending").length,
      submitted: assignments.filter((a) => a.status === "submitted").length,
      reviewed: assignments.filter((a) => a.status === "reviewed").length,
      locked: assignments.filter((a) => a.status === "locked").length,
    }),
    [assignments],
  );

  const tabs = [
    { id: "all", label: t.tabAll, count: stats.total },
    { id: "pending", label: t.tabPending, count: stats.pending },
    { id: "submitted", label: t.tabSubmitted, count: stats.submitted },
    { id: "reviewed", label: t.tabReviewed, count: stats.reviewed },
    { id: "locked", label: t.tabLocked, count: stats.locked },
  ];

  const filteredAssignments = assignments.filter((a) => {
    const matchTab = activeTab === "all" || a.status === activeTab;
    const matchCourse =
      selectedCourse === ALL_COURSES ||
      String(a.courseId || "").trim() === String(selectedCourse || "").trim();
    const q = String(searchQuery || "").toLowerCase();
    const matchSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.course.toLowerCase().includes(q) ||
      a.teacher.toLowerCase().includes(q);
    return matchTab && matchCourse && matchSearch;
  });
  const isEmptyState = !loading && filteredAssignments.length === 0;

  if (isRedirecting) return null;

  const handleSubmitAction = (assignment) => {
    if (assignment.status === "pending") setSubmitModalObj(assignment);
    else setFeedbackModalObj(assignment);
  };

  const handleSubmitComplete = async (id, payload = {}) => {
    try {
      await submitStudentAssignment(id, payload);
      setRefreshSeed((prev) => prev + 1);
      setMessage(t.submitSuccess);
      setTimeout(() => {
        setMessage("");
      }, 2500);
      return true;
    } catch (err) {
      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          t.loadErrorFa,
          "Failed to submit assignment.",
        ),
      );
      return false;
    }
  };

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
        <span className="text-slate-900">{t.assignments}</span>
      </div>

      {/* Header */}
      <div className="mb-8 px-1 sm:px-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{t.assignments}</h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {t.subtitle}
          </p>
        </div>
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700">
          <HelpCircle size={18} /> {t.guide}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AssignmentStatsCard
          title={t.statsAllTitle}
          value={stats.total}
          subtitle={t.statsAllSubtitle}
          icon={ClipboardList}
          colorClass="bg-purple-50 text-purple-600"
        />
        <AssignmentStatsCard
          title={t.statsPendingTitle}
          value={stats.pending}
          subtitle={t.statsPendingSubtitle}
          icon={Clock}
          colorClass="bg-amber-50 text-amber-600"
        />
        <AssignmentStatsCard
          title={t.statsSubmittedTitle}
          value={stats.submitted}
          subtitle={t.statsSubmittedSubtitle}
          icon={CheckSquare}
          colorClass="bg-green-50 text-green-600"
        />
        <AssignmentStatsCard
          title={t.statsReviewedTitle}
          value={stats.reviewed}
          subtitle={t.statsReviewedSubtitle}
          icon={CheckCircle}
          colorClass="bg-primary-50 text-primary-600"
        />
        <div className="sm:col-span-2 lg:col-span-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-slate-700">{isFa ? "فیلتر بر اساس کورس" : "Filter by course"}</p>
            <select
              value={selectedCourse}
              onChange={(event) => setSelectedCourse(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-primary-500 sm:w-80"
            >
              <option value={ALL_COURSES}>{t.allCourses}</option>
              {registeredCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="min-w-0 flex flex-col gap-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition sm:text-sm ${
                    isActive
                      ? "bg-primary-100 text-primary-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-[10px] ${
                      isActive ? "bg-primary-200 text-primary-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <div className="md:col-span-2 flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
              <h3 className="text-xl font-black text-slate-900">
                {t.loading}
              </h3>
            </div>
          ) : filteredAssignments.length > 0 ? (
            filteredAssignments.map((assignment) => (
              <AssignmentItem
                key={assignment.id}
                assignment={assignment}
                onAction={handleSubmitAction}
                onDetails={setDetailsModalObj}
                language={language}
              />
            ))
          ) : null}
        </div>

      </div>
      {isEmptyState ? (
        <div className="mt-6 w-full flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
            <ClipboardList size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900">
            {t.emptyTitle}
          </h3>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {t.emptySubtitle}
          </p>
        </div>
      ) : null}
      <div className="mt-6 w-full">
        <AssignmentStatusChart stats={stats} language={language} />
      </div>
      <div className="mt-6">
        <AssignmentHelpCard language={language} />
      </div>
      <div className="h-8" aria-hidden="true" />

      {/* Modals */}
      <SubmitAssignmentModal
        isOpen={!!submitModalObj}
        onClose={() => setSubmitModalObj(null)}
        assignment={submitModalObj}
        onSubmit={handleSubmitComplete}
        language={language}
      />
      <TeacherFeedbackModal
        isOpen={!!feedbackModalObj}
        onClose={() => setFeedbackModalObj(null)}
        assignment={feedbackModalObj}
        language={language}
      />
      <AssignmentDetailsModal
        isOpen={!!detailsModalObj}
        onClose={() => setDetailsModalObj(null)}
        assignment={detailsModalObj}
        language={language}
      />
    </StudentLayout>
  );
}
