import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  Clock3,
  Filter,
  Search,
  TrendingUp,
  UserCheck,
  UserX,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import { fetchStudentAttendance } from "../../services/courseService.js";
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

const formatDateTime = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeOnly = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(language === "fa" ? "fa-AF" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeSearch = (value = "") => String(value || "").trim().toLowerCase();

const getAttendanceSummary = (rows = []) => {
  const summary = {
    totalSessions: rows.length,
    countedSessions: 0,
    present: 0,
    absent: 0,
    notMarked: 0,
    attendanceRate: 0,
  };

  rows.forEach((row) => {
    const attendanceStatus = String(row?.attendanceStatus || "not_marked");
    if (attendanceStatus === "present") {
      summary.present += 1;
      summary.countedSessions += 1;
      return;
    }
    if (attendanceStatus === "absent") {
      summary.absent += 1;
      summary.countedSessions += 1;
      return;
    }
    summary.notMarked += 1;
  });

  summary.attendanceRate = summary.countedSessions
    ? Math.round((summary.present / summary.countedSessions) * 100)
    : 0;

  return summary;
};

const getJoinedDurationLabel = (joinedAt, leftAt, language) => {
  const start = joinedAt ? new Date(joinedAt) : null;
  const end = leftAt ? new Date(leftAt) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const diffMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (language === "fa") {
    return `${diffMinutes} دقیقه`;
  }
  return `${diffMinutes} min`;
};

export default function Attendance({ language = "fa" }) {
  const isFa = language === "fa";
  const navigate = useNavigate();
  const user = useMemo(() => getAuthUser() || mockStudent, []);

  const t = useMemo(
    () => ({
      dashboard: isFa ? "داشبورد" : "Dashboard",
      title: isFa ? "حضور و غیاب" : "Attendance",
      intro: isFa
        ? "حضور شما در تمام جلسات کورس‌ها، وضعیت صنف‌ها و مواردی که نیاز به پیگیری دارد از اینجا دیده می‌شود."
        : "Track your attendance across every course session, upcoming class, and any sessions that need attention.",
      loading: isFa ? "در حال بارگذاری" : "Loading",
      allCourses: isFa ? "همه کورس‌ها" : "All courses",
      allSessionStates: isFa ? "همه وضعیت‌های جلسه" : "All session states",
      allAttendanceStates: isFa ? "همه وضعیت‌های حضور" : "All attendance states",
      course: isFa ? "کورس" : "Course",
      session: isFa ? "جلسه" : "Session",
      teacher: isFa ? "استاد" : "Teacher",
      date: isFa ? "زمان" : "Time",
      status: isFa ? "وضعیت" : "Status",
      attendance: isFa ? "حضور" : "Attendance",
      joinedAt: isFa ? "زمان ورود" : "Joined",
      leftAt: isFa ? "زمان خروج" : "Left",
      duration: isFa ? "مدت حضور" : "Duration",
      note: isFa ? "یادداشت" : "Note",
      search: isFa ? "جستجوی کورس، جلسه یا استاد" : "Search course, session, or teacher",
      overview: isFa ? "نمای کلی حضور" : "Attendance Overview",
      courseBreakdown: isFa ? "خلاصه هر کورس" : "Course Breakdown",
      sessionHistory: isFa ? "تاریخچه جلسات" : "Session History",
      nextClass: isFa ? "صنف بعدی" : "Next Class",
      latestAbsence: isFa ? "آخرین غیبت" : "Latest Absence",
      noRows: isFa ? "هنوز حضور و غیابی برای شما ثبت نشده است." : "No attendance has been recorded yet.",
      noCourses: isFa ? "برای این فیلترها کورسی پیدا نشد." : "No courses matched these filters.",
      noUpcoming: isFa ? "صنفی برای بعداً ثبت نشده است." : "No upcoming class is scheduled yet.",
      noAbsence: isFa ? "غیبتی ثبت نشده است." : "No absences have been recorded.",
      stats: {
        rate: isFa ? "درصد حضور" : "Attendance Rate",
        present: isFa ? "حاضر" : "Present",
        absent: isFa ? "غیرحاضر" : "Absent",
        pending: isFa ? "ثبت‌نشده" : "Unmarked",
      },
      statuses: {
        present: isFa ? "حاضر" : "Present",
        absent: isFa ? "غیرحاضر" : "Absent",
        not_marked: isFa ? "ثبت نشده" : "Not marked",
      },
      sessionStatuses: {
        scheduled: isFa ? "برنامه‌ریزی شده" : "Scheduled",
        live: isFa ? "در حال برگزاری" : "Live",
        completed: isFa ? "تکمیل شده" : "Completed",
        cancelled: isFa ? "لغو شده" : "Cancelled",
      },
    }),
    [isFa],
  );

  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadAttendance = async () => {
      try {
        setLoading(true);
        setError("");
        const result = await fetchStudentAttendance({
          page: 1,
          limit: 100,
        });
        if (!mounted) return;
        setCourses(Array.isArray(result.courses) ? result.courses : []);
        setSessions(Array.isArray(result.sessions) ? result.sessions : []);
        setStats(result.stats || {});
      } catch (err) {
        if (!mounted) return;
        if (isUnauthorizedError(err)) {
          setAuthNotice(isFa ? "لطفاً دوباره وارد شوید." : "Please log in again.");
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            "حضور و غیاب بارگذاری نشد.",
            "Attendance could not be loaded.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAttendance();
    return () => {
      mounted = false;
    };
  }, [isFa, language, navigate, refreshSeed]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((previous) => previous + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  const statusClasses = {
    present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    absent: "bg-rose-50 text-rose-700 ring-rose-200",
    not_marked: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  const sessionStatusClasses = {
    scheduled: "bg-blue-50 text-blue-700",
    live: "bg-emerald-50 text-emerald-700",
    completed: "bg-slate-100 text-slate-700",
    cancelled: "bg-rose-50 text-rose-700",
  };

  const filteredSessions = useMemo(() => {
    const query = normalizeSearch(search);

    return sessions.filter((session) => {
      if (selectedCourseId && String(session?.course?._id || "") !== String(selectedCourseId)) {
        return false;
      }
      if (sessionStatusFilter !== "all" && String(session?.status || "") !== sessionStatusFilter) {
        return false;
      }
      if (attendanceFilter !== "all" && String(session?.attendanceStatus || "") !== attendanceFilter) {
        return false;
      }
      if (!query) return true;

      const haystack = [
        session?.course?.title,
        session?.course?.teacherName,
        session?.title,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [attendanceFilter, search, selectedCourseId, sessionStatusFilter, sessions]);

  const filteredStats = useMemo(() => getAttendanceSummary(filteredSessions), [filteredSessions]);

  const courseSummaries = useMemo(() => {
    const summaryMap = new Map();

    courses.forEach((course) => {
      summaryMap.set(String(course._id), {
        _id: String(course._id),
        title: course.title || t.course,
        teacherName: course.teacherName || "-",
        enrollmentStatus: course.enrollmentStatus || "active",
        rows: [],
      });
    });

    sessions.forEach((session) => {
      const courseId = String(session?.course?._id || "");
      if (!courseId) return;
      const current = summaryMap.get(courseId) || {
        _id: courseId,
        title: session?.course?.title || t.course,
        teacherName: session?.course?.teacherName || "-",
        enrollmentStatus: session?.enrollmentStatus || "active",
        rows: [],
      };
      current.rows.push(session);
      summaryMap.set(courseId, current);
    });

    return Array.from(summaryMap.values())
      .map((course) => {
        const summary = getAttendanceSummary(course.rows);
        const latestSession = [...course.rows].sort(
          (left, right) => new Date(right?.startAt || 0).getTime() - new Date(left?.startAt || 0).getTime(),
        )[0] || null;

        return {
          ...course,
          ...summary,
          latestSession,
        };
      })
      .filter((course) => {
        if (!selectedCourseId) return true;
        return String(course._id) === String(selectedCourseId);
      })
      .sort((left, right) => right.attendanceRate - left.attendanceRate);
  }, [courses, selectedCourseId, sessions, t.course]);

  const nextSession = useMemo(
    () =>
      filteredSessions
        .filter((session) => ["scheduled", "live"].includes(String(session?.status || "")))
        .sort((left, right) => new Date(left?.startAt || 0).getTime() - new Date(right?.startAt || 0).getTime())[0] ||
      null,
    [filteredSessions],
  );

  const latestAbsence = useMemo(
    () =>
      filteredSessions.find((session) => String(session?.attendanceStatus || "") === "absent") || null,
    [filteredSessions],
  );

  const statCards = [
    {
      label: t.stats.rate,
      value: `${Number(filteredStats.attendanceRate || stats.attendanceRate || 0)}%`,
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: t.stats.present,
      value: Number(filteredStats.present || 0),
      icon: UserCheck,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: t.stats.absent,
      value: Number(filteredStats.absent || 0),
      icon: UserX,
      color: "bg-rose-50 text-rose-700",
    },
    {
      label: t.stats.pending,
      value: Number(filteredStats.notMarked || 0),
      icon: Clock3,
      color: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <StudentLayout language={language} user={user}>
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="transition hover:text-primary-700" to="/student/dashboard">
            {t.dashboard}
          </Link>
          <span>/</span>
          <span className="text-slate-900">{t.title}</span>
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div>
              <p className="text-sm font-bold text-primary-600">{t.overview}</p>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-800 sm:text-3xl">{t.title}</h1>
              <p className="mt-2 max-w-2xl text-sm font-normal leading-7 text-slate-600">{t.intro}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-800">{item.value}</p>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${item.color}`}>
                  <item.icon size={20} />
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">{t.courseBreakdown}</h2>
                <p className="text-sm font-normal text-slate-500">
                  {courseSummaries.length} {isFa ? "کورس در این نما" : "courses in this view"}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {courseSummaries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                  {t.noCourses}
                </div>
              ) : (
                courseSummaries.map((course) => (
                  <article key={course._id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-extrabold text-slate-800">{course.title}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {t.teacher}: {course.teacherName || "-"}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {isFa ? "آخرین جلسه" : "Latest session"}:{" "}
                          {course.latestSession ? formatDateTime(course.latestSession.startAt, language) : "-"}
                        </p>
                      </div>
                      <div className="min-w-[190px]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-700">{t.stats.rate}</span>
                          <span className="font-extrabold text-slate-800">{course.attendanceRate}%</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              course.attendanceRate >= 80
                                ? "bg-emerald-500"
                                : course.attendanceRate >= 60
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(course.attendanceRate, 100)}%` }}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl bg-white px-3 py-2 text-center">
                            <p className="font-bold text-slate-500">{t.stats.present}</p>
                            <p className="mt-1 font-extrabold text-emerald-700">{course.present}</p>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2 text-center">
                            <p className="font-bold text-slate-500">{t.stats.absent}</p>
                            <p className="mt-1 font-extrabold text-rose-700">{course.absent}</p>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2 text-center">
                            <p className="font-bold text-slate-500">{t.session}</p>
                            <p className="mt-1 font-extrabold text-slate-700">{course.totalSessions}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">{t.nextClass}</h2>
                  <p className="text-sm font-normal text-slate-500">
                    {nextSession ? formatDateTime(nextSession.startAt, language) : t.noUpcoming}
                  </p>
                </div>
              </div>
              {nextSession ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="font-extrabold text-slate-800">{nextSession.course?.title || "-"}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{nextSession.title || "-"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-600 ring-1 ring-slate-200">
                      {t.teacher}: {nextSession.course?.teacherName || "-"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-bold ${
                        sessionStatusClasses[nextSession.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.sessionStatuses[nextSession.status] || nextSession.status}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-rose-600" />
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">{t.latestAbsence}</h2>
                  <p className="text-sm font-normal text-slate-500">
                    {latestAbsence ? formatDateTime(latestAbsence.startAt, language) : t.noAbsence}
                  </p>
                </div>
              </div>
              {latestAbsence ? (
                <div className="mt-4 rounded-2xl bg-rose-50/70 p-4">
                  <p className="font-extrabold text-slate-800">{latestAbsence.course?.title || "-"}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{latestAbsence.title || "-"}</p>
                  <p className="mt-3 text-xs font-medium text-rose-700">
                    {latestAbsence.note || (isFa ? "یادداشتی برای این جلسه ثبت نشده است." : "No note was recorded for this session.")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_220px_220px_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.search}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-600 focus:bg-white"
              />
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="h-11 w-full bg-transparent text-sm font-medium text-slate-700 outline-none"
              >
                <option value="">{t.allCourses}</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title || t.course}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={sessionStatusFilter}
              onChange={(event) => setSessionStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-600 focus:bg-white"
            >
              <option value="all">{t.allSessionStates}</option>
              <option value="scheduled">{t.sessionStatuses.scheduled}</option>
              <option value="live">{t.sessionStatuses.live}</option>
              <option value="completed">{t.sessionStatuses.completed}</option>
              <option value="cancelled">{t.sessionStatuses.cancelled}</option>
            </select>

            <select
              value={attendanceFilter}
              onChange={(event) => setAttendanceFilter(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-600 focus:bg-white"
            >
              <option value="all">{t.allAttendanceStates}</option>
              <option value="present">{t.statuses.present}</option>
              <option value="absent">{t.statuses.absent}</option>
              <option value="not_marked">{t.statuses.not_marked}</option>
            </select>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{t.sessionHistory}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {filteredStats.countedSessions} / {filteredStats.totalSessions}
              </p>
            </div>
            <CalendarCheck className="text-slate-400" size={22} />
          </div>

          {error ? (
            <p className="m-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
              {t.loading}
            </div>
          ) : filteredSessions.length === 0 ? (
            <p className="p-10 text-center text-sm font-medium text-slate-500">{t.noRows}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className={`w-full min-w-[1180px] text-sm ${isFa ? "text-right" : "text-left"}`}>
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t.course}</th>
                      <th className="px-5 py-3">{t.session}</th>
                      <th className="px-5 py-3">{t.date}</th>
                      <th className="px-5 py-3">{t.attendance}</th>
                      <th className="px-5 py-3">{t.joinedAt}</th>
                      <th className="px-5 py-3">{t.leftAt}</th>
                      <th className="px-5 py-3">{t.duration}</th>
                      <th className="px-5 py-3">{t.note}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSessions.map((session) => (
                      <tr key={session._id} className="align-top">
                        <td className="px-5 py-4">
                          <p className="font-extrabold text-slate-800">{session.course?.title || "-"}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {t.teacher}: {session.course?.teacherName || "-"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-700">{session.title || "-"}</p>
                          <p className="mt-1">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                sessionStatusClasses[session.status] || "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {t.sessionStatuses[session.status] || session.status || "-"}
                            </span>
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {formatDateTime(session.startAt, language)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                              statusClasses[session.attendanceStatus] || statusClasses.not_marked
                            }`}
                          >
                            {t.statuses[session.attendanceStatus] || session.attendanceStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {session.joinedAt ? formatTimeOnly(session.joinedAt, language) : "-"}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {session.leftAt ? formatTimeOnly(session.leftAt, language) : "-"}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {getJoinedDurationLabel(session.joinedAt, session.leftAt, language)}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium leading-6 text-slate-500">
                          {session.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 xl:hidden">
                {filteredSessions.map((session) => (
                  <article key={session._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-slate-800">{session.course?.title || "-"}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {t.teacher}: {session.course?.teacherName || "-"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                          statusClasses[session.attendanceStatus] || statusClasses.not_marked
                        }`}
                      >
                        {t.statuses[session.attendanceStatus] || session.attendanceStatus}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          sessionStatusClasses[session.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {t.sessionStatuses[session.status] || session.status || "-"}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      <p className="font-bold text-slate-700">{session.title || "-"}</p>
                      <p className="mt-1">{formatDateTime(session.startAt, language)}</p>
                      <p className="mt-2">
                        {t.joinedAt}: {session.joinedAt ? formatTimeOnly(session.joinedAt, language) : "-"}
                      </p>
                      <p className="mt-1">
                        {t.leftAt}: {session.leftAt ? formatTimeOnly(session.leftAt, language) : "-"}
                      </p>
                      <p className="mt-1">
                        {t.duration}: {getJoinedDurationLabel(session.joinedAt, session.leftAt, language)}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {t.note}: {session.note || "-"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </StudentLayout>
  );
}
