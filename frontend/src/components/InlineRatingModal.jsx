import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import { submitCourseRating, updateStudentRating } from "../../services/courseService.js";

const TAGS = {
  fa: ["تدریس روشن", "محتوای مفید", "پشتیبانی خوب", "تمرین‌های کاربردی", "پیشنهاد می‌کنم"],
  en: ["Clear teaching", "Useful content", "Good support", "Practical exercises", "Recommended"],
};

function Stars({ label, value, onChange }) {
  return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex gap-1" dir="ltr">{[1,2,3,4,5].map((score) => <button key={score} type="button" onClick={() => onChange(score)} aria-label={`${score}/5`} className="rounded-lg p-1 text-amber-500 transition hover:bg-amber-50"><Star size={27} fill={score <= value ? "currentColor" : "none"}/></button>)}</div></div>;
}

export default function InlineRatingModal({ open, onClose, courses = [], existingRatings = [], language = "fa", initialCourseId = "", onSaved }) {
  const isFa = language === "fa";
  const options = useMemo(() => {
    const map = new Map();
    courses.forEach((item) => map.set(String(item.courseId), item));
    existingRatings.filter((item) => item.canEdit).forEach((item) => {
      if (!map.has(String(item.courseId))) map.set(String(item.courseId), item);
    });
    return [...map.values()];
  }, [courses, existingRatings]);
  const [courseId, setCourseId] = useState("");
  const [form, setForm] = useState({ courseRating: 0, teacherRating: 0, comment: "", tags: [], displayName: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = existingRatings.find((item) => String(item.courseId) === String(courseId));
  const selectedCourse = options.find((item) => String(item.courseId) === String(courseId));
  const priorTeacherRating = existingRatings.find((item) => String(item.teacherId) === String(selectedCourse?.teacherId));
  const teacherAlreadyRated = Boolean(selectedCourse?.teacherAlreadyRated || (priorTeacherRating && !existing));

  useEffect(() => {
    if (!open) return;
    const nextId = String(initialCourseId || options[0]?.courseId || "");
    // Reset the modal selection whenever it is opened for a different page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCourseId(nextId);
  }, [open, initialCourseId, options]);
  useEffect(() => {
    const row = existingRatings.find((item) => String(item.courseId) === String(courseId));
    // The form intentionally follows the selected review record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(row ? { courseRating: row.courseRating, teacherRating: row.teacherRating, comment: row.comment || "", tags: row.tags || [], displayName: row.displayName !== false } : { courseRating: 0, teacherRating: 0, comment: "", tags: [], displayName: true });
    setError("");
  }, [courseId, existingRatings]);
  if (!open) return null;

  const save = async () => {
    if (!form.courseRating || (!teacherAlreadyRated && !form.teacherRating)) { setError(isFa ? "امتیازهای لازم را انتخاب کنید." : "Select the required ratings."); return; }
    setBusy(true); setError("");
    try {
      if (existing?._id) await updateStudentRating(existing._id, form);
      else await submitCourseRating({ courseId, ...form });
      await onSaved?.();
      onClose();
    } catch (err) { setError(err.message || (isFa ? "ثبت نظر ناموفق بود." : "Unable to save review.")); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-3 sm:p-6" dir={isFa ? "rtl" : "ltr"}><div className="mx-auto my-3 w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:my-8 sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">{isFa ? "ثبت نظر و امتیاز" : "Rate and review"}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{isFa ? "نظر شما پس از بررسی برای دیگران نمایش داده می‌شود." : "Your review will be shown publicly after moderation."}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-600"><X size={20}/></button></div>
    {options.length > 1 && <label className="mt-5 block text-sm font-black text-slate-700">{isFa ? "کورس مربوط" : "Related course"}<select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold">{options.map((item) => <option key={item.courseId} value={item.courseId}>{item.courseTitle}</option>)}</select></label>}
    <div className="mt-6 grid gap-5 sm:grid-cols-2"><Stars label={isFa ? "امتیاز کورس" : "Course rating"} value={form.courseRating} onChange={(courseRating) => setForm({...form, courseRating})}/>{teacherAlreadyRated ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">{isFa ? "شما قبلاً به این استاد امتیاز داده‌اید. همان امتیاز واحد حفظ می‌شود و از صفحه استاد قابل ویرایش است." : "You have already rated this teacher. Your single teacher rating is preserved and can be edited from the teacher page."}</div> : <Stars label={isFa ? "امتیاز استاد" : "Teacher rating"} value={form.teacherRating} onChange={(teacherRating) => setForm({...form, teacherRating})}/>}</div>
    <div className="mt-5 flex flex-wrap gap-2">{TAGS[language].map((tag) => <button type="button" key={tag} onClick={() => setForm({...form, tags: form.tags.includes(tag) ? form.tags.filter((item) => item !== tag) : [...form.tags, tag].slice(0,5)})} className={`rounded-full border px-3 py-2 text-xs font-black ${form.tags.includes(tag) ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600"}`}>{tag}</button>)}</div>
    <textarea value={form.comment} maxLength={500} onChange={(e) => setForm({...form, comment:e.target.value})} placeholder={isFa ? "نظر شما (اختیاری)" : "Your comment (optional)"} className="mt-5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"/><div className="mt-1 text-end text-xs font-bold text-slate-400">{form.comment.length}/500</div>
    <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.displayName} onChange={(e) => setForm({...form, displayName:e.target.checked})}/>{isFa ? "نام من همراه نظر نمایش داده شود" : "Show my name with this review"}</label>
    {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<button type="button" disabled={busy || !courseId} onClick={save} className="mt-5 h-12 w-full rounded-xl bg-primary-600 text-sm font-black text-white disabled:opacity-60">{busy ? (isFa ? "در حال ثبت…" : "Saving…") : existing ? (isFa ? "ذخیره تغییرات" : "Save changes") : (isFa ? "ثبت نظر" : "Submit review")}</button></div></div>;
}
