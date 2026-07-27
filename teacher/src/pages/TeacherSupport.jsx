import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, CheckCircle2, Circle, Headphones, MessageCircle, Pencil, Plus, Reply, Send, Wifi, WifiOff, X } from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import { getAuthUser } from "../../services/portal";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache.js";
import {
  connectSupportSocket,
  createSupportTicket,
  deleteSelectedSupportMessages,
  fetchMySupportTickets,
  fetchSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
  updateSupportMessage,
} from "../../services/supportService";

const copy = {
  en: {
    title: "Teacher Support", subtitle: "Talk directly with the EduTech support team.",
    newTicket: "New ticket", empty: "No support conversations yet.", select: "Select a conversation",
    category: "Request type", help: "Describe your question", create: "Start conversation",
    live: "Live", reconnecting: "Reconnecting",
    statuses: { open: "Open", in_progress: "In progress", waiting_for_user: "Waiting for you", resolved: "Resolved", closed: "Closed" },
    categories: { consultation: "Consultation", registration: "Registration", account: "Account", course: "Course", payment: "Payment", technical: "Technical", teaching: "Teaching", certificate: "Certificate", feedback: "Feedback & suggestion", complaint: "Complaint", other: "Other" },
  },
  fa: {
    title: "پشتیبانی مدرس", subtitle: "مستقیماً با تیم پشتیبانی EduTech گفتگو کنید.",
    newTicket: "تکت جدید", empty: "هنوز گفتگوی پشتیبانی ندارید.", select: "یک گفتگو را انتخاب کنید",
    category: "نوع درخواست", help: "پرسش خود را توضیح دهید", create: "شروع گفتگو",
    live: "زنده", reconnecting: "در حال اتصال",
    statuses: { open: "باز", in_progress: "در حال بررسی", waiting_for_user: "منتظر پاسخ شما", resolved: "حل‌شده", closed: "بسته" },
    categories: { consultation: "مشوره", registration: "ثبت‌نام", account: "حساب", course: "کورس", payment: "پرداخت", technical: "مشکل فنی", teaching: "تدریس", certificate: "سرتیفیکیت", feedback: "بازخورد و پیشنهاد", complaint: "شکایت", other: "سایر" },
  },
};

export default function TeacherSupport() {
  const { language, setLanguage } = useTeacherLanguage();
  const teacher = useMemo(() => getAuthUser() || {}, []);
  const t = copy[language] || copy.fa;
  const teacherId = String(teacher._id || teacher.id || teacher.email || "teacher");
  const listCacheKey = useMemo(
    () => getTeacherPageCacheKey("support-tickets", { teacherId }),
    [teacherId],
  );
  const initialListCache = useMemo(
    () => readTeacherPageCache(listCacheKey, { maxAgeMs: 30 * 60 * 1000 }),
    [listCacheKey],
  );
  const initialSelectedId =
    initialListCache?.selectedId || initialListCache?.tickets?.[0]?.id || "";
  const [tickets, setTickets] = useState(initialListCache?.tickets || []);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [chat, setChat] = useState(() =>
    {
      const cached = initialSelectedId
        ? readTeacherPageCache(
          getTeacherPageCacheKey("support-ticket", {
            teacherId,
            ticketId: initialSelectedId,
          }),
          { maxAgeMs: 30 * 60 * 1000 },
        )
        : null;
      return cached
        ? { ...cached, messages: (cached.messages || []).slice(-30) }
        : null;
    },
  );
  const [draft, setDraft] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState(() => new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [form, setForm] = useState({ category: "consultation", message: "" });
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pageInfo, setPageInfo] = useState({ hasMore: false, nextBefore: null });
  const [supportTyping, setSupportTyping] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const incomingTypingTimerRef = useRef(null);
  const loadingOlderRef = useRef(false);

  const loadList = useCallback(async () => {
    const data = await fetchMySupportTickets();
    setTickets(data.tickets || []);
    setSelectedId((current) => current || data.tickets?.[0]?.id || "");
  }, []);
  const loadChat = useCallback(async (id, { before = "" } = {}) => {
    if (!id) return;
    const cacheKey = getTeacherPageCacheKey("support-ticket", {
      teacherId,
      ticketId: id,
    });
    const cached = readTeacherPageCache(cacheKey, {
      maxAgeMs: 30 * 60 * 1000,
    });
    if (cached) {
      setChat((current) =>
        current?.ticket?.id === id
          ? current
          : { ...cached, messages: (cached.messages || []).slice(-30) },
      );
    }
    const data = await fetchSupportTicket(id, { before });
    setChat((current) => {
      const sameTicket = current?.ticket?.id === data.ticket?.id;
      const currentMessages = sameTicket ? current.messages || [] : [];
      const combined = before
        ? [...(data.messages || []), ...currentMessages]
        : [...currentMessages, ...(data.messages || [])];
      const byId = new Map(combined.map((message) => [message.id, message]));
      const next = {
        ...data,
        messages: [...byId.values()].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        ),
      };
      writeTeacherPageCache(cacheKey, next);
      return next;
    });
    setPageInfo(data.pageInfo || { hasMore: false, nextBefore: null });
    markSupportTicketRead(id).catch(() => {});
    setTickets((rows) => rows.map((row) => row.id === id ? { ...row, ...data.ticket, unreadForRequester: 0 } : row));
  }, [teacherId]);

  const loadEarlierMessages = async () => {
    if (!pageInfo.hasMore || loadingOlder || !chat?.messages?.[0]?.createdAt) return;
    const container = messagesRef.current;
    const previousHeight = container?.scrollHeight || 0;
    setLoadingOlder(true);
    loadingOlderRef.current = true;
    try {
      await loadChat(selectedId, { before: chat.messages[0].createdAt });
      window.requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (err) { setError(err.message); } finally { setLoadingOlder(false); window.setTimeout(() => { loadingOlderRef.current = false; }, 100); }
  };

  useEffect(() => {
    writeTeacherPageCache(listCacheKey, { tickets, selectedId });
  }, [listCacheKey, selectedId, tickets]);

  useEffect(() => {
    if (!chat?.ticket?.id) return;
    writeTeacherPageCache(
      getTeacherPageCacheKey("support-ticket", {
        teacherId,
        ticketId: chat.ticket.id,
      }),
      chat,
    );
  }, [chat, teacherId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadList().catch((err) => setError(err.message)), 0);
    return () => window.clearTimeout(timer);
  }, [loadList]);
  useEffect(() => {
    const timer = window.setTimeout(() => loadChat(selectedId).catch((err) => setError(err.message)), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadChat]);
  useEffect(() => { if (!loadingOlderRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages?.length]);
  useEffect(() => {
    const socket = connectSupportSocket();
    socketRef.current = socket;
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
      setChat((current) => {
        if (!current || current.ticket?.id !== eventTicket.id) return current;
        const messages = current.messages.some((message) => message.id === eventMessage.id)
          ? current.messages
          : [...current.messages, eventMessage];
        return { ...current, ticket: { ...current.ticket, ...eventTicket }, messages };
      });
      markSupportTicketRead(eventTicket.id).catch(() => {});
    };
    const refresh = (payload) => {
      loadList().catch(() => {});
      if (payload?.ticket?.id === selectedId && !payload?.message?.id) {
        loadChat(selectedId).catch(() => {});
      }
    };
    socket.on("support:message", mergeMessage);
    socket.on("support:message-updated", refresh);
    socket.on("support:message-deleted", refresh);
    socket.on("support:messages-deleted", refresh);
    socket.on("support:messages-read", (payload) => {
      if (payload?.ticket?.id !== selectedId) return;
      const readIds = new Set((payload.messageIds || []).map(String));
      setChat((current) => current ? {
        ...current,
        messages: current.messages.map((message) =>
          readIds.has(String(message.id))
            ? { ...message, deliveryStatus: "read" }
            : message,
        ),
      } : current);
    });
    socket.on("support:typing", (payload) => {
      if (payload?.ticketId !== selectedId || payload?.userId === teacherId) return;
      setSupportTyping(Boolean(payload.isTyping));
      window.clearTimeout(incomingTypingTimerRef.current);
      if (payload.isTyping) {
        incomingTypingTimerRef.current = window.setTimeout(
          () => setSupportTyping(false),
          1800,
        );
      }
    });
    socket.on("support:ticket-updated", refresh);
    socket.on("support:ticket-created", refresh);
    socket.on("support:ticket-deleted", refresh);
    const timer = setInterval(() => {
      if (document.hidden) return;
      loadList().catch(() => {});
      if (selectedId) loadChat(selectedId).catch(() => {});
    }, 15_000);
    return () => { clearInterval(timer); socketRef.current = null; socket.disconnect(); };
  }, [selectedId, loadChat, loadList, teacherId]);

  const submitTicket = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await createSupportTicket({
        ...form,
        subject: t.categories[form.category],
      });
      setCreating(false); setForm({ category: "consultation", message: "" });
      await loadList(); setSelectedId(data.ticket.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const reply = async (event) => {
    event.preventDefault();
    const body = draft.trim(); if (!body) return;
    setBusy(true); setDraft(""); notifyTyping(false);
    try { await sendSupportMessage(selectedId, body, replyingTo?.id || null); setReplyingTo(null); await Promise.all([loadChat(selectedId), loadList()]); }
    catch (err) { setDraft(body); setError(err.message); } finally { setBusy(false); }
  };
  const notifyTyping = (isTyping) => {
    if (!selectedId) return;
    socketRef.current?.emit("support:typing", { ticketId: selectedId, isTyping });
    window.clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = window.setTimeout(() => notifyTyping(false), 1200);
    }
  };
  const editMessage = async (message) => {
    const body = window.prompt(language === "fa" ? "پیام را ویرایش کنید" : "Edit message", message.body)?.trim();
    if (!body || body === message.body) return;
    setBusy(true);
    try { await updateSupportMessage(selectedId, message.id, body); await Promise.all([loadChat(selectedId), loadList()]); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const toggleMessageSelection = (messageId) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };
  const deleteSelection = async (scope) => {
    const messageIds = [...selectedMessageIds];
    if (!messageIds.length) return;
    setBusy(true);
    try {
      await deleteSelectedSupportMessages(selectedId, messageIds, scope);
      setSelectedMessageIds(new Set());
      await Promise.all([loadChat(selectedId), loadList()]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const openTicket = (ticketId) => {
    setSelectedMessageIds(new Set());
    setReplyingTo(null);
    setSupportTyping(false);
    setPageInfo({ hasMore: false, nextBefore: null });
    setSelectedId(ticketId);
  };
  return <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black"><Headphones className="text-[#0B4FD8]"/>{t.title}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{t.subtitle}</p></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? t.live : t.reconnecting}</span><button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B4FD8] px-4 py-2.5 text-sm font-black text-white"><Plus size={17}/>{t.newTicket}</button></div></header>
    {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="grid min-h-[68vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
      <aside className="chat-scrollbar-side edutech-scrollbar max-h-[68vh] overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-e"><div className="divide-y divide-slate-100">{tickets.length === 0 ? <p className="p-8 text-center font-bold text-slate-500">{t.empty}</p> : tickets.map((ticket) => <button key={ticket.id} onClick={() => openTicket(ticket.id)} className={`w-full p-4 text-start ${selectedId === ticket.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{ticket.subject}</strong>{ticket.unreadForRequester > 0 && <span className="rounded-full bg-[#0B4FD8] px-2 text-[11px] font-black text-white">{ticket.unreadForRequester}</span>}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ticket.lastMessagePreview}</span><span className="mt-2 flex justify-between text-[11px] font-bold text-blue-700"><span>{t.statuses[ticket.status]}</span><span className="text-slate-400" dir="ltr">{ticket.ticketNumber}</span></span></button>)}</div></aside>
      <div className="flex min-h-[540px] flex-col">
        {!chat ? <div className="grid flex-1 place-items-center text-slate-400"><div className="text-center"><MessageCircle className="mx-auto" size={48}/><p className="mt-3 font-bold">{t.select}</p></div></div> : <>
          <header className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-black">{chat.ticket.subject}</h2><p className="text-xs font-bold text-slate-400" dir="ltr">{chat.ticket.ticketNumber}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700">{t.statuses[chat.ticket.status]}</span></header>
          {supportTyping ? <div className="bg-blue-50 px-4 py-1 text-[11px] font-bold text-blue-700">{language === "fa" ? "پشتیبانی در حال نوشتن است…" : "Support is typing…"}</div> : null}
          {selectedMessageIds.size ? <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2"><button type="button" onClick={() => setSelectedMessageIds(new Set())} className="rounded-full p-2"><X size={17}/></button><strong className="me-auto text-sm">{selectedMessageIds.size}</strong><button type="button" onClick={() => setSelectedMessageIds(new Set(chat.messages.map((message) => message.id)))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{language === "fa" ? "انتخاب همه" : "Select all"}</button><button type="button" disabled={busy} onClick={() => deleteSelection("me")} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{language === "fa" ? "حذف برای من" : "Delete for me"}</button>{chat.messages.filter((message) => selectedMessageIds.has(message.id)).every((message) => message.senderRole === "teacher" && !message.deletedForEveryone) ? <button type="button" disabled={busy} onClick={() => deleteSelection("everyone")} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white">{language === "fa" ? "حذف برای همه" : "Delete for everyone"}</button> : null}</div> : null}
          <div ref={messagesRef} className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
            {pageInfo.hasMore ? <div className="flex justify-center"><button type="button" disabled={loadingOlder} onClick={loadEarlierMessages} className="rounded-full bg-white px-4 py-2 text-xs font-black text-blue-700 shadow-sm disabled:opacity-50">{loadingOlder ? (language === "fa" ? "در حال بارگذاری…" : "Loading…") : (language === "fa" ? "نمایش پیام‌های قبلی" : "Load earlier messages")}</button></div> : null}
            {chat.messages.map((message) => {
              const own = message.senderRole === "teacher";
              const selected = selectedMessageIds.has(message.id);
              return <div key={message.id} className={`flex items-center gap-1 ${own ? "justify-end" : "justify-start"} ${selected ? "rounded-xl bg-blue-100/70" : ""}`}>
                <button type="button" onClick={() => toggleMessageSelection(message.id)} className={selected ? "text-blue-600" : "text-slate-400"}>{selected ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${own ? "bg-[#0B4FD8] text-white" : "border border-slate-200 bg-white"}`}>
                  {message.replyTo ? <TeacherReplyQuote message={message.replyTo} language={language}/> : null}
                  {message.deletedForEveryone ? <p className={`text-sm italic ${own ? "text-blue-100" : "text-slate-500"}`}>{language === "fa" ? "این پیام حذف شده است." : "This message was deleted."}</p> : <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
                  <p className={`mt-1 text-[10px] font-bold ${own ? "text-blue-100" : "text-slate-400"}`}>{message.editedAt ? (language === "fa" ? "ویرایش‌شده · " : "edited · ") : ""}{new Date(message.createdAt).toLocaleString(language === "fa" ? "fa-AF" : "en-US")}{own ? <CheckCheck className={`ms-1 inline ${message.deliveryStatus === "read" ? "text-sky-300" : "text-blue-200"}`} size={14}/> : null}</p>
                  {!message.deletedForEveryone ? <div className="mt-1 flex justify-end gap-1"><button type="button" disabled={busy} onClick={() => setReplyingTo(message)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10"><Reply size={12}/></button>{own ? <button type="button" disabled={busy} onClick={() => editMessage(message)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10"><Pencil size={12}/></button> : null}</div> : null}
                </div>
              </div>;
            })}
            <div ref={bottomRef}/>
          </div>
          <form onSubmit={reply} className="border-t p-3">
            {replyingTo ? <div className="mb-2 flex items-center gap-2 rounded-xl border-s-4 border-blue-500 bg-blue-50 px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[10px] font-black text-blue-700">{replyingTo.sender?.name || (language === "fa" ? "پیام" : "Message")}</p><p className="truncate text-xs text-slate-600">{replyingTo.body}</p></div><button type="button" onClick={() => setReplyingTo(null)}><X size={16}/></button></div> : null}
            <div className="flex gap-2"><textarea value={draft} onChange={(e) => { setDraft(e.target.value); notifyTyping(Boolean(e.target.value.trim())); }} disabled={chat.ticket.status === "closed"} rows={2} maxLength={4000} placeholder={t.help} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"/><button disabled={busy || !draft.trim() || chat.ticket.status === "closed"} className="grid w-12 place-items-center rounded-xl bg-[#0B4FD8] text-white disabled:opacity-40"><Send size={19}/></button></div>
          </form>
        </>}
      </div>
    </section>
    {creating && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4"><form onSubmit={submitTicket} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-black">{t.newTicket}</h2><button type="button" onClick={() => setCreating(false)}><X/></button></div><label className="mt-5 block text-sm font-black">{t.category}<select value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} className="mt-2 w-full rounded-xl border px-4 py-3">{Object.entries(t.categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-black">{t.help}<textarea required minLength={2} rows={5} maxLength={4000} value={form.message} onChange={(e) => setForm({...form,message:e.target.value})} className="mt-2 w-full resize-none rounded-xl border px-4 py-3"/></label><button disabled={busy} className="mt-5 w-full rounded-xl bg-[#0B4FD8] py-3 font-black text-white disabled:opacity-50">{t.create}</button></form></div>}
  </TeacherLayout>;
}

function TeacherReplyQuote({ message, language }) {
  const isFa = language === "fa";
  return (
    <div className="mb-1.5 rounded-lg border-s-4 border-blue-300 bg-black/10 px-2 py-1.5">
      <p className="truncate text-[10px] font-black">
        {message.senderRole === "admin"
          ? isFa ? "ادمین" : "Admin"
          : message.sender?.name || (isFa ? "پیام" : "Message")}
      </p>
      <p className="line-clamp-2 text-[11px] opacity-80">
        {message.deletedForEveryone
          ? isFa ? "این پیام حذف شده است." : "This message was deleted."
          : message.body}
      </p>
    </div>
  );
}
