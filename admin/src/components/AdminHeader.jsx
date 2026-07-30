import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Menu,
  Search,
  Trash2,
  UserCheck,
  Landmark,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import { getApiBase } from "../../services/http.js";
import {
  deleteAdminNotification,
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
  const location = useLocation();
  const notificationRef = useRef(null);
  const languageRef = useRef(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [deletingNotificationId, setDeletingNotificationId] = useState("");
  const [systemSearch, setSystemSearch] = useState(
    () => new URLSearchParams(location.search).get("q") || "",
  );
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
        if (active) {
          timerId = window.setTimeout(loadNotifications, 30000);
        }
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSystemSearch(new URLSearchParams(location.search).get("q") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.search]);

  const handleSystemSearch = (event) => {
    event.preventDefault();
    const query = systemSearch.trim();
    const searchableRoutes = new Set([
      "/students",
      "/teachers",
      "/courses",
      "/payments",
      "/messages",
      "/coupons",
    ]);
    const targetPath = searchableRoutes.has(location.pathname)
      ? location.pathname
      : "/students";
    const params = new URLSearchParams(
      targetPath === location.pathname ? location.search : "",
    );
    if (query) params.set("q", query);
    else params.delete("q");
    navigate(`${targetPath}${params.size ? `?${params.toString()}` : ""}`);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await markAdminNotificationRead(notification._id);
        const nextNotifications = notifications.map((row) =>
          row._id === notification._id ? { ...row, isRead: true } : row,
        );
        const nextUnreadCount = Math.max(0, unreadCount - 1);
        setNotifications(nextNotifications);
        setUnreadCount(nextUnreadCount);
        writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
          notifications: nextNotifications,
          unreadCount: nextUnreadCount,
        });
      } catch {
        // Keep the notification unread if the server did not persist the change.
      }
    }

    setIsNotificationsOpen(false);
    navigate(
      notification.type === "teacher_bank_payment_review"
        ? "/teacher-bank-reviews"
        : notification.type === "teacher_application_review"
          ? "/teachers"
          : "/courses?status=pending",
    );
  };

  const handleMarkAllRead = async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    const nextNotifications = notifications.map((row) => ({ ...row, isRead: true }));
    setNotifications(nextNotifications);
    setUnreadCount(0);
    writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
      notifications: nextNotifications,
      unreadCount: 0,
    });
    try {
      await markAllAdminNotificationsRead();
    } catch {
      const data = await fetchAdminNotifications().catch(() => null);
      if (data) {
        const refreshedNotifications = Array.isArray(data.notifications) ? data.notifications : [];
        const refreshedUnreadCount = Math.max(0, Number(data.unreadCount) || 0);
        setNotifications(refreshedNotifications);
        setUnreadCount(refreshedUnreadCount);
        writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
          notifications: refreshedNotifications,
          unreadCount: refreshedUnreadCount,
        });
      } else {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
          notifications: previousNotifications,
          unreadCount: previousUnreadCount,
        });
      }
    }
  };

  const handleRemoveNotification = async (notification) => {
    if (!notification?._id || deletingNotificationId) return;
    setDeletingNotificationId(notification._id);
    try {
      await deleteAdminNotification(notification._id);
      const nextNotifications = notifications.filter(
        (row) => row._id !== notification._id,
      );
      const nextUnreadCount = notification.isRead
        ? unreadCount
        : Math.max(0, unreadCount - 1);
      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
      writeAdminPageCache(ADMIN_NOTIFICATIONS_CACHE_KEY, {
        notifications: nextNotifications,
        unreadCount: nextUnreadCount,
      });
    } finally {
      setDeletingNotificationId("");
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

        <form
          onSubmit={handleSystemSearch}
          role="search"
          className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#0B4FD8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0B4FD8]/10 lg:w-96"
        >
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={systemSearch}
            onChange={(event) => setSystemSearch(event.target.value)}
            placeholder={t("common.searchInSystem")}
            className={`w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 ${
              isRTL ? "text-right" : "text-left"
            }`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </form>
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
              className={`fixed inset-x-3 bottom-3 top-[calc(var(--admin-shell-header-height)+0.5rem)] z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-[calc(100%+12px)] sm:h-auto sm:max-h-[min(560px,calc(100vh-96px))] sm:w-[370px] ${
                isRTL ? "sm:left-0" : "sm:right-0"
              }`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">
                    {language === "fa" ? "اعلان‌های مدیر" : "Admin notifications"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    {language === "fa"
                      ? `${unreadCount} اعلان خوانده‌نشده`
                      : `${unreadCount} unread`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-blue-700 hover:bg-blue-50"
                    >
                      <CheckCheck size={14} />
                      <span className="hidden min-[390px]:inline">
                        {language === "fa" ? "خواندن همه" : "Mark all read"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 sm:hidden"
                    aria-label={language === "fa" ? "بستن اعلان‌ها" : "Close notifications"}
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[470px]">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`flex w-full items-start border-b border-slate-100 text-start transition last:border-b-0 hover:bg-slate-50 ${
                        notification.isRead ? "bg-white" : "bg-blue-50/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-start sm:px-4"
                      >
                        <span
                          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            notification.type === "teacher_application_review"
                              ? "bg-blue-100 text-blue-700"
                              : notification.type === "teacher_bank_payment_review"
                                ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {notification.type === "teacher_application_review" ? (
                            <UserCheck size={18} />
                          ) : notification.type === "teacher_bank_payment_review" ? (
                            <Landmark size={18} />
                          ) : (
                            <BookOpenCheck size={18} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-black text-slate-900">
                            {language === "fa"
                              ? notification.type === "teacher_application_review"
                                ? "درخواست استاد برای بررسی"
                                : notification.type === "teacher_bank_payment_review"
                                  ? "اطلاعات بانکی برای بررسی"
                                  : "کورس جدید برای بررسی"
                              : notification.title}
                          </span>
                          <span className="mt-1 block break-words text-xs font-semibold leading-5 text-slate-600">
                            {language === "fa"
                              ? notification.type === "teacher_application_review"
                                ? `${notification.teacherName || "یک استاد"} فورم درخواست استادی را برای بررسی فرستاد.`
                                : notification.type === "teacher_bank_payment_review"
                                  ? `${notification.teacherName || "یک استاد"} اطلاعات کارت یا حساب خود را برای بررسی فرستاد.`
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
                      <button
                        type="button"
                        onClick={() => handleRemoveNotification(notification)}
                        disabled={deletingNotificationId === notification._id}
                        className="m-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50 sm:m-3"
                        aria-label={language === "fa" ? "حذف اعلان" : "Remove notification"}
                        title={language === "fa" ? "حذف اعلان" : "Remove notification"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
