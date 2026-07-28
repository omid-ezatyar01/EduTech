import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { streamPlatformAiChatMessage } from "../../../services/aiChatService.js";
import { getAuthUser } from "../../../services/portal.js";
import usePersistentFormDraft, { clearTeacherFormDraft } from "../../hooks/usePersistentFormDraft.js";

const MAX_MESSAGE_LENGTH = 1200;

const resolvePageTitle = (pathname, language) => {
  const isFa = language === "fa";
  if (pathname.startsWith("/teacher/dashboard")) return isFa ? "داشبورد مدرس" : "Teacher Dashboard";
  if (pathname.startsWith("/teacher/courses")) return isFa ? "کورس‌های مدرس" : "Teacher Courses";
  if (pathname.startsWith("/teacher/students")) return isFa ? "شاگردان" : "Students";
  if (pathname.startsWith("/teacher/live-classes")) return isFa ? "صنف‌های زنده" : "Live Classes";
  if (pathname.startsWith("/teacher/attendance")) return isFa ? "حضور و غیاب" : "Attendance";
  if (pathname.startsWith("/teacher/assignments")) return isFa ? "تمرین‌ها" : "Assignments";
  if (pathname.startsWith("/teacher/resources")) return isFa ? "منابع" : "Resources";
  if (pathname.startsWith("/teacher/messages")) return isFa ? "پیام‌ها" : "Messages";
  if (pathname.startsWith("/teacher/profile")) return isFa ? "پروفایل" : "Profile";
  if (pathname.startsWith("/teacher/settings")) return isFa ? "تنظیمات" : "Settings";
  if (pathname.startsWith("/teacher/reports")) return isFa ? "گزارش‌ها" : "Reports";
  if (pathname.startsWith("/teacher/income")) return isFa ? "درآمد" : "Income";
  return "";
};

const createGreeting = (language, name) => {
  if (language === "fa") {
    return `سلام${name ? ` ${name}` : ""}! من دستیار پلتفرم EduTech هستم. فقط در مورد کورس‌ها، شاگردان، تمرین‌ها، صنف‌ها و ابزارهای پنل مدرس کمک می‌کنم.`;
  }

  return `Hi${name ? ` ${name}` : ""}! I'm the EduTech platform assistant. I only help with teacher-panel questions about courses, students, assignments, classes, and platform workflows.`;
};

const getSuggestedQuestions = (language) => {
  if (language === "fa") {
    return [
      "چطور کورس جدید بسازم؟",
      "شاگردانم را کجا ببینم؟",
      "صنف‌های زنده را چگونه مدیریت کنم؟",
    ];
  }

  return [
    "How do I create a new course?",
    "Where can I see my students?",
    "How do I manage live classes?",
  ];
};

export default function TeacherAiChatWidget({ language = "fa" }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  usePersistentFormDraft({
    draftId: "ai-chat",
    value: draft,
    setValue: setDraft,
  });
  const scrollRef = useRef(null);
  const activeRequestRef = useRef(null);
  const user = useMemo(() => getAuthUser(), []);
  const isFa = language === "fa";
  const suggestedQuestions = getSuggestedQuestions(language);
  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    setMessages((current) => {
      if (current.length) return current;
      return [
        {
          id: "welcome",
          role: "assistant",
          content: createGreeting(language, String(user?.name || "").trim()),
        },
      ];
    });
  }, [language, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => () => {
    activeRequestRef.current?.abort();
  }, []);

  const labels = {
    title: isFa ? "دستیار مدرس" : "Teacher Assistant",
    placeholder: isFa ? "سوال مربوط به پنل مدرس را بنویس..." : "Ask a teacher-panel question...",
    send: isFa ? "ارسال" : "Send",
    open: isFa ? "باز کردن چت" : "Open chat",
    close: isFa ? "بستن چت" : "Close chat",
  };
  const dockClass = isFa ? "sm:left-6 sm:items-start" : "sm:right-6 sm:items-end";

  const pageContext = {
    path: `${location.pathname}${location.search || ""}`,
    pageTitle: resolvePageTitle(location.pathname, language),
    courseId: new URLSearchParams(location.search).get("courseId") || "",
  };

  const submitMessage = async (rawContent = "") => {
    const content = String(rawContent || "").trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH || isSending) return;
    const assistantId = `assistant-${Date.now()}`;
    const nextMessages = [
      ...messages,
      { id: `user-${Date.now()}`, role: "user", content },
      { id: assistantId, role: "assistant", content: "" },
    ];
    setMessages(nextMessages);
    clearTeacherFormDraft("ai-chat");
    setDraft("");
    setErrorMessage("");
    setIsSending(true);
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      await streamPlatformAiChatMessage(
        nextMessages
          .filter((message) => message.id !== assistantId)
          .map((message) => ({ role: message.role, content: message.content })),
        pageContext,
        {
          signal: controller.signal,
          onChunk: (delta) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `${message.content}${delta}` }
                  : message,
              ),
            );
          },
        },
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        setMessages((current) => current.filter((message) => message.id !== assistantId));
        return;
      }
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setErrorMessage(error?.message || (isFa ? "پاسخ دستیار دریافت نشد." : "Could not get an assistant reply."));
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitMessage(draft);
  };

  return (
    <div className={`pointer-events-none fixed inset-x-3 bottom-3 z-40 flex flex-col items-stretch sm:inset-x-auto sm:bottom-6 ${dockClass}`}>
      {isOpen ? (
        <section className="pointer-events-auto mb-3 flex h-[min(82vh,52rem)] w-full max-w-[35rem] flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.24),_transparent_42%),linear-gradient(135deg,#0f172a,#1e293b)] px-4 py-4 text-white sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[15px] font-bold sm:text-base">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
                </span>
                <span>{labels.title}</span>
              </div>
            </div>
            <button type="button" className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={handleClose} aria-label={labels.close}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="edutech-scrollbar flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef5ff_100%)] px-3 py-3.5 pe-2 sm:px-4 sm:py-4 [direction:ltr]">
            {messages.length === 1 ? (
              <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {isFa ? "پرسش‌های پیشنهادی" : "Suggested questions"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => submitMessage(question)}
                      disabled={isSending}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-[#0B4FD8]/30 hover:bg-[#0B4FD8]/5 hover:text-[#0B4FD8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-3.5 py-3 text-[14px] leading-6 shadow-sm sm:px-4 sm:text-[15px] sm:leading-7 ${
                  message.role === "assistant"
                    ? "bg-white/95 text-slate-700 ring-1 ring-slate-200/70"
                    : "ms-auto bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-white shadow-lg shadow-blue-500/20"
                }`}
              >
                {message.content || (message.role === "assistant" && isSending ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300 [animation-delay:240ms]" />
                  </span>
                ) : "")}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200/80 bg-white/95 px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-inner sm:px-3.5">
              <textarea
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={labels.placeholder}
                disabled={isSending}
                className="max-h-24 min-h-[42px] w-full resize-none bg-transparent text-[14px] leading-6 text-slate-800 outline-none placeholder:text-slate-400 sm:text-[15px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">{draft.length}/{MAX_MESSAGE_LENGTH}</span>
                <button
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{labels.send}</span>
                </button>
              </div>
            </div>
            {errorMessage ? <p className="mt-2 px-1 text-xs font-semibold text-rose-600">{errorMessage}</p> : null}
          </form>
        </section>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={labels.open}
          className="pointer-events-auto inline-flex h-12 items-center gap-3 self-end rounded-full bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-4 text-sm font-bold text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:brightness-110 sm:h-14 sm:px-5 sm:self-auto"
        >
          <MessageCircle className="h-5 w-5" />
          <span>{labels.title}</span>
        </button>
      ) : null}
    </div>
  );
}
