import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Check,
  Hash,
  MessageSquare,
  Pencil,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { resolveAvatarUrl } from "../../../utils/avatar.js";
import {
  buildSupportCacheKey,
  readSupportPageCache,
  writeSupportPageCache,
} from "../../../utils/supportPageCache.js";
import {
  fetchSupportTeamMessages,
  deleteSupportTeamChatMessage,
  markSupportTeamConversationRead,
  sendSupportTeamChatMessage,
  updateSupportTeamChatMessage,
} from "../services/supportStaffApi.js";
import { useSupportStaffLanguage } from "../services/supportStaffLanguageContext.js";
import { supportStaffRoleLabel } from "../services/supportStaffRoles.js";

export default function SupportTeamChat({
  agent,
  members,
  generalUnread,
  presence,
  selectedConversation,
  onSelectConversation,
  onConversationRead,
  refreshTeam,
  refreshToken = 0,
  onMobileDetailChange,
}) {
  const { isFa } = useSupportStaffLanguage();
  const agentId = String(agent._id || agent.id || "");
  const conversationCacheKey = useMemo(
    () =>
      buildSupportCacheKey(
        "support",
        agentId,
        `team-chat:${selectedConversation || "general"}`,
      ),
    [agentId, selectedConversation],
  );
  const [messages, setMessages] = useState(
    () => readSupportPageCache(conversationCacheKey) || [],
  );
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const bottomRef = useRef(null);

  const visibleMembers = useMemo(() => {
    const value = search.trim().toLowerCase();
    return members
      .filter((member) => member.id !== (agent._id || agent.id))
      .filter(
        (member) =>
          !value ||
          member.name.toLowerCase().includes(value) ||
          member.email.toLowerCase().includes(value),
      );
  }, [agent._id, agent.id, members, search]);

  const selectedMember = members.find(
    (member) => member.id === selectedConversation,
  );
  const selectedMemberName = getMemberDisplayName(selectedMember, isFa);

  useEffect(() => {
    if (!selectedConversation || (!desktopLayout && !mobileOpen)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const cached = readSupportPageCache(conversationCacheKey);
      setMessages(Array.isArray(cached) ? cached : []);
      fetchSupportTeamMessages(selectedConversation)
        .then((data) => {
          if (active) {
            const rows = Array.isArray(data.messages) ? data.messages : [];
            setMessages(rows);
            writeSupportPageCache(conversationCacheKey, rows);
          }
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      markSupportTeamConversationRead(selectedConversation)
        .then(() => {
          onConversationRead(selectedConversation);
          refreshTeam();
        })
        .catch(() => {});
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    onConversationRead,
    desktopLayout,
    conversationCacheKey,
    mobileOpen,
    refreshTeam,
    refreshToken,
    selectedConversation,
  ]);

  useEffect(() => {
    const update = (event) => {
      const message = event.detail;
      if (!message?.id || !belongsToConversation(message, selectedConversation, agent)) return;
      setMessages((current) => {
        const next = current.map((row) => row.id === message.id ? message : row);
        writeSupportPageCache(conversationCacheKey, next);
        return next;
      });
    };
    const remove = (event) => {
      const messageId = event.detail?.messageId;
      if (!messageId) return;
      setMessages((current) => {
        const next = current.filter((row) => row.id !== messageId);
        writeSupportPageCache(conversationCacheKey, next);
        return next;
      });
    };
    const clearGeneral = () => {
      if (selectedConversation !== "general") return;
      setMessages([]);
      writeSupportPageCache(conversationCacheKey, []);
    };
    window.addEventListener("edutech-support-team-message-updated", update);
    window.addEventListener("edutech-support-team-message-deleted", remove);
    window.addEventListener("edutech-support-team-general-cleared", clearGeneral);
    return () => {
      window.removeEventListener("edutech-support-team-message-updated", update);
      window.removeEventListener("edutech-support-team-message-deleted", remove);
      window.removeEventListener("edutech-support-team-general-cleared", clearGeneral);
    };
  }, [agent, conversationCacheKey, selectedConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const handler = (event) => {
      const message = event.detail;
      if (!desktopLayout && !mobileOpen) return;
      if (!belongsToConversation(message, selectedConversation, agent)) return;
      setMessages((current) => {
        const next = current.some((row) => row.id === message.id)
          ? current
          : [...current, message];
        writeSupportPageCache(conversationCacheKey, next);
        return next;
      });
      if (message.sender?.id !== (agent._id || agent.id)) {
        markSupportTeamConversationRead(selectedConversation)
          .then(() => {
            onConversationRead(selectedConversation);
            refreshTeam();
          })
          .catch(() => {});
      }
    };
    window.addEventListener("edutech-support-team-message", handler);
    return () =>
      window.removeEventListener("edutech-support-team-message", handler);
  }, [
    agent,
    conversationCacheKey,
    desktopLayout,
    mobileOpen,
    onConversationRead,
    refreshTeam,
    selectedConversation,
  ]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedConversation) return;
    setSending(true);
    setError("");
    setDraft("");
    try {
      const data = await sendSupportTeamChatMessage(selectedConversation, body);
      if (data.message) {
        setMessages((current) => {
          const next = current.some((row) => row.id === data.message.id)
            ? current
            : [...current, data.message];
          writeSupportPageCache(conversationCacheKey, next);
          return next;
        });
      }
      refreshTeam();
    } catch (err) {
      setDraft(body);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const openConversation = (conversationId) => {
    onSelectConversation(conversationId);
    setMobileOpen(true);
    onMobileDetailChange?.(true);
  };

  const closeConversation = () => {
    setMobileOpen(false);
    onMobileDetailChange?.(false);
  };

  const startEdit = (message) => {
    setEditingId(message.id);
    setEditingBody(message.body);
  };

  const saveEdit = async () => {
    const body = editingBody.trim();
    if (!editingId || !body) return;
    setActionBusy(editingId);
    try {
      const data = await updateSupportTeamChatMessage(editingId, body);
      if (data.message) {
        setMessages((current) => {
          const next = current.map((row) =>
            row.id === data.message.id ? data.message : row,
          );
          writeSupportPageCache(conversationCacheKey, next);
          return next;
        });
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
      await deleteSupportTeamChatMessage(message.id);
      setMessages((current) => {
        const next = current.filter((row) => row.id !== message.id);
        writeSupportPageCache(conversationCacheKey, next);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy("");
    }
  };

  return (
    <section className={`grid w-full min-w-0 max-w-full overflow-hidden bg-white shadow-sm lg:h-[clamp(520px,calc(100dvh-10.5rem),720px)] lg:min-h-0 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:rounded-3xl lg:border lg:border-slate-200 ${mobileOpen ? "h-full min-h-0 rounded-none border-0" : "h-[calc(100dvh-9.5rem)] min-h-[28rem] rounded-2xl border border-slate-200"}`}>
      <aside className={`${mobileOpen ? "hidden" : "flex"} h-full min-h-0 flex-col border-b border-slate-200 bg-white lg:flex lg:border-b-0 lg:border-e`}>
        <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
              <Users size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black">
                {isFa ? "گفتگوی تیم" : "Team chats"}
              </h2>
              <p className="text-[11px] font-bold text-emerald-700">
                {isFa
                  ? `${members.length} عضو تیم`
                  : `${members.length} team members`}
              </p>
            </div>
          </div>
        </div>
        <div className="border-b border-slate-100 p-2">
          <label className="relative block">
            <Search
              className="absolute start-4 top-2.5 text-slate-400"
              size={17}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isFa ? "جستجوی عضو تیم" : "Find a team member"}
              className="w-full rounded-xl border-0 bg-[#f0f2f5] py-2 ps-11 pe-4 text-sm outline-none"
            />
          </label>
        </div>
        <div className="chat-scrollbar-side edutech-scrollbar min-h-0 flex-1 overflow-y-auto">
          <ConversationButton
            active={selectedConversation === "general"}
            icon={
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white">
                <Hash size={20} />
              </span>
            }
            title={isFa ? "گفتگوی عمومی تیم" : "General team room"}
            subtitle={
              isFa
                ? "برای همه اعضای فعال پشتیبانی"
                : "Visible to all active support members"
            }
            unread={generalUnread}
            onClick={() => openConversation("general")}
          />
          <p className="px-4 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
            {isFa ? "پیام‌های خصوصی" : "Direct messages"} · {visibleMembers.length}
          </p>
          {visibleMembers.map((member) => {
            const online = presence[member.id]?.online ?? member.online;
            const memberName = getMemberDisplayName(member, isFa);
            return (
              <ConversationButton
                key={member.id}
                active={selectedConversation === member.id}
                icon={
                  <Avatar
                    name={memberName}
                    avatar={member.avatar}
                    online={online}
                  />
                }
                title={memberName}
                subtitle={`${member.role === "admin" ? (isFa ? "مدیر سیستم" : "System administrator") : supportStaffRoleLabel(member.specialization, isFa)} · ${online ? (isFa ? "آنلاین" : "Online") : formatLastSeen(presence[member.id]?.lastSeenAt || member.lastSeenAt, isFa)}`}
                unread={member.unreadMessages}
                onClick={() => openConversation(member.id)}
              />
            );
          })}
        </div>
      </aside>

      <div className={`${mobileOpen ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#efeae2] lg:flex`}>
        <header className="z-20 flex min-h-14 items-center gap-2 bg-[#f0f2f5] px-2.5 py-2 shadow-sm sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={closeConversation}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label={isFa ? "بازگشت" : "Back"}
          >
            {isFa ? <ChevronRight size={23} /> : <ChevronLeft size={23} />}
          </button>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
            {selectedConversation === "general" ? (
              <Users size={21} />
            ) : (
              <MessageSquare size={21} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-black sm:text-base">
                {selectedConversation === "general"
                  ? isFa
                    ? "گفتگوی عمومی تیم"
                    : "General team room"
                  : selectedMemberName ||
                    (isFa ? "گفتگوی تیم" : "Team conversation")}
              </h2>
              {selectedConversation !== "general" &&
              selectedMember &&
              selectedMember.role !== "admin" ? (
                <span className="hidden sm:inline-flex">
                  <RoleBadge
                    specialization={selectedMember.specialization}
                    isFa={isFa}
                  />
                </span>
              ) : null}
            </div>
            <p className="truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
              {selectedConversation === "general"
                ? isFa
                  ? "هماهنگی انتقال تکت‌ها، مشکلات و خبرهای تیم."
                  : "Coordinate handoffs, incidents, and team updates."
                : selectedMember
                  ? selectedMember.role === "admin"
                    ? isFa
                      ? "مدیر سیستم"
                      : "System administrator"
                    : `${supportStaffRoleLabel(selectedMember.specialization, isFa)} · ${selectedMember.email} · ${selectedMember.activeTickets} ${isFa ? "تکت فعال" : `active ticket${selectedMember.activeTickets === 1 ? "" : "s"}`}`
                  : isFa
                    ? "گفتگوی خصوصی میان شما و این عضو تیم."
                    : "Private conversation between you and this team member."}
            </p>
          </div>
        </header>
        {error ? (
          <div className="m-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}
        <div className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.32)_0,rgba(255,255,255,0.32)_1px,transparent_1px)] bg-[length:18px_18px] p-2.5 sm:space-y-3 sm:p-4">
          {loading ? (
            <p className="p-10 text-center font-bold text-slate-400">
              {isFa ? "در حال بارگذاری گفتگو…" : "Loading conversation…"}
            </p>
          ) : messages.length === 0 ? (
            <div className="grid h-full min-h-72 place-items-center text-center text-slate-400">
              <div>
                <MessageSquare className="mx-auto" size={44} />
                <p className="mt-3 font-black">
                  {isFa ? "گفتگو را آغاز کنید" : "Start the conversation"}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {isFa
                    ? "پیام‌ها ذخیره و به‌صورت زنده همگام می‌شوند."
                    : "Messages are saved and synchronized live."}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const senderMember = members.find(
                (member) => member.id === message.sender?.id,
              );
              return (
                <TeamMessage
                  key={message.id}
                  message={message}
                  own={message.sender?.id === (agent._id || agent.id)}
                  showSender={selectedConversation === "general"}
                  specialization={senderMember?.specialization}
                  senderRole={message.sender?.role}
                  isFa={isFa}
                  editing={editingId === message.id}
                  editingBody={editingBody}
                  busy={actionBusy === message.id}
                  onEditingBodyChange={setEditingBody}
                  onStartEdit={() => startEdit(message)}
                  onCancelEdit={() => { setEditingId(""); setEditingBody(""); }}
                  onSaveEdit={saveEdit}
                  onDelete={() => removeMessage(message)}
                />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={4000}
              rows={1}
              placeholder={
                selectedConversation === "general"
                  ? isFa
                    ? "پیام برای تیم پشتیبانی"
                    : "Message the support team"
                  : isFa
                    ? `پیام به ${selectedMemberName || "عضو تیم"}`
                    : `Message ${selectedMemberName || "team member"}`
              }
              className="min-h-11 max-h-28 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm outline-none"
            />
            <button
              disabled={sending || !draft.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-sm disabled:opacity-40"
            >
              <Send size={19} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function belongsToConversation(message, conversationId, agent) {
  if (!message) return false;
  if (conversationId === "general") {
    return message.conversationType === "channel" && message.channel === "general";
  }
  const ownId = String(agent._id || agent.id || "");
  return (
    message.conversationType === "direct" &&
    [message.sender?.id, message.recipient?.id].includes(ownId) &&
    [message.sender?.id, message.recipient?.id].includes(conversationId)
  );
}

function ConversationButton({
  active,
  icon,
  title,
  subtitle,
  unread,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-start transition ${
        active ? "bg-[#f0f2f5]" : "hover:bg-slate-50"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm">{title}</strong>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">
          {subtitle}
        </span>
      </span>
      {unread > 0 ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-black text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function Avatar({ name, avatar, online }) {
  const imageUrl = resolveAvatarUrl(avatar || "");

  return (
    <span className="relative grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
      <Users size={20} />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name || ""}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <Circle
        size={11}
        className={`absolute -bottom-0.5 -right-0.5 fill-current ${
          online ? "text-emerald-500" : "text-slate-300"
        }`}
      />
    </span>
  );
}

function TeamMessage({
  message,
  own,
  showSender,
  specialization,
  senderRole,
  isFa,
  editing,
  editingBody,
  busy,
  onEditingBodyChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) {
  const isAdmin = senderRole === "admin";
  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[86%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[72%] ${
          own
            ? "bg-[#d9fdd3] text-slate-900"
            : "bg-white text-slate-900"
        }`}
      >
        {showSender && !own ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-black text-emerald-700">
              {isAdmin
                ? isFa
                  ? "ادمین"
                  : "Admin"
                : message.sender?.name}
            </p>
            {!isAdmin ? (
              <RoleBadge specialization={specialization} isFa={isFa} />
            ) : null}
          </div>
        ) : null}
        {editing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={editingBody}
              onChange={(event) => onEditingBodyChange(event.target.value)}
              maxLength={4000}
              rows={2}
              className="w-full min-w-52 resize-none rounded-lg border border-emerald-300 bg-white p-2 text-sm outline-none"
            />
            <div className="flex justify-end gap-1">
              <button type="button" onClick={onCancelEdit} className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={14} /></button>
              <button type="button" disabled={busy || !editingBody.trim()} onClick={onSaveEdit} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40"><Check size={14} /></button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-5 sm:text-sm">
            {message.body}
          </p>
        )}
        <p className="mt-1 text-end text-[9px] font-semibold text-slate-500">
          {message.editedAt ? (isFa ? "ویرایش‌شده · " : "edited · ") : ""}
          {formatMessageTime(message.createdAt, isFa)}
        </p>
        {own && !editing ? (
          <div className="mt-1 flex justify-end gap-1 opacity-70 transition hover:opacity-100">
            <button type="button" disabled={busy} onClick={onStartEdit} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "ویرایش" : "Edit"}><Pencil size={12} /></button>
            <button type="button" disabled={busy} onClick={onDelete} className="grid h-6 w-6 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label={isFa ? "حذف" : "Delete"}><Trash2 size={12} /></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getMemberDisplayName(member, isFa) {
  if (!member) return "";
  return member.role === "admin"
    ? isFa
      ? "ادمین"
      : "Admin"
    : member.name || "";
}

function formatMessageTime(value, isFa) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(isFa ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoleBadge({ specialization = "general", isFa }) {
  const colors = {
    general: "bg-slate-100 text-slate-700",
    contact: "bg-cyan-100 text-cyan-800",
    technical: "bg-violet-100 text-violet-800",
    payments: "bg-emerald-100 text-emerald-800",
    courses: "bg-blue-100 text-blue-800",
    teacher_support: "bg-amber-100 text-amber-800",
    certificates: "bg-rose-100 text-rose-800",
    team_lead: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${
        colors[specialization] || colors.general
      }`}
    >
      {supportStaffRoleLabel(specialization, isFa)}
    </span>
  );
}

function formatLastSeen(value, isFa) {
  if (!value) return isFa ? "آفلاین" : "Offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isFa ? "آفلاین" : "Offline";
  return isFa
    ? `آخرین بازدید ${date.toLocaleString("fa-IR")}`
    : `Last seen ${date.toLocaleString("en-US")}`;
}
