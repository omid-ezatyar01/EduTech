import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, MessageCircle, Plus, Send, Wifi, WifiOff, X } from "lucide-react";
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
  fetchMySupportTickets,
  fetchSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
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
    initialSelectedId
      ? readTeacherPageCache(
          getTeacherPageCacheKey("support-ticket", {
            teacherId,
            ticketId: initialSelectedId,
          }),
          { maxAgeMs: 30 * 60 * 1000 },
        )
      : null,
  );
  const [draft, setDraft] = useState("");
  const [form, setForm] = useState({ category: "consultation", message: "" });
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const bottomRef = useRef(null);

  const loadList = useCallback(async () => {
    const data = await fetchMySupportTickets();
    setTickets(data.tickets || []);
    setSelectedId((current) => current || data.tickets?.[0]?.id || "");
  }, []);
  const loadChat = useCallback(async (id) => {
    if (!id) return;
    const cacheKey = getTeacherPageCacheKey("support-ticket", {
      teacherId,
      ticketId: id,
    });
    const cached = readTeacherPageCache(cacheKey, {
      maxAgeMs: 30 * 60 * 1000,
    });
    if (cached) setChat(cached);
    const data = await fetchSupportTicket(id);
    setChat(data);
    writeTeacherPageCache(cacheKey, data);
    markSupportTicketRead(id).catch(() => {});
    setTickets((rows) => rows.map((row) => row.id === id ? { ...row, ...data.ticket, unreadForRequester: 0 } : row));
  }, [teacherId]);

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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages?.length]);
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
    socket.on("support:ticket-updated", refresh);
    socket.on("support:ticket-created", refresh);
    socket.on("support:ticket-deleted", refresh);
    const timer = setInterval(() => {
      if (document.hidden) return;
      loadList().catch(() => {});
      if (selectedId) loadChat(selectedId).catch(() => {});
    }, 15_000);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, [selectedId, loadChat, loadList]);

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
    setBusy(true); setDraft("");
    try { await sendSupportMessage(selectedId, body); await Promise.all([loadChat(selectedId), loadList()]); }
    catch (err) { setDraft(body); setError(err.message); } finally { setBusy(false); }
  };
  return <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black"><Headphones className="text-[#0B4FD8]"/>{t.title}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{t.subtitle}</p></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? t.live : t.reconnecting}</span><button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B4FD8] px-4 py-2.5 text-sm font-black text-white"><Plus size={17}/>{t.newTicket}</button></div></header>
    {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="grid min-h-[68vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
      <aside className="chat-scrollbar-side edutech-scrollbar max-h-[68vh] overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-e"><div className="divide-y divide-slate-100">{tickets.length === 0 ? <p className="p-8 text-center font-bold text-slate-500">{t.empty}</p> : tickets.map((ticket) => <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full p-4 text-start ${selectedId === ticket.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{ticket.subject}</strong>{ticket.unreadForRequester > 0 && <span className="rounded-full bg-[#0B4FD8] px-2 text-[11px] font-black text-white">{ticket.unreadForRequester}</span>}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ticket.lastMessagePreview}</span><span className="mt-2 flex justify-between text-[11px] font-bold text-blue-700"><span>{t.statuses[ticket.status]}</span><span className="text-slate-400" dir="ltr">{ticket.ticketNumber}</span></span></button>)}</div></aside>
      <div className="flex min-h-[540px] flex-col">{!chat ? <div className="grid flex-1 place-items-center text-slate-400"><div className="text-center"><MessageCircle className="mx-auto" size={48}/><p className="mt-3 font-bold">{t.select}</p></div></div> : <><header className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-black">{chat.ticket.subject}</h2><p className="text-xs font-bold text-slate-400" dir="ltr">{chat.ticket.ticketNumber}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700">{t.statuses[chat.ticket.status]}</span></header><div className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">{chat.messages.map((message) => { const own = message.senderRole === "teacher"; return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${own ? "bg-[#0B4FD8] text-white" : "border border-slate-200 bg-white"}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className={`mt-1 text-[10px] font-bold ${own ? "text-blue-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleString(language === "fa" ? "fa-AF" : "en-US")}</p></div></div>})}<div ref={bottomRef}/></div><form onSubmit={reply} className="flex gap-2 border-t p-3"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} disabled={chat.ticket.status === "closed"} rows={2} maxLength={4000} placeholder={t.help} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"/><button disabled={busy || !draft.trim() || chat.ticket.status === "closed"} className="grid w-12 place-items-center rounded-xl bg-[#0B4FD8] text-white disabled:opacity-40"><Send size={19}/></button></form></>}</div>
    </section>
    {creating && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4"><form onSubmit={submitTicket} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-black">{t.newTicket}</h2><button type="button" onClick={() => setCreating(false)}><X/></button></div><label className="mt-5 block text-sm font-black">{t.category}<select value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} className="mt-2 w-full rounded-xl border px-4 py-3">{Object.entries(t.categories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-black">{t.help}<textarea required minLength={2} rows={5} maxLength={4000} value={form.message} onChange={(e) => setForm({...form,message:e.target.value})} className="mt-2 w-full resize-none rounded-xl border px-4 py-3"/></label><button disabled={busy} className="mt-5 w-full rounded-xl bg-[#0B4FD8] py-3 font-black text-white disabled:opacity-50">{t.create}</button></form></div>}
  </TeacherLayout>;
}
