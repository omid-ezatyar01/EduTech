import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, MessageCircle, Plus, Send, Wifi, WifiOff, X } from "lucide-react";
import StudentLayout from "../components/StudentLayout.jsx";
import {
  connectSupportSocket,
  createSupportTicket,
  fetchMySupportTickets,
  fetchSupportTicket,
  markSupportTicketRead,
  sendSupportMessage,
  setSupportTicketOpenState,
} from "../../services/supportService.js";

const COPY = {
  en: {
    title: "Help & Support", subtitle: "Chat directly with the EduTech support team.",
    newTicket: "New ticket", noTickets: "No support conversations yet.",
    subject: "Subject", category: "Category", message: "How can we help?",
    create: "Start conversation", send: "Send", close: "Close ticket", reopen: "Reopen",
    connected: "Live", reconnecting: "Reconnecting", select: "Select a conversation",
    categories: { account: "Account", course: "Course", payment: "Payment", technical: "Technical", teaching: "Teaching", certificate: "Certificate", other: "Other" },
    statuses: { open: "Open", in_progress: "In progress", waiting_for_user: "Waiting for you", resolved: "Resolved", closed: "Closed" },
  },
  fa: {
    title: "کمک و پشتیبانی", subtitle: "مستقیماً با تیم پشتیبانی EduTech گفتگو کنید.",
    newTicket: "تکت جدید", noTickets: "هنوز گفتگوی پشتیبانی ندارید.",
    subject: "موضوع", category: "دسته‌بندی", message: "چگونه می‌توانیم کمک کنیم؟",
    create: "شروع گفتگو", send: "ارسال", close: "بستن تکت", reopen: "بازکردن دوباره",
    connected: "زنده", reconnecting: "در حال اتصال", select: "یک گفتگو را انتخاب کنید",
    categories: { account: "حساب", course: "کورس", payment: "پرداخت", technical: "مشکل فنی", teaching: "آموزش", certificate: "سرتیفیکیت", other: "سایر" },
    statuses: { open: "باز", in_progress: "در حال بررسی", waiting_for_user: "منتظر پاسخ شما", resolved: "حل‌شده", closed: "بسته" },
  },
};

const time = (value, isFa) => value ? new Date(value).toLocaleString(isFa ? "fa-AF" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : "";

export default function StudentSupportPage({ language = "fa" }) {
  const text = COPY[language] || COPY.fa;
  const isFa = language === "fa";
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState("");
  const [form, setForm] = useState({ subject: "", category: "technical", message: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const bottomRef = useRef(null);

  const loadTickets = useCallback(async () => {
    const data = await fetchMySupportTickets();
    setTickets(data.tickets || []);
    setSelectedId((current) => current || data.tickets?.[0]?.id || "");
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    const data = await fetchSupportTicket(id);
    setConversation(data);
    setTickets((rows) => rows.map((row) => row.id === id ? { ...row, ...data.ticket, unreadForRequester: 0 } : row));
    markSupportTicketRead(id).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTickets().catch((err) => setError(err.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadConversation(selectedId).catch((err) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadConversation]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages?.length]);

  useEffect(() => {
    const socket = connectSupportSocket();
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    const refresh = (payload) => {
      loadTickets().catch(() => {});
      const eventTicketId = payload?.ticket?.id;
      if (eventTicketId && eventTicketId === selectedId) loadConversation(selectedId).catch(() => {});
    };
    socket.on("support:message", refresh);
    socket.on("support:ticket-updated", refresh);
    socket.on("support:ticket-created", refresh);
    if (selectedId) socket.emit("support:join", selectedId);
    const timer = window.setInterval(() => {
      loadTickets().catch(() => {});
      if (selectedId) loadConversation(selectedId).catch(() => {});
    }, 30_000);
    return () => { window.clearInterval(timer); socket.disconnect(); };
  }, [selectedId, loadConversation, loadTickets]);

  const selectedTicket = useMemo(() => tickets.find((row) => row.id === selectedId), [tickets, selectedId]);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await createSupportTicket(form);
      setForm({ subject: "", category: "technical", message: "" });
      setShowCreate(false);
      await loadTickets();
      setSelectedId(data.ticket.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId) return;
    setBusy(true); setDraft("");
    try {
      await sendSupportMessage(selectedId, body);
      await loadConversation(selectedId);
      await loadTickets();
    } catch (err) { setDraft(body); setError(err.message); } finally { setBusy(false); }
  };

  const toggleClosed = async () => {
    if (!selectedTicket) return;
    const status = selectedTicket.status === "closed" ? "open" : "closed";
    await setSupportTicketOpenState(selectedId, status);
    await Promise.all([loadConversation(selectedId), loadTickets()]);
  };

  return (
    <StudentLayout language={language}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Headphones className="text-blue-600"/>{text.title}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{text.subtitle}</p></div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? text.connected : text.reconnecting}</span>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white"><Plus size={17}/>{text.newTicket}</button>
          </div>
        </header>
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        <section className="grid min-h-[65vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-e">
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
              {loading ? <p className="p-8 text-center font-bold text-slate-400">...</p> : tickets.length === 0 ? <p className="p-8 text-center font-bold text-slate-500">{text.noTickets}</p> : tickets.map((ticket) => (
                <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full p-4 text-start transition ${selectedId === ticket.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-900">{ticket.subject}</strong>{ticket.unreadForRequester > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-blue-600 px-1.5 text-[11px] font-black text-white">{ticket.unreadForRequester}</span>}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ticket.lastMessagePreview}</span>
                  <span className="mt-2 flex items-center justify-between text-[11px] font-bold"><span className="text-blue-700">{text.statuses[ticket.status]}</span><span className="text-slate-400" dir="ltr">{ticket.ticketNumber}</span></span>
                </button>
              ))}
            </div>
          </aside>
          <div className="flex min-h-[520px] flex-col">
            {!conversation ? <div className="grid flex-1 place-items-center text-center text-slate-400"><div><MessageCircle className="mx-auto" size={48}/><p className="mt-3 font-bold">{text.select}</p></div></div> : <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="font-black text-slate-950">{conversation.ticket.subject}</h2><p className="text-xs font-bold text-slate-400" dir="ltr">{conversation.ticket.ticketNumber}</p></div><button onClick={toggleClosed} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">{conversation.ticket.status === "closed" ? text.reopen : text.close}</button></header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
                {conversation.messages.map((message) => {
                  const own = message.senderRole !== "admin";
                  return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${own ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}><p className="whitespace-pre-wrap text-sm font-medium leading-6">{message.body}</p><p className={`mt-1 text-[10px] font-bold ${own ? "text-blue-100" : "text-slate-400"}`}>{time(message.createdAt, isFa)}</p></div></div>;
                })}
                <div ref={bottomRef}/>
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={4000} disabled={conversation.ticket.status === "closed"} placeholder={text.message} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/><button disabled={busy || !draft.trim() || conversation.ticket.status === "closed"} className="grid w-12 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-40"><Send size={19}/></button></form>
            </>}
          </div>
        </section>
      </div>
      {showCreate && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4"><form onSubmit={create} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{text.newTicket}</h2><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 hover:bg-slate-100"><X/></button></div><label className="mt-5 block text-sm font-black">{text.subject}<input required minLength={3} maxLength={160} value={form.subject} onChange={(e) => setForm({...form, subject:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"/></label><label className="mt-4 block text-sm font-black">{text.category}<select value={form.category} onChange={(e) => setForm({...form, category:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">{Object.entries(text.categories).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-black">{text.message}<textarea required minLength={2} maxLength={4000} rows={5} value={form.message} onChange={(e) => setForm({...form, message:e.target.value})} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"/></label><button disabled={busy} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50">{text.create}</button></form></div>}
    </StudentLayout>
  );
}
