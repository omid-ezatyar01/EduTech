import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCheck,
  Clock3,
  Inbox,
  Mail,
  MailOpen,
  Search,
  Send,
} from "lucide-react";
import { getToken } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";

const DIRECT_EMAIL_DRAFT_KEY = "edutech_admin_message_draft";

const STATUS_OPTIONS = ["all", "new", "pending", "replied", "resolved"];
const TEACHER_INTERVIEW_TEMPLATE = {
  recipientRole: "teacher",
  subject: "EduTech Teacher Interview Invitation",
};

const DEFAULT_DIRECT_EMAIL_FORM = {
  recipientRole: "student",
  recipientEmail: "",
  subject: "",
  message: "",
};

const DEFAULT_INTERVIEW_SCHEDULE = {
  date: "",
  time: "",
};

const getStoredDirectEmailDraft = () => {
  try {
    const raw = sessionStorage.getItem(DIRECT_EMAIL_DRAFT_KEY);
    if (!raw) {
      return {
        form: DEFAULT_DIRECT_EMAIL_FORM,
        schedule: DEFAULT_INTERVIEW_SCHEDULE,
        recipientSearch: "",
      };
    }

    const parsed = JSON.parse(raw);
    return {
      form: {
        ...DEFAULT_DIRECT_EMAIL_FORM,
        ...(parsed?.form || {}),
      },
      schedule: {
        ...DEFAULT_INTERVIEW_SCHEDULE,
        ...(parsed?.schedule || {}),
      },
      recipientSearch: parsed?.recipientSearch || parsed?.form?.recipientEmail || "",
    };
  } catch {
    return {
      form: DEFAULT_DIRECT_EMAIL_FORM,
      schedule: DEFAULT_INTERVIEW_SCHEDULE,
      recipientSearch: "",
    };
  }
};

const formatInterviewDateValue = (value) => {
  if (!value) return "[Write date here]";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "[Write date here]";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatInterviewTimeValue = (value) => {
  if (!value) return "[Write time here]";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  if (Number.isNaN(date.getTime())) return "[Write time here]";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildTeacherInterviewMessage = ({ date = "", time = "" } = {}) => `Dear Teacher,

Thank you for your interest in joining EduTech as an instructor.

After reviewing your application, we are pleased to invite you to an online interview with our team. The interview will be conducted through Google Meet and will help us learn more about your teaching experience, subject expertise, availability, and how your skills can contribute to the EduTech learning community.

Interview Details:

Date: ${formatInterviewDateValue(date)}
Time: ${formatInterviewTimeValue(time)}
Google Meet Link: [Paste Google Meet link here]

Please join the meeting on time and ensure that your internet connection, microphone, and camera are working properly before the interview begins. If you are unable to attend at the scheduled time, please let us know in advance so we can arrange a suitable alternative.

We look forward to speaking with you and learning more about your teaching approach.

Best regards,
EduTech Team`;

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["new", "pending", "replied", "resolved"].includes(value)) return value;
  if (value === "awaiting response") return "pending";
  if (value === "unread") return "new";
  return "pending";
};

const getStatusMeta = (status) => {
  const map = {
    new: {
      label: "New",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    pending: {
      label: "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    replied: {
      label: "Replied",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    resolved: {
      label: "Resolved",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    },
  };

  return map[status] || map.pending;
};

const formatDate = (value, language) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "-";
  }
};

const normalizeMessage = (item, index) => ({
  id: String(item?._id || item?.id || `msg-${index + 1}`),
  name: item?.name || item?.fullName || item?.user?.name || "Unknown User",
  email: item?.email || item?.contact || item?.user?.email || "-",
  subject: item?.subject || "No subject",
  body: item?.message || item?.body || item?.text || "No message content.",
  status: normalizeStatus(item?.status),
  createdAt: item?.createdAt || item?.date || new Date().toISOString(),
  adminReply: item?.adminReply || "",
});

export default function AdminMessagesPage() {
  const { t, language } = useAdminI18n();
  const token = useMemo(() => getToken(), []);
  const storedDirectEmailDraft = useMemo(() => getStoredDirectEmailDraft(), []);

  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [directEmailForm, setDirectEmailForm] = useState(storedDirectEmailDraft.form);
  const [interviewSchedule, setInterviewSchedule] = useState(storedDirectEmailDraft.schedule);
  const [recipientSearch, setRecipientSearch] = useState(storedDirectEmailDraft.recipientSearch);
  const debouncedRecipientSearch = useDebouncedValue(recipientSearch.trim(), 250);
  const [recipientResults, setRecipientResults] = useState([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [directEmailSending, setDirectEmailSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recipientSearchRequest = useLatestRequest();
  const messagesRequest = useLatestRequest();

  useEffect(() => {
    sessionStorage.setItem(
      DIRECT_EMAIL_DRAFT_KEY,
      JSON.stringify({
        form: directEmailForm,
        schedule: interviewSchedule,
        recipientSearch,
      }),
    );
  }, [directEmailForm, interviewSchedule, recipientSearch]);

  useEffect(() => {
    const searchValue = debouncedRecipientSearch;
    if (!token || searchValue.length < 2) {
      const timer = setTimeout(() => {
        setRecipientResults([]);
        setRecipientSearchLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const run = async () => {
      setRecipientSearchLoading(true);

      await recipientSearchRequest.runLatest(async () => {
        const queryParams = new URLSearchParams({
          page: "1",
          limit: "8",
          search: searchValue,
        });

        const endpoint =
          directEmailForm.recipientRole === "teacher"
            ? "/admin/teachers"
            : "/admin/students";

        const response = await fetch(`${getApiBase()}${endpoint}?${queryParams.toString()}`, {
          headers: buildAuthHeaders(),
        });
        const payload = await parseJsonResponse(response);
        const rows =
          directEmailForm.recipientRole === "teacher"
            ? payload?.teachers || []
            : payload?.students || [];

        return rows;
      }, {
        onSuccess: (rows) => {
          setRecipientResults(
            rows
              .map((row) => ({
                id: row?._id || row?.id || row?.email,
                name: row?.name || "-",
                email: row?.email || "",
                phone: row?.phone || "",
                status: row?.status || "",
              }))
              .filter((row) => row.email),
          );
        },
        onError: () => {
          setRecipientResults([]);
        },
        onFinally: () => {
          setRecipientSearchLoading(false);
        },
      });
    };

    run();
    return () => {
    };
  }, [debouncedRecipientSearch, directEmailForm.recipientRole, recipientSearchRequest, token]);

  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => {
        setMessages([]);
        setSelectedId("");
        setError("Authentication token not found. Please sign in again.");
      }, 0);
      return () => clearTimeout(timer);
    }

    const run = async () => {
      setLoading(true);
      setError("");
      setNotice("");

      await messagesRequest.runLatest(async () => {
        const response = await fetch(`${getApiBase()}/admin/messages`, {
          headers: buildAuthHeaders(),
        });
        const payload = await parseJsonResponse(response);
        const rows = payload?.data?.messages || payload?.messages || [];
        return rows.map(normalizeMessage);
      }, {
        onSuccess: (normalized) => {
          if (normalized.length === 0) {
            setMessages([]);
            setSelectedId("");
            return;
          }

          setMessages(normalized);
          setSelectedId(normalized[0].id);
        },
        onError: (err) => {
          setMessages([]);
          setSelectedId("");
          setError(err?.message || "Failed to load messages.");
        },
        onFinally: () => {
          setLoading(false);
        },
      });
    };

    run();

  }, [messagesRequest, token]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const matchesStatus = statusFilter === "all" || message.status === statusFilter;
      if (!matchesStatus) return false;

      const haystack = `${message.name} ${message.email} ${message.subject} ${message.body}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [messages, query, statusFilter]);

  const selectedMessage = useMemo(() => {
    if (!filteredMessages.length) return null;
    return filteredMessages.find((item) => item.id === selectedId) || filteredMessages[0];
  }, [filteredMessages, selectedId]);

  const summary = useMemo(() => {
    const total = messages.length;
    const newCount = messages.filter((m) => m.status === "new").length;
    const pendingCount = messages.filter((m) => m.status === "pending").length;
    const repliedCount = messages.filter((m) => m.status === "replied").length;
    const unresolved = newCount + pendingCount;

    return { total, newCount, pendingCount, repliedCount, unresolved };
  }, [messages]);

  useEffect(() => {
    if (selectedMessage?.id && selectedId !== selectedMessage.id) {
      const timer = setTimeout(() => {
        setSelectedId(selectedMessage.id);
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedMessage, selectedId]);

  const updateSelectedStatus = async (nextStatus) => {
    if (!selectedMessage) return;

    const normalizedStatus = normalizeStatus(nextStatus);
    const previousMessages = messages;

    setMessages((prev) =>
      prev.map((item) =>
        item.id === selectedMessage.id
          ? {
              ...item,
              status: normalizedStatus,
            }
          : item,
      ),
    );

    if (!token) return;

    try {
      const response = await fetch(
        `${getApiBase()}/admin/messages/${encodeURIComponent(selectedMessage.id)}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: normalizedStatus }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Failed to update message status");
      }
    } catch (err) {
      setMessages(previousMessages);
      setError(err?.message || "Failed to update message status");
    }
  };

  const handleSendReply = async () => {
    const message = replyDraft.trim();
    if (!message || !selectedMessage) return;

    if (!token) {
      setError("Please sign in as admin to send email from EduTech.");
      return;
    }

    setReplySending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${getApiBase()}/admin/messages/${encodeURIComponent(selectedMessage.id)}/reply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject: `Re: ${selectedMessage.subject}`,
            message,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Failed to send reply");
      }

      const updatedMessage = normalizeMessage(payload?.data || {}, 0);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === selectedMessage.id
            ? {
                ...item,
                ...updatedMessage,
                id: selectedMessage.id,
              }
            : item,
        ),
      );
      setReplyDraft("");
      setNotice("Reply sent from the EduTech email.");
    } catch (err) {
      setError(err?.message || "Failed to send reply");
    } finally {
      setReplySending(false);
    }
  };

  const handleSendDirectEmail = async (event) => {
    event.preventDefault();

    const payload = {
      recipientRole: directEmailForm.recipientRole,
      recipientEmail: directEmailForm.recipientEmail.trim().toLowerCase(),
      subject: directEmailForm.subject.trim(),
      message: directEmailForm.message.trim(),
    };

    if (!payload.recipientEmail || !payload.subject || !payload.message) {
      setError("Recipient email, subject, and message are required.");
      return;
    }

    if (!token) {
      setError("Please sign in as admin to send email from EduTech.");
      return;
    }

    setDirectEmailSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${getApiBase()}/admin/messages/email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok || responsePayload?.success === false) {
        throw new Error(responsePayload?.message || "Failed to send email");
      }

      setDirectEmailForm(DEFAULT_DIRECT_EMAIL_FORM);
      setInterviewSchedule(DEFAULT_INTERVIEW_SCHEDULE);
      setRecipientSearch("");
      setRecipientResults([]);
      sessionStorage.removeItem(DIRECT_EMAIL_DRAFT_KEY);
      setNotice("Email sent from the EduTech email.");
    } catch (err) {
      setError(err?.message || "Failed to send email");
    } finally {
      setDirectEmailSending(false);
    }
  };

  const isInterviewTemplateDraft = (form) =>
    form.recipientRole === TEACHER_INTERVIEW_TEMPLATE.recipientRole &&
    form.subject === TEACHER_INTERVIEW_TEMPLATE.subject &&
    (form.message.includes("Interview Details:") || !form.message.trim());

  const handleInterviewScheduleChange = (field, value) => {
    const nextSchedule = {
      ...interviewSchedule,
      [field]: value,
    };

    setInterviewSchedule(nextSchedule);
    setDirectEmailForm((prev) =>
      isInterviewTemplateDraft(prev)
        ? {
            ...prev,
            recipientRole: TEACHER_INTERVIEW_TEMPLATE.recipientRole,
            subject: TEACHER_INTERVIEW_TEMPLATE.subject,
            message: buildTeacherInterviewMessage(nextSchedule),
          }
        : prev,
    );
  };

  const applyTeacherInterviewTemplate = () => {
    setDirectEmailForm((prev) => ({
      ...prev,
      recipientRole: TEACHER_INTERVIEW_TEMPLATE.recipientRole,
      subject: TEACHER_INTERVIEW_TEMPLATE.subject,
      message: buildTeacherInterviewMessage(interviewSchedule),
    }));
    setError("");
    setNotice("Teacher interview template added. Fill the Google Meet link before sending.");
  };

  const selectRecipient = (recipient) => {
    setDirectEmailForm((prev) => ({
      ...prev,
      recipientEmail: recipient.email,
    }));
    setRecipientSearch(recipient.email);
    setRecipientResults([]);
    setNotice(`Selected ${recipient.name} (${recipient.email}).`);
  };

  const stats = [
    {
      id: "total",
      title: "Total Messages",
      value: summary.total,
      icon: Inbox,
    },
    {
      id: "new",
      title: "New",
      value: summary.newCount,
      icon: Mail,
    },
    {
      id: "pending",
      title: "Pending",
      value: summary.pendingCount,
      icon: Clock3,
    },
    {
      id: "replied",
      title: "Replied",
      value: summary.repliedCount,
      icon: CheckCheck,
    },
  ];

  return (
    <section className="space-y-6 text-left" dir="ltr">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">{t("pages.messages.title")}</h1>
          <p className="mt-1 text-sm font-normal text-slate-500">
            {t("pages.messages.subtitle")}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
          <AlertCircle size={16} />
          {summary.unresolved} unresolved
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <stat.icon size={18} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">{stat.title}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-800">{stat.value}</p>
          </article>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700">
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={handleSendDirectEmail}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">Send EduTech Email</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Sends from the same EduTech email used for OTP codes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyTeacherInterviewTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100"
            >
              <Mail size={14} />
              Interview Invite
            </button>
            <button
              type="submit"
              disabled={directEmailSending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
              {directEmailSending ? "Sending" : "Send Email"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[170px_1fr_1fr]">
          <select
            value={directEmailForm.recipientRole}
            onChange={(event) => {
              setDirectEmailForm((prev) => ({
                ...prev,
                recipientRole: event.target.value,
                recipientEmail: "",
              }));
              setRecipientSearch("");
              setRecipientResults([]);
            }}
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-[22px] -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={recipientSearch}
              onChange={(event) => {
                const value = event.target.value;
                setRecipientSearch(value);
                setDirectEmailForm((prev) => ({ ...prev, recipientEmail: value.trim() }));
              }}
              placeholder={`Search ${directEmailForm.recipientRole} by name or email`}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
            />
            {recipientSearch.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-12 z-20 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                {recipientSearchLoading ? (
                  <div className="px-3 py-2 text-xs font-bold text-slate-500">Searching...</div>
                ) : recipientResults.length ? (
                  recipientResults.map((recipient) => (
                    <button
                      type="button"
                      key={recipient.id}
                      onClick={() => selectRecipient(recipient)}
                      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-primary-50"
                    >
                      <span className="block text-sm font-extrabold text-slate-800">{recipient.name}</span>
                      <span className="block text-xs font-medium text-slate-500">
                        {recipient.email}
                        {recipient.phone ? ` - ${recipient.phone}` : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs font-bold text-slate-500">No matching recipient found.</div>
                )}
              </div>
            ) : null}
          </div>
          <input
            value={directEmailForm.subject}
            onChange={(event) =>
              setDirectEmailForm((prev) => ({ ...prev, subject: event.target.value }))
            }
            placeholder="Email subject"
            className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Interview date</span>
            <span className="relative block">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={interviewSchedule.date}
                onChange={(event) => handleInterviewScheduleChange("date", event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-500 focus:bg-white"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Interview time</span>
            <span className="relative block">
              <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="time"
                value={interviewSchedule.time}
                onChange={(event) => handleInterviewScheduleChange("time", event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-500 focus:bg-white"
              />
            </span>
          </label>
        </div>
        <textarea
          value={directEmailForm.message}
          onChange={(event) =>
            setDirectEmailForm((prev) => ({ ...prev, message: event.target.value }))
          }
          placeholder="Write the email message..."
          className="mt-3 h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-500 focus:bg-white"
        />
      </form>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <label className="relative block">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, subject"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-primary-500 focus:bg-white"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "all"
                      ? "All statuses"
                      : getStatusMeta(status).label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="max-h-[620px] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm font-medium text-slate-500">در حال بارگذاری پیام‌ها</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-6 text-center text-sm font-medium text-slate-500">
                No messages found.
              </div>
            ) : (
              filteredMessages.map((message) => {
                const isActive = selectedMessage?.id === message.id;
                const status = getStatusMeta(message.status);

                return (
                  <button
                    key={message.id}
                    onClick={() => setSelectedId(message.id)}
                    className={`w-full border-b border-slate-100 p-4 text-left transition ${
                      isActive ? "bg-primary-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-extrabold text-slate-800">{message.subject}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">
                      {message.name} - {message.email}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">{message.body}</p>
                    <p className="mt-2 text-[11px] font-medium text-slate-400">
                      {formatDate(message.createdAt, language)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <article className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedMessage ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <MailOpen size={40} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">Select a message to view details.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800">{selectedMessage.subject}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      From {selectedMessage.name} ({selectedMessage.email})
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {formatDate(selectedMessage.createdAt, language)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSelectedStatus("pending")}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
                    >
                      Mark Pending
                    </button>
                    <button
                      onClick={() => updateSelectedStatus("resolved")}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-auto p-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedMessage.body}</p>
                </div>
                {selectedMessage.adminReply ? (
                  <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-700">EduTech reply</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selectedMessage.adminReply}
                    </p>
                  </div>
                ) : null}
              </div>

              <footer className="space-y-3 border-t border-slate-100 p-5">
                <label className="block text-sm font-bold text-slate-700">Reply</label>
                <textarea
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Write your reply to this student..."
                  className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-primary-500 focus:bg-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                    <Mail size={14} />
                    Sent through EduTech email
                  </div>
                  <button
                    onClick={handleSendReply}
                    disabled={!replyDraft.trim() || replySending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={14} />
                    {replySending ? "Sending" : "Send Reply"}
                  </button>
                </div>
              </footer>
            </>
          )}
        </article>
      </div>

      <p className="text-xs font-medium text-slate-400">
        Messages are collected from the public contact form and shown here for admin follow-up.
      </p>
    </section>
  );
}
