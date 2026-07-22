import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import { submitCourseRating, submitTeacherRating, updateStudentRating, updateStudentTeacherRating } from "../../services/courseService.js";

const TAGS = { fa: ["توضیح روشن", "محتوای مفید", "پشتیبانی خوب", "تمرین کاربردی", "پیشنهاد می‌کنم"], en: ["Clear", "Useful", "Good support", "Practical", "Recommended"] };
const emptyForm = { rating: 0, comment: "", tags: [], displayName: true };

function Stars({ label, value, onChange }) { return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex gap-1" dir="ltr">{[1,2,3,4,5].map((score) => <button key={score} type="button" onClick={() => onChange(score)} aria-label={`${score}/5`} className="rounded-lg p-1 text-amber-500 hover:bg-amber-50"><Star size={29} fill={score <= value ? "currentColor" : "none"}/></button>)}</div></div>; }

export default function InlineRatingModal({ open, onClose, courses = [], existingRatings = [], language = "fa", initialCourseId = "", initialTeacherId = "", reviewType = "course", onSaved }) {
  const isFa = language === "fa";
  const isTeacher = reviewType === "teacher";
  const keyOf = (item) => String(isTeacher ? item.teacherId : item.courseId);
  const options = useMemo(() => { const map = new Map(); courses.forEach((item) => map.set(String(isTeacher ? item.teacherId : item.courseId), item)); existingRatings.forEach((item) => { const key = String(isTeacher ? item.teacherId : item.courseId); if (!map.has(key)) map.set(key, item); }); return [...map.values()]; }, [courses, existingRatings, isTeacher]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = existingRatings.find((item) => keyOf(item) === selectedId);

  useEffect(() => { if (!open) return; const next = String((isTeacher ? initialTeacherId : initialCourseId) || (options[0] ? keyOf(options[0]) : "")); /* eslint-disable-next-line react-hooks/set-state-in-effect */ setSelectedId(next); }, [open, initialCourseId, initialTeacherId, isTeacher, options]);
  useEffect(() => { const row = existingRatings.find((item) => keyOf(item) === selectedId); /* eslint-disable-next-line react-hooks/set-state-in-effect */ setForm(row ? { rating: Number(isTeacher ? row.teacherRating : row.courseRating), comment: row.comment || "", tags: row.tags || [], displayName: row.displayName !== false } : emptyForm); setError(""); }, [selectedId, existingRatings, isTeacher]);
  if (!open) return null;

  const save = async () => {
    if (!form.rating) { setError(isFa ? "یک امتیاز انتخاب کنید." : "Select a rating."); return; }
    setBusy(true); setError("");
    const payload = { [isTeacher ? "teacherRating" : "courseRating"]: form.rating, comment: form.comment, tags: form.tags, displayName: form.displayName };
    try {
      if (existing?._id) { if (isTeacher) await updateStudentTeacherRating(existing._id, payload); else await updateStudentRating(existing._id, payload); }
      else if (isTeacher) await submitTeacherRating({ teacherId: selectedId, ...payload });
      else await submitCourseRating({ courseId: selectedId, ...payload });
      await onSaved?.(); onClose();
    } catch (err) { setError(err.message || (isFa ? "ثبت نظر ناموفق بود." : "Unable to save review.")); } finally { setBusy(false); }
  };

  const title = isTeacher ? (isFa ? "نظر درباره استاد" : "Teacher review") : (isFa ? "نظر درباره کورس" : "Course review");
  return <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-3 sm:p-6" dir={isFa ? "rtl" : "ltr"}><div className="mx-auto my-4 w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:my-8 sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{isFa ? "این امتیاز و نظر مستقل ثبت می‌شود." : "This rating and comment are saved independently."}</p></div><button type="button" onClick={onClose} className="rounded-xl border p-2"><X size={20}/></button></div>
    {options.length > 1 && <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="mt-5 h-12 w-full rounded-xl border border-slate-200 px-3 font-bold">{options.map((item) => <option key={keyOf(item)} value={keyOf(item)}>{isTeacher ? item.teacherName : item.courseTitle}</option>)}</select>}
    <div className="mt-6"><Stars label={isTeacher ? (isFa ? "امتیاز استاد" : "Teacher rating") : (isFa ? "امتیاز کورس" : "Course rating")} value={form.rating} onChange={(rating) => setForm({...form, rating})}/></div>
    <div className="mt-5 flex flex-wrap gap-2">{TAGS[language].map((tag) => <button type="button" key={tag} onClick={() => setForm({...form, tags: form.tags.includes(tag) ? form.tags.filter((value) => value !== tag) : [...form.tags, tag].slice(0,5)})} className={`rounded-full border px-3 py-2 text-xs font-black ${form.tags.includes(tag) ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600"}`}>{tag}</button>)}</div>
    <textarea value={form.comment} maxLength={500} onChange={(e) => setForm({...form, comment:e.target.value})} placeholder={isFa ? "نظر شما (اختیاری)" : "Your comment (optional)"} className="mt-5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"/><div className="mt-1 text-end text-xs font-bold text-slate-400">{form.comment.length}/500</div>
    <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.displayName} onChange={(e) => setForm({...form, displayName:e.target.checked})}/>{isFa ? "نام من نمایش داده شود" : "Show my name"}</label>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<button type="button" disabled={busy || !selectedId} onClick={save} className="mt-5 h-12 w-full rounded-xl bg-primary-600 text-sm font-black text-white disabled:opacity-60">{busy ? (isFa ? "در حال ثبت…" : "Saving…") : existing ? (isFa ? "ذخیره تغییرات" : "Save changes") : (isFa ? "ثبت نظر" : "Submit review")}</button></div></div>;
}
