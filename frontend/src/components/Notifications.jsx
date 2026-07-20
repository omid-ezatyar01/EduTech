import { useEffect, useState } from "react";
import { Bell, CheckCheck, GraduationCap, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import { fetchTeacherNotifications, markAllTeacherNotificationsRead, markTeacherNotificationRead } from "../../services/teacherSocialService.js";
import { resolveAvatarUrl } from "../utils/avatar.js";

const relativeTime = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return language === "fa" ? `${minutes.toLocaleString("fa-AF")} دقیقه پیش` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === "fa" ? `${hours.toLocaleString("fa-AF")} ساعت پیش` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return language === "fa" ? `${days.toLocaleString("fa-AF")} روز پیش` : `${days}d ago`;
};

export default function Notifications({ language = "fa" }) {
  const isFa = language === "fa";
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { let active = true; fetchTeacherNotifications().then((data) => { if (!active) return; setRows(data.notifications || []); setUnread(Number(data.unreadCount || 0)); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const open = async (item) => { if (!item.isRead) { setRows((items) => items.map((row) => row._id === item._id ? {...row,isRead:true} : row)); setUnread((count) => Math.max(0, count - 1)); markTeacherNotificationRead(item._id).catch(() => {}); } navigate(item.url || "/videos"); };
  const readAll = async () => { setRows((items) => items.map((row) => ({...row,isRead:true}))); setUnread(0); await markAllTeacherNotificationsRead().catch(() => {}); };

  return <StudentLayout language={language}>
    <div className="mb-6 flex flex-wrap items-center gap-2 px-1 text-sm font-semibold text-slate-500"><Link to="/student/dashboard">{isFa ? "داشبورد" : "Dashboard"}</Link><span>/</span><span className="text-slate-900">{isFa ? "اعلان‌ها" : "Notifications"}</span></div>
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><header className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Bell size={22}/></span><div><h1 className="text-2xl font-black text-slate-950">{isFa ? "اعلان‌های شما" : "Your notifications"}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{isFa ? `${unread.toLocaleString("fa-AF")} اعلان خوانده‌نشده` : `${unread} unread notifications`}</p></div></div>{unread > 0 && <button onClick={readAll} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700"><CheckCheck size={17}/>{isFa ? "خواندن همه" : "Mark all read"}</button>}</header>
    {loading ? <div className="p-12 text-center font-bold text-slate-500">{isFa ? "در حال بارگذاری…" : "Loading…"}</div> : error ? <div className="p-12 text-center font-bold text-red-600">{error}</div> : rows.length === 0 ? <div className="p-16 text-center"><Bell className="mx-auto text-slate-300" size={44}/><p className="mt-3 font-bold text-slate-500">{isFa ? "هنوز اعلانی ندارید. استادان مورد علاقه‌تان را دنبال کنید." : "No notifications yet. Follow your favorite teachers."}</p><Link to="/teachers" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">{isFa ? "مشاهده استادان" : "Browse teachers"}</Link></div> : <div className="divide-y divide-slate-100">{rows.map((item) => { const Icon = item.type === "teacher_video" ? Video : GraduationCap; return <button key={item._id} onClick={() => open(item)} className={`flex w-full items-start gap-4 p-5 text-start transition hover:bg-slate-50 sm:p-6 ${item.isRead ? "" : "bg-blue-50/60"}`}><img src={resolveAvatarUrl(item.teacher?.avatar || "") || "/icons/favicon-96x96.png"} alt="" className="h-12 w-12 rounded-full border border-white object-cover shadow-sm"/><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><Icon size={16} className="text-blue-600"/><strong className="line-clamp-1 text-sm text-slate-950">{item.title}</strong>{!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600"/>}</span><span className="mt-1 block line-clamp-2 text-sm font-medium leading-6 text-slate-600">{item.body}</span><span className="mt-2 block text-xs font-bold text-slate-400">{relativeTime(item.createdAt, language)}</span></span></button>; })}</div>}
    </section>
  </StudentLayout>;
}
