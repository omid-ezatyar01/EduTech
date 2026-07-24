import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  RefreshCw,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { getAuthUser } from "../../services/portal";
import {
  fetchTeacherCourseById,
  fetchTeacherCourseResources,
} from "../../services/courseService";
import { fetchTeacherStudents } from "../../services/teacherPortalService";
import { fetchTeacherLiveSessions } from "../../services/liveSessionService";
import { fetchTeacherAssignments } from "../../services/assignmentService";
import { getApiBase } from "../../services/http";
import {
  formatDateTimeInZone,
  formatTimeRangeInZone,
  getBrowserTimeZone,
} from "../utils/timezone";

const LOGO_FALLBACK = "/logo.png";

const resolveAssetUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:)/i.test(raw)) return raw;
  if (!raw.startsWith("/")) return raw;
  return `${getApiBase().replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "")}${raw}`;
};

const formatNumber = (value, language) =>
  Number(value || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US");

const formatDate = (value, language, includeTime = false) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const statusMeta = (course, isFa) => {
  if (course?.classCancelledAt || course?.status === "cancelled") {
    return { label: isFa ? "لغو شده" : "Cancelled", className: "bg-rose-50 text-rose-700" };
  }
  if (course?.classEndedAt) {
    return { label: isFa ? "پایان یافته" : "Ended", className: "bg-slate-100 text-slate-700" };
  }
  if (course?.classStartedAt) {
    return { label: isFa ? "در حال برگزاری" : "In progress", className: "bg-emerald-50 text-emerald-700" };
  }
  const labels = {
    published: isFa ? "منتشر شده" : "Published",
    approved: isFa ? "تایید شده" : "Approved",
    pending: isFa ? "در انتظار تایید" : "Pending review",
    rejected: isFa ? "رد شده" : "Rejected",
    draft: isFa ? "پیش‌نویس" : "Draft",
  };
  return {
    label: labels[course?.status] || (isFa ? "ثبت شده" : "Created"),
    className: course?.status === "pending"
      ? "bg-amber-50 text-amber-700"
      : course?.status === "rejected"
        ? "bg-rose-50 text-rose-700"
        : "bg-blue-50 text-blue-700",
  };
};

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-[#0B4FD8]",
    teal: "bg-teal-50 text-teal-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-500">{label}</p>
          <p className="mt-1 break-words text-xl font-black text-slate-950 sm:text-2xl">{value}</p>
          <p className="mt-1 break-words text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs">{hint}</p>
        </div>
      </div>
    </article>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_a]:rounded-xl [&_a]:bg-primary-50 [&_a]:px-3 sm:[&_a]:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
      <div>
        <Icon className="mx-auto text-slate-400" size={28} />
        <p className="mt-2 text-sm font-bold text-slate-500">{text}</p>
      </div>
    </div>
  );
}

export default function TeacherCourseWorkspace() {
  const { courseId } = useParams();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const teacher = useMemo(
    () => getAuthUser() || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" },
    [],
  );
  const [course, setCourse] = useState(null);
  const [studentsData, setStudentsData] = useState({ students: [], stats: {}, meta: {} });
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentMeta, setAssignmentMeta] = useState({});
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const loadWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!courseId) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const courseRow = await fetchTeacherCourseById(courseId);
      if (!courseRow) throw new Error(isFa ? "کورس پیدا نشد." : "Course not found.");
      const [studentResult, sessionResult, assignmentResult, resourceRows] = await Promise.all([
        fetchTeacherStudents({ course: courseId, page: 1, limit: 20 }),
        fetchTeacherLiveSessions({ courseId, page: 1, limit: 100 }),
        fetchTeacherAssignments({ courseId, page: 1, limit: 100, sortBy: "newest" }),
        fetchTeacherCourseResources(courseId),
      ]);
      setCourse(courseRow);
      setStudentsData(studentResult || { students: [], stats: {}, meta: {} });
      setSessions(Array.isArray(sessionResult?.sessions) ? sessionResult.sessions : []);
      setAssignments(Array.isArray(assignmentResult?.items) ? assignmentResult.items : []);
      setAssignmentMeta(assignmentResult?.meta || {});
      setResources(Array.isArray(resourceRows) ? resourceRows : []);
      setLoadedAt(Date.now());
    } catch (requestError) {
      setError(requestError?.message || (isFa ? "بارگذاری فضای کورس ناموفق بود." : "Failed to load course workspace."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId, isFa]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const status = statusMeta(course, isFa);
  const students = Array.isArray(studentsData?.students) ? studentsData.students : [];
  const studentStats = studentsData?.stats || {};
  const upcomingSessions = sessions
    .filter((item) => item?.status === "scheduled" && new Date(item?.startAt).getTime() >= loadedAt)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const completedSessions = sessions.filter((item) => item?.status === "completed").length;
  const publishedAssignments = assignments.filter((item) => item?.status === "published").length;
  const pendingReviews = assignments.reduce((sum, item) => sum + Number(item?.pendingReviewCount || 0), 0);
  const totalSessions = Number(course?.totalSessions || sessions.length || 0);
  const progress = totalSessions ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

  const links = {
    students: `/teacher/students?courseId=${encodeURIComponent(courseId || "")}`,
    sessions: `/teacher/live-classes?courseId=${encodeURIComponent(courseId || "")}`,
    attendance: `/teacher/attendance?courseId=${encodeURIComponent(courseId || "")}`,
    assignments: `/teacher/assignments?courseId=${encodeURIComponent(courseId || "")}`,
    resources: `/teacher/resources?courseId=${encodeURIComponent(courseId || "")}`,
  };

  if (loading) {
    return (
      <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
        <TeacherPageLoader label={isFa ? "در حال آماده‌سازی فضای کورس" : "Preparing course workspace"} />
      </TeacherLayout>
    );
  }

  if (error || !course) {
    return (
      <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <BookOpen className="mx-auto text-rose-500" size={34} />
          <h1 className="mt-3 text-xl font-black text-slate-950">
            {isFa ? "فضای کورس باز نشد" : "Course workspace could not open"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => loadWorkspace()} className="rounded-xl bg-[#0B4FD8] px-4 py-2.5 text-sm font-black text-white">
              {isFa ? "تلاش دوباره" : "Try again"}
            </button>
            <Link to="/teacher/courses" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700">
              {isFa ? "برگشت" : "Back"}
            </Link>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <div className={`mx-auto w-full max-w-[1500px] space-y-4 sm:space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
            <div className="order-2 min-w-0 p-4 sm:p-7 lg:order-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/teacher/courses" className="inline-flex items-center gap-1.5 text-sm font-black text-[#0B4FD8]">
                  <BackIcon size={16} />
                  {isFa ? "کورس‌های من" : "My courses"}
                </Link>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
              </div>
              <h1 className="mt-4 break-words text-2xl font-black leading-9 text-slate-950 [overflow-wrap:anywhere] sm:text-3xl sm:leading-10">{course.title}</h1>
              <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm font-semibold leading-7 text-slate-600">
                {course.description}
              </p>
              <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                <Link to={links.sessions} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] px-4 py-2.5 text-sm font-black text-white">
                  <Video size={17} />
                  {isFa ? "مدیریت جلسات" : "Manage sessions"}
                </Link>
                <Link to={links.students} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">
                  <Users size={17} />
                  {isFa ? "همه شاگردان" : "All students"}
                </Link>
                <button type="button" onClick={() => loadWorkspace({ silent: true })} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50">
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                  {isFa ? "تازه‌سازی" : "Refresh"}
                </button>
              </div>
            </div>
            <div className="order-1 aspect-video min-h-0 bg-gradient-to-br from-slate-50 to-blue-50 lg:order-2 lg:aspect-auto lg:min-h-64">
              <img
                src={resolveAssetUrl(course.thumbnail) || LOGO_FALLBACK}
                alt={course.title}
                className="h-full w-full object-contain p-3 sm:p-4"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = LOGO_FALLBACK;
                }}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={Users} label={isFa ? "شاگردان ثبت‌نام‌شده" : "Enrolled students"} value={formatNumber(studentsData?.meta?.total || course.enrolledStudentsCount, language)} hint={`${formatNumber(studentStats.activeStudents, language)} ${isFa ? "شاگرد فعال" : "active"}`} />
          <StatCard icon={CalendarDays} label={isFa ? "جلسات کورس" : "Course sessions"} value={formatNumber(sessions.length, language)} hint={`${formatNumber(upcomingSessions.length, language)} ${isFa ? "جلسه آینده" : "upcoming"}`} tone="teal" />
          <StatCard icon={ClipboardCheck} label={isFa ? "تمرین‌ها" : "Assignments"} value={formatNumber(assignmentMeta.total || assignments.length, language)} hint={`${formatNumber(pendingReviews, language)} ${isFa ? "در انتظار بررسی" : "awaiting review"}`} tone="violet" />
          <StatCard icon={UserCheck} label={isFa ? "میانگین حضور" : "Average attendance"} value={`${formatNumber(studentStats.averageAttendance, language)}%`} hint={`${formatNumber(completedSessions, language)} ${isFa ? "جلسه تکمیل‌شده" : "completed sessions"}`} tone="amber" />
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {[
            [links.sessions, Video, isFa ? "جلسات زنده" : "Live sessions", isFa ? "ساخت، ویرایش و لغو جلسه" : "Create, edit and cancel"],
            [links.attendance, UserCheck, isFa ? "حضور و غیاب" : "Attendance", isFa ? "ثبت حضور شاگردان" : "Mark student attendance"],
            [links.assignments, ClipboardCheck, isFa ? "تمرین‌ها" : "Assignments", isFa ? "ساخت و بررسی تمرین" : "Create and review work"],
            [links.resources, FolderOpen, isFa ? "منابع درسی" : "Resources", isFa ? "فایل و لینک هر جلسه" : "Files and lesson links"],
            [links.students, Users, isFa ? "شاگردان" : "Students", isFa ? "پیشرفت و دسترسی شاگرد" : "Progress and access"],
          ].map(([href, Icon, title, subtitle]) => (
            <Link key={href} to={href} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0B4FD8]/30 hover:shadow-md sm:p-4">
              <Icon size={20} className="text-[#0B4FD8]" />
              <p className="mt-3 break-words text-sm font-black text-slate-950">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{subtitle}</p>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
          <Section
            title={isFa ? "شاگردان این کورس" : "Students in this course"}
            subtitle={isFa ? "وضعیت ثبت‌نام، پیشرفت و حضور هر شاگرد" : "Enrollment, progress and attendance"}
            action={<Link to={links.students} className="text-sm font-black text-[#0B4FD8]">{isFa ? "مشاهده همه" : "View all"}</Link>}
          >
            {students.length ? (
              <>
              <div className="space-y-3 sm:hidden">
                {students.slice(0, 8).map((student) => (
                  <article key={student.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={resolveAssetUrl(student.avatar) || LOGO_FALLBACK}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = LOGO_FALLBACK;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">{student.name}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">{student.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                        {student.statusLabel || student.enrollmentStatus}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        [isFa ? "پیشرفت" : "Progress", `${formatNumber(student.progress, language)}%`],
                        [isFa ? "حضور" : "Attendance", `${formatNumber(student.attendance, language)}%`],
                        [isFa ? "ثبت‌نام" : "Enrolled", formatDate(student.enrolledAt, language)],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0 rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-bold text-slate-400">{label}</p>
                          <p className="mt-1 truncate text-[11px] font-black text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[650px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-black text-slate-500">
                      <th className="px-3 py-3 text-start">{isFa ? "شاگرد" : "Student"}</th>
                      <th className="px-3 py-3 text-start">{isFa ? "وضعیت" : "Status"}</th>
                      <th className="px-3 py-3 text-start">{isFa ? "پیشرفت" : "Progress"}</th>
                      <th className="px-3 py-3 text-start">{isFa ? "حضور" : "Attendance"}</th>
                      <th className="px-3 py-3 text-start">{isFa ? "ثبت‌نام" : "Enrolled"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 8).map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <img src={resolveAssetUrl(student.avatar) || LOGO_FALLBACK} alt="" className="h-10 w-10 rounded-xl bg-slate-50 object-cover" onError={(event) => { event.currentTarget.src = LOGO_FALLBACK; }} />
                            <div>
                              <p className="text-sm font-black text-slate-900">{student.name}</p>
                              <p className="text-xs font-semibold text-slate-500">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{student.statusLabel || student.enrollmentStatus}</span></td>
                        <td className="px-3 py-3 text-sm font-black text-slate-700">{formatNumber(student.progress, language)}%</td>
                        <td className="px-3 py-3 text-sm font-black text-slate-700">{formatNumber(student.attendance, language)}%</td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-500">{formatDate(student.enrolledAt, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : <EmptyState icon={GraduationCap} text={isFa ? "هنوز شاگردی در این کورس ثبت‌نام نکرده است." : "No students have enrolled in this course yet."} />}
          </Section>

          <Section title={isFa ? "جلسات آینده" : "Upcoming sessions"} subtitle={isFa ? "برنامه نزدیک این کورس" : "The next course schedule"} action={<Link to={links.sessions} className="text-sm font-black text-[#0B4FD8]">{isFa ? "مدیریت" : "Manage"}</Link>}>
            {upcomingSessions.length ? (
              <div className="space-y-3">
                {upcomingSessions.slice(0, 5).map((session) => (
                  <article key={session._id} className="rounded-2xl border border-slate-200 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{session.title}</p>
                        <div className="mt-1 space-y-1 text-xs font-bold text-slate-500">
                          <p className="flex items-center gap-1.5">
                            <Clock3 size={13} />
                            {isFa ? "وقت کورس: " : "Course time: "}
                            {formatTimeRangeInZone(
                              session.startAt,
                              session.endAt,
                              session.timezone || course.timezone || "Asia/Kabul",
                              language,
                            )}
                          </p>
                          <p className="ps-[19px] text-teal-700">
                            {isFa ? "وقت محل شما: " : "Your local time: "}
                            {formatTimeRangeInZone(
                              session.startAt,
                              session.endAt,
                              getBrowserTimeZone(),
                              language,
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{isFa ? "زمان‌بندی‌شده" : "Scheduled"}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={CalendarDays} text={isFa ? "جلسه آینده‌ای ثبت نشده است." : "No upcoming session is scheduled."} />}
          </Section>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Section title={isFa ? "تمرین‌های کورس" : "Course assignments"} subtitle={`${formatNumber(publishedAssignments, language)} ${isFa ? "تمرین منتشرشده" : "published"}`} action={<Link to={links.assignments} className="text-sm font-black text-[#0B4FD8]">{isFa ? "مدیریت تمرین‌ها" : "Manage assignments"}</Link>}>
            {assignments.length ? (
              <div className="space-y-2">
                {assignments.slice(0, 5).map((assignment) => (
                  <article key={assignment.id || assignment._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{assignment.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{isFa ? "مهلت:" : "Due:"} {formatDate(assignment.dueAt, language, true)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">{assignment.statusLabel || assignment.status}</span>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={ClipboardCheck} text={isFa ? "هنوز تمرینی برای این کورس ساخته نشده است." : "No assignments have been created yet."} />}
          </Section>

          <Section title={isFa ? "منابع درسی" : "Learning resources"} subtitle={`${formatNumber(resources.length, language)} ${isFa ? "منبع برای جلسات کورس" : "resources for course sessions"}`} action={<Link to={links.resources} className="text-sm font-black text-[#0B4FD8]">{isFa ? "مدیریت منابع" : "Manage resources"}</Link>}>
            {resources.length ? (
              <div className="space-y-2">
                {resources.slice(0, 5).map((resource) => (
                  <article key={resource._id || resource.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                      {resource.type === "PDF" ? <FileText size={18} /> : <FolderOpen size={18} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{resource.title}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{resource.module || resource.type}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={FolderOpen} text={isFa ? "هنوز فایل یا لینکی برای این کورس اضافه نشده است." : "No files or links have been added yet."} />}
          </Section>
        </section>

        <Section title={isFa ? "خلاصه و پیشرفت کورس" : "Course summary and progress"} subtitle={isFa ? "اطلاعات اصلی کورس در یک نگاه" : "Core course information at a glance"}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              [
                isFa ? "شروع به وقت کورس" : "Start in course time",
                formatDateTimeInZone(
                  course.startDate,
                  course.timezone || "Asia/Kabul",
                  language,
                ),
              ],
              [
                isFa ? "شروع به وقت محل شما" : "Start in your local time",
                formatDateTimeInZone(
                  course.startDate,
                  getBrowserTimeZone(),
                  language,
                ),
              ],
              [isFa ? "تاریخ پایان" : "End date", formatDate(course.endDate, language)],
              [isFa ? "ظرفیت" : "Capacity", `${formatNumber(course.enrolledStudentsCount, language)} / ${formatNumber(course.maxStudents, language)}`],
              [isFa ? "تعداد کل جلسات" : "Total sessions", formatNumber(totalSessions, language)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-slate-700">{isFa ? "پیشرفت جلسات" : "Session progress"}</span>
              <span className="text-sm font-black text-[#0B4FD8]">{formatNumber(progress, language)}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </Section>
      </div>
    </TeacherLayout>
  );
}
