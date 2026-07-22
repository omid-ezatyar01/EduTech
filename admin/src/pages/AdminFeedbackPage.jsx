import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  GraduationCap,
  Lightbulb,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Send,
  Star,
} from "lucide-react";
import { buildAuthHeaders, getApiBase } from "../../services/http.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const EMPTY_DATA = { ratings: [], feedback: [] };

const copy = {
  fa: {
    title: "نظرات و بازخورد",
    subtitle: "نظرهای کورس و استاد را مدیریت کنید و بازخوردهای پلتفرم را تا زمان حل‌شدن پیگیری نمایید.",
    refresh: "تازه‌سازی",
    retry: "تلاش دوباره",
    loading: "در حال بارگذاری نظرات و بازخوردها",
    ratingsTab: "نظرهای کورس و استاد",
    platformTab: "بازخورد پلتفرم",
    totalReviews: "مجموع نظرها",
    published: "منتشرشده",
    reported: "گزارش‌شده",
    newFeedback: "بازخورد جدید",
    searchReviews: "جستجوی شاگرد، استاد، کورس یا نظر…",
    searchFeedback: "جستجوی کاربر، پیام یا صفحه…",
    allStatuses: "همه وضعیت‌ها",
    allTypes: "همه نوع‌ها",
    allReviews: "همه نظرها",
    courseReview: "نظر کورس",
    teacherReview: "نظر استاد",
    pending: "در انتظار",
    hidden: "پنهان",
    publish: "انتشار",
    hide: "پنهان کردن",
    reports: "گزارش",
    student: "شاگرد",
    teacher: "استاد",
    course: "کورس",
    anonymous: "کاربر ناشناس",
    noComment: "این امتیاز بدون متن ثبت شده است.",
    noReviews: "نظری مطابق فیلترها پیدا نشد.",
    noFeedback: "بازخوردی مطابق فیلترها پیدا نشد.",
    showing: "مورد نمایش داده می‌شود",
    feedback: "بازخورد",
    suggestion: "پیشنهاد",
    complaint: "شکایت",
    bug: "مشکل فنی",
    new: "جدید",
    reviewing: "در حال بررسی",
    resolved: "حل‌شده",
    page: "صفحه",
    adminNote: "یادداشت داخلی مدیر",
    notePlaceholder: "یادداشت پیگیری را برای تیم مدیریت بنویسید…",
    saveNote: "ذخیره یادداشت",
    saving: "در حال ذخیره…",
    loadError: "دریافت نظرات و بازخوردها ناموفق بود.",
    actionError: "انجام عملیات ناموفق بود.",
    teacherReply: "پاسخ استاد",
  },
  en: {
    title: "Reviews & Feedback",
    subtitle: "Moderate course and teacher reviews, and track platform feedback through resolution.",
    refresh: "Refresh",
    retry: "Try again",
    loading: "Loading reviews and feedback",
    ratingsTab: "Course & teacher reviews",
    platformTab: "Platform feedback",
    totalReviews: "Total reviews",
    published: "Published",
    reported: "Reported",
    newFeedback: "New feedback",
    searchReviews: "Search student, teacher, course, or review…",
    searchFeedback: "Search user, message, or page…",
    allStatuses: "All statuses",
    allTypes: "All types",
    allReviews: "All reviews",
    courseReview: "Course review",
    teacherReview: "Teacher review",
    pending: "Pending",
    hidden: "Hidden",
    publish: "Publish",
    hide: "Hide",
    reports: "reports",
    student: "Student",
    teacher: "Teacher",
    course: "Course",
    anonymous: "Anonymous user",
    noComment: "This rating was submitted without a written review.",
    noReviews: "No reviews match the selected filters.",
    noFeedback: "No feedback matches the selected filters.",
    showing: "items shown",
    feedback: "Feedback",
    suggestion: "Suggestion",
    complaint: "Complaint",
    bug: "Technical issue",
    new: "New",
    reviewing: "Reviewing",
    resolved: "Resolved",
    page: "Page",
    adminNote: "Internal admin note",
    notePlaceholder: "Add a follow-up note for the admin team…",
    saveNote: "Save note",
    saving: "Saving…",
    loadError: "Could not load reviews and feedback.",
    actionError: "The action could not be completed.",
    teacherReply: "Teacher reply",
  },
};

const parseResponse = async (response) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || "Request failed");
  return result;
};

const fetchFeedbackCenter = async () => {
  const response = await fetch(`${getApiBase()}/admin/feedback`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const result = await parseResponse(response);
  return result?.data || EMPTY_DATA;
};

const formatDate = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const ratingValue = (item) => Number(item.reviewType === "teacher" ? item.teacherRating || item.rating : item.courseRating || item.rating || 0);

function Stars({ value }) {
  return (
    <span className="inline-flex gap-0.5" dir="ltr" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={14} fill="currentColor" className={star <= value ? "text-amber-400" : "text-slate-200"} />
      ))}
    </span>
  );
}

const moderationMeta = (status, text) => {
  if (status === "published") return { label: text.published, tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" };
  if (status === "hidden") return { label: text.hidden, tone: "bg-slate-100 text-slate-700 ring-slate-600/15" };
  return { label: text.pending, tone: "bg-amber-50 text-amber-700 ring-amber-600/15" };
};

const feedbackTypeIcon = { feedback: MessageSquareHeart, suggestion: Lightbulb, complaint: AlertTriangle, bug: Bug };

export default function AdminFeedbackPage() {
  const { language, isRTL } = useAdminI18n();
  const text = copy[language === "fa" ? "fa" : "en"];
  const [data, setData] = useState(EMPTY_DATA);
  const [tab, setTab] = useState("ratings");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [busyKey, setBusyKey] = useState("");
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await fetchFeedbackCenter());
      setError("");
    } catch (err) {
      setError(err?.message || text.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    let active = true;
    fetchFeedbackCenter()
      .then((nextData) => {
        if (active) setData(nextData);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Could not load reviews and feedback.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
  };

  const retry = () => {
    setLoading(true);
    load();
  };

  const runAction = async (key, request) => {
    setBusyKey(key);
    setError("");
    try {
      await request();
      await load();
    } catch (err) {
      setError(err?.message || text.actionError);
    } finally {
      setBusyKey("");
    }
  };

  const moderate = (item, status) => runAction(`rating-${item._id}-${status}`, async () => {
    const response = await fetch(`${getApiBase()}/admin/feedback/ratings/${item._id}`, {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    await parseResponse(response);
  });

  const updateFeedback = (item, status = item.status) => runAction(`feedback-${item._id}-${status}`, async () => {
    const response = await fetch(`${getApiBase()}/admin/feedback/platform/${item._id}`, {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ status, adminNote: notes[item._id] ?? item.adminNote ?? "" }),
    });
    await parseResponse(response);
  });

  const ratings = useMemo(() => (Array.isArray(data.ratings) ? data.ratings : []), [data.ratings]);
  const platformFeedback = useMemo(() => (Array.isArray(data.feedback) ? data.feedback : []), [data.feedback]);

  const filteredRatings = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...ratings]
      .filter((item) => statusFilter === "all" || item.moderationStatus === statusFilter)
      .filter((item) => typeFilter === "all" || item.reviewType === typeFilter)
      .filter((item) => !needle || [item.studentName, item.teacherName, item.courseTitle, item.eligibilityCourseTitle, item.comment]
        .some((value) => String(value || "").toLocaleLowerCase().includes(needle)))
      .sort((left, right) => Number(right.reportCount || 0) - Number(left.reportCount || 0) || new Date(right.createdAt) - new Date(left.createdAt));
  }, [query, ratings, statusFilter, typeFilter]);

  const filteredFeedback = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return platformFeedback
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => typeFilter === "all" || item.type === typeFilter)
      .filter((item) => !needle || [item.userId?.name, item.userId?.email, item.message, item.page]
        .some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
  }, [platformFeedback, query, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    published: ratings.filter((item) => item.moderationStatus === "published").length,
    reported: ratings.filter((item) => Number(item.reportCount || 0) > 0).length,
    newFeedback: platformFeedback.filter((item) => item.status === "new").length,
  }), [platformFeedback, ratings]);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const visibleCount = tab === "ratings" ? filteredRatings.length : filteredFeedback.length;

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className={`mx-auto w-full max-w-7xl space-y-5 ${isRTL ? "text-right" : "text-left"}`}>
      <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B4FD8]/10 text-[#0B4FD8]">
              <MessageSquareHeart size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{text.title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{text.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-white hover:text-[#0B4FD8] disabled:opacity-60 sm:self-auto">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {text.refresh}
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={retry} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5">{text.retry}</button>
        </div>
      ) : null}

      {loading ? <AdminPageLoader label={text.loading} /> : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [text.totalReviews, ratings.length, MessageSquareHeart, "bg-blue-50 text-blue-700"],
              [text.published, stats.published, CheckCircle2, "bg-emerald-50 text-emerald-700"],
              [text.reported, stats.reported, AlertTriangle, "bg-rose-50 text-rose-700"],
              [text.newFeedback, stats.newFeedback, Send, "bg-violet-50 text-violet-700"],
            ].map(([label, value, Icon, tone]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>
                <p className="mt-3 text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => changeTab("ratings")} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === "ratings" ? "bg-[#0B4FD8] text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                  {text.ratingsTab} <span className="opacity-75">({ratings.length})</span>
                </button>
                <button type="button" onClick={() => changeTab("feedback")} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === "feedback" ? "bg-[#0B4FD8] text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"}`}>
                  {text.platformTab} <span className="opacity-75">({platformFeedback.length})</span>
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs font-bold text-slate-500">{visibleCount} {text.showing}</p>
                <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_180px]">
                  <label className="relative block">
                    <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? "right-3" : "left-3"}`} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "ratings" ? text.searchReviews : text.searchFeedback} className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`} />
                  </label>
                  <label className="relative block">
                    <Filter size={15} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? "right-3" : "left-3"}`} />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:border-blue-400 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}>
                      <option value="all">{text.allStatuses}</option>
                      {tab === "ratings" ? <><option value="pending">{text.pending}</option><option value="published">{text.published}</option><option value="hidden">{text.hidden}</option></> : <><option value="new">{text.new}</option><option value="reviewing">{text.reviewing}</option><option value="resolved">{text.resolved}</option></>}
                    </select>
                  </label>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400">
                    <option value="all">{tab === "ratings" ? text.allReviews : text.allTypes}</option>
                    {tab === "ratings" ? <><option value="course">{text.courseReview}</option><option value="teacher">{text.teacherReview}</option></> : <><option value="feedback">{text.feedback}</option><option value="suggestion">{text.suggestion}</option><option value="complaint">{text.complaint}</option><option value="bug">{text.bug}</option></>}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50/60 p-4 sm:p-5">
              {tab === "ratings" ? filteredRatings.map((item) => {
                const isTeacherReview = item.reviewType === "teacher";
                const score = ratingValue(item);
                const status = moderationMeta(item.moderationStatus, text);
                const reportCount = Number(item.reportCount || 0);
                return (
                  <article key={`${item.reviewType}-${item._id}`} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${reportCount ? "border-rose-200" : "border-slate-200"}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isTeacherReview ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                          {isTeacherReview ? <GraduationCap size={20} /> : <BookOpen size={20} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black text-slate-950">{isTeacherReview ? item.teacherName : item.courseTitle}</h2>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isTeacherReview ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{isTeacherReview ? text.teacherReview : text.courseReview}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${status.tone}`}>{status.label}</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-500">{text.student}: {item.studentName || text.anonymous}{!isTeacherReview && item.teacherName ? ` · ${text.teacher}: ${item.teacherName}` : ""}</p>
                          {isTeacherReview && item.courseTitle ? <p className="mt-1 text-xs font-semibold text-slate-400">{text.course}: {item.courseTitle}</p> : null}
                          <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(item.createdAt, language)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Stars value={score} /><strong className="text-sm text-amber-700" dir="ltr">{score}/5</strong></div>
                    </div>
                    {item.comment ? <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">{item.comment}</p> : <p className="mt-4 text-xs font-semibold italic text-slate-400">{text.noComment}</p>}
                    {item.teacherReply ? <div className="mt-3 rounded-xl border-s-4 border-s-blue-400 bg-blue-50/60 px-4 py-3"><p className="text-[11px] font-black text-blue-700">{text.teacherReply}</p><p className="mt-1 text-sm font-semibold text-slate-700">{item.teacherReply}</p></div> : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <button type="button" onClick={() => moderate(item, "published")} disabled={item.moderationStatus === "published" || Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"><Eye size={14} />{text.publish}</button>
                      <button type="button" onClick={() => moderate(item, "hidden")} disabled={item.moderationStatus === "hidden" || Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"><EyeOff size={14} />{text.hide}</button>
                      {reportCount ? <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-700"><AlertTriangle size={14} />{reportCount} {text.reports}</span> : null}
                    </div>
                  </article>
                );
              }) : filteredFeedback.map((item) => {
                const TypeIcon = feedbackTypeIcon[item.type] || MessageSquareHeart;
                const note = notes[item._id] ?? item.adminNote ?? "";
                return (
                  <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><TypeIcon size={20} /></span>
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">{item.userId?.name || text.anonymous}</h2><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">{text[item.type] || item.type}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{item.userId?.email || ""}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(item.createdAt, language)}</p></div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Stars value={Number(item.score || 0)} /><strong className="text-sm text-amber-700" dir="ltr">{item.score}/5</strong></div>
                    </div>
                    {item.page ? <p className="mt-3 text-xs font-bold text-slate-500">{text.page}: <span dir="ltr">{item.page}</span></p> : null}
                    {item.message ? <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">{item.message}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["new", "reviewing", "resolved"].map((status) => <button type="button" key={status} onClick={() => updateFeedback(item, status)} disabled={Boolean(busyKey)} className={`rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${item.status === status ? "bg-[#0B4FD8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{text[status]}</button>)}
                    </div>
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                      <label className="text-xs font-black text-slate-700">{text.adminNote}</label>
                      <textarea value={note} onChange={(event) => setNotes((current) => ({ ...current, [item._id]: event.target.value }))} maxLength={1000} rows={2} placeholder={text.notePlaceholder} className="mt-2 w-full resize-y rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-semibold leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold text-slate-400" dir="ltr">{note.length}/1000</span><button type="button" onClick={() => updateFeedback(item)} disabled={Boolean(busyKey)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4FD8] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Send size={13} />{busyKey.startsWith(`feedback-${item._id}`) ? text.saving : text.saveNote}</button></div>
                    </div>
                  </article>
                );
              })}

              {visibleCount === 0 ? <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 text-center"><span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquareHeart size={25} /></span><p className="mt-4 text-sm font-black text-slate-700">{tab === "ratings" ? text.noReviews : text.noFeedback}</p></div> : null}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
