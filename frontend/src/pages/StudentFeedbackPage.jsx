import { useState } from "react";
import { MessageSquareHeart, Send, Star } from "lucide-react";
import StudentLayout from "../components/StudentLayout.jsx";
import { submitPlatformFeedback } from "../../services/courseService.js";
import { getAuthUser } from "../../services/portal.js";

function Stars({ value, onChange, label }) {
  return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex gap-1" dir="ltr">{[1,2,3,4,5].map((score) => <button type="button" key={score} onClick={() => onChange(score)} aria-label={`${label} ${score}`} className={`rounded-lg p-1 transition ${score <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><Star size={28} fill="currentColor"/></button>)}</div></div>;
}

export default function StudentFeedbackPage({ language = "fa" }) {
  const isFa = language === "fa";
  const [platform, setPlatform] = useState({ type: "feedback", score: 0, message: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const savePlatform = async () => {
    if (!platform.score) { setNotice(isFa ? "ابتدا یک امتیاز انتخاب کنید." : "Select a score first."); return; }
    setBusy(true); setNotice("");
    try {
      await submitPlatformFeedback({ ...platform, page: window.location.pathname });
      setPlatform({ type: "feedback", score: 0, message: "" });
      setNotice(isFa ? "از بازخورد شما سپاسگزاریم." : "Thank you for your feedback.");
    } catch (error) { setNotice(error.message || (isFa ? "ارسال بازخورد ناموفق بود." : "Unable to send feedback.")); }
    finally { setBusy(false); }
  };
  return <StudentLayout language={language} user={getAuthUser() || {}}><div dir={isFa ? "rtl" : "ltr"} className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-teal-500 p-6 text-white shadow-lg sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black"><MessageSquareHeart size={16}/>{isFa ? "صدای شما" : "Your voice"}</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">{isFa ? "بازخورد درباره ایجوتک" : "Feedback about EduTech"}</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/80">{isFa ? "پیشنهاد، مشکل یا تجربه کلی خود را مستقیم با تیم ایجوتک شریک کنید. نظر درباره کورس و استاد در صفحه همان کورس یا استاد ثبت می‌شود." : "Share suggestions, issues, or your overall experience directly with EduTech. Course and teacher reviews are submitted on their public pages."}</p></header>
    {notice && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-5 md:grid-cols-2"><label><span className="mb-2 block text-sm font-black text-slate-700">{isFa ? "نوع پیام" : "Feedback type"}</span><select value={platform.type} onChange={(e) => setPlatform({...platform,type:e.target.value})} className="h-12 w-full rounded-xl border border-slate-200 px-3 font-bold"><option value="feedback">{isFa ? "بازخورد" : "Feedback"}</option><option value="suggestion">{isFa ? "پیشنهاد" : "Suggestion"}</option><option value="complaint">{isFa ? "شکایت" : "Complaint"}</option><option value="bug">{isFa ? "مشکل فنی" : "Technical issue"}</option></select></label><Stars label={isFa ? "رضایت کلی" : "Overall satisfaction"} value={platform.score} onChange={(score) => setPlatform({...platform,score})}/></div><textarea value={platform.message} maxLength={2000} onChange={(e) => setPlatform({...platform,message:e.target.value})} placeholder={isFa ? "پیام شما…" : "Your message…"} className="mt-5 min-h-36 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-blue-400"/><div className="mt-1 text-end text-xs font-bold text-slate-400">{platform.message.length}/2000</div><button disabled={busy} onClick={savePlatform} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Send size={16}/>{busy ? (isFa ? "در حال ارسال…" : "Sending…") : (isFa ? "ارسال بازخورد" : "Send feedback")}</button></section>
  </div></StudentLayout>;
}
