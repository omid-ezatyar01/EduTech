import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, MessageCircle, RefreshCw, Search, Send, StickyNote, Wifi, WifiOff } from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext";
import {
  connectSupportSocket,
  fetchAdminSupportTicket,
  fetchSupportQueue,
  markAdminSupportTicketRead,
  sendAdminSupportMessage,
  updateAdminSupportTicket,
} from "../../services/supportService";
import { getAuthUser } from "../../services/portal";

const copy = {
  en: {
    title: "Support Center", subtitle: "Live support conversations with students and teachers.",
    search: "Search ticket, name, or email", all: "All statuses", empty: "No tickets match these filters.",
    select: "Select a support ticket", send: "Send reply", note: "Internal note", reply: "Reply to user",
    placeholder: "Write a helpful response…", notePlaceholder: "Add a private note for the support team…",
    live: "Live", reconnecting: "Reconnecting", student: "Student", teacher: "Teacher",
    assignMe: "Assign to me", unassign: "Unassign",
    statuses: { open: "Open", in_progress: "In progress", waiting_for_user: "Waiting for user", resolved: "Resolved", closed: "Closed" },
    priorities: { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" },
  },
  fa: {
    title: "مرکز پشتیبانی", subtitle: "گفتگوی زنده پشتیبانی با شاگردان و مدرسان.",
    search: "جستجوی تکت، نام یا ایمیل", all: "همه وضعیت‌ها", empty: "تکتی با این فیلترها پیدا نشد.",
    select: "یک تکت پشتیبانی را انتخاب کنید", send: "ارسال پاسخ", note: "یادداشت داخلی", reply: "پاسخ به کاربر",
    placeholder: "یک پاسخ مفید بنویسید…", notePlaceholder: "یادداشت خصوصی برای تیم پشتیبانی…",
    live: "زنده", reconnecting: "در حال اتصال", student: "شاگرد", teacher: "مدرس",
    assignMe: "واگذاری به من", unassign: "لغو واگذاری",
    statuses: { open: "باز", in_progress: "در حال بررسی", waiting_for_user: "منتظر کاربر", resolved: "حل‌شده", closed: "بسته" },
    priorities: { low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" },
  },
};

export default function AdminSupportPage() {
  const { language } = useAdminI18n();
  const t = copy[language] || copy.fa;
  const agent = useMemo(() => getAuthUser() || {}, []);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [chat, setChat] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "all", priority: "all", requesterRole: "all" });
  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const bottomRef = useRef(null);

  const query = useMemo(() => ({ ...filters, page: 1, limit: 100 }), [filters]);
  const loadQueue = useCallback(async () => {
    const data = await fetchSupportQueue(query);
    setTickets(data.tickets || []);
    setSummary(data.summary || {});
    setSelectedId((current) => current || data.tickets?.[0]?.id || "");
  }, [query]);
  const loadChat = useCallback(async (id) => {
    if (!id) return;
    const data = await fetchAdminSupportTicket(id);
    setChat(data);
    setTickets((rows) => rows.map((row) => row.id === id ? { ...row, ...data.ticket, unreadForSupport: 0 } : row));
    markAdminSupportTicketRead(id).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadQueue().catch((err) => setError(err.message)).finally(() => setLoading(false)), 250);
    return () => clearTimeout(timer);
  }, [loadQueue]);
  useEffect(() => {
    const timer = window.setTimeout(() => loadChat(selectedId).catch((err) => setError(err.message)), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, loadChat]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages?.length]);
  useEffect(() => {
    const socket = connectSupportSocket();
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    const refresh = (payload) => {
      loadQueue().catch(() => {});
      if (payload?.ticket?.id === selectedId) loadChat(selectedId).catch(() => {});
    };
    socket.on("support:ticket-created", refresh);
    socket.on("support:message", refresh);
    socket.on("support:internal-note", refresh);
    socket.on("support:ticket-updated", refresh);
    if (selectedId) socket.emit("support:join", selectedId);
    const timer = setInterval(() => { loadQueue().catch(() => {}); if (selectedId) loadChat(selectedId).catch(() => {}); }, 30_000);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, [selectedId, loadChat, loadQueue]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim(); if (!body || !selectedId) return;
    setBusy(true); setDraft("");
    try {
      await sendAdminSupportMessage(selectedId, body, internalNote);
      await Promise.all([loadChat(selectedId), loadQueue()]);
    } catch (err) { setDraft(body); setError(err.message); } finally { setBusy(false); }
  };
  const update = async (changes) => {
    setBusy(true);
    try { await updateAdminSupportTicket(selectedId, changes); await Promise.all([loadChat(selectedId), loadQueue()]); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const statusCards = [
    ["total", summary.total || 0, "bg-slate-50 text-slate-700"],
    ["open", summary.open || 0, "bg-blue-50 text-blue-700"],
    ["in_progress", summary.inProgress || 0, "bg-amber-50 text-amber-700"],
    ["waiting_for_user", summary.waitingForUser || 0, "bg-violet-50 text-violet-700"],
    ["resolved", summary.resolved || 0, "bg-emerald-50 text-emerald-700"],
  ];

  return <div>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Headphones className="text-[#0B4FD8]"/>{t.title}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{t.subtitle}</p></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? t.live : t.reconnecting}</span><button onClick={() => { setLoading(true); loadQueue().finally(() => setLoading(false)); }} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600"><RefreshCw size={18}/></button></div></header>
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{statusCards.map(([key,count,color]) => <button key={key} onClick={() => setFilters((f) => ({...f,status:key === "total" ? "all" : key}))} className={`rounded-2xl p-3 text-start ${color}`}><strong className="block text-2xl font-black">{count}</strong><span className="text-xs font-bold">{key === "total" ? (language === "fa" ? "همه" : "Total") : t.statuses[key]}</span></button>)}</div>
    <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_170px_150px_150px]"><label className="relative"><Search className="absolute start-3 top-3 text-slate-400" size={17}/><input value={filters.search} onChange={(e) => setFilters({...filters,search:e.target.value})} placeholder={t.search} className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-10 text-sm outline-none focus:border-blue-500"/></label><select value={filters.status} onChange={(e) => setFilters({...filters,status:e.target.value})} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="all">{t.all}</option>{Object.entries(t.statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><select value={filters.priority} onChange={(e) => setFilters({...filters,priority:e.target.value})} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="all">{language === "fa" ? "همه اولویت‌ها" : "All priorities"}</option>{Object.entries(t.priorities).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><select value={filters.requesterRole} onChange={(e) => setFilters({...filters,requesterRole:e.target.value})} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="all">{language === "fa" ? "همه کاربران" : "All users"}</option><option value="student">{t.student}</option><option value="teacher">{t.teacher}</option></select></div>
    {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="grid min-h-[62vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[370px_1fr]">
      <aside className="max-h-[68vh] overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-e"><div className="divide-y divide-slate-100">{loading ? <p className="p-8 text-center font-bold text-slate-400">...</p> : tickets.length === 0 ? <p className="p-8 text-center font-bold text-slate-500">{t.empty}</p> : tickets.map((ticket) => <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full p-4 text-start ${selectedId === ticket.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><span className="flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{ticket.subject}</strong>{ticket.priority === "urgent" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">{t.priorities.urgent}</span>}{ticket.unreadForSupport > 0 && <span className="rounded-full bg-[#0B4FD8] px-2 text-[11px] font-black text-white">{ticket.unreadForSupport}</span>}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ticket.requester?.name} · {ticket.lastMessagePreview}</span><span className="mt-2 flex justify-between text-[11px] font-bold"><span className="text-blue-700">{t.statuses[ticket.status]}</span><span className="text-slate-400" dir="ltr">{ticket.ticketNumber}</span></span></button>)}</div></aside>
      <div className="flex min-h-[560px] flex-col">{!chat ? <div className="grid flex-1 place-items-center text-slate-400"><div className="text-center"><MessageCircle className="mx-auto" size={48}/><p className="mt-3 font-bold">{t.select}</p></div></div> : <><header className="border-b border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{chat.ticket.subject}</h2><p className="mt-1 text-xs font-bold text-slate-500">{chat.ticket.requester?.name} · {chat.ticket.requester?.email} · <span dir="ltr">{chat.ticket.ticketNumber}</span></p><button onClick={() => update({assignedTo:chat.ticket.assignedTo?.id ? null : agent.id || agent._id})} disabled={busy} className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-700">{chat.ticket.assignedTo?.id ? `${t.unassign} · ${chat.ticket.assignedTo.name}` : t.assignMe}</button></div><div className="flex gap-2"><select value={chat.ticket.priority} disabled={busy} onChange={(e) => update({priority:e.target.value})} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-black">{Object.entries(t.priorities).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><select value={chat.ticket.status} disabled={busy} onChange={(e) => update({status:e.target.value})} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-black">{Object.entries(t.statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div></div></header><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">{chat.messages.map((message) => { const own = message.senderRole === "admin"; return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${message.internalNote ? "border border-amber-300 bg-amber-50 text-amber-950" : own ? "bg-[#0B4FD8] text-white" : "border border-slate-200 bg-white"}`}>{message.internalNote && <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase"><StickyNote size={12}/>{t.note}</p>}<p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className={`mt-1 text-[10px] font-bold ${own && !message.internalNote ? "text-blue-100" : "text-slate-400"}`}>{message.sender?.name} · {new Date(message.createdAt).toLocaleString(language === "fa" ? "fa-AF" : "en-US")}</p></div></div>})}<div ref={bottomRef}/></div><form onSubmit={send} className="border-t p-3"><div className="mb-2 flex gap-2"><button type="button" onClick={() => setInternalNote(false)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${!internalNote ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{t.reply}</button><button type="button" onClick={() => setInternalNote(true)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${internalNote ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{t.note}</button></div><div className="flex gap-2"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={4000} placeholder={internalNote ? t.notePlaceholder : t.placeholder} className={`min-h-12 flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none ${internalNote ? "border-amber-300 bg-amber-50" : "border-slate-200 focus:border-blue-500"}`}/><button disabled={busy || !draft.trim()} className={`grid w-12 place-items-center rounded-xl text-white disabled:opacity-40 ${internalNote ? "bg-amber-600" : "bg-[#0B4FD8]"}`}><Send size={19}/></button></div></form></>}</div>
    </section>
  </div>;
}
