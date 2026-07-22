import { BadgeCheck, Flag, Star, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { reportReview, toggleReviewHelpful } from "../../services/courseService.js";
import { getToken } from "../../services/portal.js";

export default function ReviewCard({ review }) {
  const rating = Math.max(0, Math.min(5, Math.round(Number(review?.rating || 0))));
  const learnerName = review?.name || review?.studentName || (review?.isFa ? "شاگرد" : "Learner");
  const courseTitle = review?.course || review?.courseTitle || "";
  const reviewText = String(review?.text || review?.comment || "").trim();
  const [helpfulCount, setHelpfulCount] = useState(Number(review?.helpfulCount || 0));
  const [helpful, setHelpful] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);
  const handleHelpful = async () => { if (!getToken() || busy) return; setBusy(true); try { const result = await toggleReviewHelpful(review._id); setHelpful(Boolean(result.helpful)); setHelpfulCount(Number(result.helpfulCount || 0)); } finally { setBusy(false); } };
  const handleReport = async () => { if (!getToken() || busy || reported) return; setBusy(true); try { await reportReview(review._id, reportReason); setReported(true); setReportOpen(false); } finally { setBusy(false); } };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-black text-primary-700">
          {String(learnerName).charAt(0)}
        </div>
        <div>
          <h4 className="font-black text-slate-950">{learnerName}</h4>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {courseTitle}
          </p>
        </div>
        <div className="ms-auto flex text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              fill={i < rating ? "currentColor" : "none"}
              className={i < rating ? "" : "text-slate-300"}
              key={i}
              size={15}
            />
          ))}
        </div>
      </div>
      <p className={`mt-5 font-medium leading-7 ${reviewText ? "text-slate-600" : "italic text-slate-400"}`}>
        {reviewText ? `“${reviewText}”` : review.isFa ? "این شاگرد امتیاز ثبت کرده، اما نظر نوشتاری اضافه نکرده است." : "This learner submitted a rating without a written comment."}
      </p>
      {review.verifiedLearner ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><BadgeCheck size={15}/>{review.isFa ? "شاگرد تأییدشده" : "Verified learner"}</p> : null}
      {Array.isArray(review.tags) && review.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{review.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{tag}</span>)}</div> : null}
      {review.teacherReply ? <div className="mt-4 rounded-xl border-s-4 border-primary-400 bg-primary-50 p-3"><p className="text-xs font-black text-primary-700">{review.isFa ? "پاسخ استاد" : "Teacher reply"}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{review.teacherReply}</p></div> : null}
      {review._id && getToken() ? <><div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3"><button disabled={busy} onClick={handleHelpful} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${helpful ? "bg-primary-50 text-primary-700" : "bg-slate-50 text-slate-600"}`}><ThumbsUp size={14}/>{review.isFa ? "مفید" : "Helpful"} {helpfulCount}</button><button disabled={busy || reported} onClick={() => setReportOpen((value) => !value)} className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Flag size={14}/>{reported ? (review.isFa ? "گزارش شد" : "Reported") : (review.isFa ? "گزارش" : "Report")}</button></div>{reportOpen && !reported ? <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3"><textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} maxLength={300} placeholder={review.isFa ? "دلیل گزارش…" : "Reason for reporting…"} className="min-h-20 w-full rounded-lg border border-rose-200 bg-white p-2 text-xs font-semibold outline-none"/><div className="mt-2 flex justify-end gap-2"><button onClick={() => setReportOpen(false)} className="rounded-lg px-3 py-2 text-xs font-black text-slate-600">{review.isFa ? "انصراف" : "Cancel"}</button><button disabled={busy} onClick={handleReport} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white">{review.isFa ? "ارسال گزارش" : "Submit report"}</button></div></div> : null}</> : null}
    </div>
  );
}
