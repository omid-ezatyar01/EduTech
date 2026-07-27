import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  CheckCheck,
  MessageCircle,
  Search,
  Send,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import StudentLayout from "./StudentLayout.jsx";
import {
  fetchStudentGroupConversations,
  fetchStudentGroupMessages,
  markStudentGroupAsRead,
  sendStudentGroupMessage,
} from "../../services/messageService.js";
import { clearAuth, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isConstrainedConnection,
  isUnauthorizedError,
} from "../../services/http.js";

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

export default function Messages({ language = "fa" }) {
  const isFa = language !== "en";
  const isRTL = isFa;
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationStats, setConversationStats] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  const selectedConversation = useMemo(
    () => conversations.find((row) => row.courseId === selectedCourseId) || null,
    [conversations, selectedCourseId],
  );
  const showConversationList = !isMobileViewport || !selectedConversation;
  const showChatPanel = !isMobileViewport || Boolean(selectedConversation);

  const canSendToSelectedGroup = selectedCourse?.canSendMessages ?? selectedConversation?.canSendMessages ?? false;

  const loadConversations = useCallback(async (preferCourseId = "", options = {}) => {
    const silent = Boolean(options?.silent);

    try {
      if (!silent) {
        setLoadingConversations(true);
        setError("");
      }

      const data = await fetchStudentGroupConversations({
        page: 1,
        limit: 100,
        search: searchQuery,
        unreadOnly: showUnreadOnly,
      });

      const rows = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(rows);
      setConversationStats(data?.stats || {});

      setSelectedCourseId((current) =>
        (preferCourseId && rows.some((row) => row.courseId === preferCourseId) && preferCourseId) ||
        (current && rows.some((row) => row.courseId === current) && current) ||
        (rows[0]?.courseId || ""),
      );
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setAuthNotice("Not authorized for this resource");
        clearAuth();
        setIsRedirecting(true);
        navigate("/login", { replace: true });
        return;
      }
      if (silent) return;

      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "بارگذاری گفتگوهای صنف ناموفق بود.",
          "Failed to load class conversations.",
        ),
      );
      setConversations([]);
      setConversationStats({});
      setSelectedCourseId("");
    } finally {
      if (!silent) {
        setLoadingConversations(false);
      }
    }
  }, [language, navigate, searchQuery, showUnreadOnly]);

  const loadMessages = useCallback(async (courseId, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!courseId) {
      setMessages([]);
      setSelectedCourse(null);
      return;
    }

    try {
      if (!silent) {
        setLoadingMessages(true);
        setError("");
      }

      const data = await fetchStudentGroupMessages(courseId);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setSelectedCourse(data?.course || null);

      await markStudentGroupAsRead(courseId).catch(() => {});
      setConversations((prev) =>
        prev.map((row) => (row.courseId === courseId ? { ...row, unreadCount: 0 } : row)),
      );
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setAuthNotice("Not authorized for this resource");
        clearAuth();
        setIsRedirecting(true);
        navigate("/login", { replace: true });
        return;
      }
      if (silent) return;

      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "بارگذاری پیام‌های صنف ناموفق بود.",
          "Failed to load class messages.",
        ),
      );
      setMessages([]);
      setSelectedCourse(null);
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  }, [language, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadConversations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedCourseId) return undefined;
    const timer = window.setTimeout(() => loadMessages(selectedCourseId), 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages, selectedCourseId]);

  useEffect(() => {
    const refreshData = async () => {
      if (document.hidden) return;
      await loadConversations(selectedCourseId, { silent: true });
      if (selectedCourseId) {
        await loadMessages(selectedCourseId, { silent: true });
      }
    };

    const interval = setInterval(
      refreshData,
      isConstrainedConnection() ? 60000 : 30000,
    );
    const triggerRefresh = () => {
      refreshData();
    };
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, [loadConversations, loadMessages, selectedCourseId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const body = String(draft || "").trim();
    if (!body || !selectedCourseId) return;
    if (!canSendToSelectedGroup) {
      setError(
        isFa
          ? "برای این صنف ارسال پیام غیرفعال است."
          : "Messaging is disabled for this class.",
      );
      return;
    }

    try {
      setSending(true);
      setError("");
      const saved = await sendStudentGroupMessage(selectedCourseId, { body });
      if (saved) {
        setMessages((prev) => [
          ...prev,
          {
            ...saved,
            id: `msg:${String(saved.id || "")}`,
            senderRole: "student",
            senderName: isFa ? "شما" : "You",
          },
        ]);
      }
      setConversations((prev) =>
        prev.map((row) =>
          row.courseId === selectedCourseId
            ? {
                ...row,
                lastMessage: body,
                lastMessageAt: new Date().toISOString(),
                lastSenderRole: "student",
              }
            : row,
        ),
      );
      setDraft("");
      setToast(isFa ? "پیام ارسال شد." : "Message sent.");
    } catch (err) {
      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "ارسال پیام ناموفق بود.",
          "Failed to send message.",
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadRows = conversations.filter((row) => Number(row.unreadCount || 0) > 0);
    if (!unreadRows.length) return;

    try {
      setMarkingAllRead(true);
      setError("");
      await Promise.all(unreadRows.map((row) => markStudentGroupAsRead(row.courseId).catch(() => null)));
      setConversations((prev) => prev.map((row) => ({ ...row, unreadCount: 0 })));
      setToast(isFa ? "همه گفتگوهای صنف خوانده شد." : "All class conversations marked as read.");
    } catch (err) {
      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          "بروزرسانی وضعیت خوانده‌شدن ناموفق بود.",
          "Failed to mark class conversations as read.",
        ),
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  if (isRedirecting) return null;

  return (
    <StudentLayout language={language}>
      <div className="mb-6 hidden flex-wrap items-center gap-2 px-1 text-sm font-semibold text-slate-500 md:flex sm:px-0">
        <Link className="transition hover:text-primary-700" to="/student/dashboard">
          {isFa ? "داشبورد" : "Dashboard"}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{isFa ? "پیام‌های صنف" : "Class Messages"}</span>
      </div>

      <div className="mb-6 hidden flex-wrap items-end justify-between gap-3 md:flex">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{isFa ? "چت گروهی صنف‌ها" : "Class Group Chats"}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {isFa
              ? "پیام‌های استاد را در چت گروهی هر صنف ببینید و پاسخ دهید."
              : "See teacher messages in each class group and reply."}
          </p>
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {isFa
              ? "تمام پیام‌های هر گروه صنف پس از ۷۲ ساعت برای همیشه حذف می‌شود."
              : "All messages in each class group are permanently deleted after 72 hours."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-black text-primary-700">
            {isFa ? `خوانده‌نشده: ${conversationStats.totalUnreadMessages || 0}` : `Unread: ${conversationStats.totalUnreadMessages || 0}`}
          </span>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <CheckCheck size={16} />
            {markingAllRead
              ? "..."
              : isFa
                ? "علامت‌گذاری همه به‌عنوان خوانده‌شده"
                : "Mark all as read"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="relative -m-4 grid h-[calc(100dvh-72px)] gap-0 overflow-hidden bg-white shadow-sm sm:-m-6 md:m-0 md:h-[720px] md:grid-cols-[320px_1fr] md:rounded-[28px] md:border md:border-slate-200 lg:grid-cols-[380px_1fr]">
        {showConversationList ? (
        <aside className="flex h-full min-h-[320px] flex-col border-e border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-[#f0f2f5] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isFa ? "جستجوی صنف یا پیام..." : "Search class or message..."}
              className="h-10 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(event) => setShowUnreadOnly(event.target.checked)}
            />
            {isFa ? "فقط خوانده‌نشده" : "Unread only"}
          </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="rounded-xl bg-white p-6 text-center text-xs font-bold text-slate-500">
                {isFa ? "در حال بارگذاری گفتگوهای صنف" : "Loading class conversations"}
              </div>
            ) : conversations.length ? (
              conversations.map((conversation) => {
                const isActive = selectedConversation?.courseId === conversation.courseId;
                return (
                  <button
                    key={conversation.courseId}
                    type="button"
                    onClick={() => setSelectedCourseId(conversation.courseId)}
                    className={`w-full border-b border-slate-100 p-4 text-start transition ${
                      isActive
                        ? "bg-[#e7f3ff]"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{conversation.courseTitle}</p>
                        <p className="truncate text-[11px] font-semibold text-slate-500">
                          {conversation.teacherName || (isFa ? "استاد" : "Teacher")}
                        </p>
                      </div>
                      <p className="shrink-0 text-[11px] font-bold text-slate-400">
                        {formatDateTime(conversation.lastMessageAt, language)}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-600">
                      {conversation.lastMessage || (isFa ? "هنوز پیامی ثبت نشده است." : "No messages yet.")}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold ${conversation.canSendMessages ? "text-emerald-700" : "text-amber-700"}`}>
                        {conversation.canSendMessages
                          ? (isFa ? "امکان پاسخ فعال" : "Reply enabled")
                          : (isFa ? "امکان پاسخ غیرفعال" : "Reply disabled")}
                      </span>
                      {Number(conversation.unreadCount || 0) > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-black text-white">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl bg-white p-6 text-center text-xs font-bold text-slate-500">
                {isFa ? "گفتگویی پیدا نشد." : "No conversation found."}
              </div>
            )}
          </div>
        </aside>
        ) : null}

        {showChatPanel ? (
        <section className="flex h-full min-h-[320px] flex-col overflow-hidden bg-white">
          {selectedConversation ? (
            <>
              <div className="flex min-h-[64px] items-center justify-between border-b border-slate-200 bg-[#f0f2f5] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCourseId("")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-200"
                      aria-label={isFa ? "بازگشت به گفتگوها" : "Back to chats"}
                    >
                      <ChevronLeft size={14} className={isRTL ? "rotate-180" : ""} />
                    </button>
                  ) : null}
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 font-black text-white">
                    {String(selectedConversation.courseTitle || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                  <h2 className="truncate text-sm font-black text-slate-900">{selectedConversation.courseTitle}</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {selectedConversation.teacherName || (isFa ? "استاد" : "Teacher")}
                  </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:18px_18px] p-3 sm:p-4">
                {loadingMessages ? (
                  <div className="py-8 text-center text-sm font-semibold text-slate-500">
                    {isFa ? "در حال بارگذاری پیام‌ها" : "Loading messages"}
                  </div>
                ) : messages.length ? (
                  messages.map((message) => {
                    const isStudent = message.senderRole === "student";
                    return (
                      <div key={message.id} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[88%] rounded-xl px-3 py-2 text-sm font-semibold leading-6 shadow-sm sm:max-w-[82%] ${
                            isStudent
                              ? "bg-[#d9fdd3] text-slate-900"
                              : "bg-white text-slate-800"
                          }`}
                        >
                          <p className={`mb-1 text-[10px] font-bold ${isStudent ? "text-emerald-700" : "text-primary-700"}`}>
                            {isStudent ? (isFa ? "شما" : "You") : (message.senderName || (isFa ? "استاد" : "Teacher"))}
                          </p>
                          <p>{message.body}</p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            {formatDateTime(message.createdAt, language)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                    {isFa ? "پیامی در این صنف وجود ندارد." : "No messages in this class yet."}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-200 bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      canSendToSelectedGroup
                        ? isFa
                          ? "پیام خود را بنویسید..."
                          : "Write your message..."
                        : isFa
                          ? "ارسال پیام برای این صنف غیرفعال است."
                          : "Messaging is disabled for this class."
                    }
                    rows={1}
                    disabled={!canSendToSelectedGroup}
                    className="max-h-28 min-h-[44px] flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !String(draft || "").trim() || !canSendToSelectedGroup}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    aria-label={isFa ? "ارسال پیام" : "Send message"}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <MessageCircle size={30} className="text-slate-300" />
              <p className="text-sm font-black text-slate-700">
                {isFa ? "گفتگوی صنف انتخاب نشده است." : "No class conversation selected."}
              </p>
            </div>
          )}
        </section>
        ) : null}
      </div>
      <div className="h-8" aria-hidden="true" />
    </StudentLayout>
  );
}
