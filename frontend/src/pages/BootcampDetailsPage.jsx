import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, GraduationCap, Loader2, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { fetchPublicBootcamp, fetchStudentBootcampRegistrations, registerForBootcamp, resolveBootcampImageUrl } from "../../services/bootcampService.js";
import { getAuthUser, setPostAuthRedirect } from "../../services/portal.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";

const localized = (value, language) => value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";
const draftKey = (slug) => `edutech_bootcamp_registration_${slug}`;

export default function BootcampDetailsPage({ language = "fa" }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isFa = language === "fa";
  const user = getAuthUser();
  const userId = user?._id || user?.id || "";
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey(slug))) || {}; } catch { return {}; }
  });

  useEffect(() => {
    let active = true;
    fetchPublicBootcamp(slug).then((value) => { if (active) setItem(value); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!userId || localStorage.getItem("edutech_auth") !== "true") return undefined;
    let active = true;
    fetchStudentBootcampRegistrations()
      .then((rows) => {
        if (active && rows.some((row) => row.bootcamp?.slug === slug && row.status === "registered")) {
          setRegistered(true);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [slug, userId]);

  const progress = useMemo(() => item ? Math.min(100, (item.registeredCount / item.minimumStudents) * 100) : 0, [item]);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!user || localStorage.getItem("edutech_auth") !== "true") {
      sessionStorage.setItem(draftKey(slug), JSON.stringify(form));
      setPostAuthRedirect(`/bootcamps/${slug}`);
      navigate("/login");
      return;
    }
    setSubmitting(true);
    try {
      const result = await registerForBootcamp(slug, { ...form, country: form.country || user?.country || "", consent: Boolean(form.consent), source: "homepage_ad" });
      sessionStorage.removeItem(draftKey(slug));
      setRegistered(true);
      if (!result?.alreadyRegistered) {
        setItem((old) => old ? { ...old, registeredCount: old.registeredCount + 1, remainingToMinimum: Math.max(0, old.remainingToMinimum - 1) } : old);
      }
      window.dispatchEvent(new Event("edutech_data_changed"));
    } catch (requestError) { setError(requestError?.message || (isFa ? "ثبت‌نام انجام نشد." : "Registration failed.")); }
    finally { setSubmitting(false); }
  };

  if (loading) return <FrontendPageLoader label={isFa ? "در حال بارگذاری بوت‌کمپ" : "Loading bootcamp"} minHeight="min-h-[60vh]"/>;
  if (!item) return <div className="min-h-[60vh] bg-slate-50 p-8 text-center font-bold text-rose-700">{error || (isFa ? "بوت‌کمپ پیدا نشد." : "Bootcamp not found.")}</div>;

  return <section className="min-h-screen bg-slate-50 pb-16 pt-6" dir={isFa ? "rtl" : "ltr"}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><nav className="mb-5 flex gap-2 text-sm font-bold text-slate-500"><Link to="/">{isFa ? "خانه" : "Home"}</Link><span>/</span><Link to="/bootcamps">{isFa ? "بوت‌کمپ‌ها" : "Bootcamps"}</Link><span>/</span><span className="truncate text-slate-700">{localized(item.title, language)}</span></nav><div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]"><main className="space-y-6"><article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{item.coverImage ? <img src={resolveBootcampImageUrl(item.coverImage)} alt={localized(item.title, language)} className="aspect-video w-full object-cover"/> : null}<div className="p-5 sm:p-8"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><GraduationCap size={17}/>{isFa ? "بوت‌کمپ رایگان" : "Free bootcamp"}</span><h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-4xl">{localized(item.title, language)}</h1><p className="mt-5 whitespace-pre-wrap text-sm font-medium leading-8 text-slate-600 sm:text-base">{localized(item.description, language)}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-800"><UsersRound size={18} className="text-primary-600"/>{item.registeredCount} {isFa ? "ثبت‌نام" : "registered"}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-500" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-xs font-bold text-slate-500">{item.minimumReached ? (isFa ? "حداقل اشتراک‌کنندگان تکمیل شده است." : "Minimum participation reached.") : `${item.remainingToMinimum} ${isFa ? "نفر دیگر تا تکمیل حداقل" : "more needed to reach the minimum"}`}</p></div><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-800"><CalendarDays size={18} className="text-teal-600"/>{isFa ? "زمان برنامه" : "Schedule"}</div><p className="mt-3 text-xs font-bold leading-6 text-slate-500">{item.plannedStartAt ? new Date(item.plannedStartAt).toLocaleString(isFa ? "fa-AF" : "en-US") : (isFa ? "پس از تکمیل حداقل اعلام می‌شود." : "Announced after minimum participation is reached.")}</p></div></div>{item.course?.teacher ? <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><img src={item.course.teacher.avatar || "/logo.png"} alt="" className="h-12 w-12 rounded-xl object-cover"/><div><p className="text-xs font-bold text-slate-500">{isFa ? "مدرس" : "Instructor"}</p><p className="font-black text-slate-900">{item.course.teacher.name}</p></div></div> : null}</div></article></main><aside className="lg:sticky lg:top-24 lg:self-start"><form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black text-slate-950">{isFa ? "ثبت‌نام رایگان" : "Free registration"}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-500">{isFa ? "اطلاعات خود را تکمیل کنید. جلسات در داشبورد شما نمایش داده می‌شود." : "Complete your information. Sessions will appear in your dashboard."}</p>{registered ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800"><CheckCircle2 size={38} className="mx-auto"/><p className="mt-3 font-black">{isFa ? "ثبت‌نام شما تکمیل شد." : "Your registration is complete."}</p><Link to="/student/dashboard" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">{isFa ? "رفتن به داشبورد" : "Go to dashboard"}</Link></div> : <div className="mt-5 space-y-4">{error ? <div className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}<label className="block text-sm font-black text-slate-700">{isFa ? "شماره تماس یا واتساپ" : "Phone or WhatsApp"}<input required value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} dir="ltr" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"/></label><label className="block text-sm font-black text-slate-700">{isFa ? "کشور" : "Country"}<input required value={form.country || user?.country || ""} onChange={(e) => update("country", e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"/></label><label className="block text-sm font-black text-slate-700">{isFa ? "سطح فعلی" : "Current level"}<select value={form.experienceLevel || "beginner"} onChange={(e) => update("experienceLevel", e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="beginner">{isFa ? "مبتدی" : "Beginner"}</option><option value="intermediate">{isFa ? "متوسط" : "Intermediate"}</option><option value="advanced">{isFa ? "پیشرفته" : "Advanced"}</option></select></label><label className="block text-sm font-black text-slate-700">{isFa ? "چرا می‌خواهید شرکت کنید؟" : "Why do you want to join?"}<textarea value={form.motivation || ""} onChange={(e) => update("motivation", e.target.value)} rows="3" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3"/></label><label className="block text-sm font-black text-slate-700">{isFa ? "زمان مناسب شما" : "Preferred schedule"}<input value={form.preferredSchedule || ""} onChange={(e) => update("preferredSchedule", e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"/></label><label className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-600"><input required type="checkbox" checked={Boolean(form.consent)} onChange={(e) => update("consent", e.target.checked)} className="mt-1 h-4 w-4"/><span>{isFa ? "متعهد می‌شوم در صورت آغاز بوت‌کمپ، در جلسات شرکت کنم." : "I commit to attending the sessions when the bootcamp starts."}</span></label><button disabled={submitting || !item.registrationOpen} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 font-black text-white disabled:bg-slate-300">{submitting ? <Loader2 size={18} className="animate-spin"/> : item.registrationOpen ? <UsersRound size={18}/> : <Clock3 size={18}/>} {item.registrationOpen ? (user ? (isFa ? "تکمیل ثبت‌نام" : "Complete registration") : (isFa ? "ورود با Google و ثبت‌نام" : "Sign in with Google and register")) : (isFa ? "ثبت‌نام بسته است" : "Registration closed")}</button></div>}</form></aside></div></div></section>;
}
