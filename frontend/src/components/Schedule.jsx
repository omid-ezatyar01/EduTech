import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import WeeklyTimetable from "./WeeklyTimetable.jsx";
import ScheduleUpcomingTable from "./ScheduleUpcomingTable.jsx";
import WeeklySummaryCard from "./WeeklySummaryCard.jsx";
import ClassDetailsModal from "./ClassDetailsModal.jsx";
import { fetchStudentLiveSessions } from "../../services/courseService.js";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import {
  fetchGoogleCalendarAuthUrl,
  fetchGoogleCalendarStatus,
} from "../../services/googleCalendarService.js";
import { getDualTimeDetails } from "../utils/timezone.js";

const mockStudent = {
  id: "",
  nameFa: "",
  email: "",
  avatar: "",
};

const DAY_ALIASES = {
  saturday: "Saturday",
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  "شنبه": "Saturday",
  "یکشنبه": "Sunday",
  "دوشنبه": "Monday",
  "سه شنبه": "Tuesday",
  "سه‌شنبه": "Tuesday",
  "چهار شنبه": "Wednesday",
  "چهارشنبه": "Wednesday",
  "پنج شنبه": "Thursday",
  "پنجشنبه": "Thursday",
  "جمعه": "Friday",
};

const DAY_ORDER = {
  Saturday: 0,
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
};

const normalizeDayLabel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return DAY_ALIASES[key] || String(value || "").trim() || "Unknown";
};

const parseTimeToMinutes = (value) => {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 60 + Number(match[2]);
};

const inferCourseType = (course = {}) => {
  const text = `${course.title || ""} ${course.description || ""}`.toLowerCase();
  if (/(mern|react|node|javascript|js|full[\s-]?stack)/i.test(text)) return "mern";
  if (/(design|ui|ux|figma|طراحی)/i.test(text)) return "design";
  if (/(english|انگلیسی|speaking|ielts|toefl)/i.test(text)) return "english";
  return "general";
};

export default function Schedule({ language = "fa" }) {
  const isFa = language === "fa";
  const t = {
    statusCancelled: isFa ? "لغو شده" : "Cancelled",
    statusCompleted: isFa ? "تکمیل شده" : "Completed",
    statusLive: isFa ? "در حال برگزاری" : "Live now",
    statusScheduled: isFa ? "برنامه‌ریزی شده" : "Scheduled",
    statusReady: isFa ? "آماده شروع" : "Ready to start",
    statusDelayed: isFa ? "با تأخیر" : "Delayed",
    statusMissed: isFa ? "برگزار نشده" : "Missed",
    statusRescheduled: isFa ? "زمان‌بندی مجدد" : "Rescheduled",
    weeklyClasses: isFa ? "صنف این هفته" : "Classes This Week",
    todayClasses: isFa ? "صنف امروز" : "Today's Classes",
    upcomingClasses: isFa ? "صنف‌های آینده" : "Upcoming Classes",
    pending: isFa ? "در انتظار" : "Pending",
    dashboard: isFa ? "داشبورد" : "Dashboard",
    schedule: isFa ? "تقسیم اوقات" : "Schedule",
    scheduleSubtitle: isFa
      ? "تمام صنف‌های آینده و برنامه هفتگی خود را اینجا ببینید."
      : "See all your upcoming classes and weekly plan here.",
    loading: isFa ? "در حال بارگذاری تقسیم اوقات" : "Loading schedule",
  };
  const user = getAuthUser() || mockStudent;
  const [selectedClass, setSelectedClass] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [googleStatus, setGoogleStatus] = useState({
    loading: true,
    connected: false,
    googleEmail: "",
    reconnectRequired: false,
  });
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetchGoogleCalendarStatus()
      .then((status) => {
        if (!active) return;
        setGoogleStatus({
          loading: false,
          connected: Boolean(status?.connected),
          googleEmail: status?.googleEmail || "",
          reconnectRequired: Boolean(status?.reconnectRequired),
        });
      })
      .catch(() => {
        if (active) {
          setGoogleStatus((current) => ({ ...current, loading: false }));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("googleOAuth")) return;
    params.delete("googleOAuth");
    params.delete("message");
    navigate(
      `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      { replace: true },
    );
  }, [navigate]);

  const connectGoogleCalendar = async () => {
    try {
      setConnectingGoogle(true);
      const url = await fetchGoogleCalendarAuthUrl();
      if (!url) throw new Error("Google authorization URL is unavailable");
      window.location.assign(url);
    } catch (connectError) {
      setError(
        getLocalizedRequestErrorMessage(
          connectError,
          language,
          "اتصال تقویم گوگل انجام نشد.",
          "Unable to connect Google Calendar.",
        ),
      );
      setConnectingGoogle(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSchedule = async () => {
      try {
        setLoading(true);
        setError("");
        const { sessions } = await fetchStudentLiveSessions({
          page: 1,
          limit: 100,
        });
        if (!mounted) return;

        const scheduleRows = (Array.isArray(sessions) ? sessions : [])
          .map((session) => {
            const startAt = new Date(session.startAt);
            const endAt = new Date(session.endAt);
            const hasValidTime =
              !Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime());
            const dayEn = hasValidTime
              ? startAt.toLocaleDateString("en-US", { weekday: "long" })
              : "";
            const day = normalizeDayLabel(dayEn);
            const dualTime = hasValidTime
              ? getDualTimeDetails(
                  startAt,
                  endAt,
                  session.timezone || "Asia/Kabul",
                  language,
                )
              : null;
            const time = dualTime?.localRange || "-";

            const status = String(session.status || "scheduled");
            const statusLabels = {
              cancelled: t.statusCancelled,
              completed: t.statusCompleted,
              live: t.statusLive,
              ready: t.statusReady,
              delayed: t.statusDelayed,
              missed: t.statusMissed,
              rescheduled: t.statusRescheduled,
              scheduled: t.statusScheduled,
            };
            const statusLabel = statusLabels[status] || t.statusScheduled;

            return {
              id: session._id,
              course: session.course?.title || "Course",
              date: day,
              day,
              time,
              localTime: dualTime?.localRange || "-",
              teacherTime: dualTime?.teacherRange || "-",
              localTimeZone: dualTime?.localZone || "",
              teacherTimeZone: dualTime?.teacherZone || "",
              teacher: session.course?.teacherName || "Teacher",
              status,
              statusLabel,
              meetLink: session.meetingLink || "",
              type: inferCourseType({
                title: session.course?.title || "",
                description: session.description || "",
              }),
              createdAt: session.createdAt || session.startAt || 0,
            };
          })
          .sort((a, b) => {
            const dayDiff = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
            if (dayDiff !== 0) return dayDiff;
            const timeDiff = parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
            if (timeDiff !== 0) return timeDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
          });

        setRows(scheduleRows);
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
            "بارگذاری تقسیم اوقات انجام نشد.",
            "Failed to load schedule.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSchedule();
    return () => {
      mounted = false;
    };
  }, [language, navigate, refreshSeed, t.statusCancelled, t.statusCompleted, t.statusDelayed, t.statusLive, t.statusMissed, t.statusReady, t.statusRescheduled, t.statusScheduled]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  const weeklyClasses = useMemo(() => {
    return rows
      .filter((row) => DAY_ORDER[row.day] !== undefined && row.time && row.time !== "-")
      .map((row) => ({
        id: row.id,
        day: row.day,
        time: row.time,
        course: row.course,
        teacher: row.teacher,
        type: row.type,
      }));
  }, [rows]);
  const upcomingClasses = useMemo(() => rows.slice(0, 12), [rows]);

  const weeklyStats = useMemo(() => {
    const scheduledCount = rows.filter((row) => row.status !== "pending").length;
    const pendingCount = rows.filter((row) => row.status === "pending").length;
    const todayDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase();
    const todayLabel = DAY_ALIASES[todayDay] || "";
    const todayCount = rows.filter((row) => row.day === todayLabel).length;

    return [
      {
        value: String(scheduledCount),
        label: t.weeklyClasses,
        icon: "graduation",
      },
      {
        value: String(todayCount),
        label: t.todayClasses,
        icon: "video",
      },
      {
        value: String(Math.max(0, scheduledCount - todayCount)),
        label: t.upcomingClasses,
        icon: "list",
      },
      {
        value: String(pendingCount),
        label: t.pending,
        icon: "pending",
      },
    ];
  }, [rows, t.pending, t.todayClasses, t.upcomingClasses, t.weeklyClasses]);

  if (isRedirecting) return null;

  return (
    <StudentLayout language={language} user={user}>
      <div className="mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link
          className="transition hover:text-primary-700"
          to="/student/dashboard"
        >
          {t.dashboard}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{t.schedule}</span>
      </div>

      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{t.schedule}</h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {t.scheduleSubtitle}
          </p>
        </div>
      </div>

      {!googleStatus.loading ? (
        <div
          className={`mb-6 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            googleStatus.connected
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                googleStatus.connected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <CalendarCheck2 size={21} />
            </span>
            <div>
              <p className="font-black text-slate-950">
                {googleStatus.connected
                  ? isFa
                    ? "تقویم گوگل متصل است"
                    : "Google Calendar is connected"
                  : isFa
                    ? "جلسات را در تقویم گوگل دریافت کنید"
                    : "Receive sessions in Google Calendar"}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                {googleStatus.connected
                  ? isFa
                    ? `جلسات جدید و تغییرات آن‌ها خودکار با ${googleStatus.googleEmail || "حساب گوگل شما"} همگام می‌شود.`
                    : `New sessions and changes sync automatically with ${googleStatus.googleEmail || "your Google account"}.`
                  : isFa
                    ? "برای دریافت یادآوری، تغییر زمان و حذف خودکار جلسات لغوشده، حساب گوگل خود را متصل کنید."
                    : "Connect Google to receive reminders, time changes, and automatic removal of cancelled sessions."}
              </p>
            </div>
          </div>
          {!googleStatus.connected ? (
            <button
              type="button"
              onClick={connectGoogleCalendar}
              disabled={connectingGoogle}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70"
            >
              {connectingGoogle ? <Loader2 size={17} className="animate-spin" /> : null}
              {googleStatus.reconnectRequired
                ? isFa
                  ? "اتصال دوباره"
                  : "Reconnect Google"
                : isFa
                  ? "اتصال تقویم گوگل"
                  : "Connect Google Calendar"}
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
          {t.loading}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshSeed((value) => value + 1)} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black ring-1 ring-rose-200">
            {isFa ? "تلاش دوباره" : "Try again"}
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-6">
            <div className="min-w-0">
              <WeeklyTimetable
                classes={weeklyClasses}
                language={language}
                onClassClick={setSelectedClass}
              />
            </div>
            <div className="min-w-0">
              <ScheduleUpcomingTable
                classes={upcomingClasses}
                language={language}
                onOpenDetails={setSelectedClass}
              />
            </div>
          </div>

          <div className="mb-6 mt-6">
            <WeeklySummaryCard stats={weeklyStats} language={language} />
          </div>
        </>
      ) : null}
      <div className="h-8" aria-hidden="true" />
      <ClassDetailsModal
        isOpen={!!selectedClass}
        onClose={() => setSelectedClass(null)}
        classData={selectedClass}
        language={language}
      />
    </StudentLayout>
  );
}
