import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCheck,
  Clock3,
  X,
  Inbox,
  Mail,
  MailOpen,
  MessageSquare,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { getToken } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useLatestRequest from "../hooks/useLatestRequest.js";
import AdminPageLoader from "../components/common/AdminPageLoader.jsx";

const DIRECT_EMAIL_DRAFT_KEY = "edutech_admin_message_draft";

const PAGE_TEXT = {
  "Communication workspace": "فضای کاری ارتباطات",
  "Manage direct teacher conversations, keep follow-ups moving, and send direct emails to teachers or students from one workspace.":
    "گفتگوهای مستقیم با مدرسان را مدیریت کنید، پیگیری‌ها را پیش ببرید و ایمیل‌های مستقیم را به مدرسان یا شاگردان از یک فضای کاری واحد ارسال کنید.",
  "Needs attention": "نیازمند رسیدگی",
  "Teacher conversations with unread replies waiting for admin follow-up":
    "گفتگوهای مدرسان با پاسخ‌های خوانده‌نشده که منتظر پیگیری ادمین هستند",
  "Teacher Conversations": "گفتگوهای مدرسان",
  "Unread Conversations": "گفتگوهای خوانده‌نشده",
  "Unread Messages": "پیام‌های خوانده‌نشده",
  "Admin Messages Sent": "پیام‌های ارسال‌شده توسط ادمین",
  "Open teacher threads in the admin inbox": "تعداد گفتگوهای باز مدرسان در صندوق ادمین",
  "Threads that still need an admin review": "گفتگوهایی که هنوز نیازمند بررسی ادمین هستند",
  "Messages from teachers that have not been opened yet": "پیام‌های مدرسان که هنوز باز نشده‌اند",
  "Total direct messages sent by admins to teachers": "مجموع پیام‌های مستقیم ارسال‌شده از طرف ادمین به مدرسان",
  "Direct email composer": "ایجادکننده ایمیل مستقیم",
  "Sends from the same EduTech email used for OTP codes.": "از همان ایمیل EduTech که برای کدهای OTP استفاده می‌شود ارسال می‌گردد.",
  "Open Email Composer": "باز کردن ایجادکننده ایمیل",
  "Email tools stay available here whenever you need to send a direct email or interview invitation.":
    "ابزارهای ایمیل همیشه از اینجا در دسترس هستند تا هر زمان لازم بود ایمیل مستقیم یا دعوت‌نامه مصاحبه ارسال کنید.",
  "Interview Invite": "دعوت مصاحبه",
  Sending: "در حال ارسال",
  "Send Email": "ارسال ایمیل",
  Student: "شاگرد",
  Teacher: "مدرس",
  "Search teacher by name or email": "جستجوی مدرس با نام یا ایمیل",
  "Search student by name or email": "جستجوی شاگرد با نام یا ایمیل",
  "Searching...": "در حال جستجو...",
  "No matching recipient found.": "گیرنده مطابقی پیدا نشد.",
  "Email subject": "موضوع ایمیل",
  "Interview date": "تاریخ مصاحبه",
  "Interview time": "زمان مصاحبه",
  "Write the email message...": "متن ایمیل را بنویسید...",
  "Teacher inbox": "صندوق پیام مدرسان",
  "Search by teacher name, email, or recent message and open any direct conversation from one place.":
    "با نام مدرس، ایمیل یا آخرین پیام جستجو کنید و هر گفتگوی مستقیم را از یکجا باز کنید.",
  "Search teacher or message": "جستجوی مدرس یا پیام",
  "Only unread conversations": "فقط گفتگوهای خوانده‌نشده",
  "Loading conversations": "در حال بارگذاری گفتگوها",
  "No teacher conversations found.": "هیچ گفتگویی با مدرس پیدا نشد.",
  "Try changing the search text or unread filter.": "متن جستجو یا فیلتر خوانده‌نشده را تغییر دهید.",
  "Select a teacher conversation to view details.": "برای دیدن جزئیات، گفتگوی یک مدرس را انتخاب کنید.",
  "The selected teacher thread will open here with full message history and a reply box.":
    "گفتگوی انتخاب‌شده اینجا با تاریخچه کامل پیام‌ها و بخش پاسخ باز می‌شود.",
  "Admin thread": "گفتگوی ادمین",
  "Direct conversation with this teacher": "گفتگوی مستقیم با این مدرس",
  "Unread replies": "پاسخ‌های خوانده‌نشده",
  "No messages in this conversation yet.": "هنوز پیامی در این گفتگو وجود ندارد.",
  "Send the first message to start the conversation.": "برای شروع گفتگو اولین پیام را ارسال کنید.",
  "Write your message to this teacher...": "پیام خود به این مدرس را بنویسید...",
  "Send Message": "ارسال پیام",
  "Sent through EduTech inbox": "ارسال از طریق صندوق EduTech",
  "Approved teacher": "مدرس تاییدشده",
  "Pending teacher": "مدرس در انتظار تایید",
  "Blocked teacher": "مدرس مسدودشده",
  "Teacher direct message sent successfully.": "پیام مستقیم به مدرس با موفقیت ارسال شد.",
  "Recipient email, subject, and message are required.":
    "ایمیل گیرنده، موضوع و متن پیام الزامی است.",
  "Please sign in as admin to send email from EduTech.":
    "برای ارسال ایمیل از EduTech لطفا به‌عنوان ادمین وارد شوید.",
  "Please sign in as admin to message teachers.":
    "برای پیام‌رسانی به مدرسان لطفا به‌عنوان ادمین وارد شوید.",
  "Authentication token not found. Please sign in again.":
    "توکن احراز هویت پیدا نشد. لطفا دوباره وارد شوید.",
  "Failed to load teacher conversations.": "بارگذاری گفتگوهای مدرسان ناموفق بود.",
  "Failed to load conversation messages.": "بارگذاری پیام‌های گفتگو ناموفق بود.",
  "Failed to send teacher message.": "ارسال پیام به مدرس ناموفق بود.",
  "Failed to send email": "ارسال ایمیل ناموفق بود",
  "Email sent from the EduTech email.": "ایمیل از طریق ایمیل EduTech ارسال شد.",
  "Teacher interview template added. Fill the Google Meet link before sending.":
    "قالب مصاحبه مدرس اضافه شد. پیش از ارسال، لینک Google Meet را تکمیل کنید.",
  "Selected recipient": "گیرنده انتخاب شد",
  "EduTech Teacher Interview Invitation": "دعوت‌نامه مصاحبه مدرس EduTech",
  "Write date here": "تاریخ را اینجا بنویسید",
  "Write time here": "زمان را اینجا بنویسید",
  "Dear Teacher,": "مدرس گرامی،",
  "Thank you for your interest in joining EduTech as an instructor.":
    "از علاقه‌مندی شما برای پیوستن به EduTech به‌عنوان مدرس سپاسگزاریم.",
  "After reviewing your application, we are pleased to invite you to an online interview with our team. The interview will be conducted through Google Meet and will help us learn more about your teaching experience, subject expertise, availability, and how your skills can contribute to the EduTech learning community.":
    "پس از بررسی درخواست شما، خوشحالیم که شما را به یک مصاحبه آنلاین با تیم خود دعوت می‌کنیم. این مصاحبه از طریق Google Meet برگزار می‌شود و به ما کمک می‌کند درباره تجربه تدریس، تخصص آموزشی، زمان دسترس‌پذیری و نحوه کمک مهارت‌های شما به جامعه آموزشی EduTech بیشتر بدانیم.",
  "Interview Details:": "جزئیات مصاحبه:",
  "Date:": "تاریخ:",
  "Time:": "زمان:",
  "Google Meet Link: [Paste Google Meet link here]": "لینک Google Meet: [لینک Google Meet را اینجا وارد کنید]",
  "Please join the meeting on time and ensure that your internet connection, microphone, and camera are working properly before the interview begins. If you are unable to attend at the scheduled time, please let us know in advance so we can arrange a suitable alternative.":
    "لطفا در زمان تعیین‌شده در جلسه حضور پیدا کنید و پیش از شروع مصاحبه از سالم بودن اینترنت، میکروفون و دوربین خود مطمئن شوید. اگر در زمان تعیین‌شده امکان حضور ندارید، لطفا از قبل به ما اطلاع دهید تا زمان مناسب دیگری تنظیم کنیم.",
  "We look forward to speaking with you and learning more about your teaching approach.":
    "مشتاق هستیم با شما گفتگو کنیم و درباره شیوه تدریس شما بیشتر بدانیم.",
  "Best regards,": "با احترام،",
  "EduTech Team": "تیم EduTech",
};

const translateText = (text, language) => {
  if (language !== "fa") return text;
  return PAGE_TEXT[text] || text;
};

const getTeacherInterviewSubject = (language) =>
  translateText("EduTech Teacher Interview Invitation", language);

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

const formatInterviewDateValue = (value, language) => {
  if (!value) return `[${translateText("Write date here", language)}]`;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return `[${translateText("Write date here", language)}]`;
  return date.toLocaleDateString(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatInterviewTimeValue = (value, language) => {
  if (!value) return `[${translateText("Write time here", language)}]`;
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  if (Number.isNaN(date.getTime())) return `[${translateText("Write time here", language)}]`;
  return date.toLocaleTimeString(language === "fa" ? "fa-AF" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildTeacherInterviewMessage = ({ date = "", time = "", language = "en" } = {}) => `${translateText("Dear Teacher,", language)}

${translateText("Thank you for your interest in joining EduTech as an instructor.", language)}

${translateText("After reviewing your application, we are pleased to invite you to an online interview with our team. The interview will be conducted through Google Meet and will help us learn more about your teaching experience, subject expertise, availability, and how your skills can contribute to the EduTech learning community.", language)}

${translateText("Interview Details:", language)}

${translateText("Date:", language)} ${formatInterviewDateValue(date, language)}
${translateText("Time:", language)} ${formatInterviewTimeValue(time, language)}
${translateText("Google Meet Link: [Paste Google Meet link here]", language)}

${translateText("Please join the meeting on time and ensure that your internet connection, microphone, and camera are working properly before the interview begins. If you are unable to attend at the scheduled time, please let us know in advance so we can arrange a suitable alternative.", language)}

${translateText("We look forward to speaking with you and learning more about your teaching approach.", language)}

${translateText("Best regards,", language)}
${translateText("EduTech Team", language)}`;

const formatDateTime = (value, language) => {
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

const normalizeConversation = (row = {}) => ({
  teacherId: String(row?.teacherId || ""),
  name: String(row?.name || "Teacher").trim() || "Teacher",
  email: String(row?.email || "").trim(),
  avatar: String(row?.avatar || "").trim(),
  status: String(row?.status || "").toLowerCase(),
  applicationStatus: String(row?.applicationStatus || "").toLowerCase(),
  unreadCount: Number(row?.unreadCount || 0),
  lastMessage: String(row?.lastMessage || "").trim(),
  lastMessageAt: row?.lastMessageAt || null,
  lastSenderRole: String(row?.lastSenderRole || "").toLowerCase(),
});

const normalizeThreadMessage = (row = {}) => ({
  id: String(row?.id || row?._id || ""),
  teacherId: String(row?.teacherId || ""),
  senderRole: String(row?.senderRole || "").toLowerCase(),
  senderName: String(row?.senderName || "").trim(),
  body: String(row?.body || "").trim(),
  createdAt: row?.createdAt || null,
});

const getTeacherStatusLabel = (conversation, pageTr) => {
  if (String(conversation?.status || "").toLowerCase() === "blocked") {
    return pageTr("Blocked teacher");
  }
  if (String(conversation?.applicationStatus || "").toLowerCase() === "approved") {
    return pageTr("Approved teacher");
  }
  return pageTr("Pending teacher");
};

export default function AdminMessagesPage() {
  const { t, language, isRTL } = useAdminI18n();
  const [searchParams] = useSearchParams();
  const requestedSearch = searchParams.get("q") || "";
  const pageTr = useCallback(
    (text) => translateText(t(text), language),
    [language, t],
  );
  const token = useMemo(() => getToken(), []);
  const storedDirectEmailDraft = useMemo(() => getStoredDirectEmailDraft(), []);

  const [conversationSearch, setConversationSearch] = useState(requestedSearch);
  const debouncedConversationSearch = useDebouncedValue(conversationSearch.trim(), 250);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationStats, setConversationStats] = useState({
    totalConversations: 0,
    unreadConversations: 0,
    unreadMessages: 0,
    adminSentMessages: 0,
  });
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingThread, setSendingThread] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setConversationSearch(requestedSearch),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [requestedSearch]);

  const [directEmailForm, setDirectEmailForm] = useState(storedDirectEmailDraft.form);
  const [interviewSchedule, setInterviewSchedule] = useState(storedDirectEmailDraft.schedule);
  const [recipientSearch, setRecipientSearch] = useState(storedDirectEmailDraft.recipientSearch);
  const debouncedRecipientSearch = useDebouncedValue(recipientSearch.trim(), 250);
  const [recipientResults, setRecipientResults] = useState([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);
  const [directEmailSending, setDirectEmailSending] = useState(false);
  const [isDirectEmailModalOpen, setIsDirectEmailModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const recipientSearchRequest = useLatestRequest();
  const conversationsRequest = useLatestRequest();
  const threadRequest = useLatestRequest();

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
          directEmailForm.recipientRole === "teacher" ? "/admin/teachers" : "/admin/students";

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
    return () => {};
  }, [debouncedRecipientSearch, directEmailForm.recipientRole, recipientSearchRequest, token]);

  useEffect(() => {
    if (!token) {
      const timer = window.setTimeout(
        () => setError(pageTr("Authentication token not found. Please sign in again.")),
        0,
      );
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(async () => {
      setLoadingConversations(true);
      setError("");

      await conversationsRequest.runLatest(async () => {
        const params = new URLSearchParams();
        if (debouncedConversationSearch) params.set("search", debouncedConversationSearch);
        if (unreadOnly) params.set("unreadOnly", "true");

        const response = await fetch(
          `${getApiBase()}/admin/messages/teacher-conversations${params.toString() ? `?${params.toString()}` : ""}`,
          {
            headers: buildAuthHeaders(),
            cache: "no-store",
          },
        );
        return parseJsonResponse(response);
      }, {
        onSuccess: (payload) => {
          const rows = Array.isArray(payload?.data?.conversations)
            ? payload.data.conversations.map(normalizeConversation)
            : [];
          setConversations(rows);
          setConversationStats({
            totalConversations: Number(payload?.data?.stats?.totalConversations || 0),
            unreadConversations: Number(payload?.data?.stats?.unreadConversations || 0),
            unreadMessages: Number(payload?.data?.stats?.unreadMessages || 0),
            adminSentMessages: Number(payload?.data?.stats?.adminSentMessages || 0),
          });
          setSelectedTeacherId((prev) =>
            rows.some((row) => row.teacherId === prev) ? prev : rows[0]?.teacherId || "",
          );
        },
        onError: (err) => {
          setError(err?.message || pageTr("Failed to load teacher conversations."));
        },
        onFinally: () => {
          setLoadingConversations(false);
        },
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [conversationsRequest, debouncedConversationSearch, pageTr, token, unreadOnly]);

  useEffect(() => {
    if (!token || !selectedTeacherId) {
      const timer = window.setTimeout(() => {
        setSelectedTeacher(null);
        setThreadMessages([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(async () => {
      setLoadingThread(true);
      setError("");

      await threadRequest.runLatest(async () => {
        const response = await fetch(
          `${getApiBase()}/admin/messages/teacher-conversations/${encodeURIComponent(selectedTeacherId)}/messages`,
          {
            headers: buildAuthHeaders(),
            cache: "no-store",
          },
        );
        return parseJsonResponse(response);
      }, {
        onSuccess: async (payload) => {
          const teacher = payload?.data?.teacher || null;
          const messages = Array.isArray(payload?.data?.messages)
            ? payload.data.messages.map(normalizeThreadMessage)
            : [];
          setSelectedTeacher(teacher);
          setThreadMessages(messages);

          const selectedConversation = conversations.find((row) => row.teacherId === selectedTeacherId);
          if (Number(selectedConversation?.unreadCount || 0) > 0) {
            try {
              const readResponse = await fetch(
                `${getApiBase()}/admin/messages/teacher-conversations/${encodeURIComponent(selectedTeacherId)}/read`,
                {
                  method: "PATCH",
                  headers: buildAuthHeaders(),
                },
              );
              await parseJsonResponse(readResponse);
              setConversations((prev) =>
                prev.map((row) =>
                  row.teacherId === selectedTeacherId
                    ? { ...row, unreadCount: 0 }
                    : row,
                ),
              );
              setConversationStats((prev) => ({
                ...prev,
                unreadMessages: Math.max(0, Number(prev.unreadMessages || 0) - Number(selectedConversation?.unreadCount || 0)),
                unreadConversations: Math.max(
                  0,
                  Number(prev.unreadConversations || 0) - 1,
                ),
              }));
            } catch {
              // Keep the unread counters intact when the server could not mark them read.
            }
          }
        },
        onError: (err) => {
          setError(err?.message || pageTr("Failed to load conversation messages."));
        },
        onFinally: () => {
          setLoadingThread(false);
        },
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [conversations, pageTr, selectedTeacherId, threadRequest, token]);

  const handleSendThreadMessage = async () => {
    const body = String(threadDraft || "").trim();
    if (!selectedTeacherId || !body) return;

    if (!token) {
      setError(pageTr("Please sign in as admin to message teachers."));
      return;
    }

    try {
      setSendingThread(true);
      setError("");
      setNotice("");

      const response = await fetch(
        `${getApiBase()}/admin/messages/teacher-conversations/${encodeURIComponent(selectedTeacherId)}/messages`,
        {
          method: "POST",
          headers: {
            ...buildAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body }),
        },
      );
      const payload = await parseJsonResponse(response);
      const nextMessage = normalizeThreadMessage(payload?.data || {});

      setThreadDraft("");
      setThreadMessages((prev) => [...prev, nextMessage]);
      setNotice(pageTr("Teacher direct message sent successfully."));
      setConversations((prev) => {
        const nextRows = prev.map((row) =>
          row.teacherId === selectedTeacherId
            ? {
                ...row,
                lastMessage: body,
                lastMessageAt: nextMessage.createdAt || new Date().toISOString(),
                lastSenderRole: "admin",
              }
            : row,
        );
        nextRows.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        return nextRows;
      });
      setConversationStats((prev) => ({
        ...prev,
        adminSentMessages: Number(prev.adminSentMessages || 0) + 1,
      }));
    } catch (err) {
      setError(err?.message || pageTr("Failed to send teacher message."));
    } finally {
      setSendingThread(false);
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
      setError(pageTr("Recipient email, subject, and message are required."));
      return;
    }

    if (!token) {
      setError(pageTr("Please sign in as admin to send email from EduTech."));
      return;
    }

    setDirectEmailSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${getApiBase()}/admin/messages/email`, {
        method: "POST",
        headers: {
          ...buildAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await parseJsonResponse(response);
      if (responsePayload?.success === false) {
        throw new Error(responsePayload?.message || pageTr("Failed to send email"));
      }

      setDirectEmailForm(DEFAULT_DIRECT_EMAIL_FORM);
      setInterviewSchedule(DEFAULT_INTERVIEW_SCHEDULE);
      setRecipientSearch("");
      setRecipientResults([]);
      sessionStorage.removeItem(DIRECT_EMAIL_DRAFT_KEY);
      setIsDirectEmailModalOpen(false);
      setNotice(pageTr("Email sent from the EduTech email."));
    } catch (err) {
      setError(err?.message || pageTr("Failed to send email"));
    } finally {
      setDirectEmailSending(false);
    }
  };

  const isInterviewTemplateDraft = (form) =>
    form.recipientRole === "teacher" &&
    form.subject === getTeacherInterviewSubject(language) &&
    (form.message.includes("Interview Details:") || form.message.includes("جزئیات مصاحبه:") || !form.message.trim());

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
            recipientRole: "teacher",
            subject: getTeacherInterviewSubject(language),
            message: buildTeacherInterviewMessage({ ...nextSchedule, language }),
          }
        : prev,
    );
  };

  const applyTeacherInterviewTemplate = () => {
    setDirectEmailForm((prev) => ({
      ...prev,
      recipientRole: "teacher",
      subject: getTeacherInterviewSubject(language),
      message: buildTeacherInterviewMessage({ ...interviewSchedule, language }),
    }));
    setError("");
    setNotice(pageTr("Teacher interview template added. Fill the Google Meet link before sending."));
  };

  const selectRecipient = (recipient) => {
    setDirectEmailForm((prev) => ({
      ...prev,
      recipientEmail: recipient.email,
    }));
    setRecipientSearch(recipient.email);
    setRecipientResults([]);
    setNotice(`${pageTr("Selected recipient")}: ${recipient.name} (${recipient.email}).`);
  };

  const stats = [
    {
      id: "totalConversations",
      title: pageTr("Teacher Conversations"),
      value: conversationStats.totalConversations,
      icon: Inbox,
      note: pageTr("Open teacher threads in the admin inbox"),
    },
    {
      id: "unreadConversations",
      title: pageTr("Unread Conversations"),
      value: conversationStats.unreadConversations,
      icon: MessageSquare,
      note: pageTr("Threads that still need an admin review"),
    },
    {
      id: "unreadMessages",
      title: pageTr("Unread Messages"),
      value: conversationStats.unreadMessages,
      icon: Clock3,
      note: pageTr("Messages from teachers that have not been opened yet"),
    },
    {
      id: "adminSentMessages",
      title: pageTr("Admin Messages Sent"),
      value: conversationStats.adminSentMessages,
      icon: CheckCheck,
      note: pageTr("Total direct messages sent by admins to teachers"),
    },
  ];

  const selectedConversation =
    conversations.find((row) => row.teacherId === selectedTeacherId) || null;
  const selectedTeacherStatusLabel = selectedConversation
    ? getTeacherStatusLabel(selectedConversation, pageTr)
    : "";
  const rootTextClass = isRTL ? "text-right" : "text-left";

  return (
    <section
      className={`w-full max-w-full overflow-x-hidden space-y-6 ${rootTextClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
              {pageTr("Communication workspace")}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-800">
              {t("pages.messages.title")}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-7 text-slate-600">
              {pageTr("Manage direct teacher conversations, keep follow-ups moving, and send direct emails to teachers or students from one workspace.")}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-700">
              <AlertCircle size={16} />
              {pageTr("Needs attention")}
            </div>
            <p className="mt-2 text-2xl font-extrabold text-amber-800">
              {conversationStats.unreadConversations}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700/90">
              {pageTr("Teacher conversations with unread replies waiting for admin follow-up")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.id}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <stat.icon size={22} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{stat.title}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">{stat.value}</p>
            <p className="mt-2 text-sm font-normal text-slate-600">{stat.note}</p>
          </article>
        ))}
      </div>

      {error ? (
        <p className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {notice}
        </p>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Direct email composer")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Email tools stay available here whenever you need to send a direct email or interview invitation.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsDirectEmailModalOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
            >
              <Mail size={14} />
              {pageTr("Open Email Composer")}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
          {pageTr("Sends from the same EduTech email used for OTP codes.")}
        </div>
      </section>

      {isDirectEmailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="absolute inset-0" onClick={() => setIsDirectEmailModalOpen(false)} />
          <form
            onSubmit={handleSendDirectEmail}
            className={`relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl md:p-6 ${rootTextClass}`}
          >
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">{pageTr("Direct email composer")}</h2>
                <p className="mt-1 text-sm font-normal text-slate-600">
                  {pageTr("Sends from the same EduTech email used for OTP codes.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectEmailModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center self-end rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 sm:self-auto"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyTeacherInterviewTemplate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-100"
              >
                <Mail size={14} />
                {pageTr("Interview Invite")}
              </button>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)]">
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
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
              >
                <option value="student">{pageTr("Student")}</option>
                <option value="teacher">{pageTr("Teacher")}</option>
              </select>
              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={recipientSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRecipientSearch(value);
                    setDirectEmailForm((prev) => ({ ...prev, recipientEmail: value.trim() }));
                  }}
                  placeholder={
                    directEmailForm.recipientRole === "teacher"
                      ? pageTr("Search teacher by name or email")
                      : pageTr("Search student by name or email")
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
                {recipientSearch.trim().length >= 2 ? (
                  <div className="absolute inset-x-0 top-14 z-20 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                    {recipientSearchLoading ? (
                      <div className="px-3 py-3 text-xs font-bold text-slate-500">{pageTr("Searching...")}</div>
                    ) : recipientResults.length ? (
                      recipientResults.map((recipient) => (
                        <button
                          type="button"
                          key={recipient.id}
                          onClick={() => selectRecipient(recipient)}
                          className={`w-full rounded-xl px-3 py-3 transition hover:bg-primary-50 ${rootTextClass}`}
                        >
                          <span className="block text-sm font-extrabold text-slate-800">{recipient.name}</span>
                          <span className="block text-xs font-medium text-slate-500">
                            {recipient.email}
                            {recipient.phone ? ` - ${recipient.phone}` : ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs font-bold text-slate-500">
                        {pageTr("No matching recipient found.")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <input
                value={directEmailForm.subject}
                onChange={(event) =>
                  setDirectEmailForm((prev) => ({ ...prev, subject: event.target.value }))
                }
                placeholder={pageTr("Email subject")}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{pageTr("Interview date")}</span>
                <span className="relative block">
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={interviewSchedule.date}
                    onChange={(event) => handleInterviewScheduleChange("date", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{pageTr("Interview time")}</span>
                <span className="relative block">
                  <Clock3
                    size={18}
                    className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="time"
                    value={interviewSchedule.time}
                    onChange={(event) => handleInterviewScheduleChange("time", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white"
                  />
                </span>
              </label>
            </div>

            <textarea
              value={directEmailForm.message}
              onChange={(event) =>
                setDirectEmailForm((prev) => ({ ...prev, message: event.target.value }))
              }
              placeholder={pageTr("Write the email message...")}
              className="mt-4 min-h-[180px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setIsDirectEmailModalOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {language === "fa" ? "بستن" : "Close"}
              </button>
              <button
                type="submit"
                disabled={directEmailSending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} />
                {directEmailSending ? pageTr("Sending") : pageTr("Send Email")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-extrabold text-slate-800">{pageTr("Teacher inbox")}</h2>
            <p className="mt-1 text-sm font-normal text-slate-600">
              {pageTr("Search by teacher name, email, or recent message and open any direct conversation from one place.")}
            </p>

            <div className="mt-5 grid gap-3">
              <label className="relative block">
                <Search
                  size={18}
                  className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder={pageTr("Search teacher or message")}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                />
              </label>

              <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                {pageTr("Only unread conversations")}
              </label>
            </div>
          </div>

          <div className="chat-scrollbar-side edutech-scrollbar max-h-[760px] overflow-y-auto">
            {loadingConversations ? (
              <div className="p-5">
                <AdminPageLoader
                  label={pageTr("Loading conversations")}
                  minHeight="min-h-[220px]"
                  className="border-0 bg-transparent p-0"
                />
              </div>
            ) : conversations.length === 0 ? (
              <div className="grid min-h-[220px] place-items-center p-6 text-center">
                <div>
                  <Inbox size={34} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {pageTr("No teacher conversations found.")}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {pageTr("Try changing the search text or unread filter.")}
                  </p>
                </div>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.teacherId}
                  onClick={() => setSelectedTeacherId(conversation.teacherId)}
                  className={`w-full border-b border-slate-100 p-4 transition ${rootTextClass} ${
                    selectedTeacherId === conversation.teacherId ? "bg-primary-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                          <UserCheck size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-800">
                            {conversation.name}
                          </p>
                          <p className="truncate text-xs font-semibold text-slate-500">
                            {conversation.email}
                          </p>
                        </div>
                      </div>
                    </div>
                    {conversation.unreadCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {conversation.lastMessage || "-"}
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-slate-400">
                    {formatDateTime(conversation.lastMessageAt, language)}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <article className="flex min-h-[760px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          {!selectedTeacherId ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <MailOpen size={42} className="mx-auto text-slate-300" />
                <p className="mt-4 text-base font-bold text-slate-700">
                  {pageTr("Select a teacher conversation to view details.")}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {pageTr("The selected teacher thread will open here with full message history and a reply box.")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-200 p-5 lg:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                        <MessageSquare size={18} />
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        {selectedTeacherStatusLabel}
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-extrabold text-slate-800">
                      {selectedTeacher?.name || selectedConversation?.name || "Teacher"}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {selectedTeacher?.email || selectedConversation?.email || "-"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {pageTr("Direct conversation with this teacher")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                    {pageTr("Unread replies")}: {Number(selectedConversation?.unreadCount || 0)}
                  </div>
                </div>
              </header>

              <div className="chat-scrollbar-side edutech-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-5 lg:p-6">
                {loadingThread ? (
                  <AdminPageLoader
                    label={pageTr("Loading conversations")}
                    minHeight="min-h-[260px]"
                    className="border-0 bg-transparent p-0"
                  />
                ) : threadMessages.length ? (
                  <div className="space-y-3">
                    {threadMessages.map((message) => {
                      const isMine = message.senderRole === "admin";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-[20px] px-4 py-3 shadow-sm ${
                              isMine
                                ? "bg-primary-600 text-white"
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                            <p className={`mt-2 text-[11px] font-semibold ${isMine ? "text-white/80" : "text-slate-400"}`}>
                              {formatDateTime(message.createdAt, language)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-[260px] place-items-center text-center">
                    <div>
                      <MailOpen size={34} className="mx-auto text-slate-300" />
                      <p className="mt-3 text-sm font-bold text-slate-700">
                        {pageTr("No messages in this conversation yet.")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {pageTr("Send the first message to start the conversation.")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-200 p-5 lg:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">
                        {pageTr("Admin thread")}
                      </h3>
                      <p className="mt-1 text-sm font-normal text-slate-600">
                        {pageTr("Direct conversation with this teacher")}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                      <Mail size={14} />
                      {pageTr("Sent through EduTech inbox")}
                    </div>
                  </div>

                  <textarea
                    value={threadDraft}
                    onChange={(event) => setThreadDraft(event.target.value)}
                    placeholder={pageTr("Write your message to this teacher...")}
                    className="min-h-[160px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
                  />

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={handleSendThreadMessage}
                      disabled={sendingThread || !String(threadDraft || "").trim()}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-600 px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={15} />
                      {sendingThread ? pageTr("Sending") : pageTr("Send Message")}
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
