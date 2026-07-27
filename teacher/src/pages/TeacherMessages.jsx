import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, ChevronLeft, MessageCircle, Search, Send } from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { getAuthUser } from "../../services/portal";
import { fetchTeacherCourses } from "../../services/courseService";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import {
  deleteTeacherCourseBroadcastMessages,
  fetchTeacherAdminConversation,
  fetchTeacherCourseBroadcastConversations,
  fetchTeacherCourseBroadcastMessages,
  fetchTeacherMessageSettings,
  markTeacherAdminConversationRead,
  sendTeacherAdminMessage,
  sendTeacherCourseBroadcastMessage,
  updateTeacherCourseGroupMessageSettings,
  updateTeacherMessageSettings,
} from "../../services/messageService";

const formatDateTime = (value, language) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-IR" : "en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MESSAGES_CACHE_KEY = getTeacherPageCacheKey("messages");
const isManageableCourse = (course = {}) => !course?.classEndedAt;

export default function TeacherMessages() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const isFa = language === "fa";
  const initialMessagesCache = readTeacherPageCache(MESSAGES_CACHE_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [courses, setCourses] = useState(initialMessagesCache?.courses || []);
  const [groupConversations, setGroupConversations] = useState(initialMessagesCache?.groupConversations || []);
  const [selectedCourseChatId, setSelectedCourseChatId] = useState(initialMessagesCache?.selectedCourseChatId || "");
  const [selectedCourseChat, setSelectedCourseChat] = useState(initialMessagesCache?.selectedCourseChat || null);
  const [groupChatMessages, setGroupChatMessages] = useState(initialMessagesCache?.groupChatMessages || []);
  const [groupChatDraft, setGroupChatDraft] = useState("");
  const [loadingGroupChatMessages, setLoadingGroupChatMessages] = useState(false);
  const [groupChatSelecting, setGroupChatSelecting] = useState(false);
  const [selectedGroupMessageIds, setSelectedGroupMessageIds] = useState([]);
  const [groupDeleting, setGroupDeleting] = useState(false);
  const [adminConversation, setAdminConversation] = useState(initialMessagesCache?.adminConversation || null);
  const [adminMessages, setAdminMessages] = useState(initialMessagesCache?.adminMessages || []);
  const [adminDraft, setAdminDraft] = useState("");
  const [adminConversationLoading, setAdminConversationLoading] = useState(false);
  const [adminSending, setAdminSending] = useState(false);
  const [groupCourseId, setGroupCourseId] = useState("");
  const [groupBody, setGroupBody] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [chatSettingsLoading, setChatSettingsLoading] = useState(true);
  const [chatSettingsSaving, setChatSettingsSaving] = useState(false);
  const [allowStudentDirectMessages, setAllowStudentDirectMessages] = useState(true);
  const [courseChatSettingsSaving, setCourseChatSettingsSaving] = useState(false);
  const [allowCourseStudentMessages, setAllowCourseStudentMessages] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const adminBottomRef = useRef(null);
  const groupBottomRef = useRef(null);

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  const selectedGroupConversation = useMemo(
    () => groupConversations.find((row) => row.courseId === selectedCourseChatId) || null,
    [groupConversations, selectedCourseChatId],
  );
  const activeCourseIds = useMemo(
    () => new Set((Array.isArray(courses) ? courses : []).map((course) => String(course.id || ""))),
    [courses],
  );

  const filteredGroupConversations = useMemo(() => {
    let rows = Array.isArray(groupConversations) ? [...groupConversations] : [];

    const q = String(searchQuery || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        String(row?.courseTitle || "").toLowerCase().includes(q) ||
        String(row?.lastMessage || "").toLowerCase().includes(q),
      );
    }

    if (showUnreadOnly) {
      rows = rows.filter((row) => Number(row?.unreadCount || 0) > 0);
    }

    return rows;
  }, [groupConversations, searchQuery, showUnreadOnly]);

  const canStudentsReplyInSelectedCourse =
    allowStudentDirectMessages && allowCourseStudentMessages;
  const isCourseToggleLockedByGlobal = !allowStudentDirectMessages;
  const showConversationList = !isMobileViewport || !selectedCourseChatId;
  const showChatPanel = !isMobileViewport || Boolean(selectedCourseChatId);

  const groupStats = useMemo(() => ({
    totalConversations: Array.isArray(groupConversations) ? groupConversations.length : 0,
    totalUnreadMessages: (Array.isArray(groupConversations) ? groupConversations : []).reduce(
      (sum, row) => sum + Number(row?.unreadCount || 0),
      0,
    ),
  }), [groupConversations]);

  const adminUnreadCount = Number(adminConversation?.unreadCount || 0);

  useEffect(() => {
    adminBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [adminMessages.length]);

  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupChatMessages.length]);

  const loadAdminConversation = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    try {
      if (!silent) {
        setAdminConversationLoading(true);
      }
      const data = await fetchTeacherAdminConversation();
      setAdminConversation(data?.conversation || null);
      setAdminMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (Number(data?.conversation?.unreadCount || 0) > 0) {
        await markTeacherAdminConversationRead().catch(() => null);
        setAdminConversation((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
      }
    } catch (err) {
      if (!silent) {
        setError(err?.message || (isFa ? "بارگذاری پیام‌های ادمین ناموفق بود." : "Failed to load admin messages."));
      }
      setAdminConversation(null);
      setAdminMessages([]);
    } finally {
      if (!silent) {
        setAdminConversationLoading(false);
      }
    }
  }, [isFa]);

  const loadGroupConversations = useCallback(async (preferCourseId = "") => {
    try {
      const rows = await fetchTeacherCourseBroadcastConversations();
      const normalized = (Array.isArray(rows) ? rows : []).filter((row) =>
        activeCourseIds.has(String(row?.courseId || "")),
      );
      setGroupConversations(normalized);

      const nextId =
        (preferCourseId && normalized.some((row) => row.courseId === preferCourseId) && preferCourseId) ||
        (selectedCourseChatId && normalized.some((row) => row.courseId === selectedCourseChatId) && selectedCourseChatId) ||
        (normalized[0]?.courseId || "");
      setSelectedCourseChatId(nextId);
    } catch {
      setGroupConversations([]);
      setSelectedCourseChatId("");
    }
  }, [activeCourseIds, selectedCourseChatId]);

  const loadGroupMessages = useCallback(async (courseId, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!courseId) {
      setSelectedCourseChat(null);
      setGroupChatMessages([]);
      return;
    }

    try {
      if (!silent) {
        setLoadingGroupChatMessages(true);
        setError("");
      }
      const data = await fetchTeacherCourseBroadcastMessages(courseId);
      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setSelectedCourseChat(data?.course || null);
      setAllowCourseStudentMessages(data?.course?.allowStudentGroupMessages !== false);
      setGroupChatMessages(nextMessages);
      setSelectedGroupMessageIds([]);
      setGroupChatSelecting(false);
    } catch (err) {
      if (silent) return;
      setError(err?.message || (isFa ? "بارگذاری تاریخچه پیام صنف ناموفق بود." : "Failed to load class chat history."));
      setSelectedCourseChat(null);
      setGroupChatMessages([]);
    } finally {
      if (!silent) {
        setLoadingGroupChatMessages(false);
      }
    }
  }, [isFa]);

  const loadMessageSettings = useCallback(async () => {
    try {
      setChatSettingsLoading(true);
      const settings = await fetchTeacherMessageSettings();
      setAllowStudentDirectMessages(settings?.allowStudentDirectMessages !== false);
    } catch {
      setAllowStudentDirectMessages(true);
    } finally {
      setChatSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMessageSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMessageSettings]);

  useEffect(() => {
    let mounted = true;

    const loadCourses = async () => {
      try {
        const { courses: rows } = await fetchTeacherCourses({ page: 1, limit: 100 });
        if (!mounted) return;
        const normalized = (Array.isArray(rows) ? rows : []).filter(isManageableCourse).map((row) => ({
          id: String(row?._id || row?.id || ""),
          title: String(row?.title || "").trim(),
        })).filter((row) => row.id && row.title);
        setCourses(normalized);
        setGroupCourseId((previous) => previous || normalized[0]?.id || "");
      } catch {
        if (!mounted) return;
      }
    };

    loadCourses();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    writeTeacherPageCache(MESSAGES_CACHE_KEY, {
      courses,
      groupConversations,
      selectedCourseChatId,
      selectedCourseChat,
      groupChatMessages,
      adminConversation,
      adminMessages,
    });
  }, [adminConversation, adminMessages, courses, groupConversations, groupChatMessages, selectedCourseChat, selectedCourseChatId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGroupConversations();
      loadAdminConversation();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAdminConversation, loadGroupConversations]);

  useEffect(() => {
    if (!selectedCourseChatId) return;
    const timer = setTimeout(() => {
      loadGroupMessages(selectedCourseChatId);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadGroupMessages, selectedCourseChatId]);

  useEffect(() => {
    const refreshData = async () => {
      await loadAdminConversation({ silent: true });
      await loadGroupConversations(selectedCourseChatId);
      if (selectedCourseChatId) {
        await loadGroupMessages(selectedCourseChatId, { silent: true });
      }
    };

    const triggerRefresh = () => {
      refreshData();
    };

    window.addEventListener("teacher_auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      window.removeEventListener("teacher_auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, [loadAdminConversation, loadGroupConversations, loadGroupMessages, selectedCourseChatId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 1279px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSendGroupMessage = async () => {
    const body = String(groupBody || "").trim();
    if (!groupCourseId || !body) return;
    try {
      setGroupSending(true);
      setError("");
      const result = await sendTeacherCourseBroadcastMessage({
        courseId: groupCourseId,
        body,
      });
      const sentCount = Number(result?.sentCount || 0);
      setGroupBody("");
      setSelectedCourseChatId(groupCourseId);
      window.dispatchEvent(new Event("edutech_data_changed"));
      setToast(
        isFa
          ? `پیام گروهی برای ${sentCount} شاگرد ارسال شد.`
          : `Group message sent to ${sentCount} students.`,
      );
      await loadGroupConversations(groupCourseId);
      await loadGroupMessages(groupCourseId, { silent: true });
    } catch (err) {
      setError(err?.message || (isFa ? "ارسال پیام گروهی ناموفق بود." : "Failed to send group message."));
    } finally {
      setGroupSending(false);
    }
  };

  const handleSendAdminMessage = async () => {
    const body = String(adminDraft || "").trim();
    if (!body) return;

    try {
      setAdminSending(true);
      setError("");
      const nextMessage = await sendTeacherAdminMessage({ body });
      setAdminDraft("");
      setAdminMessages((prev) => [...prev, nextMessage].filter(Boolean));
      setAdminConversation((prev) => ({
        ...(prev || {}),
        unreadCount: 0,
        lastMessage: body,
        lastMessageAt: nextMessage?.createdAt || new Date().toISOString(),
        lastSenderRole: "teacher",
      }));
      window.dispatchEvent(new Event("edutech_data_changed"));
      setToast(isFa ? "پیام به ادمین ارسال شد." : "Message sent to admin.");
    } catch (err) {
      setError(err?.message || (isFa ? "ارسال پیام به ادمین ناموفق بود." : "Failed to send message to admin."));
    } finally {
      setAdminSending(false);
    }
  };

  const handleSendGroupChatMessage = async () => {
    const body = String(groupChatDraft || "").trim();
    if (!selectedCourseChatId || !body) return;

    try {
      setGroupSending(true);
      setError("");
      const result = await sendTeacherCourseBroadcastMessage({
        courseId: selectedCourseChatId,
        body,
      });
      const sentCount = Number(result?.sentCount || 0);
      setGroupChatDraft("");
      window.dispatchEvent(new Event("edutech_data_changed"));
      setToast(
        isFa
          ? `پیام برای ${sentCount} شاگرد ارسال شد.`
          : `Message sent to ${sentCount} students.`,
      );
      await loadGroupConversations(selectedCourseChatId);
      await loadGroupMessages(selectedCourseChatId, { silent: true });
    } catch (err) {
      setError(err?.message || (isFa ? "ارسال پیام گروهی ناموفق بود." : "Failed to send group message."));
    } finally {
      setGroupSending(false);
    }
  };

  const handleToggleStudentChat = async (checked) => {
    const nextValue = Boolean(checked);
    const previousValue = allowStudentDirectMessages;
    setAllowStudentDirectMessages(nextValue);

    try {
      setChatSettingsSaving(true);
      setError("");
      const saved = await updateTeacherMessageSettings({
        allowStudentDirectMessages: nextValue,
      });
      const finalValue = saved?.allowStudentDirectMessages !== false;
      window.dispatchEvent(new Event("edutech_data_changed"));
      setAllowStudentDirectMessages(finalValue);
      setToast(
        isFa
          ? finalValue
            ? "پیام مستقیم شاگردان فعال شد."
            : "پیام مستقیم شاگردان غیرفعال شد."
          : finalValue
            ? "Student direct messages enabled."
            : "Student direct messages disabled.",
      );
    } catch (err) {
      setAllowStudentDirectMessages(previousValue);
      setError(
        err?.message ||
          (isFa
            ? "ذخیره تنظیمات پیام ناموفق بود."
            : "Failed to save message settings."),
      );
    } finally {
      setChatSettingsSaving(false);
    }
  };

  const handleToggleCourseStudentChat = async (checked) => {
    if (!selectedCourseChatId) return;
    if (!allowStudentDirectMessages) return;

    const nextValue = Boolean(checked);
    const previousValue = allowCourseStudentMessages;
    setAllowCourseStudentMessages(nextValue);

    try {
      setCourseChatSettingsSaving(true);
      setError("");
      const saved = await updateTeacherCourseGroupMessageSettings(selectedCourseChatId, {
        allowStudentGroupMessages: nextValue,
      });
      const finalValue = saved?.allowStudentGroupMessages !== false;
      setAllowCourseStudentMessages(finalValue);
      setToast(
        isFa
          ? finalValue
            ? "پاسخ شاگردان برای این صنف فعال شد."
            : "پاسخ شاگردان برای این صنف غیرفعال شد."
          : finalValue
            ? "Student replies enabled for this class."
            : "Student replies disabled for this class.",
      );
      await loadGroupConversations(selectedCourseChatId);
      await loadGroupMessages(selectedCourseChatId, { silent: true });
    } catch (err) {
      setAllowCourseStudentMessages(previousValue);
      setError(
        err?.message ||
          (isFa ? "ذخیره تنظیمات صنف ناموفق بود." : "Failed to save class chat settings."),
      );
    } finally {
      setCourseChatSettingsSaving(false);
    }
  };

  const toggleSelectedGroupMessage = (messageId) => {
    setSelectedGroupMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId],
    );
  };

  const handleDeleteSelectedGroupMessages = async () => {
    if (!selectedCourseChatId || !selectedGroupMessageIds.length) return;

    try {
      setGroupDeleting(true);
      setError("");
      await deleteTeacherCourseBroadcastMessages(selectedCourseChatId, {
        clearAll: false,
        messageIds: selectedGroupMessageIds,
      });
      window.dispatchEvent(new Event("edutech_data_changed"));
      setSelectedGroupMessageIds([]);
      setGroupChatSelecting(false);
      await loadGroupMessages(selectedCourseChatId, { silent: true });
      await loadGroupConversations(selectedCourseChatId);
      setToast(isFa ? "پیام‌های انتخاب‌شده حذف شد." : "Selected messages removed.");
    } catch (err) {
      setError(err?.message || (isFa ? "حذف پیام‌ها ناموفق بود." : "Failed to delete selected messages."));
    } finally {
      setGroupDeleting(false);
    }
  };

  const handleClearAllGroupMessages = async () => {
    if (!selectedCourseChatId) return;

    const confirmed = window.confirm(
      isFa
        ? "همه پیام‌های این صنف برای همیشه حذف شود؟"
        : "Delete all messages of this class permanently?",
    );
    if (!confirmed) return;

    try {
      setGroupDeleting(true);
      setError("");
      await deleteTeacherCourseBroadcastMessages(selectedCourseChatId, {
        clearAll: true,
        messageIds: [],
      });
      window.dispatchEvent(new Event("edutech_data_changed"));
      setSelectedGroupMessageIds([]);
      setGroupChatSelecting(false);
      await loadGroupMessages(selectedCourseChatId, { silent: true });
      await loadGroupConversations(selectedCourseChatId);
      setToast(isFa ? "همه پیام‌های صنف حذف شد." : "All class messages cleared.");
    } catch (err) {
      setError(err?.message || (isFa ? "پاک‌سازی پیام‌ها ناموفق بود." : "Failed to clear class messages."));
    } finally {
      setGroupDeleting(false);
    }
  };

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section className={`space-y-4 ${isRTL ? "text-right" : "text-left"}`}>
        <header className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A]">{isFa ? "مرکز پیام‌های استاد" : "Teacher Messages Hub"}</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">
                {isFa
                  ? "گفتگوهای واقعی با شاگردان کورس‌های خود را مدیریت کنید."
                  : "Manage real conversations with students in your courses."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-bold text-[#1D4ED8]">
                {isFa ? `گفتگوها: ${groupStats.totalConversations || 0}` : `Conversations: ${groupStats.totalConversations || 0}`}
              </span>
              <span className="rounded-full bg-[#FEF3C7] px-3 py-1.5 text-xs font-bold text-[#B45309]">
                {isFa ? `خوانده‌نشده: ${groupStats.totalUnreadMessages || 0}` : `Unread: ${groupStats.totalUnreadMessages || 0}`}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await loadGroupConversations(selectedCourseChatId);
                  if (selectedCourseChatId) {
                    await loadGroupMessages(selectedCourseChatId, { silent: true });
                  }
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 text-xs font-semibold text-slate-700 hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
              >
                <CheckCheck size={14} />
                {isFa ? "تازه‌سازی گفتگوها" : "Refresh Conversations"}
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isFa ? "تنظیمات چت شاگردان" : "Student Chat Settings"}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {isFa
                  ? "با خاموش‌کردن این گزینه، شاگردان فقط پیام‌های شما را می‌بینند و نمی‌توانند پاسخ جدید ارسال کنند."
                  : "When disabled, students can read your messages but cannot send new replies."}
              </p>
            </div>
            <label className="inline-flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold text-slate-700">
                {allowStudentDirectMessages
                  ? isFa
                    ? "فعال"
                    : "Enabled"
                  : isFa
                    ? "غیرفعال"
                    : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={allowStudentDirectMessages}
                disabled={chatSettingsLoading || chatSettingsSaving}
                onChange={(event) => handleToggleStudentChat(event.target.checked)}
              />
            </label>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}
        {toast ? (
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
            {toast}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f0f2f5] p-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isFa ? "گفتگوی مستقیم با ادمین" : "Direct Admin Conversation"}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {isFa
                  ? "برای هماهنگی، پشتیبانی یا پیگیری موضوعات آموزشی مستقیما به ادمین پیام بدهید."
                  : "Message the admin directly for coordination, support, or teaching-related follow-up."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-bold text-[#1D4ED8]">
                {isFa ? "ادمین EduTech" : "EduTech Admin"}
              </span>
              <span className="rounded-full bg-[#FEF3C7] px-3 py-1.5 text-xs font-bold text-[#B45309]">
                {isFa ? `خوانده‌نشده: ${adminUnreadCount}` : `Unread: ${adminUnreadCount}`}
              </span>
            </div>
          </div>

          <div>
            {adminConversationLoading ? (
              <TeacherPageLoader
                label={isFa ? "در حال بارگذاری گفتگوی ادمین" : "Loading admin conversation"}
                minHeight="min-h-[160px]"
                className="border-0 bg-transparent p-0"
              />
            ) : (
              <>
                <div className="chat-scrollbar-side edutech-scrollbar max-h-[360px] min-h-[220px] space-y-2 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:18px_18px] p-3 sm:p-4">
                  {adminMessages.length ? (
                    adminMessages.map((message) => {
                      const isMine = message?.senderRole === "teacher";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-xl px-3 py-2 text-sm shadow-sm sm:max-w-[82%] ${
                              isMine
                                ? "bg-[#d9fdd3] text-slate-900"
                                : "bg-white text-slate-700"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              {formatDateTime(message.createdAt, language)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="grid min-h-[140px] place-items-center text-center">
                      <div>
                        <MessageCircle size={28} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-bold text-slate-700">
                          {isFa ? "هنوز گفتگویی با ادمین شروع نشده است." : "No admin conversation yet."}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {isFa ? "اولین پیام را برای شروع گفتگو ارسال کنید." : "Send the first message to start the conversation."}
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={adminBottomRef} />
                </div>

                <div className="flex items-end gap-2 border-t border-slate-200 bg-[#f0f2f5] p-3">
                  <textarea
                    value={adminDraft}
                    onChange={(event) => setAdminDraft(event.target.value)}
                    placeholder={isFa ? "پیام خود به ادمین را بنویسید..." : "Write your message to admin..."}
                    rows={1}
                    className="min-h-11 max-h-28 flex-1 resize-none rounded-3xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={adminSending || !String(adminDraft || "").trim()}
                    onClick={handleSendAdminMessage}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">{isFa ? "ارسال پیام گروهی کورس" : "Course Group Message"}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isFa
              ? "پیام یکسان برای همه شاگردان کورس انتخاب‌شده ارسال می‌شود."
              : "The same message will be sent to all students in the selected course."}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-[280px_1fr_auto]">
            <select
              value={groupCourseId}
              onChange={(event) => setGroupCourseId(event.target.value)}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            >
              <option value="">{isFa ? "انتخاب کورس" : "Select course"}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <input
              value={groupBody}
              onChange={(event) => setGroupBody(event.target.value)}
              placeholder={isFa ? "متن پیام گروهی..." : "Group message text..."}
              className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#0B4FD8]"
            />
            <button
              type="button"
              disabled={groupSending || !groupCourseId || !String(groupBody || "").trim()}
              onClick={handleSendGroupMessage}
              className="h-11 rounded-xl bg-[#0B4FD8] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {groupSending ? (isFa ? "درحال ارسال" : "Sending") : isFa ? "ارسال گروهی" : "Send Group"}
            </button>
          </div>
        </section>

        <section className="grid gap-0 overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm xl:grid-cols-[360px_1fr]">
          {showConversationList ? (
          <aside className="border-e border-[#E2E8F0] bg-white">
            <div className="border-b border-slate-200 bg-[#f0f2f5] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3">
              <Search size={16} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={isFa ? "جستجوی شاگرد یا پیام..." : "Search student or message..."}
                className="h-11 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) => setShowUnreadOnly(event.target.checked)}
              />
              {isFa ? "فقط گفتگوهای خوانده‌نشده" : "Only unread conversations"}
            </label>
            </div>

            <div className="chat-scrollbar-side edutech-scrollbar max-h-[70dvh] overflow-y-auto xl:max-h-[730px]">
              <div>
                <p className="px-4 pb-2 pt-4 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  {isFa ? "گروه‌های صنف" : "Class Groups"}
                </p>
                <p className="px-4 pb-2 text-[10px] font-semibold text-rose-600">
                  {isFa
                    ? "تمام پیام‌های این گروه پس از ۷۲ ساعت برای همیشه حذف می‌شود."
                    : "All messages in this group are permanently deleted after 72 hours."}
                </p>
                {filteredGroupConversations.length ? (
                  <div>
                    {filteredGroupConversations.map((row) => {
                      const isActive = selectedCourseChatId === row.courseId;
                      return (
                        <button
                          key={row.courseId}
                          type="button"
                          onClick={() => {
                            setSelectedCourseChatId(row.courseId);
                          }}
                          className={`w-full border-b border-slate-100 p-4 text-start transition ${
                            isActive
                              ? "bg-[#e7f3ff]"
                              : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-black text-slate-900">{row.courseTitle}</p>
                            <span className="shrink-0 text-[10px] font-bold text-slate-400">
                              {formatDateTime(row.lastMessageAt, language)}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-xs font-semibold text-slate-600">
                            {row.lastMessage || (isFa ? "هنوز پیام گروهی ارسال نشده است." : "No group messages yet.")}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-rose-600">
                            {isFa ? "حذف خودکار ۷۲ ساعته" : "72h auto-delete"}
                          </p>
                          {Number(row.unreadCount || 0) > 0 ? (
                            <div className="mt-2 flex justify-end">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0B4FD8] px-1.5 text-[10px] font-black text-white">
                                {row.unreadCount}
                              </span>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-4 text-center text-xs font-semibold text-slate-500">
                    {isFa ? "پس از ارسال پیام گروهی، تاریخچه صنف اینجا نمایش می‌شود." : "Class history appears here after sending a group message."}
                  </p>
                )}
              </div>

            </div>
          </aside>
          ) : null}

          {showChatPanel ? (
          <article className="bg-white">
            {selectedCourseChatId && selectedGroupConversation ? (
              <div className="flex h-[70dvh] min-h-[420px] flex-col md:h-[730px]">
                <header className="border-b border-[#E2E8F0] bg-[#f0f2f5] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {isMobileViewport ? (
                        <button
                          type="button"
                          onClick={() => setSelectedCourseChatId("")}
                            className="me-2 inline-grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-200"
                            aria-label={isFa ? "بازگشت به گفتگوها" : "Back to chats"}
                          >
                            <ChevronLeft size={14} className={isRTL ? "rotate-180" : ""} />
                        </button>
                      ) : null}
                      <h2 className="text-sm font-black text-slate-900">{selectedCourseChat?.title || selectedGroupConversation.courseTitle}</h2>
                      <p className="text-xs font-semibold text-slate-500">
                        {isFa ? "تاریخچه پیام‌های گروهی صنف" : "Class group message history"}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-rose-600">
                        {isFa
                          ? "حذف خودکار: همه پیام‌ها بعد از ۷۲ ساعت پاک می‌شود."
                          : "Auto-delete: all messages are removed after 72 hours."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-bold text-[#1D4ED8]">
                        {isFa ? "گروه صنف" : "Class Group"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setGroupChatSelecting((prev) => !prev);
                          setSelectedGroupMessageIds([]);
                        }}
                        className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-700"
                      >
                        {groupChatSelecting
                          ? (isFa ? "لغو انتخاب" : "Cancel")
                          : (isFa ? "انتخاب پیام" : "Select")}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllGroupMessages}
                        disabled={groupDeleting}
                        className="h-8 rounded-lg border border-rose-300 bg-rose-50 px-3 text-[11px] font-bold text-rose-700 disabled:opacity-60"
                      >
                        {isFa ? "حذف همه" : "Clear All"}
                      </button>
                      {groupChatSelecting ? (
                        <button
                          type="button"
                          onClick={handleDeleteSelectedGroupMessages}
                          disabled={groupDeleting || !selectedGroupMessageIds.length}
                          className="h-8 rounded-lg bg-rose-600 px-3 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          {isFa ? "حذف انتخاب‌شده" : "Delete Selected"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">
                      <span>{isFa ? "پاسخ شاگردان برای این صنف" : "Student replies for this class"}</span>
                      <input
                        type="checkbox"
                        checked={allowStudentDirectMessages && allowCourseStudentMessages}
                        disabled={courseChatSettingsSaving || isCourseToggleLockedByGlobal}
                        onChange={(event) => handleToggleCourseStudentChat(event.target.checked)}
                      />
                    </label>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${canStudentsReplyInSelectedCourse ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {canStudentsReplyInSelectedCourse
                        ? (isFa ? "امکان پاسخ فعال" : "Replies enabled")
                        : (isFa ? "امکان پاسخ غیرفعال" : "Replies disabled")}
                    </span>
                    {isCourseToggleLockedByGlobal ? (
                      <span className="text-[10px] font-semibold text-amber-700">
                        {isFa
                          ? "به‌دلیل غیرفعال بودن تنظیمات سراسری، پاسخ این صنف نیز غیرفعال است."
                          : "Global setting is disabled, so class replies are also disabled."}
                      </span>
                    ) : null}
                  </div>
                </header>

                <div className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:18px_18px] p-3 sm:p-4">
                  {loadingGroupChatMessages ? (
                    <TeacherPageLoader
                      label={isFa ? "در حال بارگذاری تاریخچه صنف" : "Loading class history"}
                      minHeight="min-h-[220px]"
                      className="border-0 bg-transparent"
                    />
                  ) : groupChatMessages.length ? (
                    groupChatMessages.map((msg) => {
                      const isMine = msg.senderRole === "teacher";
                      const isChecked = selectedGroupMessageIds.includes(msg.id);
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          {groupChatSelecting ? (
                            <label className={`mr-2 mt-2 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded border ${isChecked ? "border-[#0B4FD8] bg-[#0B4FD8]" : "border-slate-300 bg-white"}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isChecked}
                                onChange={() => toggleSelectedGroupMessage(msg.id)}
                              />
                            </label>
                          ) : null}
                          <div
                            className={`max-w-[88%] rounded-xl px-3 py-2 text-sm shadow-sm sm:max-w-[82%] ${
                              isMine
                                ? "bg-[#d9fdd3] text-slate-900"
                                : "bg-white text-slate-800"
                            }`}
                          >
                            <p className={`mb-1 text-[10px] font-bold ${isMine ? "text-emerald-700" : "text-[#0B4FD8]"}`}>
                              {isMine
                                ? (isFa ? "استاد" : "Teacher")
                                : (msg.senderName || (isFa ? "شاگرد" : "Student"))}
                            </p>
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              {formatDateTime(msg.createdAt, language)}
                              {isMine && Number(msg.sentCount || 0) > 0
                                ? isFa
                                  ? ` - ارسال به ${msg.sentCount} شاگرد`
                                  : ` - sent to ${msg.sentCount} students`
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm font-semibold text-slate-500">
                        {isFa ? "برای این صنف هنوز پیام گروهی ثبت نشده است." : "No group messages yet for this class."}
                      </p>
                    </div>
                  )}
                  <div ref={groupBottomRef} />
                </div>

                <footer className="border-t border-[#E2E8F0] bg-[#f0f2f5] p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={groupChatDraft}
                      onChange={(event) => setGroupChatDraft(event.target.value)}
                      placeholder={isFa ? "پیام گروهی جدید برای این صنف..." : "New group message for this class..."}
                      rows={1}
                      className="max-h-32 min-h-[46px] flex-1 resize-none rounded-3xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={groupSending || !String(groupChatDraft || "").trim()}
                      onClick={handleSendGroupChatMessage}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </footer>
              </div>
            ) : (
              <div className="flex h-[70dvh] min-h-[420px] flex-col items-center justify-center gap-3 text-center text-slate-500 md:h-[730px]">
                <MessageCircle size={28} className="text-slate-300" />
                <p className="text-sm font-semibold">{isFa ? "گفتگو را از لیست سمت راست انتخاب کنید." : "Select a conversation from the sidebar."}</p>
              </div>
            )}
          </article>
          ) : null}
        </section>
      </section>
    </TeacherLayout>
  );
}
