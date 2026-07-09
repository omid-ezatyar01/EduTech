import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Search,
  Star,
  XCircle,
} from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const REVIEW_ROWS = [];

const statusMeta = {
  approved: { label: "Approved", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  rejected: { label: "Rejected", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const formatDate = (value) =>
  new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function RatingStars({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const active = index < rating;
        return (
          <Star
            key={index}
            size={15}
            className={active ? "text-amber-400" : "text-slate-200"}
            fill={active ? "currentColor" : "none"}
          />
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, title, value, note, tone }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="mt-2 text-sm font-normal text-slate-600">{note}</p>
    </article>
  );
}

export default function AdminReviewsPage() {
  const { t } = useAdminI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return REVIEW_ROWS.filter((review) => {
      const matchesQuery =
        !normalizedQuery ||
        [review.studentName, review.courseTitle, review.comment].some((value) =>
          String(value || "").toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = statusFilter === "all" || review.status === statusFilter;
      const matchesRating =
        ratingFilter === "all" || Number(review.rating) >= Number(ratingFilter);
      return matchesQuery && matchesStatus && matchesRating;
    });
  }, [query, ratingFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredReviews.length;
    const approved = filteredReviews.filter((item) => item.status === "approved").length;
    const pending = filteredReviews.filter((item) => item.status === "pending").length;
    const rejected = filteredReviews.filter((item) => item.status === "rejected").length;
    const averageRating = total
      ? (filteredReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total).toFixed(1)
      : "0.0";

    return { total, approved, pending, rejected, averageRating };
  }, [filteredReviews]);

  return (
    <section className="space-y-6" dir="ltr">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] p-6 text-slate-50 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100/85">Admin Reviews</p>
        <h1 className="mt-3 text-3xl font-extrabold text-white">{t("pages.reviews.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm font-normal leading-7 text-slate-100/85">
          Moderate learner feedback with a clearer view of ratings, pending items, and rejected reviews.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={MessageSquare} title="Reviews" value={stats.total} note="Visible review entries" tone="bg-blue-50 text-blue-700" />
        <StatCard icon={CheckCircle2} title="Approved" value={stats.approved} note="Already visible publicly" tone="bg-emerald-50 text-emerald-700" />
        <StatCard icon={Clock3} title="Pending" value={stats.pending} note="Needs moderation decision" tone="bg-amber-50 text-amber-700" />
        <StatCard icon={XCircle} title="Rejected" value={stats.rejected} note="Removed from public display" tone="bg-rose-50 text-rose-700" />
        <StatCard icon={Star} title="Average" value={stats.averageRating} note="Average visible rating" tone="bg-violet-50 text-violet-700" />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, course, or review text..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-violet-500"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-violet-500"
          >
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4+ stars</option>
            <option value="3">3+ stars</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredReviews.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm font-medium text-slate-500 xl:col-span-2">
            No reviews matched the current filters.
          </div>
        ) : (
          filteredReviews.map((review) => {
            const meta = statusMeta[review.status] || statusMeta.pending;
            return (
              <article key={review.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-slate-800">{review.studentName}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                      <BookOpen size={15} />
                      {review.courseTitle}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <RatingStars rating={review.rating} />
                  <span className="text-sm font-bold text-slate-700">{review.rating}/5</span>
                  <span className="text-xs font-medium text-slate-500">{formatDate(review.createdAt)}</span>
                </div>

                <p className="mt-4 text-sm font-normal leading-7 text-slate-600">{review.comment}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
