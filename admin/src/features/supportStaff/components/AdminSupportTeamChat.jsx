import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, CheckCircle2, Circle, Hash, MessageSquare, Pencil, Reply, Search, Send, Trash2, UsersRound, X } from "lucide-react";
import { connectSupportSocket } from "../../../../services/supportService";
import { getAuthUser } from "../../../../services/portal";
import {
  clearGeneralSupportTeamMessages,
  deleteSelectedSupportTeamMessages,
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
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pageInfo, setPageInfo] = useState({ hasMore: false, nextBefore: null });
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const composerRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const incomingTypingTimerRef = useRef(null);
  const loadingOlderRef = useRef(false);

  const refreshDirectory = useCallback(async () => {
    const data = await fetchSupportTeamDirectory();
    setMembers(data.members || []);
    setGeneralUnread(Number(data.generalUnread || 0));
  }, []);

  const loadConversation = useCallback(async (conversationId, { before = "" } = {}) => {
    if (!before) setLoading(true);
    setError("");
    try {
      const data = await fetchSupportTeamMessages(conversationId, { before });
      setMessages((current) => {
        const combined = before
          ? [...(data.messages || []), ...current]
          : [...current, ...(data.messages || [])];
        return [...new Map(combined.map((message) => [message.id, message])).values()]
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
      setPageInfo(data.pageInfo || { hasMore: false, nextBefore: null });
      await markSupportTeamConversationRead(conversationId);
      await refreshDirectory();
    } catch (err) {
      setError(err.message);
    } finally {
      if (!before) setLoading(false);
    }
  }, [refreshDirectory]);

  const loadEarlier = async () => {
    if (!pageInfo.hasMore || loadingOlder || !messages[0]?.createdAt) return;
    const container = messagesRef.current;
    const previousHeight = container?.scrollHeight || 0;
    setLoadingOlder(true);
    loadingOlderRef.current = true;
    try {
      await loadConversation(selected, { before: messages[0].createdAt });
      window.requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingOlder(false);
      window.setTimeout(() => {
        loadingOlderRef.current = false;
      }, 100);
    }
  };

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

  const latestTeamMessageId = messages[messages.length - 1]?.id || "";

  useEffect(() => {
    if (loadingOlderRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [latestTeamMessageId, selected]);

  useEffect(() => {
    const socket = connectSupportSocket();
    socketRef.current = socket;
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
    socket.on("support:team-messages-deleted", ({ messageIds = [], scope }) => {
      const removed = new Set(messageIds.map(String));
      setMessages((rows) =>
        scope === "everyone"
          ? rows.map((row) =>
              removed.has(String(row.id))
                ? {
                    ...row,
                    body: "",
                    deletedForEveryone: true,
                    deletedForEveryoneAt: new Date().toISOString(),
                  }
                : row,
            )
          : rows.filter((row) => !removed.has(String(row.id))),
      );
      setSelectedIds(new Set());
      refreshDirectory().catch(() => {});
    });
    socket.on("support:team-messages-read", ({ messageIds = [] }) => {
      const readIds = new Set(messageIds.map(String));
      setMessages((rows) =>
        rows.map((message) =>
          readIds.has(String(message.id))
            ? { ...message, deliveryStatus: "read" }
            : message,
        ),
      );
    });
    socket.on("support:team-typing", (payload) => {
      const matches =
        selected === "general"
          ? payload?.conversationId === "general"
          : String(payload?.userId || "") === String(selected);
      if (matches) {
        setTyping(Boolean(payload.isTyping));
        window.clearTimeout(incomingTypingTimerRef.current);
        if (payload.isTyping) {
          incomingTypingTimerRef.current = window.setTimeout(
            () => setTyping(false),
            1800,
          );
        }
      }
    });
    socket.on("support:team-general-cleared", () => {
      if (selected === "general") setMessages([]);
      refreshDirectory().catch(() => {});
    });
    return () => { socketRef.current = null; socket.disconnect(); };
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
    notifyTyping(false);
    setSending(true);
    try {
      const data = await sendSupportTeamMessage(
        selected,
        body,
        replyingTo?.id || null,
      );
      if (data.message) {
        setMessages((rows) =>
          rows.some((row) => row.id === data.message.id)
            ? rows
            : [...rows, data.message],
        );
      }
      setReplyingTo(null);
    } catch (err) {
      setDraft(body);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const notifyTyping = (isTyping) => {
    socketRef.current?.emit("support:team-typing", {
      conversationId: selected,
      isTyping,
    });
    window.clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = window.setTimeout(() => notifyTyping(false), 1200);
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

  const toggleSelected = (messageId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const deleteSelection = async (scope) => {
    const messageIds = [...selectedIds];
    if (!messageIds.length) return;
    setActionBusy("delete-selection");
    try {
      await deleteSelectedSupportTeamMessages(messageIds, scope);
      const removed = new Set(messageIds);
      setMessages((rows) =>
        scope === "everyone"
          ? rows.map((row) =>
              removed.has(row.id)
                ? {
                    ...row,
                    body: "",
                    deletedForEveryone: true,
                    deletedForEveryoneAt: new Date().toISOString(),
                  }
                : row,
            )
          : rows.filter((row) => !removed.has(row.id)),
      );
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy("");
    }
  };

  const selectedMessages = messages.filter((message) => selectedIds.has(message.id));
  const canDeleteForEveryone =
    selectedMessages.length > 0 &&
    ((selected === "general" &&
      selectedMessages.every((message) => !message.deletedForEveryone)) ||
      selectedMessages.every(
        (message) =>
          message.sender?.id === (admin.id || admin._id) &&
          !message.deletedForEveryone,
      ));

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
          onClick={() => { setSelectedIds(new Set()); setReplyingTo(null); setTyping(false); setMessages([]); setPageInfo({ hasMore: false, nextBefore: null }); setSelected("general"); }}
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
            onClick={() => { setSelectedIds(new Set()); setReplyingTo(null); setTyping(false); setMessages([]); setPageInfo({ hasMore: false, nextBefore: null }); setSelected(member.id); }}
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
        {selectedIds.size ? (
          <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2">
            <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-full p-2 hover:bg-slate-100"><X size={17} /></button>
            <strong className="me-auto text-sm">{selectedIds.size}</strong>
            <button type="button" onClick={() => setSelectedIds(new Set(messages.map((message) => message.id)))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{isFa ? "انتخاب همه" : "Select all"}</button>
            <button type="button" disabled={actionBusy === "delete-selection"} onClick={() => deleteSelection("me")} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{isFa ? "حذف برای من" : "Delete for me"}</button>
            {canDeleteForEveryone ? <button type="button" disabled={actionBusy === "delete-selection"} onClick={() => deleteSelection("everyone")} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white">{isFa ? "حذف برای همه" : "Delete for everyone"}</button> : null}
          </div>
        ) : null}
        {error ? <div className="m-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        <div ref={messagesRef} className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
          {pageInfo.hasMore ? <div className="flex justify-center"><button type="button" disabled={loadingOlder} onClick={loadEarlier} className="rounded-full bg-white px-4 py-2 text-xs font-black text-emerald-700 shadow-sm disabled:opacity-50">{loadingOlder ? (isFa ? "در حال بارگذاری…" : "Loading…") : (isFa ? "نمایش پیام‌های قبلی" : "Load earlier messages")}</button></div> : null}
          {loading ? (
            <p className="p-10 text-center font-bold text-slate-400">...</p>
          ) : messages.length ? (
            messages.map((message) => {
              const own = message.sender?.id === (admin.id || admin._id);
              const sender = members.find((row) => row.id === message.sender?.id);
              return (
                <div key={message.id} className={`flex items-center gap-1 ${own ? "justify-end" : "justify-start"} ${selectedIds.has(message.id) ? "rounded-xl bg-emerald-100/70" : ""}`}>
                  <button type="button" onClick={() => toggleSelected(message.id)} className={selectedIds.has(message.id) ? "text-emerald-600" : "text-slate-400"}>{selectedIds.has(message.id) ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
                  <div className={`max-w-[82%] rounded-xl px-4 py-3 shadow-sm ${own ? "bg-[#d9fdd3]" : "bg-white"}`}>
                    {selected === "general" && !own ? (
                      <p className="mb-1 text-[11px] font-black text-emerald-700">
                        {message.sender?.name} · {supportSpecializationLabel(sender?.specialization, language)}
                      </p>
                    ) : null}
                    {message.replyTo ? <AdminReplyQuote message={message.replyTo} isFa={isFa} /> : null}
                    {editingId === message.id ? (
                      <div className="space-y-2">
                        <textarea autoFocus value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={4000} rows={2} className="w-full min-w-52 resize-none rounded-lg border border-emerald-300 bg-white p-2 text-sm outline-none" />
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => { setEditingId(""); setEditingBody(""); }} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100"><X size={14} /></button>
                          <button type="button" disabled={actionBusy === message.id || !editingBody.trim()} onClick={saveEdit} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40"><Check size={14} /></button>
                        </div>
                      </div>
                    ) : message.deletedForEveryone ? <p className="text-sm italic text-slate-500">{isFa ? "این پیام حذف شده است." : "This message was deleted."}</p> : <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">
                      {message.editedAt ? (isFa ? "ویرایش‌شده · " : "edited · ") : ""}
                      {new Date(message.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US")}
                      {own ? <CheckCheck className={`ms-1 inline ${message.deliveryStatus === "read" ? "text-sky-500" : "text-slate-400"}`} size={14} /> : null}
                    </p>
                    {editingId !== message.id && !message.deletedForEveryone ? (
                      <div className="mt-1 flex justify-end gap-1">
                        <button type="button" disabled={actionBusy === message.id} onClick={() => setReplyingTo(message)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "پاسخ" : "Reply"}><Reply size={12} /></button>
                        {own ? <button type="button" disabled={actionBusy === message.id} onClick={() => { setEditingId(message.id); setEditingBody(message.body); }} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "ویرایش" : "Edit"}><Pencil size={12} /></button> : null}
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
        <form onSubmit={send} className="border-t bg-[#f0f2f5] p-3">
          {replyingTo ? <div className="mb-2 flex items-center gap-2 rounded-xl border-s-4 border-emerald-500 bg-white px-3 py-2"><div className="min-w-0 flex-1"><p className="text-[10px] font-black text-emerald-700">{replyingTo.sender?.name || (isFa ? "پیام" : "Message")}</p><p className="truncate text-xs text-slate-600">{replyingTo.body}</p></div><button type="button" onClick={() => setReplyingTo(null)}><X size={16} /></button></div> : null}
          {typing ? <div className="mb-1 px-3 text-[11px] font-bold text-emerald-700">{isFa ? "در حال نوشتن…" : "typing…"}</div> : null}
          <div className="flex gap-2">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              notifyTyping(Boolean(event.target.value.trim()));
            }}
            rows={1}
            maxLength={4000}
            placeholder={isFa ? "پیام برای تیم پشتیبانی" : "Message the support team"}
            className="min-h-11 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />
          <button onPointerDown={(event) => event.preventDefault()} onClick={() => composerRef.current?.focus({ preventScroll: true })} disabled={sending || !draft.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40">
            <Send size={19} />
          </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function AdminReplyQuote({ message, isFa }) {
  return <div className="mb-1.5 rounded-lg border-s-4 border-emerald-500 bg-black/5 px-2 py-1.5"><p className="truncate text-[10px] font-black text-emerald-700">{message.sender?.role === "admin" ? (isFa ? "ادمین" : "Admin") : message.sender?.name || (isFa ? "پیام" : "Message")}</p><p className="line-clamp-2 text-[11px] text-slate-600">{message.deletedForEveryone ? (isFa ? "این پیام حذف شده است." : "This message was deleted.") : message.body}</p></div>;
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
