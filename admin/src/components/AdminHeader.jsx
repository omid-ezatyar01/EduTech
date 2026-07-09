import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Menu,
  Search,
  UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { getApiBase } from "../../services/http.js";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../../services/notificationService.js";
import {
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";

const ADMIN_NOTIFICATIONS_CACHE_KEY = getAdminPageCacheKey("header-notifications");
const ADMIN_NOTIFICATIONS_CACHE_TTL_MS = 30 * 1000;

const resolveAvatarUrl = (rawAvatar) => {
  const avatar = String(rawAvatar || "").trim();
  if (!avatar) return "";
  if (/^https?:\/\//i.test(avatar) || avatar.startsWith("data:image/")) {
    return avatar;
  }

  if (avatar.startsWith("/")) {
    const apiBase = getApiBase();
    const backendOrigin = apiBase.replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "");
    return `${backendOrigin}${avatar}`;
  }

  return avatar;
};

export default function AdminHeader({ admin, onMenuClick }) {
  const { t, language, isRTL, setLanguage } = useAdminI18n();
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const languageRef = useRef(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const displayName = admin?.name || t("header.adminName");
  const adminMeta = admin?.email || t("header.adminRole");
  const adminAvatar = resolveAvatarUrl(admin?.avatar || "");
  const adminInitial = (displayName.trim()[0] || "A").toUpperCase();
  const languages = [
    { value: "fa", label: "فارسی" },
    { value: "en", label: "English" },
  ];
  const currentLabel = languages.find((item) => item.value === language)?.label || "فارسی";
  const currentMobileLabel = language === "fa" ? "FA" : "EN";

  useEffect(() => {
    let active = true;
    let timerId = null;

    const loadNotifications = async () => {
      if (!active || document.visibilityState === "hidden") return;

      try {
        const cached = readAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
          maxAgeMs: ADMIN_NOTIFICATIONS_CACHE_TTL_MS,
        });
        if (cached) {
          setNotifications(Array.isArray(cached.notifications) ? cached.notifications : []);
          setUnreadCount(Math.max(0, Number(cached.unreadCount) || 0));
          return;
        }
        const data = await fetchAdminNotifications();
        if (!active) return;
        const nextNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
        const nextUnreadCount = Math.max(0, Number(data?.unreadCount) || 0);
        setNotifications(nextNotifications);
        setUnreadCount(nextUnreadCount);
        writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
          notifications: nextNotifications,
          unreadCount: nextUnreadCount,
        });
      } catch {
        // Keep the header usable if notifications are temporarily unavailable.
      } finally {
        if (!active) return;
        timerId = window.setTimeout(loadNotifications, 30000);
      }
    };

    loadNotifications();

    return () => {
      active = false;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
      if (languageRef.current && !languageRef.current.contains(event.target)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      setNotifications((rows) =>
        rows.map((row) =>
          row._id === notification._id ? { ...row, isRead: true } : row,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      markAdminNotificationRead(notification._id).catch(() => {});
    }

    setIsNotificationsOpen(false);
    navigate(
      notification.type === "teacher_application_review"
        ? "/teachers"
        : "/courses?status=pending",
    );
  };

  const handleMarkAllRead = async () => {
    setNotifications((rows) => rows.map((row) => ({ ...row, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllAdminNotificationsRead();
    } catch {
      const data = await fetchAdminNotifications().catch(() => null);
      if (data) {
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Math.max(0, Number(data.unreadCount) || 0));
      }
    }
  };

  const formatNotificationTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language === "fa" ? "fa-AF" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <header className="sticky top-0 z-30 flex h-[var(--admin-shell-header-height)] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 xl:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#0B4FD8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0B4FD8]/10 lg:w-96">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder={t("common.searchInSystem")}
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
            onClick={() => setIsNotificationsOpen((open) => !open)}
            className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label={language === "fa" ? "اعلان‌ها" : "Notifications"}
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#8B5CF6] px-1 text-[10px] font-black text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div
              className={`absolute top-[calc(100%+12px)] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] ${
                isRTL ? "left-0" : "right-0"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {language === "fa" ? "اعلان‌های مدیر" : "Admin notifications"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    {language === "fa"
                      ? `${unreadCount} اعلان خوانده‌نشده`
                      : `${unreadCount} unread`}
                  </p>
                </div>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-50"
                  >
                    <CheckCheck size={14} />
                    {language === "fa" ? "خواندن همه" : "Mark all read"}
                  </button>
                ) : null}
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-start transition last:border-b-0 hover:bg-slate-50 ${
                        notification.isRead ? "bg-white" : "bg-blue-50/70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          notification.type === "teacher_application_review"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {notification.type === "teacher_application_review" ? (
                          <UserCheck size={18} />
                        ) : (
                          <BookOpenCheck size={18} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900">
                          {language === "fa"
                            ? notification.type === "teacher_application_review"
                              ? "درخواست استاد برای بررسی"
                              : "کورس جدید برای بررسی"
                            : notification.title}
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                          {language === "fa"
                            ? notification.type === "teacher_application_review"
                              ? `${notification.teacherName || "یک استاد"} فورم درخواست استادی را برای بررسی فرستاد.`
                              : `${notification.teacherName || "یک استاد"} کورس «${notification.courseTitle || ""}» را برای بررسی فرستاد.`
                            : notification.message}
                        </span>
                        <span className="mt-1.5 block text-[10px] font-bold text-slate-400">
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </span>
                      {!notification.isRead ? (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="px-5 py-10 text-center">
                    <Bell className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      {language === "fa"
                        ? "هنوز اعلانی وجود ندارد."
                        : "No notifications yet."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={languageRef}>
          <button
            type="button"
            onClick={() => setIsLanguageOpen((prev) => !prev)}
            className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-black text-[#1D4ED8] shadow-sm transition hover:bg-[#DBEAFE] sm:min-w-[88px]"
            aria-label={language === "fa" ? "تغییر زبان" : "Change language"}
          >
            <span className="sm:hidden">{currentMobileLabel}</span>
            <span className="hidden sm:inline">{currentLabel}</span>
            <ChevronDown
              size={13}
              className={`text-[#1D4ED8] transition ${isLanguageOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isLanguageOpen ? (
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
                    setLanguage(item.value);
                    setIsLanguageOpen(false);
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

        <div className="flex items-center gap-2 rounded-lg p-1">
          {adminAvatar ? (
            <img
              src={adminAvatar}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover shadow-sm"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <span
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 shadow-sm"
            style={{ display: adminAvatar ? "none" : "flex" }}
          >
            {adminInitial}
          </span>
          <div className="hidden min-w-0 max-w-[170px] flex-col items-start sm:flex">
            <span className="block w-full truncate text-sm font-bold text-slate-900" title={displayName}>
              {displayName}
            </span>
            <span className="block w-full truncate text-[11px] font-bold text-slate-500" title={adminMeta}>
              {adminMeta}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
