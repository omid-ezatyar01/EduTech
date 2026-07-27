import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Link2,
  Plus,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import { fetchTeacherCourses } from "../../services/courseService";
import { getAuthUser } from "../../services/portal";
import CreateLiveClassModal from "../components/liveClasses/CreateLiveClassModal";
import AttendanceModal from "../components/liveClasses/AttendanceModal";
import {
  cancelTeacherLiveSession,
  createTeacherLiveSession,
  deleteTeacherLiveSession,
  endTeacherLiveSession,
  fetchTeacherLiveSessionAttendance,
  fetchTeacherLiveSessions,
  startTeacherLiveSession,
  updateTeacherLiveSessionAttendance,
} from "../../services/liveSessionService";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import { extractRouteIdentifier } from "../utils/routePaths";
import {
  formatDateTimeInZone,
  formatTimeRangeInZone,
  getBrowserTimeZone,
  zonedDateTimeToUtc,
} from "../utils/timezone";

const formatDay = (day, language) => {
  if (!day) return language === "fa" ? "نامشخص" : "Unknown";
  const map = {
    saturday: { fa: "شنبه", en: "Saturday" },
    sunday: { fa: "یکشنبه", en: "Sunday" },
    monday: { fa: "دوشنبه", en: "Monday" },
    tuesday: { fa: "سه‌شنبه", en: "Tuesday" },
    wednesday: { fa: "چهارشنبه", en: "Wednesday" },
    thursday: { fa: "پنجشنبه", en: "Thursday" },
    friday: { fa: "جمعه", en: "Friday" },
  };
  return map[String(day).toLowerCase()]?.[language] || day;
};

const formatPlatform = (platform, language) => {
  const key = String(platform || "").toLowerCase();
  const map = {
    google_meet: { fa: "Google Meet", en: "Google Meet" },
    zoom: { fa: "Zoom", en: "Zoom" },
    manual: { fa: "لینک دستی", en: "Manual link" },
    physical: { fa: "حضوری", en: "In person" },
  };
  return map[key]?.[language] || platform || "-";
};

const statusMetaMap = {
  scheduled: {
    fa: "زمان‌بندی شده",
    en: "Scheduled",
    badge: "bg-[#DBEAFE] text-[#0B4FD8]",
  },
  ready: {
    fa: "آماده شروع",
    en: "Ready to start",
    badge: "bg-amber-100 text-amber-800",
  },
  live: {
    fa: "در حال برگزاری",
    en: "Live",
    badge: "bg-[#DCFCE7] text-[#10B981]",
  },
  delayed: {
    fa: "با تأخیر",
    en: "Delayed",
    badge: "bg-orange-100 text-orange-800",
  },
  completed: {
    fa: "تکمیل شده",
    en: "Completed",
    badge: "bg-slate-100 text-slate-700",
  },
  cancelled: {
    fa: "لغو شده",
    en: "Cancelled",
    badge: "bg-[#FEE2E2] text-[#EF4444]",
  },
  rescheduled: {
    fa: "زمان‌بندی مجدد",
    en: "Rescheduled",
    badge: "bg-violet-100 text-violet-800",
  },
  missed: {
    fa: "برگزار نشده",
    en: "Missed",
    badge: "bg-rose-100 text-rose-700",
  },
};

const getLiveClassesCacheKey = ({ courseId, status }) =>
  getTeacherPageCacheKey("live-classes", { courseId, status });
const isManageableCourse = (course = {}) => !course?.classEndedAt;

const isSameLocalDay = (value, compareWith = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === compareWith.getFullYear() &&
    date.getMonth() === compareWith.getMonth() &&
    date.getDate() === compareWith.getDate()
  );
};

const normalizeSearchValue = (value = "") => String(value || "").trim().toLowerCase();

function StatCard({ icon: Icon, title, value, subtitle }) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-[#0F172A]">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0B4FD8]/10 text-[#0B4FD8]">
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function SpotlightCard({ title, subtitle, emptyText, session, language, actionLabel, onAction }) {
  const statusMeta = statusMetaMap[session?.status] || statusMetaMap.scheduled;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#0F172A]">{title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        {session ? (
          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusMeta.badge}`}>
            {language === "fa" ? statusMeta.fa : statusMeta.en}
          </span>
        ) : null}
      </div>

      {!session ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-sm font-semibold text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 rounded-2xl bg-[#F8FAFC] p-4">
          <p className="text-sm font-black text-slate-900">{session.title}</p>
          <p className="mt-1 text-xs font-bold text-slate-600">{session.courseTitle}</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">
            {language === "fa" ? "وقت کورس: " : "Course time: "}
            {session.teacherDateLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700" dir="ltr">
            {session.teacherTimeLabel}
          </p>
          <p className="mt-2 text-xs font-bold text-teal-700">
            {language === "fa" ? "وقت محل شما: " : "Your local time: "}
            {session.localDateLabel} · {session.localTimeLabel}
          </p>
          {actionLabel ? (
            <button
              type="button"
              onClick={() => onAction?.(session)}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#0B4FD8] px-4 text-sm font-black text-white"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SessionCard({
  session,
  language,
  isBusy,
  onJoin,
  onStart,
  onEnd,
  onAttendance,
  onCancel,
}) {
  const statusMeta = statusMetaMap[session.status] || statusMetaMap.scheduled;
  const isFa = language === "fa";

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{session.title}</p>
          <p className="mt-1 text-xs font-bold text-slate-600">{session.courseTitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusMeta.badge}`}>
          {isFa ? statusMeta.fa : statusMeta.en}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
          <p className="text-[11px] font-black text-slate-500">{isFa ? "وقت کورس" : "Course time"}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{session.teacherDateLabel}</p>
          <p className="mt-1 text-xs font-bold text-slate-600" dir="ltr">{session.teacherTimeLabel}</p>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
          <p className="text-[11px] font-black text-slate-500">{isFa ? "وقت محل شما" : "Your local time"}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{session.localDateLabel}</p>
          <p className="mt-1 text-xs font-bold text-teal-700" dir="ltr">{session.localTimeLabel}</p>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
          <p className="text-[11px] font-black text-slate-500">{isFa ? "پلتفرم" : "Platform"}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{session.platformLabel}</p>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
          <p className="text-[11px] font-black text-slate-500">{isFa ? "حضور ثبت‌شده" : "Attendance marked"}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {session.attendanceCount} {isFa ? "نفر" : "students"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {["scheduled", "ready", "delayed", "missed"].includes(session.status) ? (
          <button
            type="button"
            onClick={() => onStart(session)}
            disabled={
              isBusy ||
              (session.platform !== "physical" && !session.meetingLink)
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Video size={14} />
            {isFa ? "شروع جلسه" : "Start session"}
          </button>
        ) : null}

        {session.status === "live" && session.meetingLink ? (
          <button
            type="button"
            onClick={() => onJoin(session)}
            disabled={!session.meetingLink}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Link2 size={14} />
            {isFa ? "ورود به جلسه" : "Join session"}
          </button>
        ) : null}

        {session.status === "live" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onEnd(session)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-black text-blue-700 disabled:opacity-60"
          >
            <Square size={14} />
            {isFa ? "پایان" : "End"}
          </button>
        ) : null}

        {session.status !== "cancelled" ? (
          <button
            type="button"
            onClick={() => onAttendance(session)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-black text-slate-700"
          >
            <ClipboardCheck size={14} />
            {isFa ? "حضور" : "Attendance"}
          </button>
        ) : null}

        {session.status !== "cancelled" && session.status !== "completed" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onCancel(session)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-700 disabled:opacity-60"
          >
            <Ban size={14} />
            {isFa ? "لغو" : "Cancel"}
          </button>
        ) : null}

      </div>
    </article>
  );
}

export default function TeacherLiveClasses() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const requestedCourseId = useMemo(
    () =>
      extractRouteIdentifier(
        new URLSearchParams(location.search).get("courseId") ||
          new URLSearchParams(location.search).get("course") ||
          "",
      ),
    [location.search],
  );
  const initialLiveClassesCache = readTeacherPageCache(getLiveClassesCacheKey({
    courseId: "",
    status: "",
  }));
  const [sessions, setSessions] = useState(initialLiveClassesCache?.sessions || []);
  const [courses, setCourses] = useState(initialLiveClassesCache?.courses || []);
  const [loading, setLoading] = useState(!initialLiveClassesCache);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [busySessionId, setBusySessionId] = useState("");
  const [filterCourseId, setFilterCourseId] = useState(requestedCourseId);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  const sessionQuery = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(filterCourseId ? { courseId: filterCourseId } : {}),
    }),
    [filterCourseId],
  );

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const cacheKey = getLiveClassesCacheKey({
        courseId: filterCourseId,
        status: filterStatus,
      });
      const cached = readTeacherPageCache(cacheKey);
      if (cached) {
        setCourses(cached.courses || []);
        setSessions(cached.sessions || []);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        setError("");
        const [{ courses: courseRows }, { sessions: sessionRows }] = await Promise.all([
          fetchTeacherCourses({ page: 1, limit: 100 }),
          fetchTeacherLiveSessions(sessionQuery),
        ]);
        if (!isMounted) return;
        const nextCourses = (Array.isArray(courseRows) ? courseRows : []).filter(isManageableCourse);
        const allowedCourseIds = new Set(nextCourses.map((course) => String(course?._id || course?.id || "")));
        const nextSessions = (Array.isArray(sessionRows) ? sessionRows : []).filter((session) => {
          const courseId = String(session?.course?._id || session?.courseId || "");
          return allowedCourseIds.has(courseId);
        });
        setCourses(nextCourses);
        setSessions(nextSessions);
        writeTeacherPageCache(cacheKey, {
          courses: nextCourses,
          sessions: nextSessions,
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load live classes");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [filterCourseId, filterStatus, refreshSeed, sessionQuery]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilterCourseId((current) =>
          current === requestedCourseId ? current : requestedCourseId,
        ),
      0,
    );
    return () => clearTimeout(timer);
  }, [requestedCourseId]);

  const reloadSessions = async () => {
    const { sessions: rows } = await fetchTeacherLiveSessions(sessionQuery);
    const nextSessions = Array.isArray(rows) ? rows : [];
    setSessions(nextSessions);
    writeTeacherPageCache(getLiveClassesCacheKey({
      courseId: filterCourseId,
      status: filterStatus,
    }), {
      courses,
      sessions: nextSessions,
    });
  };

  const mappedSessions = useMemo(() => {
    return (Array.isArray(sessions) ? sessions : [])
      .map((session) => {
        const startDate = new Date(session.startAt);
        const endDate = new Date(session.endAt);
        const statusMeta = statusMetaMap[session.status] || statusMetaMap.scheduled;
        const attendanceCount = Number(session.attendanceCount || 0);
        const teacherTimeZone = session.timezone || "Asia/Kabul";
        const localTimeZone = getBrowserTimeZone();
        return {
          ...session,
          id: session._id,
          courseTitle: session.course?.title || (language === "fa" ? "کورس" : "Course"),
          day: formatDay(
            Number.isNaN(startDate.getTime())
              ? ""
              : startDate.toLocaleDateString("en-US", { weekday: "long" }),
            language,
          ),
          teacherDateLabel: Number.isNaN(startDate.getTime())
            ? "-"
            : formatDateTimeInZone(startDate, teacherTimeZone, language, {
                hour: undefined,
                minute: undefined,
                weekday: "long",
              }),
          localDateLabel: Number.isNaN(startDate.getTime())
            ? "-"
            : formatDateTimeInZone(startDate, localTimeZone, language, {
                hour: undefined,
                minute: undefined,
                weekday: "long",
              }),
          teacherTimeLabel:
            Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
              ? "-"
              : formatTimeRangeInZone(startDate, endDate, teacherTimeZone, language),
          localTimeLabel:
            Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
              ? "-"
              : formatTimeRangeInZone(startDate, endDate, localTimeZone, language),
          dateLabel: Number.isNaN(startDate.getTime())
            ? "-"
            : formatDateTimeInZone(startDate, localTimeZone, language, {
                hour: undefined,
                minute: undefined,
                weekday: "long",
              }),
          timeLabel:
            Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
              ? "-"
              : formatTimeRangeInZone(startDate, endDate, localTimeZone, language),
          statusLabel: language === "fa" ? statusMeta.fa : statusMeta.en,
          badgeClass: statusMeta.badge,
          platformLabel: formatPlatform(session.platform, language),
          attendanceCount,
          isToday: isSameLocalDay(session.startAt),
          isUpcoming: !Number.isNaN(startDate.getTime()) && startDate > new Date() && session.status === "scheduled",
          startsAtMs: Number.isNaN(startDate.getTime()) ? Number.MAX_SAFE_INTEGER : startDate.getTime(),
        };
      })
      .sort((a, b) => a.startsAtMs - b.startsAtMs);
  }, [language, sessions]);

  const uniqueSessions = useMemo(() => {
    const seenIds = new Set();
    return mappedSessions.filter((session) => {
      if (seenIds.has(session.id)) return false;
      seenIds.add(session.id);
      return true;
    });
  }, [mappedSessions]);

  const filteredSessions = useMemo(() => {
    const query = normalizeSearchValue(searchQuery);
    return uniqueSessions.filter((session) => {

      if (filterCourseId && String(session.course?._id || session.course?.id || "") !== String(filterCourseId)) {
        return false;
      }

      if (filterStatus && String(session.status || "") !== String(filterStatus)) {
        return false;
      }

      if (!query) return true;
      const haystack = `${session.title} ${session.courseTitle} ${session.dateLabel} ${session.statusLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filterCourseId, filterStatus, searchQuery, uniqueSessions]);

  const liveNowSession = useMemo(() => {
    const liveSessions = uniqueSessions.filter((session) => session.status === "live");
    return liveSessions[0] || null;
  }, [uniqueSessions]);
  const nextSession = useMemo(() => {
    const upcomingSessions = uniqueSessions.filter((session) => session.isUpcoming);
    return upcomingSessions[0] || null;
  }, [uniqueSessions]);
  const todaySessionsCount = useMemo(
    () => filteredSessions.filter((session) => session.isToday).length,
    [filteredSessions],
  );

  const stats = [
    {
      id: "live",
      icon: Video,
      title: language === "fa" ? "جلسات در حال برگزاری" : "Live sessions",
      value: filteredSessions.filter((item) => item.status === "live").length,
      subtitle: language === "fa" ? "نیازمند مدیریت فوری" : "Need immediate management",
    },
    {
      id: "scheduled",
      icon: CalendarClock,
      title: language === "fa" ? "جلسات زمان‌بندی شده" : "Scheduled sessions",
      value: filteredSessions.filter((item) => item.status === "scheduled").length,
      subtitle: language === "fa" ? "جلسات آینده" : "Upcoming sessions",
    },
    {
      id: "today",
      icon: Clock3,
      title: language === "fa" ? "جلسات امروز" : "Today's sessions",
      value: todaySessionsCount,
      subtitle: language === "fa" ? "برای امروز" : "On today’s calendar",
    },
  ];

  const handleCreateSession = async (form) => {
    try {
      const selectedCourse = courses.find(
        (course) => String(course?._id) === String(form.courseId),
      );
      const timezone =
        selectedCourse?.timezone || getBrowserTimeZone() || "Asia/Kabul";
      const startAt = zonedDateTimeToUtc(form.date, form.startTime, timezone);
      const endAt = zonedDateTimeToUtc(form.date, form.endTime, timezone);

      if (!startAt || !endAt) {
        throw new Error(language === "fa" ? "زمان جلسه معتبر نیست." : "Invalid date/time");
      }

      await createTeacherLiveSession({
        courseId: form.courseId,
        title: form.topic,
        description: form.description || "",
        platform: "google_meet",
        meetingLink: form.meetLink || "",
        autoGenerateMeet: Boolean(form.autoGenerateMeet),
        calendarId: "primary",
        timezone,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        notifyStudents: Boolean(form.notify),
        reminderEnabled: Boolean(form.reminder),
        autoAttendance: Boolean(form.autoAttendance),
      });

      setCreateOpen(false);
      setToast(language === "fa" ? "جلسه ایجاد شد." : "Session created.");
      window.dispatchEvent(new Event("edutech_data_changed"));
      await reloadSessions();
    } catch (err) {
      setToast(err?.message || "Failed to create session");
    }
  };

  const withSessionAction = async (sessionId, action) => {
    try {
      setBusySessionId(sessionId);
      await action();
      window.dispatchEvent(new Event("edutech_data_changed"));
      await reloadSessions();
    } catch (err) {
      setToast(err?.message || "Action failed");
    } finally {
      setBusySessionId("");
    }
  };

  const openAttendance = async (session) => {
    try {
      const data = await fetchTeacherLiveSessionAttendance(session.id);
      const rows = Array.isArray(data?.attendees) ? data.attendees : [];
      setSelectedSession(session);
      setAttendanceRows(rows);
      setAttendanceOpen(true);
    } catch (err) {
      setToast(err?.message || "Failed to load attendance");
    }
  };

  const saveAttendance = async (rows) => {
    if (!selectedSession?.id) return;
    try {
      await updateTeacherLiveSessionAttendance(
        selectedSession.id,
        rows.map((row) => ({
          studentId: row.studentId,
          status: row.status,
          note: row.note || "",
          joinedAt: row.joinedAt || undefined,
          leftAt: row.leftAt || undefined,
        })),
      );
      setAttendanceOpen(false);
      setToast(language === "fa" ? "حضور ثبت شد." : "Attendance saved.");
      window.dispatchEvent(new Event("edutech_data_changed"));
      await reloadSessions();
    } catch (err) {
      setToast(err?.message || "Failed to save attendance");
    }
  };

  const handleDeleteAllLinksByCourse = async () => {
    const selectedId = String(filterCourseId || "").trim();
    if (!selectedId) {
      setToast(language === "fa" ? "اول از فیلتر، یک کورس انتخاب کنید." : "Select a course from filter first.");
      return;
    }

    const { sessions: courseSessions } = await fetchTeacherLiveSessions({
      page: 1,
      limit: 100,
      courseId: selectedId,
    });
    const targetSessions = (Array.isArray(courseSessions) ? courseSessions : [])
      .map((row) => ({ id: row?._id }))
      .filter((row) => String(row.id || "").trim());

    if (!targetSessions.length) {
      setToast(language === "fa" ? "برای این کورس لینکی جهت حذف وجود ندارد." : "No links found for this course.");
      return;
    }

    const confirmed = window.confirm(
      language === "fa"
        ? `همه لینک‌های صنف زنده برای این کورس حذف شود؟ (${targetSessions.length})`
        : `Delete all live class links for this course? (${targetSessions.length})`,
    );
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        targetSessions.map((row) => deleteTeacherLiveSession(row.id)),
      );
      const successCount = results.filter((item) => item.status === "fulfilled").length;
      const failedCount = results.length - successCount;
      window.dispatchEvent(new Event("edutech_data_changed"));
      await reloadSessions();
      setToast(
        language === "fa"
          ? `حذف شد: ${successCount} | ناموفق: ${failedCount}`
          : `Deleted: ${successCount} | Failed: ${failedCount}`,
      );
    } catch (err) {
      setToast(err?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleJoinSession = (session) => {
    if (!session?.meetingLink) {
      setToast(language === "fa" ? "لینک جلسه ثبت نشده است." : "Meeting link is not available.");
      return;
    }
    window.open(session.meetingLink, "_blank", "noopener,noreferrer");
  };

  const handleStartSession = async (session) => {
    await withSessionAction(session.id, async () => {
      await startTeacherLiveSession(session.id);
      setToast(
        language === "fa"
          ? "جلسه شروع شد؛ اکنون شاگردان می‌توانند وارد شوند."
          : "Session started; students can now join.",
      );
    });
  };

  const handleEndSession = async (session) => {
    await withSessionAction(session.id, () => endTeacherLiveSession(session.id));
  };

  const handleCancelSession = async (session) => {
    const reason = window.prompt(
      language === "fa" ? "دلیل لغو جلسه را بنویسید:" : "Enter a reason for cancellation:",
      "",
    );
    if (reason === null) return;
    await withSessionAction(session.id, () => cancelTeacherLiveSession(session.id, reason));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterCourseId("");
    navigate("/teacher/live-classes", { replace: true });
  };

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section className={`space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
        <header className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-black text-[#0F172A]">
                {language === "fa" ? "مدیریت صنف‌های زنده" : "Manage live sessions"}
              </h1>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                {language === "fa"
                  ? "برای هر کورس جلسه بسازید، زمان و لینک را مدیریت کنید، حضور شاگردان را ثبت کنید و وضعیت هر جلسه را به‌سادگی کنترل کنید."
                  : "Create sessions for each course, manage timing and links, record attendance, and stay in control of every live class."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!courses.length}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                {language === "fa" ? "ایجاد جلسه جدید" : "Create session"}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((item) => (
            <StatCard key={item.id} icon={item.icon} title={item.title} value={item.value} subtitle={item.subtitle} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <SpotlightCard
            title={language === "fa" ? "جلسه فعال فعلی" : "Live right now"}
            subtitle={language === "fa" ? "اگر جلسه‌ای در حال برگزاری باشد، اینجا سریع به آن دسترسی دارید." : "Jump into the currently running session if there is one."}
            emptyText={language === "fa" ? "در حال حاضر جلسه زنده‌ای در حال برگزاری نیست." : "There is no live session running right now."}
            session={liveNowSession}
            language={language}
            actionLabel={liveNowSession ? (language === "fa" ? "ورود به جلسه" : "Join session") : ""}
            onAction={handleJoinSession}
          />
          <SpotlightCard
            title={language === "fa" ? "جلسه بعدی" : "Next upcoming session"}
            subtitle={language === "fa" ? "نزدیک‌ترین جلسه برنامه‌ریزی‌شده برای پیگیری سریع." : "The nearest scheduled session for quick follow-up."}
            emptyText={language === "fa" ? "جلسه آینده‌ای پیدا نشد." : "No upcoming session found."}
            session={nextSession}
            language={language}
          />
        </section>

        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto_auto_auto]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={language === "fa" ? "جستجو بر اساس موضوع یا کورس" : "Search by topic or course"}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10"
            />

            <select
              value={filterCourseId}
              onChange={(event) => {
                const nextCourseId = event.target.value;
                setFilterCourseId(nextCourseId);
                navigate(
                  nextCourseId
                    ? `/teacher/live-classes?courseId=${encodeURIComponent(nextCourseId)}`
                    : "/teacher/live-classes",
                  { replace: true },
                );
              }}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10"
            >
              <option value="">{language === "fa" ? "همه کورس‌ها" : "All courses"}</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title || (language === "fa" ? "کورس بدون نام" : "Untitled course")}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10"
            >
              <option value="">{language === "fa" ? "همه وضعیت‌ها" : "All statuses"}</option>
              <option value="scheduled">{language === "fa" ? "زمان‌بندی شده" : "Scheduled"}</option>
              <option value="live">{language === "fa" ? "در حال برگزاری" : "Live"}</option>
              <option value="completed">{language === "fa" ? "تکمیل شده" : "Completed"}</option>
              <option value="cancelled">{language === "fa" ? "لغو شده" : "Cancelled"}</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {language === "fa" ? "پاک‌کردن" : "Clear"}
            </button>

            <button
              type="button"
              onClick={handleDeleteAllLinksByCourse}
              disabled={bulkDeleting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Trash2 size={15} />
              {bulkDeleting
                ? (language === "fa" ? "در حال حذف" : "Deleting")
                : (language === "fa" ? "حذف لینک‌های کورس" : "Delete course links")}
            </button>

            <div className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F8FAFC] px-4 text-sm font-bold text-slate-600">
              {language === "fa"
                ? `${filteredSessions.length} جلسه`
                : `${filteredSessions.length} sessions`}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#0F172A]">
                {language === "fa" ? "جلسات قابل مدیریت" : "Manageable sessions"}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {language === "fa"
                  ? "از اینجا می‌توانید ورود، پایان، لغو یا حضور هر جلسه را مدیریت کنید."
                  : "Join, end, cancel, or manage attendance for each session from here."}
              </p>
            </div>
          </div>

          {loading ? (
            <TeacherPageLoader
              label={language === "fa" ? "در حال بارگذاری جلسات" : "Loading sessions"}
              minHeight="min-h-[260px]"
              className="mt-4"
            />
          ) : filteredSessions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-4 text-sm font-semibold text-slate-500">
              {language === "fa"
                ? "هیچ جلسه‌ای با فیلترهای فعلی پیدا نشد."
                : "No sessions match the current filters."}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  language={language}
                  isBusy={busySessionId === session.id}
                  onJoin={handleJoinSession}
                  onStart={handleStartSession}
                  onEnd={handleEndSession}
                  onAttendance={openAttendance}
                  onCancel={handleCancelSession}
                />
              ))}
            </div>
          )}
        </section>

        <CreateLiveClassModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateSession}
          courses={courses}
          language={language}
          defaultCourseId={requestedCourseId}
        />

        <AttendanceModal
          open={attendanceOpen}
          classInfo={{
            course: selectedSession?.courseTitle || "",
            topic: selectedSession?.title || "",
          }}
          attendees={attendanceRows}
          onClose={() => setAttendanceOpen(false)}
          onSave={saveAttendance}
        />

        {toast ? (
          <div className={`fixed bottom-5 z-[110] inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-bold text-white shadow-xl ${isRTL ? "right-5" : "left-5"}`}>
            {toast}
          </div>
        ) : null}
      </section>
    </TeacherLayout>
  );
}
