import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareHeart, Send, Star } from "lucide-react";
import StudentLayout from "../components/StudentLayout.jsx";
import { fetchPendingCourseRatings, fetchStudentRatings, submitCourseRating, submitPlatformFeedback, updateStudentRating } from "../../services/courseService.js";
import { getAuthUser } from "../../services/portal.js";

const TAGS = {
  fa: ["توضیح روشن", "محتوای عملی", "استاد پاسخ‌گو", "برنامه‌ریزی خوب", "نیاز به بهبود"],
  en: ["Clear explanations", "Practical content", "Responsive teacher", "Good scheduling", "Needs improvement"],
};

function Stars({ value, onChange, label }) {
  return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex gap-1" dir="ltr">{[1,2,3,4,5].map((score) => <button type="button" key={score} onClick={() => onChange(score)} aria-label={`${label} ${score}`} className={`rounded-lg p-1 transition ${score <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><Star size={28} fill="currentColor"/></button>)}</div></div>;
}

const emptyReview = { courseRating: 0, teacherRating: 0, comment: "", tags: [], displayName: true };

export default function StudentFeedbackPage({ language = "fa" }) {
  const isFa = language === "fa";
  const [pending, setPending] = useState([]);
  const [submitted, setSubmitted] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyReview);
  const [platform, setPlatform] = useState({ type: "feedback", score: 0, message: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try { const [nextPending, nextSubmitted] = await Promise.all([fetchPendingCourseRatings(), fetchStudentRatings()]); setPending(nextPending); setSubmitted(nextSubmitted); }
    catch (error) { setNotice(error.message || (isFa ? "بارگذاری بازخوردها ناموفق بود." : "Unable to load feedback.")); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    Promise.all([fetchPendingCourseRatings(), fetchStudentRatings()])
      .then(([nextPending, nextSubmitted]) => { if (active) { setPending(nextPending); setSubmitted(nextSubmitted); setNotice(""); } })
      .catch((error) => { if (active) setNotice(error.message || (isFa ? "بارگذاری بازخوردها ناموفق بود." : "Unable to load feedback.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isFa]);

  const openPending = (item) => { setSelected({ ...item, mode: "create" }); setForm(emptyReview); };
  const openEdit = (item) => { setSelected({ ...item, mode: "edit" }); setForm({ courseRating: item.courseRating, teacherRating: item.teacherRating, comment: item.comment || "", tags: item.tags || [], displayName: item.displayName !== false }); };
  const saveReview = async () => {
    if (!form.courseRating || !form.teacherRating) { setNotice(isFa ? "برای کورس و استاد امتیاز انتخاب کنید." : "Select ratings for both course and teacher."); return; }
    setBusy(true);
    try {
      if (selected.mode === "edit") await updateStudentRating(selected._id, form);
      else await submitCourseRating({ courseId: selected.courseId, ...form });
      setSelected(null); setNotice(isFa ? "نظر شما ثبت شد." : "Your review was saved."); await load();
    } catch (error) { setNotice(error.message || (isFa ? "ثبت نظر ناموفق بود." : "Unable to save review.")); }
    finally { setBusy(false); }
  };
  const savePlatform = async () => {
    if (!platform.score) { setNotice(isFa ? "ابتدا یک امتیاز انتخاب کنید." : "Select a score first."); return; }
    setBusy(true);
    try { await submitPlatformFeedback({ ...platform, page: window.location.pathname }); setPlatform({ type: "feedback", score: 0, message: "" }); setNotice(isFa ? "از بازخورد شما سپاسگزاریم." : "Thank you for your feedback."); }
    catch (error) { setNotice(error.message || (isFa ? "ارسال بازخورد ناموفق بود." : "Unable to send feedback.")); }
    finally { setBusy(false); }
  };

  return <StudentLayout language={language} user={getAuthUser() || {}}><div dir={isFa ? "rtl" : "ltr"} className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-teal-500 p-6 text-white shadow-lg sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black"><MessageSquareHeart size={16}/>{isFa ? "صدای شما" : "Your voice"}</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">{isFa ? "نظرات و بازخورد من" : "My Reviews & Feedback"}</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/80">{isFa ? "تجربه واقعی شما به بهترشدن کورس‌ها، مدرسان و ایجوتک کمک می‌کند." : "Your verified experience helps improve courses, teachers, and EduTech."}</p></header>
    {notice && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">{isFa ? "منتظر نظر شما" : "Waiting for your review"}</h2><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{pending.length}</span></div>{loading ? <p className="mt-5 text-sm font-bold text-slate-500">{isFa ? "در حال بارگذاری…" : "Loading…"}</p> : pending.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{pending.map((item) => <article key={item.courseId} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">{item.courseTitle}</h3><p className="mt-1 text-sm font-bold text-slate-500">{item.teacherName}</p><button onClick={() => openPending(item)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">{isFa ? "ثبت نظر" : "Write review"}</button></article>)}</div> : <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} className="me-2 inline"/>{isFa ? "همه نظرهای واجد شرایط را ثبت کرده‌اید." : "You are up to date with eligible reviews."}</p>}</section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black text-slate-950">{isFa ? "نظرهای ثبت‌شده" : "Submitted reviews"}</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{submitted.map((item) => <article key={item._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><h3 className="font-black text-slate-950">{item.courseTitle}</h3><p className="mt-1 text-sm font-bold text-slate-500">{item.teacherName}</p></div><span className="text-sm font-black text-amber-600">★ {item.courseRating}/5</span></div>{item.comment && <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.comment}</p>}<div className="mt-4 flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${item.moderationStatus === "published" ? "bg-emerald-50 text-emerald-700" : item.moderationStatus === "hidden" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{item.moderationStatus === "published" ? (isFa ? "منتشرشده" : "Published") : item.moderationStatus === "hidden" ? (isFa ? "پنهان" : "Hidden") : (isFa ? "در انتظار بررسی" : "Pending review")}</span>{item.canEdit && <button onClick={() => openEdit(item)} className="ms-auto rounded-xl border border-blue-200 px-4 py-2 text-xs font-black text-blue-700">{isFa ? "ویرایش نظر" : "Edit review"}</button>}</div></article>)}</div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black text-slate-950">{isFa ? "بازخورد درباره ایجوتک" : "Feedback about EduTech"}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{isFa ? "پیشنهاد، مشکل یا تجربه کلی خود را مستقیم با تیم پلتفرم شریک کنید." : "Share a suggestion, issue, or your overall experience directly with the platform team."}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-sm font-black text-slate-700">{isFa ? "نوع پیام" : "Feedback type"}</span><select value={platform.type} onChange={(e) => setPlatform({...platform,type:e.target.value})} className="h-12 w-full rounded-xl border border-slate-200 px-3 font-bold"><option value="feedback">{isFa ? "بازخورد" : "Feedback"}</option><option value="suggestion">{isFa ? "پیشنهاد" : "Suggestion"}</option><option value="complaint">{isFa ? "شکایت" : "Complaint"}</option><option value="bug">{isFa ? "مشکل فنی" : "Technical issue"}</option></select></label><Stars label={isFa ? "رضایت کلی" : "Overall satisfaction"} value={platform.score} onChange={(score) => setPlatform({...platform,score})}/></div><textarea value={platform.message} maxLength={2000} onChange={(e) => setPlatform({...platform,message:e.target.value})} placeholder={isFa ? "پیام شما…" : "Your message…"} className="mt-4 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-blue-400"/><button disabled={busy} onClick={savePlatform} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Send size={16}/>{isFa ? "ارسال بازخورد" : "Send feedback"}</button></section>
    {selected && <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 p-4"><div className="mx-auto my-6 w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">{selected.courseTitle}</h2><p className="mt-1 text-sm font-bold text-slate-500">{selected.teacherName}</p></div><button onClick={() => setSelected(null)} className="h-10 rounded-xl border px-3 text-sm font-black">{isFa ? "بستن" : "Close"}</button></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><Stars label={isFa ? "امتیاز کورس" : "Course rating"} value={form.courseRating} onChange={(courseRating) => setForm({...form,courseRating})}/><Stars label={isFa ? "امتیاز استاد" : "Teacher rating"} value={form.teacherRating} onChange={(teacherRating) => setForm({...form,teacherRating})}/></div><div className="mt-5 flex flex-wrap gap-2">{TAGS[isFa ? "fa" : "en"].map((tag) => <button type="button" key={tag} onClick={() => setForm({...form,tags:form.tags.includes(tag)?form.tags.filter((item)=>item!==tag):[...form.tags,tag].slice(0,5)})} className={`rounded-full border px-3 py-2 text-xs font-black ${form.tags.includes(tag)?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200 text-slate-600"}`}>{tag}</button>)}</div><textarea value={form.comment} maxLength={500} onChange={(e) => setForm({...form,comment:e.target.value})} placeholder={isFa ? "نظر اختیاری…" : "Optional comment…"} className="mt-5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"/><label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.displayName} onChange={(e) => setForm({...form,displayName:e.target.checked})}/>{isFa ? "نام من همراه نظر نمایش داده شود" : "Show my name with this review"}</label><button disabled={busy} onClick={saveReview} className="mt-5 h-12 w-full rounded-xl bg-blue-600 text-sm font-black text-white disabled:opacity-60">{busy ? (isFa ? "در حال ثبت…" : "Saving…") : (isFa ? "ثبت نظر" : "Save review")}</button></div></div>}
  </div></StudentLayout>;
}
