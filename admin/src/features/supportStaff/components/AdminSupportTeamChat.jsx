import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Hash, MessageSquare, Pencil, Search, Send, Trash2, UsersRound, X } from "lucide-react";
import { connectSupportSocket } from "../../../../services/supportService";
import { getAuthUser } from "../../../../services/portal";
import {
  clearGeneralSupportTeamMessages,
  deleteSupportTeamMessage,
  fetchSupportTeamDirectory,
  fetchSupportTeamMessages,
  markSupportTeamConversationRead,
  sendSupportTeamMessage,
  updateSupportTeamMessage,
} from "../services/supportStaffAdminService";
import { supportSpecializationLabel } from "../supportStaffRoles";

export default function AdminSupportTeamChat({ language = "en", onLiveChange }) {
  const isFa = language === "fa";
  const admin = useMemo(() => getAuthUser() || {}, []);
  const [members, setMembers] = useState([]);
  const [generalUnread, setGeneralUnread] = useState(0);
  const [selected, setSelected] = useState("general");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const refreshDirectory = useCallback(async () => {
    const data = await fetchSupportTeamDirectory();
    setMembers(data.members || []);
    setGeneralUnread(Number(data.generalUnread || 0));
  }, []);

  const loadConversation = useCallback(async (conversationId) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSupportTeamMessages(conversationId);
      setMessages(data.messages || []);
      await markSupportTeamConversationRead(conversationId);
      await refreshDirectory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshDirectory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshDirectory().catch((err) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshDirectory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadConversation(selected);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversation, selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const socket = connectSupportSocket();
    socket.on("connect", () => onLiveChange?.(true));
    socket.on("disconnect", () => onLiveChange?.(false));
    socket.on("support:team-message", ({ message }) => {
      refreshDirectory().catch(() => {});
      if (!belongsToConversation(message, selected, admin)) return;
      setMessages((rows) =>
        rows.some((row) => row.id === message.id) ? rows : [...rows, message],
      );
      markSupportTeamConversationRead(selected).catch(() => {});
    });
    socket.on("support:team-message-updated", ({ message }) => {
      if (!belongsToConversation(message, selected, admin)) return;
      setMessages((rows) =>
        rows.map((row) => row.id === message.id ? message : row),
      );
    });
    socket.on("support:team-message-deleted", ({ messageId }) => {
      setMessages((rows) => rows.filter((row) => row.id !== messageId));
      refreshDirectory().catch(() => {});
    });
    socket.on("support:team-general-cleared", () => {
      if (selected === "general") setMessages([]);
      refreshDirectory().catch(() => {});
    });
    return () => socket.disconnect();
  }, [admin, onLiveChange, refreshDirectory, selected]);

  const visibleMembers = members.filter((member) => {
    const value = search.trim().toLowerCase();
    return (
      !value ||
      member.name?.toLowerCase().includes(value) ||
      member.email?.toLowerCase().includes(value)
    );
  });
  const selectedMember = members.find((member) => member.id === selected);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setSending(true);
    try {
      const data = await sendSupportTeamMessage(selected, body);
      if (data.message) {
        setMessages((rows) =>
          rows.some((row) => row.id === data.message.id)
            ? rows
            : [...rows, data.message],
        );
      }
    } catch (err) {
      setDraft(body);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    const body = editingBody.trim();
    if (!editingId || !body) return;
    setActionBusy(editingId);
    try {
      const data = await updateSupportTeamMessage(editingId, body);
      if (data.message) {
        setMessages((rows) =>
          rows.map((row) => row.id === data.message.id ? data.message : row),
        );
      }
      setEditingId("");
      setEditingBody("");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy("");
    }
  };

  const removeMessage = async (message) => {
    if (!window.confirm(isFa ? "این پیام حذف شود؟" : "Delete this message?")) return;
    setActionBusy(message.id);
    try {
      await deleteSupportTeamMessage(message.id);
      setMessages((rows) => rows.filter((row) => row.id !== message.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy("");
    }
  };

  const clearGeneral = async () => {
    if (!messages.length) return;
    if (!window.confirm(isFa ? "همه پیام‌های گفتگوی عمومی حذف شوند؟" : "Delete every message in the general team room?")) return;
    setActionBusy("clear-general");
    try {
      await clearGeneralSupportTeamMessages();
      setMessages([]);
      await refreshDirectory();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy("");
    }
  };

  return (
    <section className="grid min-h-[68vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
      <aside className="chat-scrollbar-side edutech-scrollbar max-h-[72vh] overflow-y-auto border-b border-slate-200 lg:border-b-0 lg:border-e">
        <div className="sticky top-0 z-10 border-b bg-white p-3">
          <label className="relative block">
            <Search className="absolute start-3 top-3 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isFa ? "جستجوی عضو تیم" : "Find a team member"}
              className="w-full rounded-xl border border-slate-200 py-2.5 pe-3 ps-9 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <Conversation
          active={selected === "general"}
          icon={<Hash size={19} />}
          title={isFa ? "گفتگوی عمومی تیم" : "General team room"}
          subtitle={isFa ? "مدیر و همه اعضای پشتیبانی" : "Admin and all support members"}
          unread={generalUnread}
          onClick={() => setSelected("general")}
        />
        <p className="px-4 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
          {isFa ? "پیام مستقیم" : "Direct messages"} · {visibleMembers.length}
        </p>
        {visibleMembers.map((member) => (
          <Conversation
            key={member.id}
            active={selected === member.id}
            icon={<Avatar name={member.name} online={member.online} />}
            title={member.name}
            subtitle={`${supportSpecializationLabel(member.specialization, language)} · ${member.activeTickets} ${isFa ? "تکت فعال" : "active tickets"}`}
            unread={member.unreadMessages}
            onClick={() => setSelected(member.id)}
          />
        ))}
      </aside>
      <div className="flex min-h-[580px] flex-col">
        <header className="flex items-center gap-3 border-b p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            {selected === "general" ? <UsersRound size={21} /> : <MessageSquare size={21} />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-black">
              {selected === "general"
                ? isFa ? "گفتگوی عمومی تیم" : "General team room"
                : selectedMember?.name}
            </h2>
            <p className="truncate text-xs font-semibold text-slate-500">
              {selected === "general"
                ? isFa ? "برای هماهنگی تیم، انتقال تکت‌ها و مشکلات مهم" : "For team coordination, handoffs, and incidents"
                : selectedMember
                  ? `${supportSpecializationLabel(selectedMember.specialization, language)} · ${selectedMember.email}`
                  : ""}
            </p>
          </div>
          {selected === "general" ? (
            <button type="button" disabled={!messages.length || actionBusy === "clear-general"} onClick={clearGeneral} className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40">
              <Trash2 size={15} />
              {isFa ? "حذف همه" : "Clear all"}
            </button>
          ) : null}
        </header>
        {error ? <div className="m-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        <div className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
          {loading ? (
            <p className="p-10 text-center font-bold text-slate-400">...</p>
          ) : messages.length ? (
            messages.map((message) => {
              const own = message.sender?.id === (admin.id || admin._id);
              const sender = members.find((row) => row.id === message.sender?.id);
              return (
                <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-xl px-4 py-3 shadow-sm ${own ? "bg-[#d9fdd3]" : "bg-white"}`}>
                    {selected === "general" && !own ? (
                      <p className="mb-1 text-[11px] font-black text-emerald-700">
                        {message.sender?.name} · {supportSpecializationLabel(sender?.specialization, language)}
                      </p>
                    ) : null}
                    {editingId === message.id ? (
                      <div className="space-y-2">
                        <textarea autoFocus value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={4000} rows={2} className="w-full min-w-52 resize-none rounded-lg border border-emerald-300 bg-white p-2 text-sm outline-none" />
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => { setEditingId(""); setEditingBody(""); }} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"><X size={14} /></button>
                          <button type="button" disabled={actionBusy === message.id || !editingBody.trim()} onClick={saveEdit} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40"><Check size={14} /></button>
                        </div>
                      </div>
                    ) : <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">
                      {message.editedAt ? (isFa ? "ویرایش‌شده · " : "edited · ") : ""}
                      {new Date(message.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US")}
                    </p>
                    {editingId !== message.id && (own || selected === "general") ? (
                      <div className="mt-1 flex justify-end gap-1">
                        {own ? <button type="button" disabled={actionBusy === message.id} onClick={() => { setEditingId(message.id); setEditingBody(message.body); }} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "ویرایش" : "Edit"}><Pencil size={12} /></button> : null}
                        <button type="button" disabled={actionBusy === message.id} onClick={() => removeMessage(message)} className="grid h-6 w-6 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label={isFa ? "حذف" : "Delete"}><Trash2 size={12} /></button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <div><MessageSquare className="mx-auto" size={42} /><p className="mt-2 font-black">{isFa ? "گفتگو را آغاز کنید" : "Start the conversation"}</p></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t bg-[#f0f2f5] p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            maxLength={4000}
            placeholder={isFa ? "پیام برای تیم پشتیبانی" : "Message the support team"}
            className="min-h-11 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />
          <button disabled={sending || !draft.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40">
            <Send size={19} />
          </button>
        </form>
      </div>
    </section>
  );
}

function belongsToConversation(message, conversationId, admin) {
  if (!message) return false;
  if (conversationId === "general") {
    return message.conversationType === "channel" && message.channel === "general";
  }
  const ownId = String(admin.id || admin._id || "");
  const participants = [message.sender?.id, message.recipient?.id];
  return message.conversationType === "direct" &&
    participants.includes(ownId) &&
    participants.includes(conversationId);
}

function Conversation({ active, icon, title, subtitle, unread, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-start ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
      <span>{icon}</span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{title}</strong><span className="block truncate text-[11px] font-semibold text-slate-500">{subtitle}</span></span>
      {unread > 0 ? <span className="rounded-full bg-blue-600 px-2 text-[10px] font-black text-white">{unread}</span> : null}
    </button>
  );
}

function Avatar({ name, online }) {
  return (
    <span className="relative grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-black">
      {String(name || "?").slice(0, 1).toUpperCase()}
      <span className={`absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
    </span>
  );
}
