import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Hash,
  MessageSquare,
  Search,
  Send,
  Users,
} from "lucide-react";
import {
  fetchSupportTeamMessages,
  markSupportTeamConversationRead,
  sendSupportTeamChatMessage,
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
  onMobileDetailChange,
}) {
  const { isFa } = useSupportStaffLanguage();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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

  useEffect(() => {
    if (!selectedConversation || (!desktopLayout && !mobileOpen)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetchSupportTeamMessages(selectedConversation)
        .then((data) => {
          if (active) {
            setMessages(Array.isArray(data.messages) ? data.messages : []);
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
    mobileOpen,
    refreshTeam,
    selectedConversation,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const handler = (event) => {
      const message = event.detail;
      if (!desktopLayout && !mobileOpen) return;
      if (!belongsToConversation(message, selectedConversation, agent)) return;
      setMessages((current) =>
        current.some((row) => row.id === message.id)
          ? current
          : [...current, message],
      );
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
        setMessages((current) =>
          current.some((row) => row.id === data.message.id)
            ? current
            : [...current, data.message],
        );
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

  return (
    <section className={`grid overflow-hidden bg-white shadow-sm lg:h-auto lg:min-h-[72vh] lg:grid-cols-[340px_1fr] lg:rounded-3xl lg:border lg:border-slate-200 ${mobileOpen ? "h-[100dvh] min-h-0 rounded-none border-0" : "h-[calc(100dvh-9.5rem)] min-h-[28rem] rounded-2xl border border-slate-200"}`}>
      <aside className={`${mobileOpen ? "hidden" : "block"} h-full overflow-y-auto border-b border-slate-200 lg:block lg:max-h-[76vh] lg:border-b-0 lg:border-e`}>
        <div className="sticky top-0 z-10 border-b bg-white p-3">
          <label className="relative block">
            <Search
              className="absolute start-3 top-3 text-slate-400"
              size={16}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isFa ? "جستجوی عضو تیم" : "Find a team member"}
              className="w-full rounded-xl border border-slate-200 py-2.5 ps-9 pe-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <ConversationButton
          active={selectedConversation === "general"}
          icon={<Hash size={18} />}
          title={isFa ? "گفتگوی عمومی تیم" : "General team room"}
          subtitle={
            isFa
              ? "برای همه اعضای فعال پشتیبانی قابل مشاهده است"
              : "Visible to every active support member"
          }
          unread={generalUnread}
          onClick={() => openConversation("general")}
        />
        <p className="px-4 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
          {isFa ? "پیام‌های خصوصی" : "Direct messages"} · {visibleMembers.length}
        </p>
        {visibleMembers.map((member) => {
          const online = presence[member.id]?.online ?? member.online;
          return (
            <ConversationButton
              key={member.id}
              active={selectedConversation === member.id}
              icon={
                <Avatar name={member.name} online={online} />
              }
              title={member.name}
              subtitle={`${supportStaffRoleLabel(member.specialization, isFa)} · ${online ? (isFa ? "آنلاین" : "Online") : formatLastSeen(presence[member.id]?.lastSeenAt || member.lastSeenAt, isFa)} · ${member.activeTickets} ${isFa ? "تکت فعال" : `active ticket${member.activeTickets === 1 ? "" : "s"}`}`}
              unread={member.unreadMessages}
              onClick={() => openConversation(member.id)}
            />
          );
        })}
      </aside>

      <div className={`${mobileOpen ? "flex" : "hidden"} h-full min-h-0 flex-col lg:flex lg:min-h-[620px]`}>
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white p-2.5 shadow-sm sm:gap-3 sm:p-4">
          <button
            type="button"
            onClick={closeConversation}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label={isFa ? "بازگشت" : "Back"}
          >
            {isFa ? <ChevronRight size={23} /> : <ChevronLeft size={23} />}
          </button>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 sm:h-11 sm:w-11 sm:rounded-xl">
            {selectedConversation === "general" ? (
              <Users size={21} />
            ) : (
              <MessageSquare size={21} />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-black sm:text-base">
                {selectedConversation === "general"
                  ? isFa
                    ? "گفتگوی عمومی تیم"
                    : "General team room"
                  : selectedMember?.name ||
                    (isFa ? "گفتگوی تیم" : "Team conversation")}
              </h2>
              {selectedConversation !== "general" && selectedMember ? (
                <RoleBadge
                  specialization={selectedMember.specialization}
                  isFa={isFa}
                />
              ) : null}
            </div>
            <p className="truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
              {selectedConversation === "general"
                ? isFa
                  ? "هماهنگی انتقال تکت‌ها، مشکلات و خبرهای تیم."
                  : "Coordinate handoffs, incidents, and team updates."
                : selectedMember
                  ? `${supportStaffRoleLabel(selectedMember.specialization, isFa)} · ${selectedMember.email} · ${selectedMember.activeTickets} ${isFa ? "تکت فعال" : `active ticket${selectedMember.activeTickets === 1 ? "" : "s"}`}`
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
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.32)_0,rgba(255,255,255,0.32)_1px,transparent_1px)] bg-[length:18px_18px] p-2.5 sm:space-y-3 sm:p-4">
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
                  isFa={isFa}
                />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="border-t bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
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
                    ? `پیام به ${selectedMember?.name || "عضو تیم"}`
                    : `Message ${selectedMember?.name || "team member"}`
              }
              className="min-h-11 max-h-28 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
            <button
              disabled={sending || !draft.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm disabled:opacity-40"
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
        active ? "bg-blue-50" : "hover:bg-slate-50"
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
        <span className="rounded-full bg-[#0B4FD8] px-2 py-0.5 text-[10px] font-black text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

function Avatar({ name, online }) {
  return (
    <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
      {String(name || "?").slice(0, 1).toUpperCase()}
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
  isFa,
}) {
  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-xl px-3 py-2 shadow-sm sm:max-w-[82%] sm:px-4 sm:py-3 ${
          own
            ? "bg-[#d9fdd3] text-slate-900"
            : "bg-white text-slate-900"
        }`}
      >
        {showSender && !own ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-black text-emerald-700">
              {message.sender?.name}
            </p>
            <RoleBadge specialization={specialization} isFa={isFa} />
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        <p
          className={`mt-1 text-[10px] font-semibold ${
            "text-slate-400"
          }`}
        >
          {new Date(message.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US")}
        </p>
      </div>
    </div>
  );
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
