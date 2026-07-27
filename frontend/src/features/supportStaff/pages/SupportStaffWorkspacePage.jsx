import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpenCheck,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Circle,
  Download,
  GraduationCap,
  Headphones,
  Inbox,
  LogOut,
  MessageCircle,
  MessagesSquare,
  MoreVertical,
  Pencil,
  RefreshCw,
  Reply,
  Search,
  Send,
  StickyNote,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router";
import { resolveAvatarUrl } from "../../../utils/avatar.js";
import {
  buildSupportCacheKey,
  readSupportPageCache,
  writeSupportPageCache,
} from "../../../utils/supportPageCache.js";
import {
  connectSupportStaffSocket,
  deleteSelectedSupportStaffMessages,
  deleteSupportStaffTicket,
  fetchSupportTeamDirectory,
  fetchSupportStaffQueue,
  fetchSupportStaffTicket,
  markSupportStaffTicketRead,
  sendSupportStaffMessage,
  updateSupportStaffMessage,
  updateSupportStaffTicket,
} from "../services/supportStaffApi.js";
import {
  enableSupportStaffNotifications,
  getSupportNotificationPermission,
  syncSupportStaffNotifications,
} from "../services/supportStaffNotifications.js";
import SupportTeamChat from "../components/SupportTeamChat.jsx";
import SupportTeamGuide from "../components/SupportTeamGuide.jsx";
import {
  SupportStaffLanguageProvider,
  SupportStaffLanguageToggle,
} from "../components/SupportStaffLanguage.jsx";
import { useSupportStaffLanguage } from "../services/supportStaffLanguageContext.js";
import { supportStaffRoleLabel } from "../services/supportStaffRoles.js";
import {
  clearSupportStaffAuth,
  getSupportStaffUser,
} from "../services/supportStaffAuth.js";

const STATUSES = ["open", "in_progress", "waiting_for_user", "resolved", "closed"];
const LABELS = {
  workspace: "My active workspace",
  open: "Open",
  in_progress: "In progress",
  waiting_for_user: "Waiting for user",
  resolved: "Resolved",
  closed: "Closed",
};
const FA_LABELS = {
  workspace: "کارهای فعال من",
  open: "باز",
  in_progress: "در حال بررسی",
  waiting_for_user: "در انتظار کاربر",
  resolved: "حل شده",
  closed: "بسته",
};

export default function SupportStaffWorkspacePage() {
  return (
    <SupportStaffLanguageProvider>
      <SupportStaffWorkspaceContent />
    </SupportStaffLanguageProvider>
  );
}

function SupportStaffWorkspaceContent() {
  const navigate = useNavigate();
  const { isFa } = useSupportStaffLanguage();
  const labels = isFa ? FA_LABELS : LABELS;
  const initialRoute = useMemo(() => {
    if (typeof window === "undefined") {
      return { ticketId: "", conversationId: "" };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      ticketId: params.get("ticket") || "",
      conversationId: params.get("conversation") || "",
    };
  }, []);
  const agent = useMemo(() => getSupportStaffUser() || {}, []);
  const agentId = String(agent._id || agent.id || "");
  const workspaceCacheKey = useMemo(
    () => buildSupportCacheKey("support", agentId, "workspace"),
    [agentId],
  );
  const teamCacheKey = useMemo(
    () => buildSupportCacheKey("support", agentId, "team"),
    [agentId],
  );
  const initialWorkspaceCache = useMemo(
    () => readSupportPageCache(workspaceCacheKey),
    [workspaceCacheKey],
  );
  const initialTeamCache = useMemo(
    () => readSupportPageCache(teamCacheKey),
    [teamCacheKey],
  );
  const [tickets, setTickets] = useState(
    initialWorkspaceCache?.tickets || [],
  );
  const [team, setTeam] = useState(initialTeamCache?.members || []);
  const [generalUnread, setGeneralUnread] = useState(
    Number(initialTeamCache?.generalUnread) || 0,
  );
  const [presence, setPresence] = useState({});
  const [activeView, setActiveView] = useState(
    initialRoute.conversationId ? "team" : "tickets",
  );
  const [mobileTicketOpen, setMobileTicketOpen] = useState(
    Boolean(initialRoute.ticketId),
  );
  const [mobileTeamChatOpen, setMobileTeamChatOpen] = useState(
    Boolean(initialRoute.conversationId),
  );
  const [desktopLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const [selectedConversation, setSelectedConversation] = useState(
    initialRoute.conversationId || "general",
  );
  const initialTicketId =
    initialRoute.ticketId ||
    initialWorkspaceCache?.selectedId ||
    initialWorkspaceCache?.tickets?.[0]?.id ||
    "";
  const [selectedId, setSelectedId] = useState(initialTicketId);
  const [chat, setChat] = useState(() =>
    {
      const cached = initialTicketId
        ? readSupportPageCache(
          buildSupportCacheKey(
            "support",
            agentId,
            `ticket:${initialTicketId}`,
          ),
        )
        : null;
      return cached
        ? { ...cached, messages: (cached.messages || []).slice(-30) }
        : null;
    },
  );
  const [filters, setFilters] = useState({
    search: "",
    status: "workspace",
  });
  const [draft, setDraft] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState(() => new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(
    !(initialWorkspaceCache && initialTeamCache),
  );
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pageInfo, setPageInfo] = useState({ hasMore: false, nextBefore: null });
  const [requesterTyping, setRequesterTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [teamRefreshToken, setTeamRefreshToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    getSupportNotificationPermission,
  );
  const [installPrompt, setInstallPrompt] = useState(
    () => window.__edutechInstallPrompt || null,
  );
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.("(display-mode: standalone)")?.matches || false,
  );
  const [error, setError] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [ticketActionsOpen, setTicketActionsOpen] = useState(false);
  const [handoffReason, setHandoffReason] = useState("");
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const composerRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const incomingTypingTimerRef = useRef(null);
  const loadingOlderRef = useRef(false);

  const loadQueue = useCallback(async () => {
    const workspaceView = filters.status === "workspace";
    const data = await fetchSupportStaffQueue({
      ...filters,
      status: workspaceView ? "all" : filters.status,
    });
    const fetchedRows = Array.isArray(data.tickets) ? data.tickets : [];
    const rows = workspaceView
      ? fetchedRows.filter(
          (ticket) =>
            ["open", "in_progress", "waiting_for_user"].includes(
              ticket.status,
            ) || ticket.assignedTo?.id === agentId,
        )
      : fetchedRows;
    setTickets(rows);
    setSelectedId((current) => current || rows[0]?.id || "");
  }, [agentId, filters]);

  const loadChat = useCallback(async (ticketId, { before = "" } = {}) => {
    if (!ticketId) return;
    const cacheKey = buildSupportCacheKey(
      "support",
      agentId,
      `ticket:${ticketId}`,
    );
    const cached = readSupportPageCache(cacheKey);
    if (cached) {
      setChat((current) =>
        current?.ticket?.id === ticketId
          ? current
          : { ...cached, messages: (cached.messages || []).slice(-30) },
      );
    }
    const data = await fetchSupportStaffTicket(ticketId, { before });
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
      writeSupportPageCache(cacheKey, next);
      return next;
    });
    setPageInfo(data.pageInfo || { hasMore: false, nextBefore: null });
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              unreadForSupport:
                data.ticket?.assignedTo?.id === agentId
                  ? 0
                  : ticket.unreadForSupport,
            }
          : ticket,
      ),
    );
    if (data.ticket?.assignedTo?.id === agentId) {
      markSupportStaffTicketRead(ticketId).catch(() => {});
    }
  }, [agentId]);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOlder(false);
      window.setTimeout(() => {
        loadingOlderRef.current = false;
      }, 100);
    }
  };

  useEffect(() => {
    const isDefaultWorkspace =
      filters.status === "workspace" &&
      !filters.search;
    if (!isDefaultWorkspace || (loading && !initialWorkspaceCache)) return;
    writeSupportPageCache(workspaceCacheKey, { tickets, selectedId });
  }, [
    filters.search,
    filters.status,
    initialWorkspaceCache,
    loading,
    selectedId,
    tickets,
    workspaceCacheKey,
  ]);

  useEffect(() => {
    if (loading && !initialTeamCache) return;
    writeSupportPageCache(teamCacheKey, {
      members: team,
      generalUnread,
    });
  }, [
    generalUnread,
    initialTeamCache,
    loading,
    team,
    teamCacheKey,
  ]);

  useEffect(() => {
    if (!chat?.ticket?.id) return;
    writeSupportPageCache(
      buildSupportCacheKey(
        "support",
        agentId,
        `ticket:${chat.ticket.id}`,
      ),
      chat,
    );
  }, [agentId, chat]);

  const loadTeam = useCallback(async () => {
    const data = await fetchSupportTeamDirectory();
    const members = Array.isArray(data.members) ? data.members : [];
    setTeam(members);
    setGeneralUnread(Number(data.generalUnread) || 0);
    setPresence((current) => {
      const next = { ...current };
      members.forEach((member) => {
        next[member.id] = {
          online: member.online,
          lastSeenAt: member.lastSeenAt,
        };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([loadQueue(), loadTeam()])
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [loadQueue, loadTeam]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    syncSupportStaffNotifications().catch(() => {});
  }, [notificationPermission]);

  useEffect(() => {
    navigator.serviceWorker?.register("/edutech-push-sw.js").catch(() => {});
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      window.__edutechInstallPrompt = event;
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      window.__edutechInstallPrompt = null;
      setInstallPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!selectedId || (!desktopLayout && !mobileTicketOpen)) return;
    const timer = window.setTimeout(() => {
      loadChat(selectedId).catch((err) => setError(err.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [desktopLayout, loadChat, mobileTicketOpen, selectedId]);

  const latestTicketMessageId =
    chat?.messages?.[chat.messages.length - 1]?.id || "";

  useEffect(() => {
    if (loadingOlderRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [chat?.ticket?.id, latestTicketMessageId]);

  useEffect(() => {
    const socket = connectSupportStaffSocket();
    socketRef.current = socket;
    socket.on("connect", () => {
      setLive(true);
      loadQueue().catch(() => {});
      if (selectedId && (desktopLayout || mobileTicketOpen)) {
        loadChat(selectedId).catch(() => {});
      }
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));
    const mergeRealtimeMessage = (payload) => {
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
      if (eventTicket.assignedTo?.id === agentId) {
        markSupportStaffTicketRead(eventTicket.id).catch(() => {});
      }
    };
    const refresh = (payload) => {
      mergeRealtimeMessage(payload);
      loadQueue().catch(() => {});
      if (payload?.ticket?.id === selectedId) {
        loadChat(selectedId).catch(() => {});
      }
    };
    [
      "support:ticket-created",
      "support:message",
      "support:message-updated",
      "support:message-deleted",
      "support:messages-deleted",
      "support:internal-note",
      "support:ticket-updated",
      "support:ticket-deleted",
    ].forEach((event) => socket.on(event, refresh));
    socket.on("support:team-presence", (payload) => {
      if (!payload?.userId) return;
      setPresence((current) => ({
        ...current,
        [payload.userId]: {
          online: Boolean(payload.online),
          lastSeenAt: payload.lastSeenAt || null,
        },
      }));
    });
    socket.on("support:team-message", (payload) => {
      if (payload?.message) {
        window.dispatchEvent(
          new CustomEvent("edutech-support-team-message", {
            detail: payload.message,
          }),
        );
      }
      loadTeam().catch(() => {});
    });
    socket.on("support:team-message-updated", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-message-updated", {
          detail: payload?.message,
        }),
      );
    });
    socket.on("support:team-message-deleted", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-message-deleted", {
          detail: payload,
        }),
      );
      loadTeam().catch(() => {});
    });
    socket.on("support:team-messages-deleted", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-messages-deleted", {
          detail: payload,
        }),
      );
      loadTeam().catch(() => {});
    });
    socket.on("support:team-messages-read", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-messages-read", {
          detail: payload,
        }),
      );
    });
    socket.on("support:team-typing", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-typing", {
          detail: payload,
        }),
      );
    });
    socket.on("support:messages-read", (payload) => {
      if (payload?.ticket?.id !== selectedId) return;
      const readIds = new Set((payload.messageIds || []).map(String));
      setChat((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                readIds.has(String(message.id))
                  ? { ...message, deliveryStatus: "read" }
                  : message,
              ),
            }
          : current,
      );
    });
    socket.on("support:typing", (payload) => {
      if (payload?.ticketId !== selectedId || payload?.userId === agentId) return;
      setRequesterTyping(Boolean(payload.isTyping));
      window.clearTimeout(incomingTypingTimerRef.current);
      if (payload.isTyping) {
        incomingTypingTimerRef.current = window.setTimeout(
          () => setRequesterTyping(false),
          1800,
        );
      }
    });
    const outgoingTeamTyping = (event) => {
      socket.emit("support:team-typing", event.detail || {});
    };
    window.addEventListener(
      "edutech-support-team-typing-outgoing",
      outgoingTeamTyping,
    );
    socket.on("support:team-general-cleared", (payload) => {
      window.dispatchEvent(
        new CustomEvent("edutech-support-team-general-cleared", {
          detail: payload,
        }),
      );
      loadTeam().catch(() => {});
    });
    if (selectedId) socket.emit("support:join", selectedId);
    const timer = setInterval(() => {
      if (document.hidden) return;
      loadQueue().catch(() => {});
      loadTeam().catch(() => {});
      if (selectedId && (desktopLayout || mobileTicketOpen)) {
        loadChat(selectedId).catch(() => {});
      }
    }, 15_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener(
        "edutech-support-team-typing-outgoing",
        outgoingTeamTyping,
      );
      socketRef.current = null;
      socket.disconnect();
    };
  }, [
    agentId,
    desktopLayout,
    loadChat,
    loadQueue,
    loadTeam,
    mobileTicketOpen,
    selectedId,
  ]);

  const teamUnread =
    generalUnread +
    team.reduce(
      (total, member) => total + Number(member.unreadMessages || 0),
      0,
    );

  const markConversationReadLocally = useCallback((conversationId) => {
    if (conversationId === "general") {
      setGeneralUnread(0);
      return;
    }
    setTeam((current) =>
      current.map((member) =>
        member.id === conversationId
          ? { ...member, unreadMessages: 0 }
          : member,
      ),
    );
  }, []);

  const updateTicket = async (changes, { reloadConversation = true } = {}) => {
    setBusy(true);
    setError("");
    try {
      await updateSupportStaffTicket(selectedId, changes);
      if (reloadConversation) {
        await Promise.all([loadQueue(), loadChat(selectedId)]);
      } else {
        setSelectedId("");
        setChat(null);
        setMobileTicketOpen(false);
        await loadQueue();
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    notifyTicketTyping(false);
    setDraft("");
    try {
      await sendSupportStaffMessage(
        selectedId,
        body,
        internalNote,
        replyingTo?.id || null,
      );
      setReplyingTo(null);
      await Promise.all([loadQueue(), loadChat(selectedId)]);
    } catch (err) {
      setDraft(body);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const notifyTicketTyping = (isTyping) => {
    if (!selectedId) return;
    socketRef.current?.emit("support:typing", { ticketId: selectedId, isTyping });
    window.clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = window.setTimeout(
        () => notifyTicketTyping(false),
        1200,
      );
    }
  };

  const editTicketMessage = async (message) => {
    const body = window.prompt(
      isFa ? "پیام را ویرایش کنید" : "Edit message",
      message.body,
    )?.trim();
    if (!body || body === message.body) return;
    setBusy(true);
    try {
      await updateSupportStaffMessage(selectedId, message.id, body);
      await Promise.all([loadQueue(), loadChat(selectedId)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMessageSelection = (messageId) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const deleteSelectedMessages = async (scope) => {
    const messageIds = [...selectedMessageIds];
    if (!messageIds.length) return;
    setBusy(true);
    try {
      await deleteSelectedSupportStaffMessages(selectedId, messageIds, scope);
      setSelectedMessageIds(new Set());
      await Promise.all([loadQueue(), loadChat(selectedId)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handoffTicket = async (event) => {
    event.preventDefault();
    const reason = handoffReason.trim();
    if (reason.length < 5) return;
    const completed = await updateTicket(
      { assignedTo: null, handoffReason: reason },
      { reloadConversation: false },
    );
    if (!completed) return;
    setHandoffReason("");
    setHandoffOpen(false);
  };

  const enableNotifications = async () => {
    setError("");
    if (getSupportNotificationPermission() === "denied") {
      setError(
        isFa
          ? "کروم اجازه اعلان این سایت را بسته است. در اعلان کروم روی Review و سپس Undo بزنید، یا از اطلاعات سایت ← Permissions ← Notifications گزینه Allow را انتخاب کنید."
          : "Chrome has blocked this site's notification permission. Tap Review and then Undo in Chrome, or open Site info → Permissions → Notifications and choose Allow.",
      );
      return;
    }
    try {
      const enabled = await enableSupportStaffNotifications();
      setNotificationPermission(getSupportNotificationPermission());
      if (!enabled) {
        setError(
          isFa
            ? "اعلان‌های مرورگر فعال نشد. اجازه اعلان را در تنظیمات مرورگر بررسی کنید."
            : "Browser notifications were not enabled. Check this site's notification permission.",
        );
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const installSupportApp = async () => {
    const prompt = installPrompt || window.__edutechInstallPrompt;
    if (!prompt) {
      setError(
        isFa
          ? "از منوی مرورگر گزینه «نصب برنامه» یا «افزودن به صفحه اصلی» را انتخاب کنید."
          : "Use your browser menu and choose “Install app” or “Add to Home screen”.",
      );
      return;
    }
    await prompt.prompt();
    await prompt.userChoice;
    window.__edutechInstallPrompt = null;
    setInstallPrompt(null);
  };

  const refreshWorkspace = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      const tasks = [loadQueue(), loadTeam()];
      if (activeView === "tickets" && selectedId) {
        tasks.push(loadChat(selectedId));
      }
      await Promise.all(tasks);
      if (activeView === "team") {
        setTeamRefreshToken((current) => current + 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const deleteCompletedTicket = async () => {
    if (!chat?.ticket?.id) return;
    const confirmed = window.confirm(
      isFa
        ? "این گفتگوی تکمیل‌شده از صندوق پشتیبانی حذف شود؟"
        : "Delete this completed conversation from the support inbox?",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await deleteSupportStaffTicket(chat.ticket.id);
      setSelectedId("");
      setChat(null);
      setMobileTicketOpen(false);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearSupportStaffAuth();
    navigate("/support/login", { replace: true });
  };

  const changeView = (view) => {
    setActiveView(view);
    setMobileTicketOpen(false);
    setMobileTeamChatOpen(false);
  };

  const mobileDetailOpen =
    (activeView === "tickets" && mobileTicketOpen) ||
    (activeView === "team" && mobileTeamChatOpen);

  return (
    <div
      className={`${mobileDetailOpen ? "h-[100dvh] overflow-hidden lg:h-auto lg:min-h-[100dvh] lg:overflow-visible" : "min-h-[100dvh]"} bg-[#f0f2f5] text-slate-950`}
      dir={isFa ? "rtl" : "ltr"}
    >
      <header className={`border-b border-slate-200 bg-[#f0f2f5] px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 ${mobileDetailOpen ? "hidden lg:block" : ""}`}>
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884] text-white sm:h-11 sm:w-11">
              <Headphones size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-black sm:text-base">
                {isFa ? "محیط کاری پشتیبانی EduTech" : "EduTech Support Workspace"}
              </h1>
              <p className="truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
                {agent.name} · {supportStaffRoleLabel(
                  team.find(
                    (member) => member.id === (agent._id || agent.id),
                  )?.specialization,
                  isFa,
                )} · {agent.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-red-700 shadow-sm sm:hidden"
              aria-label={isFa ? "خروج" : "Logout"}
            >
              <LogOut size={17} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <SupportStaffLanguageToggle compact />
            {!installed ? (
              <button
                type="button"
                onClick={installSupportApp}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm"
                aria-label={isFa ? "نصب برنامه پشتیبانی" : "Install support app"}
                title={isFa ? "نصب برنامه پشتیبانی" : "Install support app"}
              >
                <Download size={18} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={enableNotifications}
              disabled={notificationPermission === "granted"}
              className={`grid h-10 w-10 place-items-center rounded-full text-slate-600 shadow-sm ${
                notificationPermission === "granted"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-white"
              }`}
              aria-label={
                notificationPermission === "granted"
                  ? isFa ? "اعلان‌ها فعال است" : "Notifications enabled"
                  : isFa ? "فعال‌کردن اعلان‌ها" : "Enable notifications"
              }
              title={
                notificationPermission === "granted"
                  ? isFa ? "اعلان‌ها فعال است" : "Notifications enabled"
                  : isFa ? "فعال‌کردن اعلان‌ها" : "Enable notifications"
              }
            >
              {notificationPermission === "granted" ? <BellRing size={18} /> : <Bell size={18} />}
            </button>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[10px] font-black sm:px-3 sm:py-1.5 sm:text-xs ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {live ? <Wifi size={14} /> : <WifiOff size={14} />}
              {live
                ? isFa
                  ? "متصل"
                  : "Live"
                : isFa
                  ? "اتصال دوباره"
                  : "Reconnecting"}
            </span>
            <button
              type="button"
              onClick={refreshWorkspace}
              disabled={refreshing}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm disabled:opacity-60"
              aria-label={isFa ? "تازه‌سازی" : "Refresh"}
              title={isFa ? "تازه‌سازی همه اطلاعات" : "Refresh all workspace data"}
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={logout} className="hidden items-center gap-2 rounded-full bg-red-50 p-2.5 text-sm font-black text-red-700 sm:inline-flex sm:px-3">
              <LogOut size={17} /> <span className="hidden sm:inline">{isFa ? "خروج" : "Logout"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-[1500px] ${mobileDetailOpen ? "h-full min-h-0 p-0 lg:h-auto lg:p-4" : "p-2 pb-24 sm:p-4 lg:pb-4"}`}>
        <nav className="mb-4 hidden flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:flex">
          <WorkspaceTab
            active={activeView === "tickets"}
            icon={Inbox}
            label={isFa ? "صندوق تکت‌ها" : "Ticket inbox"}
            badge={tickets.reduce(
              (sum, ticket) => sum + Number(ticket.unreadForSupport || 0),
              0,
            )}
            onClick={() => changeView("tickets")}
          />
          <WorkspaceTab
            active={activeView === "team"}
            icon={MessagesSquare}
            label={isFa ? "تیم و گفتگو" : "Team & chat"}
            badge={teamUnread}
            onClick={() => changeView("team")}
          />
          <WorkspaceTab
            active={activeView === "guide"}
            icon={BookOpenCheck}
            label={isFa ? "راهنمای کار" : "How it works"}
            onClick={() => changeView("guide")}
          />
        </nav>

        {activeView === "tickets" ? <div className={`mb-2 grid-cols-[minmax(0,1fr)_minmax(0,170px)] gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:mb-4 lg:p-3 ${mobileTicketOpen ? "hidden lg:grid" : "grid"}`}>
          <label className="relative">
            <Search className="absolute start-3 top-3 text-slate-400" size={17} />
            <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder={isFa ? "جستجوی تکت، کاربر یا ایمیل" : "Search ticket, user, or email"} className="w-full rounded-xl border border-slate-200 py-2.5 ps-10 pe-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <FilterSelect value={filters.status} onChange={(status) => setFilters({ ...filters, status })} values={["workspace", ...STATUSES]} allLabel={isFa ? "همه وضعیت‌ها" : "All statuses"} labels={labels} />
        </div> : null}
        {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}

        {activeView === "team" ? (
          <SupportTeamChat
            agent={agent}
            members={team}
            generalUnread={generalUnread}
            presence={presence}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onConversationRead={markConversationReadLocally}
            refreshTeam={loadTeam}
            refreshToken={teamRefreshToken}
            onMobileDetailChange={setMobileTeamChatOpen}
          />
        ) : null}

        {activeView === "guide" ? <SupportTeamGuide /> : null}

        {activeView === "tickets" ? <section className={`grid w-full min-w-0 max-w-full overflow-hidden bg-white shadow-sm lg:h-[clamp(520px,calc(100dvh-10.5rem),720px)] lg:min-h-0 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:rounded-3xl lg:border lg:border-slate-200 ${mobileTicketOpen ? "h-full min-h-0 rounded-none border-0" : "h-[calc(100dvh-14rem)] min-h-[28rem] rounded-2xl border border-slate-200"}`}>
          <aside className={`chat-scrollbar-side edutech-scrollbar h-full min-h-0 overflow-y-auto border-b border-slate-200 lg:block lg:border-b-0 lg:border-e ${mobileTicketOpen ? "hidden" : "block"}`}>
            {loading ? (
              <p className="p-10 text-center font-bold text-slate-400">{isFa ? "در حال بارگذاری…" : "Loading…"}</p>
            ) : tickets.length === 0 ? (
              <p className="p-10 text-center font-bold text-slate-500">{isFa ? "هیچ تکت پشتیبانی یافت نشد." : "No support tickets found."}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <button key={ticket.id} onClick={() => { setChat(null); setTicketActionsOpen(false); setSelectedMessageIds(new Set()); setReplyingTo(null); setRequesterTyping(false); setPageInfo({ hasMore: false, nextBefore: null }); setSelectedId(ticket.id); setMobileTicketOpen(true); }} className={`flex w-full items-center gap-3 p-3 text-start transition sm:p-4 ${selectedId === ticket.id ? "bg-[#f0f2f5]" : "hover:bg-slate-50"}`}>
                    <RequesterAvatar requester={ticket.requester} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <strong className="min-w-0 flex-1 truncate text-sm">{ticket.subject}</strong>
                        <RequesterRoleBadge role={ticket.requesterRole} isFa={isFa} compact />
                        <span className="text-[10px] font-semibold text-slate-400">{formatListTime(ticket.lastMessageAt, isFa)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500">{ticket.requester?.name} · {ticket.lastMessagePreview}</span>
                        {ticket.unreadForSupport > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-white">{ticket.unreadForSupport}</span> : null}
                      </span>
                      <span className="mt-1.5 flex justify-between text-[10px] font-bold"><span className="text-emerald-700">{labels[ticket.status]}</span><span className="text-slate-400">{ticket.ticketNumber}</span></span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div className={`${mobileTicketOpen ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-col overflow-hidden lg:flex`}>
            {!chat ? (
              <div className="grid flex-1 place-items-center text-center text-slate-400">
                <div><MessageCircle className="mx-auto" size={48} /><p className="mt-3 font-bold">{mobileTicketOpen ? (isFa ? "در حال بارگذاری گفتگو…" : "Loading conversation…") : (isFa ? "یک گفتگو را انتخاب کنید" : "Select a conversation")}</p></div>
              </div>
            ) : (
              <>
                <header className="sticky top-0 z-20 bg-[#f0f2f5] p-2.5 shadow-sm sm:p-4">
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" onClick={() => { setTicketActionsOpen(false); setMobileTicketOpen(false); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden" aria-label={isFa ? "بازگشت" : "Back"}>
                        {isFa ? <ChevronRight size={23} /> : <ChevronLeft size={23} />}
                      </button>
                      <RequesterAvatar requester={chat.ticket.requester} size="sm" />
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-black sm:text-base">{chat.ticket.subject}</h2>
                        <p className="mt-0.5 flex min-w-0 items-center gap-x-1 truncate text-[10px] font-semibold text-slate-500 sm:mt-1 sm:text-xs">
                          <span className="max-w-28 truncate sm:max-w-none">{chat.ticket.requester?.name}</span>
                          <RequesterRoleBadge role={chat.ticket.requesterRole} isFa={isFa} />
                          <span aria-hidden="true">·</span>
                          <span className="hidden max-w-40 truncate sm:inline" dir="ltr">{chat.ticket.requester?.email}</span>
                          <span className="hidden sm:inline" aria-hidden="true">·</span>
                          <span className="whitespace-nowrap" dir="ltr">{chat.ticket.ticketNumber}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTicketActionsOpen((current) => !current)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-200"
                      aria-label={isFa ? "مدیریت تکت" : "Ticket actions"}
                      aria-expanded={ticketActionsOpen}
                    >
                      <MoreVertical size={22} />
                    </button>
                    <div className={`${ticketActionsOpen ? "grid" : "hidden"} absolute end-0 top-[calc(100%+0.65rem)] z-30 w-[min(34rem,calc(100vw-1.25rem))] grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:grid-cols-3`}>
                        <button
                          disabled={
                            busy ||
                            (chat.ticket.assignedTo?.id &&
                              chat.ticket.assignedTo.id !==
                                agentId)
                          }
                          onClick={() => {
                            setTicketActionsOpen(false);
                            if (chat.ticket.assignedTo?.id === agentId) {
                              setHandoffOpen(true);
                            } else {
                              updateTicket({ assignedTo: agentId });
                            }
                          }}
                          className="h-10 min-w-0 truncate rounded-xl bg-slate-100 px-3 text-[11px] font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {!chat.ticket.assignedTo?.id
                            ? isFa
                              ? "گرفتن تکت"
                              : "Claim ticket"
                            : chat.ticket.assignedTo.id ===
                                agentId
                              ? isFa
                                ? "رها کردن تکت من"
                                : "Release my ticket"
                              : isFa
                                ? `مسئول: ${chat.ticket.assignedTo.name}`
                                : `Owned by ${chat.ticket.assignedTo.name}`}
                        </button>
                        <div className="flex h-10 min-w-0 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600">
                          <span className="truncate">
                            {chat.ticket.assignedTo?.id
                              ? `${isFa ? "مسئول" : "Owner"}: ${chat.ticket.assignedTo.name}`
                              : isFa ? "بدون مسئول" : "Unassigned"}
                          </span>
                        </div>
                        <TicketSelect value={chat.ticket.status} values={STATUSES} disabled={busy || chat.ticket.assignedTo?.id !== agentId} onChange={(status) => { setTicketActionsOpen(false); updateTicket({ status }); }} labels={labels} ariaLabel={isFa ? "وضعیت" : "Status"} />
                        <button
                          type="button"
                          onClick={() => {
                            setTicketActionsOpen(false);
                            deleteCompletedTicket();
                          }}
                          disabled={
                            busy ||
                            chat.ticket.assignedTo?.id !== agentId ||
                            !["resolved", "closed"].includes(chat.ticket.status)
                          }
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-[11px] font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            isFa
                              ? "پس از حل یا بستن تکت قابل حذف است"
                              : "Available after resolving or closing the ticket"
                          }
                        >
                          <Trash2 size={15} />
                          <span>{isFa ? "حذف گفتگو" : "Delete chat"}</span>
                        </button>
                  </div>
                  </div>
                </header>
                {selectedMessageIds.size ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                    <button type="button" onClick={() => setSelectedMessageIds(new Set())} className="rounded-full p-2 hover:bg-slate-100"><Circle size={18} /></button>
                    <strong className="me-auto text-sm">{selectedMessageIds.size} {isFa ? "پیام انتخاب شد" : "selected"}</strong>
                    <button type="button" onClick={() => setSelectedMessageIds(new Set(chat.messages.map((message) => message.id)))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{isFa ? "انتخاب همه" : "Select all"}</button>
                    <button type="button" disabled={busy} onClick={() => deleteSelectedMessages("me")} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{isFa ? "حذف برای من" : "Delete for me"}</button>
                    {chat.messages.filter((message) => selectedMessageIds.has(message.id)).every((message) => message.sender?.id === agentId && !message.deletedForEveryone) ? (
                      <button type="button" disabled={busy} onClick={() => deleteSelectedMessages("everyone")} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white">{isFa ? "حذف برای همه" : "Delete for everyone"}</button>
                    ) : null}
                  </div>
                ) : null}
                <div ref={messagesRef} className="chat-scrollbar-side edutech-scrollbar flex-1 space-y-1.5 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.32)_0,rgba(255,255,255,0.32)_1px,transparent_1px)] bg-[length:18px_18px] p-2.5 sm:p-5">
                  {pageInfo.hasMore ? <div className="flex justify-center"><button type="button" disabled={loadingOlder} onClick={loadEarlierMessages} className="rounded-full bg-white px-4 py-2 text-xs font-black text-emerald-700 shadow-sm disabled:opacity-50">{loadingOlder ? (isFa ? "در حال بارگذاری…" : "Loading…") : (isFa ? "نمایش پیام‌های قبلی" : "Load earlier messages")}</button></div> : null}
                  {chat.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isFa={isFa}
                      own={message.sender?.id === agentId}
                      busy={busy}
                      onEdit={() => editTicketMessage(message)}
                      selected={selectedMessageIds.has(message.id)}
                      onSelect={() => toggleMessageSelection(message.id)}
                      onReply={() => setReplyingTo(message)}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
                <form onSubmit={send} className="bg-[#f0f2f5] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
                  {replyingTo ? <TicketReplyPreview message={replyingTo} isFa={isFa} onClose={() => setReplyingTo(null)} /> : null}
                  {requesterTyping ? <div className="mb-1 px-3 text-[11px] font-bold text-emerald-700">{isFa ? "کاربر در حال نوشتن است…" : "User is typing…"}</div> : null}
                  {chat.ticket.assignedTo?.id !== agentId ? (
                    <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      {chat.ticket.assignedTo?.id
                        ? isFa ? "این تکت توسط عضو دیگری مدیریت می‌شود." : "Another team member owns this ticket."
                        : isFa ? "برای پاسخ دادن، ابتدا تکت را بگیرید." : "Claim this ticket before replying."}
                    </p>
                  ) : null}
                  <div className="mb-2 flex gap-2">
                    <ModeButton disabled={chat.ticket.assignedTo?.id !== agentId} active={!internalNote} onClick={() => setInternalNote(false)}>{isFa ? "پاسخ" : "Reply"}</ModeButton>
                    <ModeButton disabled={chat.ticket.assignedTo?.id !== agentId} active={internalNote} note onClick={() => setInternalNote(true)}>{isFa ? "یادداشت داخلی" : "Internal note"}</ModeButton>
                  </div>
                  <div className="flex gap-2">
                    <textarea ref={composerRef} disabled={chat.ticket.assignedTo?.id !== agentId} value={draft} onChange={(event) => { setDraft(event.target.value); if (!internalNote) notifyTicketTyping(Boolean(event.target.value.trim())); }} maxLength={4000} rows={1} placeholder={internalNote ? (isFa ? "یادداشت خصوصی که فقط تیم پشتیبانی می‌بیند" : "Private note visible only to support staff") : (isFa ? "پاسخ خود را برای کاربر بنویسید" : "Write a reply to the user")} className={`min-h-11 max-h-28 flex-1 resize-none rounded-3xl border-0 px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 ${internalNote ? "bg-amber-50" : "bg-white"}`} />
                    <button onPointerDown={(event) => event.preventDefault()} onClick={() => composerRef.current?.focus({ preventScroll: true })} disabled={busy || !draft.trim() || chat.ticket.assignedTo?.id !== agentId} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-sm disabled:opacity-40 ${internalNote ? "bg-amber-600" : "bg-[#00a884]"}`}><Send size={19} /></button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section> : null}
      </main>
      {handoffOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handoffTicket} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black">{isFa ? "انتقال تکت" : "Hand off ticket"}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {isFa ? "دلیل انتقال را بنویسید تا عضو بعدی بداند چه کاری باقی مانده است." : "Explain why you are releasing it so the next agent knows what remains."}
            </p>
            <textarea autoFocus value={handoffReason} onChange={(event) => setHandoffReason(event.target.value)} rows={4} minLength={5} maxLength={500} required className="mt-4 w-full resize-none rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" placeholder={isFa ? "مثال: نیاز به بررسی تخنیکی دارد…" : "Example: Needs technical investigation…"} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setHandoffOpen(false); setHandoffReason(""); }} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">{isFa ? "لغو" : "Cancel"}</button>
              <button disabled={busy || handoffReason.trim().length < 5} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{isFa ? "انتقال به صف" : "Return to queue"}</button>
            </div>
          </form>
        </div>
      ) : null}
      {!mobileDetailOpen ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <MobileNavButton active={activeView === "tickets"} icon={Inbox} label={isFa ? "تکت‌ها" : "Tickets"} badge={tickets.reduce((sum, ticket) => sum + Number(ticket.unreadForSupport || 0), 0)} onClick={() => changeView("tickets")} />
          <MobileNavButton active={activeView === "team"} icon={MessagesSquare} label={isFa ? "تیم" : "Team"} badge={teamUnread} onClick={() => changeView("team")} />
          <MobileNavButton active={activeView === "guide"} icon={BookOpenCheck} label={isFa ? "راهنما" : "Guide"} onClick={() => changeView("guide")} />
        </nav>
      ) : null}
    </div>
  );
}

function WorkspaceTab({ active, icon: Icon, label, badge = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
        active
          ? "bg-[#00a884] text-white shadow-md"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon size={17} />
      {label}
      {badge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${
            active ? "bg-white text-blue-700" : "bg-red-500 text-white"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function MobileNavButton({
  active,
  icon: Icon,
  label,
  badge = 0,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-black ${
        active ? "text-emerald-700" : "text-slate-500"
      }`}
    >
      <span className="relative">
        <Icon size={21} strokeWidth={active ? 2.6 : 2} />
        {badge > 0 ? (
          <span className="absolute -end-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  );
}

function FilterSelect({ value, onChange, values, allLabel, labels }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="all">{allLabel}</option>{values.map((entry) => <option key={entry} value={entry}>{labels[entry]}</option>)}</select>;
}

function TicketSelect({
  value,
  onChange,
  values,
  disabled,
  labels,
  ariaLabel,
}) {
  return <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-black">{values.map((entry) => <option key={entry} value={entry}>{ariaLabel}: {labels[entry]}</option>)}</select>;
}

function ModeButton({ active, note = false, disabled = false, onClick, children }) {
  const activeClass = note ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700";
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${active ? activeClass : "bg-slate-100 text-slate-500"}`}>{children}</button>;
}

function MessageBubble({ message, isFa, own, busy, onEdit, selected, onSelect, onReply }) {
  const fromTeam = ["admin", "support"].includes(message.senderRole);
  const senderLabel =
    message.senderRole === "admin"
      ? isFa
        ? "ادمین"
        : "Admin"
      : message.senderRole === "teacher"
        ? `${message.sender?.name || (isFa ? "مدرس" : "Teacher")} · ${isFa ? "مدرس" : "Teacher"}`
      : message.sender?.name;
  return (
    <div className={`flex items-center gap-1 ${fromTeam ? "justify-end" : "justify-start"} ${selected ? "rounded-xl bg-emerald-100/70" : ""}`}>
      <button type="button" onClick={onSelect} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? "text-emerald-600" : "text-slate-400"}`} aria-label={isFa ? "انتخاب پیام" : "Select message"}>{selected ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
      <div className={`relative max-w-[86%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[72%] ${message.internalNote ? "border border-amber-300 bg-amber-50" : fromTeam ? "bg-[#d9fdd3] text-slate-900" : "bg-white text-slate-900"}`}>
        {message.internalNote ? <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase"><StickyNote size={12} /> {isFa ? "یادداشت داخلی" : "Internal note"}</p> : null}
        <p className="mb-0.5 text-[10px] font-black text-[#00a884]">{senderLabel}</p>
        {message.replyTo ? <TicketReplyQuote message={message.replyTo} isFa={isFa} /> : null}
        {message.deletedForEveryone ? <p className="text-sm italic text-slate-500">{isFa ? "این پیام حذف شده است." : "This message was deleted."}</p> : <p className="whitespace-pre-wrap text-[13px] font-medium leading-5 sm:text-sm">{message.body}</p>}
        <p className="mt-1 text-end text-[9px] font-semibold text-slate-500">{message.editedAt ? (isFa ? "ویرایش‌شده · " : "edited · ") : ""}{new Date(message.createdAt).toLocaleTimeString(isFa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</p>
        {own ? <span className="absolute bottom-1 end-2"><CheckCheck size={14} className={message.deliveryStatus === "read" ? "text-sky-500" : "text-slate-400"} /></span> : null}
        {!message.deletedForEveryone ? <div className="mt-1 flex justify-end gap-1"><button type="button" disabled={busy} onClick={onReply} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "پاسخ" : "Reply"}><Reply size={12} /></button>{own ? <button type="button" disabled={busy} onClick={onEdit} className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5" aria-label={isFa ? "ویرایش" : "Edit"}><Pencil size={12} /></button> : null}</div> : null}
      </div>
    </div>
  );
}

function TicketReplyQuote({ message, isFa }) {
  return <div className="mb-1.5 rounded-lg border-s-4 border-emerald-500 bg-black/5 px-2 py-1.5"><p className="truncate text-[10px] font-black text-emerald-700">{message.senderRole === "admin" ? (isFa ? "ادمین" : "Admin") : message.sender?.name || (isFa ? "پیام" : "Message")}</p><p className="line-clamp-2 text-[11px] text-slate-600">{message.deletedForEveryone ? (isFa ? "این پیام حذف شده است." : "This message was deleted.") : message.body}</p></div>;
}

function TicketReplyPreview({ message, isFa, onClose }) {
  return <div className="mb-2 flex items-center gap-2 rounded-xl border-s-4 border-emerald-500 bg-white px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black text-emerald-700">{message.sender?.name || (isFa ? "پیام" : "Message")}</p><p className="truncate text-xs text-slate-600">{message.body}</p></div><button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100">×</button></div>;
}

function RequesterRoleBadge({ role, isFa, compact = false }) {
  if (role !== "teacher") return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 font-black text-amber-800 ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
      title={isFa ? "مدرس پلتفرم" : "Platform teacher"}
    >
      <GraduationCap size={compact ? 10 : 11} />
      {isFa ? "مدرس" : "Teacher"}
    </span>
  );
}

function RequesterAvatar({ requester, size = "lg" }) {
  const avatar = resolveAvatarUrl(requester?.avatar || "");
  const sizeClass = size === "sm" ? "h-10 w-10" : "h-12 w-12";

  return (
    <span
      className={`relative grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-500`}
      aria-label={requester?.name || "User"}
    >
      <UserRound size={size === "sm" ? 19 : 22} />
      {avatar ? (
        <img
          src={avatar}
          alt={requester?.name || ""}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function formatListTime(value, isFa) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString(isFa ? "fa-IR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString(isFa ? "fa-IR" : "en-US", {
        month: "short",
        day: "numeric",
      });
}
