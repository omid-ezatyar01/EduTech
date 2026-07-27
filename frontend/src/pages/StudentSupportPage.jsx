import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Headphones,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import StudentLayout from "../components/StudentLayout.jsx";
import { getAuthUser } from "../../services/portal.js";
import {
  connectSupportSocket,
  createSupportTicket,
  deleteSupportMessage,
  fetchMySupportTickets,
  fetchSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
  updateSupportMessage,
} from "../../services/supportService.js";
import {
  buildSupportCacheKey,
  readSupportPageCache,
  writeSupportPageCache,
} from "../utils/supportPageCache.js";

const COPY = {
  en: {
    title: "Help & Support",
    subtitle: "Chat directly with the EduTech support team.",
    newTicket: "New chat",
    noTickets: "No support conversations yet.",
    noSearchResults: "No conversations match your search.",
    category: "Request type",
    message: "Type a message",
    create: "Start conversation",
    connected: "online",
    reconnecting: "connecting…",
    select: "Select a conversation to start messaging",
    search: "Search conversations",
    supportTeam: "EduTech Support",
    you: "You",
    categories: {
      consultation: "Consultation",
      registration: "Registration",
      account: "Account",
      course: "Course",
      payment: "Payment",
      technical: "Technical",
      teaching: "Teaching",
      certificate: "Certificate",
      feedback: "Feedback & suggestion",
      complaint: "Complaint",
      other: "Other",
    },
    statuses: {
      open: "Open",
      in_progress: "In progress",
      waiting_for_user: "Waiting for you",
      resolved: "Resolved",
      closed: "Closed",
    },
  },
  fa: {
    title: "کمک و پشتیبانی",
    subtitle: "مستقیماً با تیم پشتیبانی EduTech گفتگو کنید.",
    newTicket: "گفتگوی جدید",
    noTickets: "هنوز گفتگوی پشتیبانی ندارید.",
    noSearchResults: "گفتگویی با این جستجو پیدا نشد.",
    category: "نوع درخواست",
    message: "پیام خود را بنویسید",
    create: "شروع گفتگو",
    connected: "آنلاین",
    reconnecting: "در حال اتصال…",
    select: "یک گفتگو را برای پیام‌دادن انتخاب کنید",
    search: "جستجوی گفتگوها",
    supportTeam: "پشتیبانی EduTech",
    you: "شما",
    categories: {
      consultation: "مشوره",
      registration: "ثبت‌نام",
      account: "حساب",
      course: "کورس",
      payment: "پرداخت",
      technical: "مشکل فنی",
      teaching: "آموزش",
      certificate: "سرتیفیکیت",
      feedback: "بازخورد و پیشنهاد",
      complaint: "شکایت",
      other: "سایر",
    },
    statuses: {
      open: "باز",
      in_progress: "در حال بررسی",
      waiting_for_user: "منتظر پاسخ شما",
      resolved: "حل‌شده",
      closed: "بسته",
    },
  },
};

const formatMessageTime = (value, isFa) =>
  value
    ? new Date(value).toLocaleTimeString(isFa ? "fa-AF" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const formatListTime = (value, isFa) => {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return formatMessageTime(value, isFa);
  }
  return date.toLocaleDateString(isFa ? "fa-AF" : "en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function StudentSupportPage({ language = "fa" }) {
  const text = COPY[language] || COPY.fa;
  const isFa = language === "fa";
  const viewer = useMemo(() => getAuthUser() || {}, []);
  const viewerId = String(viewer._id || viewer.id || viewer.email || "student");
  const listCacheKey = useMemo(
    () => buildSupportCacheKey("student", viewerId, "tickets"),
    [viewerId],
  );
  const initialListCache = useMemo(
    () => readSupportPageCache(listCacheKey),
    [listCacheKey],
  );
  const initialSelectedId =
    initialListCache?.selectedId || initialListCache?.tickets?.[0]?.id || "";
  const [tickets, setTickets] = useState(initialListCache?.tickets || []);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [conversation, setConversation] = useState(() =>
    initialSelectedId
      ? readSupportPageCache(
          buildSupportCacheKey(
            "student",
            viewerId,
            `ticket:${initialSelectedId}`,
          ),
        )
      : null,
  );
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    category: "consultation",
    message: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [loading, setLoading] = useState(!initialListCache);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const bottomRef = useRef(null);

  const loadTickets = useCallback(async () => {
    const data = await fetchMySupportTickets();
    const rows = Array.isArray(data.tickets) ? data.tickets : [];
    setTickets(rows);
    if (!rows.length) setConversation(null);
    setSelectedId((current) => {
      if (current && rows.some((ticket) => ticket.id === current)) return current;
      return rows[0]?.id || "";
    });
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    const cacheKey = buildSupportCacheKey("student", viewerId, `ticket:${id}`);
    const cached = readSupportPageCache(cacheKey);
    if (cached) setConversation(cached);
    const data = await fetchSupportTicket(id);
    setConversation(data);
    writeSupportPageCache(cacheKey, data);
    setTickets((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, ...data.ticket, unreadForRequester: 0 }
          : row,
      ),
    );
    markSupportTicketRead(id).catch(() => {});
  }, [viewerId]);

  useEffect(() => {
    if (loading && !initialListCache) return;
    writeSupportPageCache(listCacheKey, { tickets, selectedId });
  }, [initialListCache, listCacheKey, loading, selectedId, tickets]);

  useEffect(() => {
    if (!conversation?.ticket?.id) return;
    writeSupportPageCache(
      buildSupportCacheKey(
        "student",
        viewerId,
        `ticket:${conversation.ticket.id}`,
      ),
      conversation,
    );
  }, [conversation, viewerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTickets()
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => {
      loadConversation(selectedId).catch((err) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  useEffect(() => {
    const socket = connectSupportSocket();
    socket.on("connect", () => {
      setLive(true);
      if (selectedId) socket.emit("support:join", selectedId);
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));

    const mergeMessage = (payload) => {
      const eventTicket = payload?.ticket;
      const eventMessage = payload?.message;
      if (!eventTicket?.id) return;

      setTickets((current) => {
        const existing = current.find((ticket) => ticket.id === eventTicket.id);
        if (!existing) return current;
        return [
          { ...existing, ...eventTicket },
          ...current.filter((ticket) => ticket.id !== eventTicket.id),
        ];
      });

      if (eventTicket.id !== selectedId || !eventMessage?.id) return;
      setConversation((current) => {
        if (!current || current.ticket?.id !== eventTicket.id) return current;
        const messages = current.messages.some(
          (message) => message.id === eventMessage.id,
        )
          ? current.messages
          : [...current.messages, eventMessage];
        return {
          ...current,
          ticket: { ...current.ticket, ...eventTicket },
          messages,
        };
      });
      markSupportTicketRead(eventTicket.id).catch(() => {});
    };

    const refreshTicket = (payload) => {
      if (payload?.ticket?.id === selectedId) {
        loadConversation(selectedId).catch(() => {});
      }
      loadTickets().catch(() => {});
    };

    socket.on("support:message", mergeMessage);
    socket.on("support:message-updated", refreshTicket);
    socket.on("support:message-deleted", refreshTicket);
    socket.on("support:ticket-updated", refreshTicket);
    socket.on("support:ticket-created", refreshTicket);
    socket.on("support:ticket-deleted", refreshTicket);

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      loadTickets().catch(() => {});
      if (selectedId) loadConversation(selectedId).catch(() => {});
    }, 15_000);

    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [selectedId, loadConversation, loadTickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) =>
      [ticket.subject, ticket.ticketNumber, ticket.lastMessagePreview]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, tickets]);

  const openTicket = (ticketId) => {
    setSelectedId(ticketId);
    setMobileChatOpen(true);
  };

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await createSupportTicket({
        ...form,
        subject: text.categories[form.category],
      });
      setForm({ category: "consultation", message: "" });
      setShowCreate(false);
      await loadTickets();
      setSelectedId(data.ticket.id);
      setMobileChatOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId) return;
    setBusy(true);
    setDraft("");
    try {
      const data = await sendSupportMessage(selectedId, body);
      if (data?.message?.id) {
        setConversation((current) => {
          if (!current || current.ticket?.id !== selectedId) return current;
          const exists = current.messages.some(
            (message) => message.id === data.message.id,
          );
          return {
            ...current,
            ticket: { ...current.ticket, ...data.ticket },
            messages: exists
              ? current.messages
              : [...current.messages, data.message],
          };
        });
      }
      await loadTickets();
    } catch (err) {
      setDraft(body);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const editMessage = async (message) => {
    const body = window.prompt(
      isFa ? "پیام را ویرایش کنید" : "Edit message",
      message.body,
    )?.trim();
    if (!body || body === message.body) return;
    setBusy(true);
    try {
      await updateSupportMessage(selectedId, message.id, body);
      await Promise.all([loadConversation(selectedId), loadTickets()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeMessage = async (message) => {
    if (!window.confirm(isFa ? "این پیام حذف شود؟" : "Delete this message?")) return;
    setBusy(true);
    try {
      await deleteSupportMessage(selectedId, message.id);
      await Promise.all([loadConversation(selectedId), loadTickets()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <StudentLayout language={language}>
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-3 hidden items-center justify-between gap-3 lg:flex">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
              <Headphones className="text-emerald-600" />
              {text.title}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {text.subtitle}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-4 py-2.5 text-sm font-black text-white shadow-sm"
          >
            <Plus size={17} />
            {text.newTicket}
          </button>
        </header>

        {error ? (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid h-[calc(100dvh-8.5rem)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-10.5rem)] lg:grid-cols-[380px_1fr] lg:rounded-3xl">
          <aside
            className={`min-h-0 flex-col border-e border-slate-200 bg-white ${
              mobileChatOpen ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
                  <Headphones size={20} />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-black">{text.title}</h1>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                      live ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {live ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {live ? text.connected : text.reconnecting}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-200"
                aria-label={text.newTicket}
              >
                <Plus size={22} />
              </button>
            </div>

            <div className="border-b border-slate-100 p-2">
              <label className="relative block">
                <Search
                  size={17}
                  className="absolute start-4 top-2.5 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.search}
                  className="w-full rounded-xl bg-[#f0f2f5] py-2 ps-11 pe-4 text-sm outline-none"
                />
              </label>
            </div>

            <div className="chat-scrollbar-side edutech-scrollbar min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-10 text-center font-bold text-slate-400">…</p>
              ) : filteredTickets.length === 0 ? (
                <div className="grid h-full min-h-64 place-items-center p-8 text-center text-slate-400">
                  <div>
                    <MessageCircle className="mx-auto" size={44} />
                    <p className="mt-3 text-sm font-bold">
                      {tickets.length ? text.noSearchResults : text.noTickets}
                    </p>
                  </div>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-start transition ${
                      selectedId === ticket.id
                        ? "bg-[#f0f2f5]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white">
                      <Headphones size={21} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <strong className="min-w-0 flex-1 truncate text-sm text-slate-900">
                          {ticket.subject}
                        </strong>
                        <span
                          className={`text-[10px] font-semibold ${
                            ticket.unreadForRequester > 0
                              ? "text-[#00a884]"
                              : "text-slate-400"
                          }`}
                        >
                          {formatListTime(ticket.lastMessageAt, isFa)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500">
                          {ticket.lastMessagePreview}
                        </span>
                        {ticket.unreadForRequester > 0 ? (
                          <span className="grid min-w-5 place-items-center rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-black text-white">
                            {ticket.unreadForRequester}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold text-emerald-700">
                        {text.statuses[ticket.status]}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div
            className={`min-h-0 flex-col bg-[#efeae2] ${
              mobileChatOpen ? "flex" : "hidden lg:flex"
            }`}
          >
            {!conversation ? (
              <div className="grid flex-1 place-items-center text-center text-slate-500">
                <div>
                  <MessageCircle className="mx-auto" size={58} />
                  <p className="mt-4 font-bold">{text.select}</p>
                </div>
              </div>
            ) : (
              <>
                <header className="z-10 flex items-center justify-between gap-3 bg-[#f0f2f5] px-2.5 py-2 shadow-sm sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileChatOpen(false)}
                      className="grid h-9 w-9 place-items-center rounded-full text-slate-600 lg:hidden"
                      aria-label={isFa ? "بازگشت" : "Back"}
                    >
                      {isFa ? (
                        <ArrowRight size={22} />
                      ) : (
                        <ArrowLeft size={22} />
                      )}
                    </button>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
                      <Headphones size={19} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-slate-950">
                        {conversation.ticket.subject}
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {text.supportTeam} ·{" "}
                        <span className={live ? "text-emerald-700" : ""}>
                          {live ? text.connected : text.reconnecting}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-emerald-700">
                    {text.statuses[conversation.ticket.status]}
                  </span>
                </header>

                <div className="chat-scrollbar-side edutech-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:18px_18px] p-2.5 sm:p-5">
                  {conversation.messages.map((message) => {
                    const own = message.senderRole === "student";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${own ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`relative max-w-[86%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[72%] ${
                            own
                              ? "bg-[#d9fdd3] text-slate-900"
                              : "bg-white text-slate-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-[13px] font-medium leading-5 sm:text-sm">
                            {message.body}
                          </p>
                          <span className="mt-1 flex items-center justify-end gap-1 ps-8 text-[9px] font-semibold text-slate-500">
                            {message.editedAt ? (isFa ? "ویرایش‌شده ·" : "edited ·") : null}
                            {formatMessageTime(message.createdAt, isFa)}
                            {own ? (
                              <CheckCheck
                                size={14}
                                className="text-sky-500"
                              />
                            ) : null}
                          </span>
                          {own ? (
                            <span className="mt-1 flex justify-end gap-1">
                              <button type="button" disabled={busy} onClick={() => editMessage(message)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "ویرایش" : "Edit"}><Pencil size={12} /></button>
                              <button type="button" disabled={busy} onClick={() => removeMessage(message)} className="grid h-6 w-6 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label={isFa ? "حذف" : "Delete"}><Trash2 size={12} /></button>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={send}
                  className="flex items-end gap-2 bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3"
                >
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
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    disabled={conversation.ticket.status === "closed"}
                    placeholder={text.message}
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm outline-none"
                  />
                  <button
                    disabled={
                      busy ||
                      !draft.trim() ||
                      conversation.ticket.status === "closed"
                    }
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-sm disabled:opacity-40"
                    aria-label={text.message}
                  >
                    <Send size={19} />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4">
          <form
            onSubmit={create}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{text.newTicket}</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <X />
              </button>
            </div>
            <label className="mt-5 block text-sm font-black">
              {text.category}
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
              >
                {Object.entries(text.categories).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-black">
              {text.message}
              <textarea
                required
                minLength={2}
                maxLength={4000}
                rows={5}
                value={form.message}
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
              />
            </label>
            <button
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-[#00a884] px-5 py-3 font-black text-white disabled:opacity-50"
            >
              {text.create}
            </button>
          </form>
        </div>
      ) : null}
    </StudentLayout>
  );
}
