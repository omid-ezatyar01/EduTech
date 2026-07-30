import { useEffect, useState } from "react";
import { Bell, CalendarCheck2, CheckCheck, GraduationCap, RefreshCw, Video } from "lucide-react";
import { Link, useNavigate } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import { fetchTeacherNotifications, markAllTeacherNotificationsRead, markTeacherNotificationRead } from "../../services/teacherSocialService.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";

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
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let active = true;
    const loadNotifications = ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      return fetchTeacherNotifications()
        .then((data) => {
          if (!active) return;
          setRows(data.notifications || []);
          setUnread(Number(data.unreadCount || 0));
          setError("");
        })
        .catch((err) => {
          if (active && !quiet) {
            setError(
              getLocalizedRequestErrorMessage(
                err,
                language,
                "اعلان‌ها بارگذاری نشد.",
                "Notifications could not be loaded.",
              ),
            );
          }
        })
        .finally(() => {
          if (active && !quiet) setLoading(false);
        });
    };

    loadNotifications();
    const timer = window.setInterval(
      () => loadNotifications({ quiet: true }),
      45_000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [language, refreshSeed]);
  const open = async (item) => {
    if (!item.isRead) {
      setRows((items) =>
        items.map((row) =>
          row._id === item._id ? { ...row, isRead: true } : row,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
      markTeacherNotificationRead(item._id).catch(() => {
        setRefreshSeed((value) => value + 1);
      });
    }
    const target = String(item.url || "");
    navigate(target.startsWith("/") ? target : "/videos");
  };
  const readAll = async () => {
    const previousRows = rows;
    const previousUnread = unread;
    setRows((items) => items.map((row) => ({ ...row, isRead: true })));
    setUnread(0);
    try {
      await markAllTeacherNotificationsRead();
    } catch (requestError) {
      setRows(previousRows);
      setUnread(previousUnread);
      setError(
        getLocalizedRequestErrorMessage(
          requestError,
          language,
          "اعلان‌ها به‌روزرسانی نشد.",
          "Notifications could not be updated.",
        ),
      );
    }
  };

  return <StudentLayout language={language}>
    <div className="mb-6 flex flex-wrap items-center gap-2 px-1 text-sm font-semibold text-slate-500"><Link to="/student/dashboard">{isFa ? "داشبورد" : "Dashboard"}</Link><span>/</span><span className="text-slate-900">{isFa ? "اعلان‌ها" : "Notifications"}</span></div>
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"><header className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Bell size={22}/></span><div><h1 className="text-2xl font-black text-slate-950">{isFa ? "اعلان‌های شما" : "Your notifications"}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{isFa ? `${unread.toLocaleString("fa-AF")} اعلان خوانده‌نشده` : `${unread} unread notifications`}</p></div></div>{unread > 0 && <button onClick={readAll} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700"><CheckCheck size={17}/>{isFa ? "خواندن همه" : "Mark all read"}</button>}</header>
    {loading ? <div className="p-12 text-center font-bold text-slate-500">{isFa ? "در حال بارگذاری…" : "Loading…"}</div> : error ? <div className="p-12 text-center font-bold text-red-600"><p>{error}</p><button type="button" onClick={() => { setError(""); setRefreshSeed((value) => value + 1); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-rose-700 ring-1 ring-rose-200"><RefreshCw size={16}/>{isFa ? "تلاش دوباره" : "Try again"}</button></div> : rows.length === 0 ? <div className="p-16 text-center"><Bell className="mx-auto text-slate-300" size={44}/><p className="mt-3 font-bold text-slate-500">{isFa ? "هنوز اعلانی ندارید. رویدادهای کورس‌ها و استادان شما اینجا نمایش داده می‌شود." : "No notifications yet. Course and teacher updates will appear here."}</p><Link to="/live-courses" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">{isFa ? "مشاهده کورس‌ها" : "Browse courses"}</Link></div> : <div className="divide-y divide-slate-100">{rows.map((item) => { const isCalendarPrompt = item.type === "calendar_connect_required"; const Icon = item.type === "teacher_video" ? Video : isCalendarPrompt ? CalendarCheck2 : GraduationCap; const isCourseStarted = item.type === "course_started"; const title = isCourseStarted ? (isFa ? "کورس شما آغاز شد" : "Your course has started") : isCalendarPrompt ? (isFa ? "تقویم گوگل را متصل کنید" : "Connect Google Calendar") : item.title; const body = isCourseStarted ? (isFa ? `کورس «${item.course?.title || "ثبت‌نام‌شده"}» آغاز شده است. اکنون می‌توانید آموزش را ادامه دهید.` : `${item.course?.title || "Your course"} has started. You can now continue learning.`) : isCalendarPrompt ? (isFa ? `برای دریافت خودکار جلسات و تغییرات کورس «${item.course?.title || "شما"}»، تقویم گوگل را متصل کنید.` : `Connect Google Calendar to automatically receive sessions and changes for ${item.course?.title || "your course"}.`) : item.body; return <button key={item._id} onClick={() => open(item)} className={`flex w-full items-start gap-4 p-5 text-start transition hover:bg-slate-50 sm:p-6 ${item.isRead ? "" : "bg-blue-50/60"}`}><img src={resolveAvatarUrl(item.teacher?.avatar || "") || "/icons/favicon-96x96.png"} alt="" className="h-12 w-12 rounded-full border border-white object-cover shadow-sm"/><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><Icon size={16} className="text-blue-600"/><strong className="line-clamp-1 text-sm text-slate-950">{title}</strong>{!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600"/>}</span><span className="mt-1 block line-clamp-2 text-sm font-medium leading-6 text-slate-600">{body}</span><span className="mt-2 block text-xs font-bold text-slate-400">{relativeTime(item.createdAt, language)}</span></span></button>; })}</div>}
    </section>
  </StudentLayout>;
}
