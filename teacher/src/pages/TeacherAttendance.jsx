import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Save,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { getAuthUser } from "../../services/portal";
import {
  fetchTeacherAttendanceOverview,
  fetchTeacherLiveSessionAttendance,
  updateTeacherLiveSessionAttendance,
} from "../../services/liveSessionService";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";

const STATUS_OPTIONS = [
  { key: "present", icon: UserCheck, color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "absent", icon: UserX, color: "bg-rose-50 text-rose-700 ring-rose-200" },
];

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

const getStatusLabels = (isFa) => ({
  present: isFa ? "حاضر" : "Present",
  absent: isFa ? "غیرحاضر" : "Absent",
});

const getCourseId = (course) => String(course?._id || course?.id || "");

const getSessionCourseId = (session) => String(session?.course?._id || session?.course?.id || session?.courseId || "");
const normalizeSearchValue = (value = "") => String(value || "").trim().toLowerCase();

const getSessionStatusLabel = (status, isFa) => {
  const map = {
    scheduled: isFa ? "زمان‌بندی شده" : "Scheduled",
    live: isFa ? "در حال برگزاری" : "Live",
    completed: isFa ? "تکمیل شده" : "Completed",
    cancelled: isFa ? "لغو شده" : "Cancelled",
  };
  return map[String(status || "").toLowerCase()] || (status || "-");
};

const getSessionStatusTone = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "live") return "bg-emerald-50 text-emerald-700";
  if (key === "completed") return "bg-slate-100 text-slate-700";
  if (key === "cancelled") return "bg-rose-50 text-rose-700";
  return "bg-blue-50 text-blue-700";
};

const getCourseStatusLabel = (status, isFa) => {
  const map = {
    published: isFa ? "منتشر شده" : "Published",
    approved: isFa ? "تایید شده" : "Approved",
    draft: isFa ? "پیش‌نویس" : "Draft",
    cancelled: isFa ? "لغو شده" : "Cancelled",
    class_started: isFa ? "صنف شروع شده" : "Class started",
    class_ended: isFa ? "صنف پایان یافته" : "Class ended",
    pending: isFa ? "در انتظار" : "Pending",
    rejected: isFa ? "رد شده" : "Rejected",
  };
  return map[String(status || "").toLowerCase()] || (status || "-");
};

const ATTENDANCE_OVERVIEW_CACHE_KEY = getTeacherPageCacheKey("attendance-overview");
const getAttendanceSessionCacheKey = (sessionId) =>
  getTeacherPageCacheKey("attendance-session", { sessionId: String(sessionId || "") });

export default function TeacherAttendance() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const statusLabels = useMemo(() => getStatusLabels(isFa), [isFa]);
  const teacher = useMemo(
    () => getAuthUser() || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" },
    [],
  );
  const initialAttendanceCache = readTeacherPageCache(ATTENDANCE_OVERVIEW_CACHE_KEY);

  const [courses, setCourses] = useState(initialAttendanceCache?.courses || []);
  const [allSessions, setAllSessions] = useState(initialAttendanceCache?.allSessions || []);
  const [overviewStats, setOverviewStats] = useState(initialAttendanceCache?.overviewStats || {});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [studentAttendanceDays, setStudentAttendanceDays] = useState({ key: "", rows: {} });
  const [loading, setLoading] = useState(!initialAttendanceCache);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [studentDaysLoading, setStudentDaysLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [attendeeSearch, setAttendeeSearch] = useState("");

  const sessions = useMemo(() => {
    if (!selectedCourseId) return allSessions;
    return allSessions.filter((session) => getSessionCourseId(session) === String(selectedCourseId));
  }, [allSessions, selectedCourseId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => String(session._id) === String(selectedSessionId)) || null,
    [selectedSessionId, sessions],
  );

  const summarySessions = useMemo(() => {
    if (selectedCourseId) return sessions;
    const selectedCourse = getSessionCourseId(selectedSession);
    if (!selectedCourse) return selectedSession ? [selectedSession] : [];
    return allSessions.filter((session) => getSessionCourseId(session) === selectedCourse);
  }, [allSessions, selectedCourseId, selectedSession, sessions]);

  const attendanceDaysKey = useMemo(
    () => summarySessions.map((session) => String(session._id || "")).filter(Boolean).join("|"),
    [summarySessions],
  );

  const courseSummaries = useMemo(() => {
    const summaryMap = new Map();

    courses.forEach((course) => {
      const id = getCourseId(course);
      if (!id) return;
      summaryMap.set(id, {
        id,
        title: course.title || (isFa ? "کورس" : "Course"),
        status: course.status || (course.isPublished ? "published" : "draft"),
        students: Number(course.activeStudentsCount || course.enrolledStudentsCount || course.students || 0),
        sessions: 0,
        marked: 0,
        present: 0,
        absent: 0,
        latestStartAt: null,
      });
    });

    allSessions.forEach((session) => {
      const id = getSessionCourseId(session);
      if (!id) return;
      const existing = summaryMap.get(id) || {
        id,
        title: session.course?.title || (isFa ? "کورس" : "Course"),
        status: "-",
        students: 0,
        sessions: 0,
        marked: 0,
        present: 0,
        absent: 0,
        latestStartAt: null,
      };
      const stats = session.attendanceStats || {};
      const present = Number(stats.present || 0);
      const absent = Number(stats.absent || 0);
      const marked = Number(session.attendanceCount || present + absent || 0);
      const currentStartAt = session.startAt ? new Date(session.startAt) : null;
      const previousStartAt = existing.latestStartAt ? new Date(existing.latestStartAt) : null;

      summaryMap.set(id, {
        ...existing,
        sessions: existing.sessions + 1,
        marked: existing.marked + marked,
        present: existing.present + present,
        absent: existing.absent + absent,
        latestStartAt:
          currentStartAt &&
          Number.isFinite(currentStartAt.getTime()) &&
          (!previousStartAt || currentStartAt > previousStartAt)
            ? session.startAt
            : existing.latestStartAt,
      });
    });

    return Array.from(summaryMap.values()).map((summary) => {
      const counted = summary.present + summary.absent;
      return {
        ...summary,
        attendanceRate: counted ? Math.round((summary.present / counted) * 100) : 0,
      };
    }).sort((left, right) => {
      if (right.attendanceRate !== left.attendanceRate) {
        return right.attendanceRate - left.attendanceRate;
      }
      return String(left.title || "").localeCompare(String(right.title || ""), language === "fa" ? "fa" : "en");
    });
  }, [allSessions, courses, isFa]);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      const cached = readTeacherPageCache(ATTENDANCE_OVERVIEW_CACHE_KEY);
      if (cached) {
        setCourses(cached.courses || []);
        setAllSessions(cached.allSessions || []);
        setOverviewStats(cached.overviewStats || {});
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");
        const result = await fetchTeacherAttendanceOverview({
          page: 1,
          limit: 100,
        });
        if (!mounted) return;
        const nextSessions = Array.isArray(result.sessions) ? result.sessions : [];
        const nextCourses = Array.isArray(result.courses) ? result.courses : [];
        const nextOverviewStats = result.stats || {};
        setCourses(nextCourses);
        setAllSessions(nextSessions);
        setOverviewStats(nextOverviewStats);
        writeTeacherPageCache(ATTENDANCE_OVERVIEW_CACHE_KEY, {
          courses: nextCourses,
          allSessions: nextSessions,
          overviewStats: nextOverviewStats,
        });
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || (isFa ? "حضور و غیاب بارگذاری نشد." : "Attendance could not be loaded."));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOverview();
    return () => {
      mounted = false;
    };
  }, [isFa, refreshSeed]);

  useEffect(() => {
    const selectableSessions = selectedCourseId
      ? allSessions.filter((session) => getSessionCourseId(session) === String(selectedCourseId))
      : allSessions;
    setSelectedSessionId((previous) => {
      if (previous && selectableSessions.some((session) => String(session._id) === String(previous))) {
        return previous;
      }
      return selectableSessions[0]?._id || "";
    });
  }, [allSessions, selectedCourseId]);

  useEffect(() => {
    if (!selectedSessionId) {
      return undefined;
    }

    let mounted = true;
    const loadAttendance = async () => {
      try {
        setAttendanceLoading(true);
        setError("");
        const cacheKey = getAttendanceSessionCacheKey(selectedSessionId);
        const cached = readTeacherPageCache(cacheKey);
        if (cached) {
          setAttendees(Array.isArray(cached.attendees) ? cached.attendees : []);
          setSessionStats(cached.stats || {});
          setAttendanceLoading(false);
        }
        const result = await fetchTeacherLiveSessionAttendance(selectedSessionId);
        if (!mounted) return;
        const nextAttendees = Array.isArray(result.attendees) ? result.attendees : [];
        const nextStats = result.stats || {};
        setAttendees(nextAttendees);
        setSessionStats(nextStats);
        writeTeacherPageCache(cacheKey, {
          attendees: nextAttendees,
          stats: nextStats,
        });
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || (isFa ? "لیست شاگردان بارگذاری نشد." : "Student list could not be loaded."));
      } finally {
        if (mounted) setAttendanceLoading(false);
      }
    };

    loadAttendance();
    return () => {
      mounted = false;
    };
  }, [isFa, selectedSessionId]);

  useEffect(() => {
    if (!attendanceDaysKey) {
      return undefined;
    }

    let mounted = true;
    const loadStudentAttendanceDays = async () => {
      try {
        setStudentDaysLoading(true);
        const results = await Promise.all(
          summarySessions.map(async (session) => {
            const cacheKey = getAttendanceSessionCacheKey(session._id);
            const cached = readTeacherPageCache(cacheKey);
            if (cached) {
              return Array.isArray(cached.attendees) ? cached.attendees : [];
            }
            const result = await fetchTeacherLiveSessionAttendance(session._id);
            const nextAttendees = Array.isArray(result.attendees) ? result.attendees : [];
            writeTeacherPageCache(cacheKey, {
              attendees: nextAttendees,
              stats: result.stats || {},
            });
            return nextAttendees;
          }),
        );

        if (!mounted) return;
        const rows = {};
        results.forEach((sessionRows) => {
          sessionRows.forEach((row) => {
            const studentId = String(row.studentId || "");
            if (!studentId) return;
            const previous = rows[studentId] || { present: 0, absent: 0 };
            if (row.status === "present") {
              previous.present += 1;
            } else {
              previous.absent += 1;
            }
            rows[studentId] = previous;
          });
        });
        setStudentAttendanceDays({ key: attendanceDaysKey, rows });
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || (isFa ? "روزهای حضور شاگردان بارگذاری نشد." : "Student attendance days could not be loaded."));
      } finally {
        if (mounted) setStudentDaysLoading(false);
      }
    };

    loadStudentAttendanceDays();
    return () => {
      mounted = false;
    };
  }, [attendanceDaysKey, isFa, summarySessions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const updateAttendee = (studentId, patch) => {
    setAttendees((previous) =>
      previous.map((row) => (String(row.studentId) === String(studentId) ? { ...row, ...patch } : row)),
    );
  };

  const markAll = (status) => {
    setAttendees((previous) => previous.map((row) => ({ ...row, status })));
  };

  const saveAttendance = async () => {
    if (!selectedSessionId || !attendees.length) return;
    try {
      setSaving(true);
      setError("");
      const payload = attendees.map((row) => ({
        studentId: row.studentId,
        status: row.status || "absent",
        note: row.note || "",
        joinedAt: row.joinedAt || undefined,
        leftAt: row.leftAt || undefined,
      }));
      const result = await updateTeacherLiveSessionAttendance(selectedSessionId, payload);
      setSessionStats(result.stats || {});
      setToast(isFa ? "حضور و غیاب ذخیره شد." : "Attendance saved.");
      clearTeacherPageCache("teacher:attendance-overview");
      clearTeacherPageCache("teacher:attendance-session");
      setRefreshSeed((previous) => previous + 1);
    } catch (err) {
      setError(err?.message || (isFa ? "ذخیره حضور و غیاب انجام نشد." : "Attendance could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const visibleAttendees = selectedSessionId ? attendees : [];
  const filteredAttendees = useMemo(() => {
    const query = normalizeSearchValue(attendeeSearch);
    if (!query) return visibleAttendees;
    return visibleAttendees.filter((row) => {
      const haystack = `${row.name || ""} ${row.email || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [attendeeSearch, visibleAttendees]);
  const visibleSessionStats = selectedSessionId ? sessionStats : {};
  const filteredCourseSummaries = useMemo(() => {
    if (!selectedCourseId) return courseSummaries;
    return courseSummaries.filter((course) => String(course.id) === String(selectedCourseId));
  }, [courseSummaries, selectedCourseId]);
  const selectedCourseSummary = useMemo(
    () => filteredCourseSummaries.find((course) => String(course.id) === String(selectedCourseId)) || null,
    [filteredCourseSummaries, selectedCourseId],
  );
  const getStudentAttendanceDays = (studentId) => {
    if (studentAttendanceDays.key !== attendanceDaysKey) return null;
    return studentAttendanceDays.rows[String(studentId)] || { present: 0, absent: 0 };
  };

  const totalMarkedForCurrentScope = useMemo(
    () => summarySessions.reduce((sum, session) => sum + Number(session.attendanceCount || 0), 0),
    [summarySessions],
  );

  const statCards = [
    {
      label: isFa ? "جلسات" : "Sessions",
      value: Number(selectedCourseId ? sessions.length : overviewStats.totalSessions || sessions.length || 0),
      icon: CalendarCheck,
      color: "text-blue-700 bg-blue-50",
    },
    {
      label: isFa ? "ثبت‌شده" : "Marked",
      value: Number(selectedCourseId ? totalMarkedForCurrentScope : overviewStats.totalMarked || totalMarkedForCurrentScope || 0),
      icon: CheckCircle2,
      color: "text-amber-700 bg-amber-50",
    },
    {
      label: isFa ? "حاضر" : "Present",
      value: Number(visibleSessionStats.present || 0),
      icon: UserCheck,
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: isFa ? "غیرحاضر" : "Absent",
      value: Number(visibleSessionStats.absent || 0),
      icon: UserX,
      color: "text-rose-700 bg-rose-50",
    },
  ];

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#0B4FD8]">{isFa ? "حضور و غیاب کورس‌ها" : "Course Attendance"}</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                {isFa ? "ثبت حضور شاگردان" : "Mark Student Attendance"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                {isFa
                  ? "برای هر جلسه کورس، وضعیت حضور شاگردان را ثبت و ذخیره کنید."
                  : "Select a course session, update each student status, and save the class roster."}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${item.color}`}>
                  <item.icon size={20} />
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-end">
            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">{isFa ? "کورس" : "Course"}</span>
              <select
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setSelectedSessionId("");
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#0B4FD8]"
              >
                <option value="">{isFa ? "همه کورس‌ها" : "All courses"}</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title || (isFa ? "کورس" : "Course")}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">{isFa ? "جلسه" : "Session"}</span>
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#0B4FD8]"
              >
                <option value="">{isFa ? "یک جلسه را انتخاب کنید" : "Select a session"}</option>
                {sessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.course?.title || (isFa ? "کورس" : "Course")} - {formatDateTime(session.startAt, language)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black text-slate-500">{isFa ? "جستجوی شاگرد" : "Search student"}</span>
              <div className="relative">
                <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? "right-3" : "left-3"}`} />
                <input
                  value={attendeeSearch}
                  onChange={(event) => setAttendeeSearch(event.target.value)}
                  placeholder={isFa ? "نام یا ایمیل شاگرد" : "Student name or email"}
                  className={`h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none transition focus:border-[#0B4FD8] ${isRTL ? "pr-10 pl-3 text-right" : "pl-10 pr-3 text-left"}`}
                />
              </div>
            </label>

            <button
              type="button"
              onClick={saveAttendance}
              disabled={saving || attendanceLoading || !selectedSessionId || !filteredAttendees.length}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(11,79,216,0.22)] transition hover:bg-[#083FAA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />
              {saving ? (isFa ? "در حال ذخیره" : "Saving") : isFa ? "ذخیره حضور" : "Save Attendance"}
            </button>
          </div>

          {selectedSession ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{selectedSession.course?.title || "-"}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{formatDateTime(selectedSession.startAt, language)}</span>
              <span className={`rounded-full px-3 py-1 ${getSessionStatusTone(selectedSession.status)}`}>
                {getSessionStatusLabel(selectedSession.status, isFa)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {isFa ? `ثبت‌شده: ${Number(visibleSessionStats.present || 0) + Number(visibleSessionStats.absent || 0)}` : `Marked: ${Number(visibleSessionStats.present || 0) + Number(visibleSessionStats.absent || 0)}`}
              </span>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => markAll(option.key)}
                  disabled={!filteredAttendees.length || attendanceLoading}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black ring-1 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${option.color}`}
                >
                  <Icon size={15} />
                  {isFa ? "همه" : "All"} {statusLabels[option.key]}
                </button>
              );
            })}
          </div>

          {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
          {toast ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{toast}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {isFa ? "خلاصه حضور کورس‌ها" : "Course Attendance Overview"}
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {isFa
                  ? "وضعیت حاضر، غیرحاضر و شاگردان هر کورس"
                  : "Present, absent, student count, and progress for each course."}
              </p>
            </div>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-3 text-xs font-black text-blue-700">
              <CalendarCheck size={15} />
              {isFa ? `${filteredCourseSummaries.length} کورس` : `${filteredCourseSummaries.length} courses`}
            </span>
          </div>

          {loading ? (
            <TeacherPageLoader
              label={isFa ? "در حال بارگذاری" : "Loading"}
              minHeight="min-h-[260px]"
              className="rounded-none border-0"
            />
          ) : filteredCourseSummaries.length === 0 ? (
            <p className="p-10 text-center text-sm font-bold text-slate-500">
              {isFa ? "هنوز کورسی برای نمایش وجود ندارد." : "No courses available to summarize yet."}
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className={`w-full min-w-[980px] text-sm ${isRTL ? "text-right" : "text-left"}`}>
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{isFa ? "کورس" : "Course"}</th>
                      <th className="px-5 py-3">{isFa ? "شاگردان" : "Students"}</th>
                      <th className="px-5 py-3">{isFa ? "جلسات" : "Sessions"}</th>
                      <th className="px-5 py-3">{isFa ? "حاضر" : "Present"}</th>
                      <th className="px-5 py-3">{isFa ? "غیرحاضر" : "Absent"}</th>
                      <th className="px-5 py-3">{isFa ? "درصد حضور" : "Attendance"}</th>
                      <th className="px-5 py-3">{isFa ? "آخرین جلسه" : "Latest Session"}</th>
                      <th className="px-5 py-3">{isFa ? "عملیات" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCourseSummaries.map((course) => (
                      <tr key={course.id} className="align-middle">
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">{course.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{getCourseStatusLabel(course.status, isFa)}</p>
                        </td>
                        <td className="px-5 py-4 font-black text-slate-700">{course.students}</td>
                        <td className="px-5 py-4 font-black text-slate-700">{course.sessions}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex min-w-12 justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {course.present}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex min-w-12 justify-center rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                            {course.absent}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#0B4FD8]"
                                style={{ width: `${Math.min(course.attendanceRate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-black text-slate-700">{course.attendanceRate}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-slate-500">
                          {course.latestStartAt ? formatDateTime(course.latestStartAt, language) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(course.id);
                              const latestSession = allSessions.find((session) => getSessionCourseId(session) === String(course.id));
                              setSelectedSessionId(latestSession?._id || "");
                            }}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                          >
                            {isFa ? "دیدن شاگردان" : "View Students"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {filteredCourseSummaries.map((course) => (
                  <div key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{course.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{getCourseStatusLabel(course.status, isFa)}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                        {course.attendanceRate}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                        {isFa ? "شاگردان" : "Students"}: {course.students}
                      </span>
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                        {isFa ? "جلسات" : "Sessions"}: {course.sessions}
                      </span>
                      <span className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                        {isFa ? "حاضر" : "Present"}: {course.present}
                      </span>
                      <span className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                        {isFa ? "غیرحاضر" : "Absent"}: {course.absent}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        const latestSession = allSessions.find((session) => getSessionCourseId(session) === String(course.id));
                        setSelectedSessionId(latestSession?._id || "");
                      }}
                      className="mt-4 h-10 w-full rounded-xl border border-slate-200 text-xs font-black text-slate-700"
                    >
                      {isFa ? "دیدن شاگردان" : "View Students"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-black text-slate-950">{isFa ? "لیست شاگردان" : "Student Roster"}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {isFa ? `${filteredAttendees.length} شاگرد` : `${filteredAttendees.length} students`}
              </p>
            </div>
            <Users className="text-slate-400" size={22} />
          </div>

          {loading || attendanceLoading ? (
            <TeacherPageLoader
              label={isFa ? "در حال بارگذاری" : "Loading"}
              minHeight="min-h-[260px]"
              className="rounded-none border-0"
            />
          ) : !selectedSessionId ? (
            <p className="p-10 text-center text-sm font-bold text-slate-500">
              {isFa ? "برای شروع یک جلسه انتخاب کنید." : "Select a session to start marking attendance."}
            </p>
          ) : filteredAttendees.length === 0 ? (
            <p className="p-10 text-center text-sm font-bold text-slate-500">
              {attendeeSearch
                ? (isFa ? "شاگردی با این جستجو پیدا نشد." : "No students match this search.")
                : (isFa ? "شاگرد فعالی برای این کورس پیدا نشد." : "No active students found for this course.")}
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className={`w-full min-w-[960px] text-sm ${isRTL ? "text-right" : "text-left"}`}>
                  <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{isFa ? "شاگرد" : "Student"}</th>
                      <th className="px-5 py-3">{isFa ? "روزهای حاضر" : "Present Days"}</th>
                      <th className="px-5 py-3">{isFa ? "روزهای غیرحاضر" : "Absent Days"}</th>
                      <th className="px-5 py-3">{isFa ? "وضعیت" : "Status"}</th>
                      <th className="px-5 py-3">{isFa ? "ثبت شده" : "Marked"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendees.map((row) => (
                      <tr key={row.studentId} className="align-middle">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                              {(row.name || "S").trim().charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-slate-900">{row.name || (isFa ? "شاگرد" : "Student")}</p>
                              <p className="text-xs font-semibold text-slate-500">{row.email || "-"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex min-w-12 justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {studentDaysLoading ? "..." : getStudentAttendanceDays(row.studentId)?.present ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex min-w-12 justify-center rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                            {studentDaysLoading ? "..." : getStudentAttendanceDays(row.studentId)?.absent ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((option) => {
                              const Icon = option.icon;
                              const active = row.status === option.key;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => updateAttendee(row.studentId, { status: option.key })}
                                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black ring-1 transition ${
                                    active ? option.color : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  <Icon size={14} />
                                  {statusLabels[option.key]}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            <CheckCircle2 size={14} />
                            {statusLabels[row.status] || statusLabels.absent}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {filteredAttendees.map((row) => (
                  <div key={row.studentId} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{row.name || (isFa ? "شاگرد" : "Student")}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.email || "-"}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {statusLabels[row.status] || statusLabels.absent}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
                      <span className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                        {isFa ? "روزهای حاضر" : "Present Days"}:{" "}
                        {studentDaysLoading ? "..." : getStudentAttendanceDays(row.studentId)?.present ?? 0}
                      </span>
                      <span className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                        {isFa ? "روزهای غیرحاضر" : "Absent Days"}:{" "}
                        {studentDaysLoading ? "..." : getStudentAttendanceDays(row.studentId)?.absent ?? 0}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = row.status === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateAttendee(row.studentId, { status: option.key })}
                            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-black ring-1 ${
                              active ? option.color : "bg-white text-slate-500 ring-slate-200"
                            }`}
                          >
                            <Icon size={14} />
                            {statusLabels[option.key]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </TeacherLayout>
  );
}
