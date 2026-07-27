import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Menu,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  deleteTeacherNotification,
  fetchTeacherNotifications,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
} from "../../../services/notificationService.js";

const relativeTime = (value, language) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return language === "fa" ? `${minutes} دقیقه پیش` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === "fa" ? `${hours} ساعت پیش` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return language === "fa" ? `${days} روز پیش` : `${days}d ago`;
};

export default function TeacherTopbar({
  language,
  isRTL,
  onLanguageChange,
  onOpenMobileSidebar,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openLangs, setOpenLangs] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [deletingNotificationId, setDeletingNotificationId] = useState("");
  const langRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setOpenLangs(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async ({ quiet = false } = {}) => {
      if (!quiet) setNotificationsLoading(true);
      try {
        const data = await fetchTeacherNotifications();
        if (!active) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
      } catch {
        // Keep the teacher portal usable if notifications are temporarily unavailable.
      } finally {
        if (active && !quiet) setNotificationsLoading(false);
      }
    };

    loadNotifications();
    const timer = window.setInterval(() => loadNotifications({ quiet: true }), 45_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadNotifications({ quiet: true });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      setNotifications((rows) =>
        rows.map((row) =>
          row._id === notification._id ? { ...row, isRead: true } : row,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      markTeacherNotificationRead(notification._id).catch(() => {});
    }
    setOpenNotifications(false);
    navigate(notification.url || "/teacher/courses");
  };

  const markAllRead = async () => {
    setNotifications((rows) => rows.map((row) => ({ ...row, isRead: true })));
    setUnreadCount(0);
    await markAllTeacherNotificationsRead().catch(() => {});
  };

  const removeNotification = async (notification) => {
    if (!notification?._id || deletingNotificationId) return;
    setDeletingNotificationId(notification._id);
    try {
      await deleteTeacherNotification(notification._id);
      setNotifications((rows) => rows.filter((row) => row._id !== notification._id));
      if (!notification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } finally {
      setDeletingNotificationId("");
    }
  };

  const languages = [
    { value: "fa", label: "فارسی" },
    { value: "en", label: "English" },
  ];
  const currentLabel = languages.find((item) => item.value === language)?.label || "فارسی";
  const currentMobileLabel = language === "fa" ? "FA" : "EN";
  const isStudentsPage = location.pathname.startsWith("/teacher/students");
  const isLiveClassesPage = location.pathname.startsWith("/teacher/live-classes");
  const isAttendancePage = location.pathname.startsWith("/teacher/attendance");
  const isAssignmentsPage = location.pathname.startsWith("/teacher/assignments");
  const isMessagesPage = location.pathname.startsWith("/teacher/messages");
  const searchPlaceholder = isLiveClassesPage
    ? language === "fa"
      ? "جستجو در صنف‌ها..."
      : "Search live classes..."
    : isAttendancePage
      ? language === "fa"
        ? "جستجو در حضور و غیاب..."
        : "Search attendance..."
      : isAssignmentsPage
      ? language === "fa"
        ? "جستجو در تمرین‌ها..."
        : "Search assignments..."
      : isStudentsPage
        ? language === "fa"
          ? "جستجو در شاگردان..."
          : "Search students..."
        : isMessagesPage
          ? language === "fa"
            ? "جستجو در پیام‌ها..."
            : "Search messages..."
          : language === "fa"
            ? "جستجو در کورس‌ها، شاگردان، صنف‌ها ..."
            : "Search courses, students, classes ...";

  return (
    <header className="sticky top-0 z-30 flex h-[var(--teacher-shell-header-height)] items-center justify-between bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 xl:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#0B4FD8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0B4FD8]/10 lg:w-96">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className={`w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 ${
              isRTL ? "text-right" : "text-left"
            }`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setOpenNotifications((value) => !value)}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            aria-label={language === "fa" ? "اعلان‌ها" : "Notifications"}
          >
            <Bell size={19} />
            {unreadCount > 0 ? (
              <span className="absolute -end-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {openNotifications ? (
            <div
              className={`fixed inset-x-3 bottom-3 top-[calc(var(--teacher-shell-header-height)+0.5rem)] z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:h-auto sm:max-h-[min(560px,calc(100vh-96px))] sm:w-[370px] ${
                isRTL ? "sm:left-0" : "sm:right-0"
              }`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">
                    {language === "fa" ? "اعلان‌ها" : "Notifications"}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    {language === "fa"
                      ? `${unreadCount} اعلان خوانده‌نشده`
                      : `${unreadCount} unread`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-200 sm:text-xs"
                    >
                      <CheckCheck size={14} />
                      <span className="hidden min-[390px]:inline">
                        {language === "fa" ? "خواندن همه" : "Read all"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpenNotifications(false)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 sm:hidden"
                    aria-label={language === "fa" ? "بستن اعلان‌ها" : "Close notifications"}
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[470px]">
                {notificationsLoading ? (
                  <p className="p-8 text-center text-sm font-bold text-slate-500">
                    {language === "fa" ? "در حال بارگذاری…" : "Loading…"}
                  </p>
                ) : notifications.length ? (
                  notifications.map((notification) => {
                    const Icon =
                      notification.type === "student_enrolled" ? UserPlus : UsersRound;
                    const localizedBody = language === "fa"
                      ? notification.type === "student_enrolled"
                        ? `${notification.student?.name || "یک شاگرد"} در کورس «${notification.course?.title || "شما"}» ثبت‌نام کرد.`
                        : `کورس «${notification.course?.title || "شما"}» به حداقل تعداد شاگردان رسیده و آماده شروع است.`
                      : notification.body;
                    return (
                      <div
                        key={notification._id}
                        className={`flex w-full items-start border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50 ${
                          notification.isRead ? "bg-white" : "bg-blue-50/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className="flex min-w-0 flex-1 items-start gap-3 p-3 text-start sm:p-4"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <strong className="line-clamp-2 break-words text-sm text-slate-950">
                                {notification.type === "student_enrolled"
                                  ? language === "fa"
                                    ? "ثبت‌نام شاگرد جدید"
                                    : notification.title
                                  : language === "fa"
                                    ? "حداقل شاگردان تکمیل شد"
                                    : notification.title}
                              </strong>
                              {!notification.isRead ? (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                              ) : null}
                            </span>
                            <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                              {localizedBody}
                            </span>
                            <span className="mt-1.5 block text-[11px] font-bold text-slate-400">
                              {relativeTime(notification.createdAt, language)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNotification(notification)}
                          disabled={deletingNotificationId === notification._id}
                          className="m-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50 sm:m-3"
                          aria-label={language === "fa" ? "حذف اعلان" : "Remove notification"}
                          title={language === "fa" ? "حذف اعلان" : "Remove notification"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto text-slate-300" size={32} />
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {language === "fa" ? "هنوز اعلانی ندارید." : "No notifications yet."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setOpenLangs((prev) => !prev)}
            className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-black text-[#1D4ED8] shadow-sm transition hover:bg-[#DBEAFE] sm:min-w-[88px]"
            aria-label={language === "fa" ? "تغییر زبان" : "Change language"}
          >
            <span className="sm:hidden">{currentMobileLabel}</span>
            <span className="hidden sm:inline">{currentLabel}</span>
            <ChevronDown
              size={13}
              className={`text-slate-500 transition ${openLangs ? "rotate-180" : ""}`}
            />
          </button>

          {openLangs ? (
            <div
              className={`absolute top-full z-50 mt-2 min-w-[130px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${
                isRTL ? "left-0" : "right-0"
              }`}
            >
              {languages.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onLanguageChange(item.value);
                    setOpenLangs(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                    item.value === language
                      ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.value === language ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
