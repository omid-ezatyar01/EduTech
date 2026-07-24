import { useEffect, useMemo, useState } from "react";
import { Star, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import CurrentLiveClassCard from "./CurrentLiveClassCard.jsx";
import CountdownCard from "./CountdownCard.jsx";
import ClassRulesCard from "./ClassRulesCard.jsx";
import UpcomingClassesTable from "./UpcomingClassesTable.jsx";
import HelpCard from "./HelpCard.jsx";
import InfoCard from "./InfoCard.jsx";
import { Info } from "lucide-react";
import {
  fetchStudentLiveSessionLink,
  fetchStudentLiveSessions,
  joinStudentLiveSession,
  submitCourseRating,
} from "../../services/courseService.js";
import { resolveAvatarUrl } from "../utils/avatar";
import { clearAuth, getAuthUser, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import { getDualTimeDetails } from "../utils/timezone.js";

const mockStudent = {
  id: "",
  nameFa: "",
  email: "",
  avatar: "",
};

function RatingStarsInput({ value, onChange, label }) {
  return (
    <div>
      <p className="text-sm font-black text-slate-800">{label}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            className={`rounded-lg p-1 transition ${
              rating <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
            }`}
            onClick={() => onChange(rating)}
            aria-label={`${label} ${rating}`}
          >
            <Star className="h-7 w-7" fill="currentColor" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CourseRatingModal({
  prompt,
  language,
  values,
  onChange,
  onClose,
  onSubmit,
  submitting,
  error,
}) {
  if (!prompt) return null;
  const isFa = language === "fa";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-primary-700">
              {isFa ? "امتیازدهی واقعی" : "Real rating"}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {isFa ? "نظر شما درباره کورس و استاد" : "Rate the course and teacher"}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            {isFa ? "بعدا" : "Later"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="font-black text-slate-900">{prompt.courseTitle}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {isFa ? "استاد" : "Teacher"}: {prompt.teacherName || "-"}
          </p>
          <p className="mt-2 text-xs font-bold text-primary-700">
            {isFa
              ? `بعد از اشتراک در ${prompt.requiredJoinedClasses || 2} جلسه، می‌توانید برای کورس و استاد امتیاز و نظر ثبت کنید.`
              : `After joining ${prompt.requiredJoinedClasses || 2} sessions, you can rate and comment on the course and teacher.`}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <RatingStarsInput
            label={isFa ? "امتیاز کورس" : "Course rating"}
            value={values.courseRating}
            onChange={(rating) => onChange({ ...values, courseRating: rating })}
          />
          <RatingStarsInput
            label={isFa ? "امتیاز استاد" : "Teacher rating"}
            value={values.teacherRating}
            onChange={(rating) => onChange({ ...values, teacherRating: rating })}
          />
          <label className="block">
            <span className="text-sm font-black text-slate-800">
              {isFa ? "نظر اختیاری" : "Optional comment"}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-primary-400"
              value={values.comment}
              onChange={(event) => onChange({ ...values, comment: event.target.value })}
              maxLength={500}
            />
            <p className="mt-2 text-xs font-bold text-slate-500">
              {values.comment.length}/500
            </p>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-black text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting
            ? isFa ? "در حال ثبت" : "Submitting"
            : isFa ? "ثبت امتیاز" : "Submit rating"}
        </button>
      </div>
    </div>
  );
}

const getLocalizedCourseTitle = (course = {}, isFa = true) => {
  const faTitle = String(course?.titleFa || "").trim();
  const enTitle = String(course?.titleEn || "").trim();
  const genericTitle = String(course?.title || "").trim();
  if (isFa) return faTitle || genericTitle || "کورس";
  return enTitle || genericTitle || "Course";
};

const getLocalizedTopicTitle = (topic = "", isFa = true) => {
  const raw = String(topic || "").trim();
  if (!raw) return isFa ? "موضوع جلسه" : "Session topic";
  if (/^js\s+live\s+session$/i.test(raw)) {
    return isFa ? "جلسه زنده جاوااسکریپت" : "JS Live Session";
  }
  return raw;
};

const formatLocalizedDate = (date, language) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  const locale = language === "fa" ? "fa-AF-u-ca-persian" : "en-US";

  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";

  if (!year && !month && !day) return "-";
  if (!weekday) return `${year} ${month} ${day}`.trim();

  return `${year} ${month} ${day}, ${weekday}`.trim();
};

const getEffectiveSessionStatus = (session = {}) => {
  const rawStatus = String(session.status || "scheduled").toLowerCase();
  const supportedStatuses = new Set([
    "scheduled",
    "ready",
    "live",
    "delayed",
    "completed",
    "cancelled",
    "rescheduled",
    "missed",
    "pending",
  ]);
  return supportedStatuses.has(rawStatus) ? rawStatus : "scheduled";
};

const getSessionSortTime = (row = {}) => {
  const startTime = new Date(row.startAt || row.createdAt || 0).getTime();
  return Number.isFinite(startTime) ? startTime : 0;
};

export default function LiveClass({ language = "fa" }) {
  const isFa = language === "fa";
  const t = useMemo(
    () => ({
      topicFallback: isFa ? "موضوع جلسه" : "Session topic",
      dashboard: isFa ? "داشبورد" : "Dashboard",
      liveClass: isFa ? "صنف آنلاین" : "Live Class",
      intro: isFa
        ? "صنف‌های آنلاین امروز و برنامه صنف‌های آینده شما"
        : "Today's live classes and your upcoming class schedule",
      liveNote: isFa
        ? "تمام صنف‌های آنلاین از طریق Google Meet برگزار می‌شود."
        : "All live classes are held via Google Meet.",
      loading: isFa ? "در حال بارگذاری صنف آنلاین" : "Loading live class",
      noActiveClass: isFa
        ? "هنوز صنف فعالی برای شما یافت نشد."
        : "No active class found for you yet.",
      noRegisteredClass: isFa
        ? "هنوز صنف ثبت شده‌ای برای شما وجود ندارد."
        : "You do not have any registered classes yet.",
      importantNoteTitle: isFa ? "نکته مهم" : "Important Note",
      importantNoteText: isFa
        ? "لینک ورود زمانی فعال می‌شود که استاد جلسه را شروع کند و تا پایان رسمی همان جلسه در دسترس می‌ماند."
        : "The join link becomes active when the teacher starts the session and remains available until the session is officially ended.",
      joining: isFa ? "در حال ورود به صنف" : "Joining class",
      statusLabels: {
        scheduled: isFa ? "برنامه‌ریزی شده" : "Scheduled",
        ready: isFa ? "آماده شروع" : "Ready to start",
        live: isFa ? "در حال برگزاری" : "Live now",
        delayed: isFa ? "با تأخیر" : "Delayed",
        completed: isFa ? "پایان یافته" : "Ended",
        cancelled: isFa ? "لغو شده" : "Cancelled",
        rescheduled: isFa ? "زمان‌بندی مجدد" : "Rescheduled",
        missed: isFa ? "برگزار نشده" : "Missed",
        pending: isFa ? "در انتظار تایید" : "Pending approval",
      },
    }),
    [isFa],
  );
  const user = getAuthUser() || mockStudent;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [ratingPrompt, setRatingPrompt] = useState(null);
  const [ratingValues, setRatingValues] = useState({
    courseRating: 0,
    teacherRating: 0,
    comment: "",
  });
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSessions = async () => {
      try {
        setLoading(true);
        setError("");
        const { sessions } = await fetchStudentLiveSessions({
          page: 1,
          limit: 100,
        });
        if (!mounted) return;
        const statusLabelMap = t.statusLabels;

        const mapped = (Array.isArray(sessions) ? sessions : [])
          .map((session) => {
            const startAt = new Date(session.startAt);
            const endAt = new Date(session.endAt);
            const isTimeValid =
              !Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime());
            const effectiveStatus = getEffectiveSessionStatus(session);

            const dateLabel = isTimeValid
              ? formatLocalizedDate(startAt, language)
              : "-";
            const dualTime = isTimeValid
              ? getDualTimeDetails(
                  startAt,
                  endAt,
                  session.timezone || "Asia/Kabul",
                  language,
                )
              : null;
            const timeLabel = dualTime?.localRange || "-";

            return {
              id: session._id,
              courseTitle: getLocalizedCourseTitle(session.course, isFa),
              course: getLocalizedCourseTitle(session.course, isFa),
              teacher: session.course?.teacherName || (isFa ? "استاد" : "Teacher"),
              teacherAvatar: resolveAvatarUrl(""),
              topic: getLocalizedTopicTitle(session.title, isFa) || t.topicFallback,
              date: dateLabel,
              time: timeLabel,
              localTime: dualTime?.localRange || "-",
              teacherTime: dualTime?.teacherRange || "-",
              localTimeZone: dualTime?.localZone || "",
              teacherTimeZone: dualTime?.teacherZone || "",
              platform:
                session.platform === "zoom"
                  ? "Zoom"
                  : session.platform === "physical"
                    ? "Physical"
                    : "Google Meet",
              status: effectiveStatus,
              statusLabel: statusLabelMap[effectiveStatus] || statusLabelMap.scheduled,
              meetLink: session.meetingLink || null,
              joinEnabled: Boolean(session.joinEnabled),
              linkMessage: session?.linkAvailability?.message || "",
              linkOpenAt: session?.linkAvailability?.openAt || null,
              linkCloseAt: session?.linkAvailability?.closeAt || null,
              startAt: session.startAt || null,
              endAt: session.endAt || null,
              createdAt: session.createdAt || session.startAt || 0,
            };
          })
          .sort((a, b) => getSessionSortTime(a) - getSessionSortTime(b));

        setRows(mapped);
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
            "بارگذاری صنف‌های زنده انجام نشد.",
            "Failed to load live classes.",
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSessions();
    return () => {
      mounted = false;
    };
  }, [isFa, language, navigate, refreshSeed, t]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((prev) => prev + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  useEffect(() => {
    const now = nowMs || Date.now();
    const nextRefreshAt = rows
      .flatMap((row) => [row.linkOpenAt, row.linkCloseAt])
      .map((value) => new Date(value).getTime())
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now)
      .sort((a, b) => a - b)[0];

    if (!nextRefreshAt) return undefined;

    const delay = Math.min(Math.max(nextRefreshAt - now + 800, 1000), 60_000);
    const timeout = setTimeout(() => {
      setRefreshSeed((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timeout);
  }, [nowMs, rows]);

  const currentClass = useMemo(() => {
    const now = nowMs || 0;
    return (
      rows.find((row) => row.status === "live") ||
      rows.find((row) => ["ready", "delayed"].includes(row.status)) ||
      rows.find((row) => {
        if (row.status !== "scheduled") return false;
        const endAt = new Date(row.endAt || 0).getTime();
        return Number.isFinite(endAt) && endAt > now;
      }) || null
    );
  }, [nowMs, rows]);

  const upcomingClasses = useMemo(() => {
    const now = nowMs || Date.now();
    return rows
      .filter((row) => {
        if (
          ["cancelled", "completed", "live", "missed", "rescheduled"].includes(
            row.status,
          )
        ) {
          return false;
        }
        const startAt = new Date(row.startAt || 0).getTime();
        return Number.isFinite(startAt) && startAt > now;
      })
      .map((row) => ({
        id: row.id,
        course: row.courseTitle,
        topic: row.topic,
        date: row.date,
        time: row.time,
        teacher: row.teacher,
        status: row.status,
        statusLabel: t.statusLabels[row.status] || t.statusLabels.scheduled,
      }));
  }, [nowMs, rows, t]);
  const hasNoClasses = !currentClass && upcomingClasses.length === 0;

  const handleJoin = async (session) => {
    if (!session?.id) return;
    try {
      setJoiningId(session.id);
      const liveLinkState = await fetchStudentLiveSessionLink(session.id);
      if (!liveLinkState?.available) {
        setError(
          getLocalizedRequestErrorMessage(
            liveLinkState,
            language,
            "لینک صنف هنوز فعال نشده است.",
            "Class link is not active yet.",
          ),
        );
        return;
      }

      const joined = await joinStudentLiveSession(session.id);
      const target = joined?.meetingLink || liveLinkState?.meetLink || session.meetLink;
      setRefreshSeed((prev) => prev + 1);
      window.dispatchEvent(new Event("edutech_data_changed"));
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(
          getLocalizedRequestErrorMessage(
          err,
            language,
          "ورود به صنف ممکن نشد.",
          "Unable to join the class.",
        ),
      );
    } finally {
      setJoiningId("");
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingPrompt?.courseId || ratingSubmitting) return;
    if (!ratingValues.courseRating || !ratingValues.teacherRating) {
      setRatingError(language === "fa" ? "برای کورس و استاد امتیاز انتخاب کنید." : "Select ratings for both course and teacher.");
      return;
    }
    try {
      setRatingSubmitting(true);
      setRatingError("");
      await submitCourseRating({
        courseId: ratingPrompt.courseId,
        courseRating: ratingValues.courseRating,
        teacherRating: ratingValues.teacherRating,
        comment: ratingValues.comment,
      });
      setRatingPrompt(null);
      setRatingValues({ courseRating: 0, teacherRating: 0, comment: "" });
      setRefreshSeed((prev) => prev + 1);
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (err) {
      setRatingError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "ثبت امتیاز ممکن نشد.",
          "Unable to submit rating.",
        ),
      );
    } finally {
      setRatingSubmitting(false);
    }
  };

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
        <span className="text-slate-900">{t.liveClass}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-950">{t.liveClass}</h1>
        <p className="mt-2 text-lg font-medium text-slate-600">
          {t.intro}
        </p>
        <div className="mt-4 flex sm:inline-flex items-start sm:items-center gap-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-sm font-bold text-teal-800 shadow-sm">
          <Video size={18} className="text-teal-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>{t.liveNote}</span>
        </div>
      </div>

      {loading ? (
        <div className="mb-6 rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
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
          {hasNoClasses ? (
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                {t.noActiveClass}
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                {t.noRegisteredClass}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                {currentClass ? (
                  <CurrentLiveClassCard course={currentClass} onJoin={handleJoin} language={language} />
                ) : (
                  <div className="rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                    {t.noActiveClass}
                  </div>
                )}
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <CountdownCard course={currentClass} language={language} />
                <ClassRulesCard language={language} />
              </div>

              {upcomingClasses.length ? (
                <div className="mb-6">
                  <UpcomingClassesTable classes={upcomingClasses} language={language} />
                </div>
              ) : (
                <div className="mb-6 rounded-[24px] border border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                  {t.noRegisteredClass}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 h-full">
          <HelpCard compact language={language} />
        </div>
        <div className="min-w-0 h-full">
          <InfoCard
            title={t.importantNoteTitle}
            text={t.importantNoteText}
            icon={Info}
            compact
            bgClass="bg-primary-50"
            textClass="text-primary-800"
            iconClass="text-primary-600"
          />
        </div>
      </div>
      {joiningId ? (
        <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700">
          {t.joining}
        </div>
      ) : null}
      <CourseRatingModal
        prompt={ratingPrompt}
        language={language}
        values={ratingValues}
        onChange={setRatingValues}
        onClose={() => setRatingPrompt(null)}
        onSubmit={handleSubmitRating}
        submitting={ratingSubmitting}
        error={ratingError}
      />
      <div className="h-8" aria-hidden="true" />
    </StudentLayout>
  );
}
