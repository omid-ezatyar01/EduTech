import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Filter,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout.jsx";
import TeacherPageLoader from "../components/common/TeacherPageLoader.jsx";
import useTeacherLanguage from "../hooks/useTeacherLanguage.js";
import { getAuthUser } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";

const EMPTY_DATA = { average: 0, total: 0, distribution: {}, reviews: [] };

const fetchFeedback = async () => {
  const response = await fetch(`${getApiBase()}/teacher/feedback`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });
  const result = await parseJsonResponse(response);
  return result?.data || EMPTY_DATA;
};

const statusMeta = (status, isFa) => {
  if (status === "published") {
    return { label: isFa ? "منتشرشده" : "Published", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" };
  }
  if (status === "hidden") {
    return { label: isFa ? "پنهان" : "Hidden", className: "bg-slate-100 text-slate-700 ring-slate-600/15" };
  }
  return { label: isFa ? "در انتظار بررسی" : "Pending", className: "bg-amber-50 text-amber-700 ring-amber-600/15" };
};

const formatDate = (value, isFa) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(isFa ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function Stars({ value, size = 16 }) {
  return (
    <span className="inline-flex gap-0.5" dir="ltr" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= value ? "text-amber-400" : "text-slate-200"}
          fill="currentColor"
        />
      ))}
    </span>
  );
}

export default function TeacherFeedback() {
  const { language, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const teacher = useMemo(() => getAuthUser() || {}, []);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [busyAction, setBusyAction] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      setData(await fetchFeedback());
      setError("");
    } catch (err) {
      setError(err?.message || (isFa ? "دریافت بازخوردها ناموفق بود." : "Unable to load feedback."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isFa]);

  useEffect(() => {
    let active = true;
    fetchFeedback()
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err?.message || "Unable to load feedback.");
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
    setBusyAction(key);
    setError("");
    try {
      await request();
      await load();
    } catch (err) {
      setError(err?.message || (isFa ? "انجام عملیات ناموفق بود." : "The action failed."));
    } finally {
      setBusyAction("");
    }
  };

  const reply = (review) => runAction(`reply-${review._id}`, async () => {
    const response = await fetch(`${getApiBase()}/teacher/feedback/${review._id}/reply`, {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ reply: drafts[review._id] ?? review.teacherReply ?? "" }),
    });
    await parseJsonResponse(response);
  });

  const setVisibility = (review) => runAction(`visibility-${review._id}`, async () => {
    const response = await fetch(`${getApiBase()}/teacher/feedback/${review._id}/visibility`, {
      method: "PATCH",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ hidden: review.moderationStatus !== "hidden" }),
    });
    await parseJsonResponse(response);
  });

  const remove = (review) => {
    const confirmed = window.confirm(isFa ? "این نظر و امتیاز برای همیشه حذف شود؟" : "Permanently remove this review and rating?");
    if (!confirmed) return;
    runAction(`delete-${review._id}`, async () => {
      const response = await fetch(`${getApiBase()}/teacher/feedback/${review._id}`, {
        method: "DELETE",
        headers: buildAuthHeaders(),
      });
      await parseJsonResponse(response);
    });
  };

  const reviews = useMemo(() => (Array.isArray(data.reviews) ? data.reviews : []), [data.reviews]);
  const filteredReviews = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return reviews.filter((review) => {
      if (statusFilter !== "all" && review.moderationStatus !== statusFilter) return false;
      if (!needle) return true;
      return [review.studentName, review.courseTitle, review.comment]
        .some((value) => String(value || "").toLocaleLowerCase().includes(needle));
    });
  }, [query, reviews, statusFilter]);

  const publishedCount = reviews.filter((review) => review.moderationStatus === "published").length;
  const hiddenCount = reviews.filter((review) => review.moderationStatus === "hidden").length;
  const repliedCount = reviews.filter((review) => String(review.teacherReply || "").trim()).length;

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <main className={`space-y-5 ${isFa ? "text-right" : "text-left"}`}>
        <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B4FD8]/10 text-[#0B4FD8]">
                <MessageSquareHeart size={22} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900">{isFa ? "بازخورد شاگردان" : "Student Feedback"}</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                  {isFa ? "امتیازها، دیدگاه‌ها و پاسخ‌های خود را از یک مکان مدیریت کنید." : "Review ratings, learner comments, and your public replies in one place."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-sm font-bold text-slate-700 transition hover:border-[#0B4FD8]/30 hover:bg-white hover:text-[#0B4FD8] disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              {isFa ? "بروزرسانی" : "Refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={retry} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-rose-200">
              {isFa ? "تلاش دوباره" : "Try again"}
            </button>
          </div>
        ) : null}

        {loading ? (
          <TeacherPageLoader label={isFa ? "در حال دریافت بازخوردها" : "Loading feedback"} />
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
              <article className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <span className="text-4xl font-black leading-none">{data.total ? Number(data.average || 0).toFixed(1) : "—"}</span>
                  <span className="mt-1 text-xs font-black">/ 5</span>
                </div>
                <div className="min-w-0">
                  <Stars value={Math.round(Number(data.average || 0))} size={19} />
                  <p className="mt-2 text-sm font-black text-slate-900">{isFa ? "میانگین امتیاز شما" : "Your average rating"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {isFa ? `بر اساس ${data.total || 0} نظر تأییدشده شاگردان` : `Based on ${data.total || 0} verified learner reviews`}
                  </p>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-black text-slate-900">{isFa ? "توزیع امتیازها" : "Rating distribution"}</h2>
                <div className="mt-4 space-y-2.5">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = Number(data.distribution?.[rating] || 0);
                    const percentage = data.total ? Math.round((count / data.total) * 100) : 0;
                    return (
                      <div key={rating} className="grid grid-cols-[34px_1fr_42px] items-center gap-3 text-xs font-bold text-slate-600" dir="ltr">
                        <span className="inline-flex items-center gap-1">{rating}<Star size={12} className="text-amber-400" fill="currentColor" /></span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-right tabular-nums">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [isFa ? "مجموع نظرها" : "Total reviews", data.total || 0, "text-blue-700 bg-blue-50"],
                [isFa ? "منتشرشده" : "Published", publishedCount, "text-emerald-700 bg-emerald-50"],
                [isFa ? "پاسخ‌داده‌شده" : "Replied", repliedCount, "text-violet-700 bg-violet-50"],
                [isFa ? "پنهان" : "Hidden", hiddenCount, "text-slate-700 bg-slate-100"],
              ].map(([label, value, tone]) => (
                <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${tone}`}>{label}</span>
                  <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">{isFa ? "نظرهای شاگردان" : "Learner reviews"}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {isFa ? `${filteredReviews.length} نظر نمایش داده می‌شود` : `Showing ${filteredReviews.length} reviews`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative block min-w-0 sm:w-64">
                      <Search size={17} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isFa ? "right-3" : "left-3"}`} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={isFa ? "جستجوی شاگرد، کورس یا نظر…" : "Search student, course, or review…"}
                        className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 ${isFa ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                      />
                    </label>
                    <label className="relative block sm:w-48">
                      <Filter size={16} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${isFa ? "right-3" : "left-3"}`} />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className={`h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 ${isFa ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                      >
                        <option value="all">{isFa ? "همه وضعیت‌ها" : "All statuses"}</option>
                        <option value="published">{isFa ? "منتشرشده" : "Published"}</option>
                        <option value="pending">{isFa ? "در انتظار" : "Pending"}</option>
                        <option value="hidden">{isFa ? "پنهان" : "Hidden"}</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50/60 p-4 sm:p-5">
                {filteredReviews.map((review) => {
                  const meta = statusMeta(review.moderationStatus, isFa);
                  const replyValue = drafts[review._id] ?? review.teacherReply ?? "";
                  const replying = busyAction === `reply-${review._id}`;
                  return (
                    <article key={review._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-teal-100 text-sm font-black text-blue-700">
                            {String(review.studentName || "S").trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-slate-950">{review.studentName || (isFa ? "شاگرد" : "Student")}</h3>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${meta.className}`}>{meta.label}</span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-500">{review.courseTitle}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(review.createdAt, isFa)}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                          <Stars value={Number(review.teacherRating || 0)} size={14} />
                          <strong className="text-sm text-amber-700" dir="ltr">{review.teacherRating}/5</strong>
                        </div>
                      </div>

                      {review.comment ? (
                        <blockquote className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-700">
                          {review.comment}
                        </blockquote>
                      ) : (
                        <p className="mt-4 text-xs font-semibold italic text-slate-400">{isFa ? "این امتیاز بدون متن ثبت شده است." : "This rating was submitted without a written review."}</p>
                      )}

                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                        <label className="mb-2 block text-xs font-black text-slate-700">{isFa ? "پاسخ عمومی شما" : "Your public reply"}</label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <textarea
                            value={replyValue}
                            onChange={(event) => setDrafts((current) => ({ ...current, [review._id]: event.target.value }))}
                            maxLength={500}
                            rows={2}
                            placeholder={isFa ? "پاسخ محترمانه خود را بنویسید…" : "Write a thoughtful response…"}
                            className="min-h-[46px] min-w-0 flex-1 resize-y rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-semibold leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => reply(review)}
                            disabled={replying || replyValue.length > 500}
                            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Send size={15} />
                            {replying ? (isFa ? "در حال ثبت…" : "Saving…") : (isFa ? "ثبت پاسخ" : "Save reply")}
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-slate-400" dir="ltr">{replyValue.length}/500</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => setVisibility(review)}
                          disabled={busyAction === `visibility-${review._id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"
                        >
                          {review.moderationStatus === "hidden" ? <Eye size={15} /> : <EyeOff size={15} />}
                          {review.moderationStatus === "hidden" ? (isFa ? "درخواست نمایش دوباره" : "Request republish") : (isFa ? "پنهان کردن" : "Hide review")}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(review)}
                          disabled={busyAction === `delete-${review._id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          <Trash2 size={15} />
                          {isFa ? "حذف همیشگی" : "Delete permanently"}
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!filteredReviews.length ? (
                  <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquareHeart size={25} /></span>
                    <h3 className="mt-4 font-black text-slate-800">{isFa ? "نظری پیدا نشد" : "No reviews found"}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {reviews.length ? (isFa ? "فیلتر یا عبارت جستجو را تغییر دهید." : "Try changing the filter or search term.") : (isFa ? "هنوز نظری برای تدریس شما ثبت نشده است." : "No learner has reviewed your teaching yet.")}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </TeacherLayout>
  );
}
