import { useEffect, useMemo, useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout.jsx";
import useTeacherLanguage from "../hooks/useTeacherLanguage.js";
import { getAuthUser } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";

export default function TeacherFeedback() {
  const { language, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const teacher = useMemo(() => getAuthUser() || {}, []);
  const [data, setData] = useState({ average: 0, total: 0, distribution: {}, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = async () => { setLoading(true); try { const response = await fetch(`${getApiBase()}/teacher/feedback`, { headers: buildAuthHeaders() }); const result = await parseJsonResponse(response); setData(result?.data || data); setError(""); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    fetch(`${getApiBase()}/teacher/feedback`, { headers: buildAuthHeaders() })
      .then(parseJsonResponse)
      .then((result) => { if (active) { setData(result?.data || { average: 0, total: 0, distribution: {}, reviews: [] }); setError(""); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const reply = async (id) => { try { const response = await fetch(`${getApiBase()}/teacher/feedback/${id}/reply`, { method: "PATCH", headers: buildAuthHeaders(), body: JSON.stringify({ reply: drafts[id] || "" }) }); await parseJsonResponse(response); await load(); } catch (err) { setError(err.message); } };

  return <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}><div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-[#0B4FD8] to-[#00B8A9] p-6 text-white shadow-lg"><div className="flex items-center gap-3"><MessageSquareHeart size={28}/><div><h1 className="text-2xl font-black">{isFa ? "بازخورد شاگردان" : "Student Feedback"}</h1><p className="mt-1 text-sm font-semibold text-white/75">{isFa ? "دیدگاه‌های تأییدشده شاگردان درباره تدریس شما" : "Verified learner insights about your teaching"}</p></div></div></header>
    {error && <p className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">{isFa ? "میانگین امتیاز" : "Average rating"}</p><p className="mt-2 text-3xl font-black text-slate-950">{data.average || "—"} <Star className="inline text-amber-500" fill="currentColor" size={23}/></p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">{isFa ? "مجموع نظرها" : "Total reviews"}</p><p className="mt-2 text-3xl font-black">{data.total}</p></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">{isFa ? "امتیازهای پنج‌ستاره" : "Five-star reviews"}</p><p className="mt-2 text-3xl font-black">{data.distribution?.[5] || 0}</p></div></div>
    <section className="rounded-3xl border bg-white p-5 sm:p-6"><h2 className="text-xl font-black">{isFa ? "نظرهای اخیر" : "Recent reviews"}</h2>{loading ? <p className="mt-5 font-bold text-slate-500">{isFa ? "در حال بارگذاری…" : "Loading…"}</p> : <div className="mt-5 space-y-4">{data.reviews.map((review) => <article key={review._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black">{review.courseTitle}</h3><p className="text-sm font-bold text-slate-500">{review.studentName}</p></div><span className="font-black text-amber-600">★ {review.teacherRating}/5</span></div>{review.comment && <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">{review.comment}</p>}<div className="mt-4 flex gap-2"><input value={drafts[review._id] ?? review.teacherReply ?? ""} onChange={(e) => setDrafts({...drafts,[review._id]:e.target.value})} maxLength={500} placeholder={isFa ? "پاسخ عمومی شما…" : "Your public reply…"} className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm font-semibold"/><button onClick={() => reply(review._id)} className="rounded-xl bg-blue-600 px-4 text-xs font-black text-white">{isFa ? "ثبت پاسخ" : "Save reply"}</button></div></article>)}{!data.reviews.length && <p className="text-sm font-bold text-slate-500">{isFa ? "هنوز نظری ثبت نشده است." : "No reviews yet."}</p>}</div>}</section>
  </div></TeacherLayout>;
}
