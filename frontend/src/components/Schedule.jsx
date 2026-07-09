import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const mockStudent = {
  id: 1,
  nameFa: "امید عزتیار",
  email: "student@edutech.com",
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
  const text = `${course.title || ""} ${course.shortDescription || ""} ${course.description || ""}`.toLowerCase();
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
  const navigate = useNavigate();

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
            const time = hasValidTime
              ? `${startAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })} - ${endAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`
              : "-";

            const status =
              session.status === "cancelled"
                ? "pending"
                : session.status === "completed"
                  ? "scheduled"
                  : session.status === "live"
                    ? "scheduled"
                    : "scheduled";
            const statusLabel =
              session.status === "cancelled"
                ? t.statusCancelled
                : session.status === "completed"
                  ? t.statusCompleted
                  : session.status === "live"
                    ? t.statusLive
                    : t.statusScheduled;

            return {
              id: session._id,
              course: session.course?.title || "Course",
              date: day,
              day,
              time,
              teacher: session.course?.teacherName || "Teacher",
              status,
              statusLabel,
              meetLink: session.meetingLink || "",
              type: inferCourseType({
                title: session.course?.title || "",
                shortDescription: session.description || "",
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
  }, [language, navigate, refreshSeed, t.statusCancelled, t.statusCompleted, t.statusLive, t.statusScheduled]);

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

      {loading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
          {t.loading}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-[24px] border border-rose-200 bg-rose-50 py-6 text-center text-sm font-bold text-rose-700">
          {error}
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
