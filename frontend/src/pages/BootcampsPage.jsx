import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { fetchPublicBootcamps, resolveBootcampImageUrl } from "../../services/bootcampService.js";
import FrontendPageLoader from "../components/common/FrontendPageLoader.jsx";
import { DEFAULT_TIME_ZONE } from "../utils/timezone.js";

const localized = (value, language) => value?.[language] || value?.[language === "fa" ? "en" : "fa"] || "";

export default function BootcampsPage({ language = "fa" }) {
  const isFa = language === "fa";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const Arrow = isFa ? ArrowLeft : ArrowRight;

  useEffect(() => {
    let active = true;
    fetchPublicBootcamps().then((rows) => { if (active) setItems(rows); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <FrontendPageLoader label={isFa ? "در حال بارگذاری بوت‌کمپ‌ها" : "Loading bootcamps"} minHeight="min-h-[60vh]"/>;

  return <section className="min-h-screen bg-slate-50 pb-16" dir={isFa ? "rtl" : "ltr"}>
    <div className="mx-auto max-w-[1536px] px-4 pt-8 sm:px-6 lg:px-8"><header className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-10 text-center shadow-sm sm:px-8 sm:py-14"><div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl"/><div className="absolute -bottom-28 end-0 h-80 w-80 rounded-full bg-teal-100/70 blur-3xl"/><div className="relative mx-auto max-w-4xl"><span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"><UsersRound size={17}/>{isFa ? "بوت‌کمپ‌های رایگان" : "Free bootcamps"}</span><h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-5xl">{isFa ? "با استادان متخصص، رایگان یاد بگیرید" : "Learn free with expert instructors"}</h1><p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{isFa ? "ثبت‌نام کنید؛ پس از تکمیل حداقل اشتراک‌کنندگان، برنامه کلاس‌ها در داشبورد شما نمایش داده می‌شود." : "Register now. When minimum participation is reached, class sessions appear in your dashboard."}</p></div></header>
      <main className="py-10">{error ? <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center font-bold text-rose-700">{error}</div> : !items.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center"><UsersRound size={46} className="mx-auto text-slate-300"/><p className="mt-3 font-bold text-slate-500">{isFa ? "فعلاً بوت‌کمپی برای ثبت‌نام وجود ندارد." : "No bootcamp is available right now."}</p></div> : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Link key={item._id} to={`/bootcamps/${item.slug}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="aspect-video overflow-hidden bg-slate-100">{item.coverImage ? <img src={resolveBootcampImageUrl(item.coverImage)} alt={localized(item.title, language)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/> : <div className="grid h-full place-items-center bg-gradient-to-br from-blue-50 to-teal-50"><UsersRound size={52} className="text-blue-300"/></div>}</div><div className="p-5 sm:p-6"><h2 className="text-xl font-black text-slate-950">{localized(item.title, language)}</h2><p className="mt-3 line-clamp-2 text-sm font-medium leading-7 text-slate-600">{localized(item.description, language)}</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700"><UsersRound size={14} className="me-1 inline"/>{item.registeredCount} / {item.minimumStudents}</span>{item.plannedStartAt ? <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600"><CalendarDays size={14} className="me-1 inline"/>{new Intl.DateTimeFormat(isFa ? "fa-AF-u-ca-persian" : "en-US", { timeZone: DEFAULT_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(item.plannedStartAt))}</span> : null}</div><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-black text-primary-700">{item.registrationOpen ? (isFa ? "ثبت‌نام رایگان" : "Register free") : (isFa ? "مشاهده جزئیات" : "View details")}</span><span className="grid h-10 w-10 place-items-center rounded-full bg-primary-600 text-white"><Arrow size={17}/></span></div></div></Link>)}</div>}</main>
    </div>
  </section>;
}
