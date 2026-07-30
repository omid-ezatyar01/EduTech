import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  CheckCheck,
  MessageCircle,
  Search,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router";
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

const formatMessageTime = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US", {
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
  const conversationRequestIdRef = useRef(0);
  const messageRequestIdRef = useRef(0);
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
    const requestId = conversationRequestIdRef.current + 1;
    conversationRequestIdRef.current = requestId;

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
      if (requestId !== conversationRequestIdRef.current) return;

      const rows = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(rows);
      setConversationStats(data?.stats || {});

      setSelectedCourseId((current) =>
        (preferCourseId && rows.some((row) => row.courseId === preferCourseId) && preferCourseId) ||
        (current && rows.some((row) => row.courseId === current) && current) ||
        (!isMobileViewport ? rows[0]?.courseId || "" : ""),
      );
    } catch (err) {
      if (requestId !== conversationRequestIdRef.current) return;
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
      if (!silent && requestId === conversationRequestIdRef.current) {
        setLoadingConversations(false);
      }
    }
  }, [isMobileViewport, language, navigate, searchQuery, showUnreadOnly]);

  const loadMessages = useCallback(async (courseId, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!courseId) {
      messageRequestIdRef.current += 1;
      setMessages([]);
      setSelectedCourse(null);
      return;
    }
    const requestId = messageRequestIdRef.current + 1;
    messageRequestIdRef.current = requestId;

    try {
      if (!silent) {
        setLoadingMessages(true);
        setError("");
      }

      const data = await fetchStudentGroupMessages(courseId);
      if (requestId !== messageRequestIdRef.current) return;
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setSelectedCourse(data?.course || null);

      await markStudentGroupAsRead(courseId).catch(() => {});
      setConversations((prev) =>
        prev.map((row) => (row.courseId === courseId ? { ...row, unreadCount: 0 } : row)),
      );
    } catch (err) {
      if (requestId !== messageRequestIdRef.current) return;
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
      if (!silent && requestId === messageRequestIdRef.current) {
        setLoadingMessages(false);
      }
    }
  }, [language, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 1023px)");
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
      isConstrainedConnection() ? 30000 : 15000,
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
    if (!body || !selectedCourseId || sending) return;
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
      const results = await Promise.allSettled(
        unreadRows.map((row) => markStudentGroupAsRead(row.courseId)),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        await loadConversations(selectedCourseId, { silent: true });
        throw failure.reason;
      }
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
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-3 hidden items-center justify-between gap-3 lg:flex">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
              <MessageCircle className="text-emerald-600" />
              {isFa ? "پیام‌های صنف" : "Class Messages"}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {isFa
                ? "پیام‌های استاد را در چت گروهی هر صنف ببینید و پاسخ دهید."
                : "See teacher messages in each class group and reply."}
            </p>
            <p className="mt-1 text-[11px] font-bold text-rose-600">
              {isFa
                ? "پیام‌های هر گروه صنف پس از ۷۲ ساعت حذف می‌شود."
                : "Messages in each class group are deleted after 72 hours."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              {isFa
                ? `خوانده‌نشده: ${conversationStats.totalUnreadMessages || 0}`
                : `Unread: ${conversationStats.totalUnreadMessages || 0}`}
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-4 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-50"
            >
              <CheckCheck size={17} />
              {markingAllRead
                ? "..."
                : isFa
                  ? "خواندن همه"
                  : "Mark all read"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {toast}
          </div>
        ) : null}

        <section dir="ltr" className="grid h-[calc(100dvh-8.5rem)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-10.5rem)] lg:grid-cols-[380px_1fr] lg:rounded-3xl">
          {showConversationList ? (
            <aside dir={isFa ? "rtl" : "ltr"} className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
              <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
                    <MessageCircle size={20} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-black">
                      {isFa ? "پیام‌های صنف" : "Class Messages"}
                    </h1>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {isFa
                        ? `${conversationStats.totalUnreadMessages || 0} پیام خوانده‌نشده`
                        : `${conversationStats.totalUnreadMessages || 0} unread`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
                  aria-label={isFa ? "خواندن همه پیام‌ها" : "Mark all messages as read"}
                >
                  <CheckCheck size={21} />
                </button>
              </div>

              <div className="border-b border-slate-100 p-2">
                <label className="relative block">
                  <Search
                    size={17}
                    className="absolute start-4 top-2.5 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={isFa ? "جستجوی صنف یا پیام..." : "Search class or message..."}
                    className="w-full rounded-xl bg-[#f0f2f5] py-2 ps-11 pe-4 text-sm outline-none"
                  />
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 px-2 text-[11px] font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={showUnreadOnly}
                    onChange={(event) => setShowUnreadOnly(event.target.checked)}
                    className="accent-[#00a884]"
                  />
                  {isFa ? "فقط خوانده‌نشده" : "Unread only"}
                </label>
              </div>

              <div className="chat-scrollbar-side edutech-scrollbar min-h-0 flex-1 overflow-y-auto">
                {loadingConversations ? (
                  <p className="p-10 text-center font-bold text-slate-400">…</p>
                ) : conversations.length ? (
                  conversations.map((conversation) => {
                    const isActive = selectedConversation?.courseId === conversation.courseId;
                    return (
                      <button
                        key={conversation.courseId}
                        type="button"
                        onClick={() => setSelectedCourseId(conversation.courseId)}
                        className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-start transition ${
                          isActive ? "bg-[#f0f2f5]" : "hover:bg-slate-50"
                        }`}
                      >
                        {conversation.teacherAvatar ? (
                          <img
                            src={conversation.teacherAvatar}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 font-black text-white">
                            {String(conversation.courseTitle || "?").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <strong className="min-w-0 flex-1 truncate text-sm text-slate-900">
                              {conversation.courseTitle}
                            </strong>
                            <span
                              className={`text-[10px] font-semibold ${
                                Number(conversation.unreadCount || 0) > 0
                                  ? "text-[#00a884]"
                                  : "text-slate-400"
                              }`}
                            >
                              {formatDateTime(conversation.lastMessageAt, language)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
                            {conversation.teacherName || (isFa ? "استاد" : "Teacher")}
                          </span>
                          <span className="mt-1 flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500">
                              {conversation.lastMessage ||
                                (isFa ? "هنوز پیامی ثبت نشده است." : "No messages yet.")}
                            </span>
                            {Number(conversation.unreadCount || 0) > 0 ? (
                              <span className="grid min-w-5 place-items-center rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-black text-white">
                                {conversation.unreadCount}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`mt-1 block text-[10px] font-bold ${
                              conversation.canSendMessages
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {conversation.canSendMessages
                              ? isFa
                                ? "امکان پاسخ فعال"
                                : "Reply enabled"
                              : isFa
                                ? "امکان پاسخ غیرفعال"
                                : "Reply disabled"}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="grid h-full min-h-64 place-items-center p-8 text-center text-slate-400">
                    <div>
                      <MessageCircle className="mx-auto" size={44} />
                      <p className="mt-3 text-sm font-bold">
                        {isFa ? "گفتگویی پیدا نشد." : "No conversation found."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          {showChatPanel ? (
            <div dir={isFa ? "rtl" : "ltr"} className="flex min-h-0 flex-col bg-[#efeae2]">
              {!selectedConversation ? (
                <div className="grid flex-1 place-items-center text-center text-slate-500">
                  <div>
                    <MessageCircle className="mx-auto" size={58} />
                    <p className="mt-4 font-bold">
                      {isFa ? "یک گفتگوی صنف را انتخاب کنید." : "Select a class conversation."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <header className="z-10 flex items-center justify-between gap-3 bg-[#f0f2f5] px-2.5 py-2 shadow-sm sm:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      {isMobileViewport ? (
                        <button
                          type="button"
                          onClick={() => setSelectedCourseId("")}
                          className="grid h-9 w-9 place-items-center rounded-full text-slate-600"
                          aria-label={isFa ? "بازگشت به گفتگوها" : "Back to chats"}
                        >
                          <ChevronLeft
                            size={22}
                            className={isRTL ? "rotate-180" : ""}
                          />
                        </button>
                      ) : null}
                      {selectedConversation.teacherAvatar ? (
                        <img
                          src={selectedConversation.teacherAvatar}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] font-black text-white">
                          {String(selectedConversation.courseTitle || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-black text-slate-950">
                          {selectedConversation.courseTitle}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {selectedConversation.teacherName || (isFa ? "استاد" : "Teacher")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black ${
                        canSendToSelectedGroup ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {canSendToSelectedGroup
                        ? isFa
                          ? "فعال"
                          : "Active"
                        : isFa
                          ? "فقط خواندنی"
                          : "Read only"}
                    </span>
                  </header>

                  <div className="chat-scrollbar-side edutech-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:18px_18px] p-2.5 sm:p-5">
                    {loadingMessages ? (
                      <div className="py-8 text-center text-sm font-semibold text-slate-500">
                        {isFa ? "در حال بارگذاری پیام‌ها" : "Loading messages"}
                      </div>
                    ) : messages.length ? (
                      messages.map((message) => {
                        const isStudent = message.senderRole === "student";
                        return (
                          <div
                            key={message.id}
                            dir="ltr"
                            className={`flex ${isStudent ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`relative max-w-[86%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[72%] ${
                                isStudent
                                  ? "bg-[#d9fdd3] text-slate-900"
                                  : "bg-white text-slate-900"
                              }`}
                            >
                              {!isStudent ? (
                                <p className="mb-0.5 text-[10px] font-bold text-[#00a884]">
                                  {message.senderName || (isFa ? "استاد" : "Teacher")}
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap text-[13px] font-medium leading-5 sm:text-sm">
                                {message.body}
                              </p>
                              <span className="mt-1 flex items-center justify-end gap-1 ps-8 text-[9px] font-semibold text-slate-500">
                                {formatMessageTime(message.createdAt, language)}
                                {isStudent ? (
                                  <CheckCheck size={14} className="text-sky-500" />
                                ) : null}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="grid h-full place-items-center text-center text-sm font-semibold text-slate-500">
                        {isFa ? "پیامی در این صنف وجود ندارد." : "No messages in this class yet."}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div className="flex items-end gap-2 bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
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
                      maxLength={4000}
                      disabled={!canSendToSelectedGroup}
                      className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !String(draft || "").trim() || !canSendToSelectedGroup}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-sm disabled:opacity-40"
                      aria-label={isFa ? "ارسال پیام" : "Send message"}
                    >
                      <Send size={19} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </StudentLayout>
  );
}
