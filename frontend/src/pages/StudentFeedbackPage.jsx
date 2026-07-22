import { useEffect, useState } from "react";
import { MessageSquareHeart, Send, Star } from "lucide-react";
import StudentLayout from "../components/StudentLayout.jsx";
import { fetchMonthlyPlatformFeedbackStatus, submitPlatformFeedback } from "../../services/courseService.js";
import { getAuthUser } from "../../services/portal.js";

function Stars({ value, onChange, label, disabled = false }) {
  return <div><p className="mb-2 text-sm font-black text-slate-700">{label}</p><div className="flex gap-1" dir="ltr">{[1,2,3,4,5].map((score) => <button disabled={disabled} type="button" key={score} onClick={() => onChange(score)} aria-label={`${label} ${score}`} className={`rounded-lg p-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${score <= value ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}><Star size={28} fill="currentColor"/></button>)}</div></div>;
}

export default function StudentFeedbackPage({ language = "fa" }) {
  const isFa = language === "fa";
  const [platform, setPlatform] = useState({ type: "feedback", score: 0, message: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [monthlyStatus, setMonthlyStatus] = useState({ loading: true, canSubmit: false, score: 0, nextAvailableAt: null });
  useEffect(() => { let active = true; fetchMonthlyPlatformFeedbackStatus().then((status) => { if (active) { setMonthlyStatus({ loading: false, ...status }); if (!status.canSubmit) setPlatform((current) => ({ ...current, score: Number(status.score || 0) })); } }).catch(() => { if (active) setMonthlyStatus({ loading: false, canSubmit: true, score: 0, nextAvailableAt: null }); }); return () => { active = false; }; }, []);
  const savePlatform = async () => {
    if (!platform.score) { setNotice(isFa ? "ابتدا یک امتیاز انتخاب کنید." : "Select a score first."); return; }
    setBusy(true); setNotice("");
    try {
      await submitPlatformFeedback({ ...platform, page: window.location.pathname });
      setPlatform({ type: "feedback", score: 0, message: "" });
      const status = await fetchMonthlyPlatformFeedbackStatus();
      setMonthlyStatus({ loading: false, ...status });
      setNotice(isFa ? "از بازخورد شما سپاسگزاریم." : "Thank you for your feedback.");
    } catch (error) { setNotice(error.message || (isFa ? "ارسال بازخورد ناموفق بود." : "Unable to send feedback.")); }
    finally { setBusy(false); }
  };
  return <StudentLayout language={language} user={getAuthUser() || {}}><div dir={isFa ? "rtl" : "ltr"} className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-teal-500 p-6 text-white shadow-lg sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black"><MessageSquareHeart size={16}/>{isFa ? "صدای شما" : "Your voice"}</span><h1 className="mt-4 text-2xl font-black sm:text-3xl">{isFa ? "بازخورد درباره ایجوتک" : "Feedback about EduTech"}</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/80">{isFa ? "پیشنهاد، مشکل یا تجربه کلی خود را مستقیم با تیم ایجوتک شریک کنید. نظر درباره کورس و استاد در صفحه همان کورس یا استاد ثبت می‌شود." : "Share suggestions, issues, or your overall experience directly with EduTech. Course and teacher reviews are submitted on their public pages."}</p></header>
    {notice && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{!monthlyStatus.loading && !monthlyStatus.canSubmit && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-800">{isFa ? `امتیاز این ماه شما ثبت شده است. از آغاز ماه آینده دوباره می‌توانید رضایت کلی خود را ثبت کنید.` : "Your satisfaction rating for this month has been recorded. You can submit another rating at the start of next month."}</div>}<div className="grid gap-5 md:grid-cols-2"><label><span className="mb-2 block text-sm font-black text-slate-700">{isFa ? "نوع پیام" : "Feedback type"}</span><select disabled={!monthlyStatus.canSubmit} value={platform.type} onChange={(e) => setPlatform({...platform,type:e.target.value})} className="h-12 w-full rounded-xl border border-slate-200 px-3 font-bold disabled:bg-slate-100"><option value="feedback">{isFa ? "بازخورد" : "Feedback"}</option><option value="suggestion">{isFa ? "پیشنهاد" : "Suggestion"}</option><option value="complaint">{isFa ? "شکایت" : "Complaint"}</option><option value="bug">{isFa ? "مشکل فنی" : "Technical issue"}</option></select></label><Stars disabled={!monthlyStatus.canSubmit} label={isFa ? "رضایت کلی" : "Overall satisfaction"} value={platform.score} onChange={(score) => setPlatform({...platform,score})}/></div><textarea disabled={!monthlyStatus.canSubmit} value={platform.message} maxLength={2000} onChange={(e) => setPlatform({...platform,message:e.target.value})} placeholder={isFa ? "پیام شما…" : "Your message…"} className="mt-5 min-h-36 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-blue-400 disabled:bg-slate-100"/><div className="mt-1 text-end text-xs font-bold text-slate-400">{platform.message.length}/2000</div><button disabled={busy || monthlyStatus.loading || !monthlyStatus.canSubmit} onClick={savePlatform} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"><Send size={16}/>{busy ? (isFa ? "در حال ارسال…" : "Sending…") : (isFa ? "ارسال بازخورد ماهانه" : "Send monthly feedback")}</button></section>
  </div></StudentLayout>;
}
