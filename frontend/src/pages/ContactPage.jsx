import { useEffect, useState } from "react";
import {
  Mail,
  MapPin,
  Clock,
  LogIn,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import FAQAccordion from "../components/FAQAccordion.jsx";
import CTASection from "../components/CTASection.jsx";
import SocialBrandIcon from "../components/SocialBrandIcon.jsx";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http";
import { getAuthUser } from "../../services/portal";

const CONTACT_MESSAGE_MAX_LENGTH = 1000;

const pageData = {
  fa: {
    breadcrumbs: ["خانه", "تماس با ما"],
    hero: {
      title: "تماس با ما",
      subtitle:
        "ما اینجا هستیم تا به سوالات شما پاسخ دهیم و در مسیر یادگیری همراه شما باشیم.",
    },
    form: {
      title: "برای ما پیام بفرستید",
      subtitle:
        "پیام خود را ارسال کنید، ما در اولین فرصت با شما تماس می‌گیریم.",
      registeredEmailNote: "برای پاسخ‌گویی، از نام و ایمیل ثبت‌شده حساب شاگردی شما استفاده می‌شود.",
      fields: {
        subject: "موضوع",
        message: "پیام شما",
        submit: "ارسال پیام",
      },
      submitMessages: {
        required: "لطفا همه فیلدهای الزامی را کامل کنید.",
        invalidEmail: "لطفاً یک ایمیل معتبر وارد کنید.",
        tooLong: `پیام شما نباید بیشتر از ${CONTACT_MESSAGE_MAX_LENGTH} کاراکتر باشد.`,
        sending: "در حال ارسال",
        success: "پیام شما با موفقیت ارسال شد.",
        error: "ارسال پیام موفق نبود. لطفا دوباره تلاش کنید.",
        loginRequired: "برای ارسال پیام، لطفاً ابتدا به عنوان شاگرد وارد حساب خود شوید.",
        dailyLimit: "شما فقط یک بار در روز می‌توانید پیام ارسال کنید. لطفاً فردا دوباره تلاش کنید.",
      },
      subjects: [
        "سوال درباره کورس‌ها",
        "مشکل در ثبت‌نام",
        "پرداخت",
        "همکاری با ایجوتک",
        "درخواست مشاوره",
        "بازخورد و پیشنهاد",
        "گزارش مشکل فنی",
        "سایر موارد",
      ],
    },
    info: {
      title: "راه‌های ارتباطی",
      workingHoursLabel: "ساعات کاری",
      workingHours: "شنبه تا پنجشنبه، 8:00 صبح تا 6:00 عصر",
    },
    consultation: {
      title: "مشاوره رایگان",
      text: "برای انتخاب کورس مناسب، با مشاور آموزشی ما صحبت کنید.",
      btn: "درخواست مشاوره",
    },
    faq: {
      title: "سوالات متداول",
      items: [
        {
          q: "چگونه در یک کورس ثبت‌نام کنم؟",
          a: "از صفحه کورس‌های آنلاین، کورس مورد نظر را انتخاب کنید و روی دکمه ثبت‌نام کلیک کنید.",
        },
        {
          q: "آیا صنف‌ها ضبط‌شده هستند؟",
          a: "نخیر، صنف‌ها به صورت آنلاین در Google Meet برگزار می‌شوند.",
        },
        {
          q: "لینک Google Meet را از کجا دریافت کنم؟",
          a: "بعد از تایید ثبت‌نام، لینک صنف در داشبورد شاگرد نمایش داده می‌شود.",
        },
        {
          q: "آیا قبل از ثبت‌نام می‌توانم مشوره بگیرم؟",
          a: "بلی، می‌توانید از طریق فرم تماس یا دکمه درخواست مشاوره با ما ارتباط بگیرید.",
        },
        {
          q: "آیا بعد از تکمیل کورس سرتیفیکیت داده می‌شود؟",
          a: "بلی، بعد از تکمیل کورس و انجام تمرین‌ها سرتیفیکیت داده می‌شود.",
        },
      ],
    },
    followUs: {
      title: "ما را دنبال کنید",
      text: "برای دریافت جدیدترین خبرها و اطلاعیه‌های آموزشی، ما را در شبکه‌های اجتماعی دنبال کنید.",
    },
    map: { title: "موقعیت ما روی نقشه", text: "کابل، افغانستان" },
    modal: {
      title: "تایید اطلاعات",
      text: "پاسخ پیام به ایمیل ثبت‌شده حساب شاگردی شما فرستاده می‌شود. لطفاً پیش از ارسال، موضوع و متن پیام را بررسی کنید.",
      submit: "تایید و ارسال",
      edit: "بازگشت و ویرایش",
    },
  },
  en: {
    breadcrumbs: ["Home", "Contact Us"],
    hero: {
      title: "Contact Us",
      subtitle:
        "We are here to answer your questions and support you on your learning journey.",
    },
    form: {
      title: "Send Us a Message",
      subtitle:
        "Send your message and we will contact you as soon as possible.",
      registeredEmailNote: "We will use your registered student account name and email to reply.",
      fields: {
        subject: "Subject",
        message: "Your Message",
        submit: "Send Message",
      },
      submitMessages: {
        required: "Please fill in all required fields.",
        invalidEmail: "Please enter a valid email address.",
        tooLong: `Your message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or less.`,
        sending: "Sending",
        success: "Your message was sent successfully.",
        error: "Failed to send your message. Please try again.",
        loginRequired: "Please log in as a student before sending a message.",
        dailyLimit: "You can send only one message per day. Please try again tomorrow.",
      },
      subjects: [
        "Question about courses",
        "Registration issue",
        "Payment",
        "Partnership with EduTech",
        "Request Consultation",
        "Feedback and suggestion",
        "Report a technical issue",
        "Other",
      ],
    },
    info: {
      title: "Contact Information",
      workingHoursLabel: "Working Hours",
      workingHours: "Saturday to Thursday, 8:00 AM to 6:00 PM",
    },
    consultation: {
      title: "Free Consultation",
      text: "Talk to our academic advisor to choose the right course.",
      btn: "Request Consultation",
    },
    faq: {
      title: "Frequently Asked Questions",
      items: [
        {
          q: "How do I register for a course?",
          a: "Go to the Live Courses page, choose your course, and click the registration button.",
        },
        {
          q: "Are the classes recorded?",
          a: "No, classes are held live through Google Meet.",
        },
        {
          q: "Where do I get the Google Meet link?",
          a: "After registration approval, the class link appears in the student dashboard.",
        },
        {
          q: "Can I get consultation before registration?",
          a: "Yes, you can contact us through the form or request consultation button.",
        },
        {
          q: "Will I receive a certificate after completing a course?",
          a: "Yes, after completing the course and assignments, you will receive a certificate.",
        },
      ],
    },
    followUs: {
      title: "Follow Us",
      text: "Follow us on social media for the latest news and learning updates.",
    },
    map: { title: "Our Location on Map", text: "Kabul, Afghanistan" },
    modal: {
      title: "Confirm Information",
      text: "Our reply will be sent to the email registered with your student account. Please review the subject and message before sending.",
      submit: "Confirm & Submit",
      edit: "Back and edit",
    },
  },
};

const WHATSAPP_NUMBER = "93772305458";
const WHATSAPP_DISPLAY_NUMBER = "+93 772 305 458";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const CONTACT_EMAIL = "info@edutech.study";
const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb6syw8CRs1pexVczE0A";
const TELEGRAM_CHANNEL_URL = "https://t.me/edutech_main";
const INSTAGRAM_URL = "https://www.instagram.com/edutech_main/";

function WhatsAppIcon({ size = 20, className = "" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.601 2.326A7.854 7.854 0 0 0 8.002 0a7.94 7.94 0 0 0-6.89 11.89L0 16l4.265-1.114A7.94 7.94 0 0 0 8 16a7.94 7.94 0 0 0 7.94-7.94 7.9 7.9 0 0 0-2.339-5.734zm-5.6 12.38a6.6 6.6 0 0 1-3.36-.92l-.24-.145-2.53.66.676-2.466-.157-.251a6.6 6.6 0 0 1-1.007-3.505 6.62 6.62 0 1 1 6.617 6.627zm3.615-4.953c-.198-.099-1.173-.579-1.353-.645-.182-.066-.312-.099-.445.1s-.512.645-.627.777c-.115.132-.231.149-.429.05-.198-.1-.836-.308-1.59-.981-.587-.523-.985-1.168-1.1-1.366-.116-.198-.012-.305.087-.404.09-.089.198-.231.297-.347.099-.115.132-.198.198-.33.066-.132.033-.248-.017-.347-.05-.099-.445-1.074-.61-1.47-.161-.387-.325-.335-.446-.341l-.38-.007a.73.73 0 0 0-.528.248c-.182.198-.693.678-.693 1.653s.71 1.918.81 2.05c.1.132 1.387 2.118 3.361 2.972.47.203.836.324 1.122.415.472.15.902.129 1.24.078.378-.056 1.173-.48 1.339-.944.165-.463.165-.86.116-.943-.05-.083-.182-.132-.38-.232z" />
    </svg>
  );
}

function TelegramIcon({ size = 20, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.94 4.66a1.5 1.5 0 0 0-1.62-.24L3.4 11.5a1.5 1.5 0 0 0 .13 2.81l4.15 1.45 1.45 4.15a1.5 1.5 0 0 0 2.81.13l7.08-16.92a1.5 1.5 0 0 0-.08-1.46zm-10.98 10.2-.58 2.74-.95-2.73 7.2-6.57-5.67 6.56z" />
    </svg>
  );
}

export default function ContactPage({ language = "fa" }) {
  const isFa = language === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const data = pageData[language] || pageData["fa"];
  const [form, setForm] = useState({
    subject: data.form.subjects[0] || "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState({ type: "", text: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const authUser = getAuthUser();
  const isStudentAuthenticated = authUser?.role === "student";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === "Escape" && !submitting) setIsModalOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [isModalOpen, submitting]);

  const activeSubject = data.form.subjects.includes(form.subject)
    ? form.subject
    : (data.form.subjects[0] || "");
  const resolvedMessage = form.message.trim();

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitState({ type: "", text: "" });

    if (!isStudentAuthenticated) {
      setSubmitState({
        type: "error",
        text: data.form.submitMessages.loginRequired,
      });
      return;
    }

    if (!resolvedMessage) {
      setSubmitState({
        type: "error",
        text: data.form.submitMessages.required,
      });
      return;
    }

    if (resolvedMessage.length < 5) {
      setSubmitState({
        type: "error",
        text: isFa
          ? "متن پیام شما بسیار کوتاه است. لطفاً توضیحات بیشتری بنویسید."
          : "Your message is too short. Please provide more details.",
      });
      return;
    }

    if (resolvedMessage.length > CONTACT_MESSAGE_MAX_LENGTH) {
      setSubmitState({
        type: "error",
        text: data.form.submitMessages.tooLong,
      });
      return;
    }

    setIsModalOpen(true);
  };

  const confirmSubmit = async () => {
    setIsModalOpen(false);
    try {
      setSubmitting(true);
      setSubmitState({ type: "info", text: data.form.submitMessages.sending });

      const response = await fetch(`${getApiBase()}/contact/messages`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          subject: activeSubject || data.form.subjects[0] || "General inquiry",
          message: resolvedMessage,
        }),
      });

      await parseJsonResponse(response);

      setForm({
        subject: data.form.subjects[0] || "",
        message: "",
      });
      setSubmitState({
        type: "success",
        text: data.form.submitMessages.success,
      });

      // Hide the success message after 4 seconds
      setTimeout(() => {
        setSubmitState((prev) =>
          prev.type === "success" ? { type: "", text: "" } : prev,
        );
      }, 4000);
    } catch (error) {
      const specificError =
        error?.response?.data?.message || error?.message || "";
      let errorText = data.form.submitMessages.error;

      if (specificError) {
        const lowerMsg = specificError.toLowerCase();
        if (lowerMsg.includes("failed to fetch")) {
          errorText = isFa
            ? "خطا در اتصال به سرور. لطفاً اینترنت خود را بررسی کنید."
            : "Server connection error. Please check your internet connection.";
        } else if (
          lowerMsg.includes("required") ||
          lowerMsg.includes("empty")
        ) {
          errorText = data.form.submitMessages.required;
        } else if (lowerMsg.includes("length") || lowerMsg.includes("short")) {
          errorText = isFa
            ? "متن پیام شما بسیار کوتاه است. لطفاً توضیحات بیشتری بنویسید."
            : "Your message is too short. Please provide more details.";
        } else if (
          lowerMsg.includes("must be less than or equal to") ||
          lowerMsg.includes("too long") ||
          lowerMsg.includes("1000")
        ) {
          errorText = data.form.submitMessages.tooLong;
        } else if (
          lowerMsg.includes("email") &&
          (lowerMsg.includes("valid") || lowerMsg.includes("format"))
        ) {
          errorText = data.form.submitMessages.invalidEmail;
        } else if (
          lowerMsg.includes("only registered students") ||
          lowerMsg.includes("please login") ||
          lowerMsg.includes("not authorized")
        ) {
          errorText = data.form.submitMessages.loginRequired;
        } else if (
          lowerMsg.includes("only one contact message per day") ||
          lowerMsg.includes("one message per day")
        ) {
          errorText = data.form.submitMessages.dailyLimit;
        } else if (
          !specificError.includes('"') &&
          !specificError.includes("{")
        ) {
          errorText = specificError; // Use safe, custom backend messages verbatim
        }
      }

      setSubmitState({ type: "error", text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 pb-10 pt-8 font-sans text-slate-900"
      dir={dir}
    >
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <section className="relative mb-6 overflow-hidden rounded-[32px] border border-slate-100 bg-white px-5 py-8 text-center shadow-sm sm:px-8 sm:py-10">
          <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-teal-50/50 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-primary-50/50 blur-3xl" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-black text-primary-700"><MessageCircle size={15} />{isFa ? "پشتیبانی ایجوتک" : "EduTech support"}</span>
            <h1 className="mt-5 text-3xl font-black text-slate-950 sm:text-4xl md:text-5xl">
              {data.hero.title}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">
              {data.hero.subtitle}
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Left: Contact Form */}
          <section
            id="contact-form"
            className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm lg:p-10"
          >
            <h2 className="text-2xl font-black text-slate-950">
              {data.form.title}
            </h2>
            <p className="mt-2 font-medium text-slate-600">
              {data.form.subtitle}
            </p>
            {isStudentAuthenticated ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><ShieldCheck size={19} className="mt-0.5 shrink-0"/><div><p className="font-black">{authUser?.name || (isFa ? "حساب شاگرد" : "Student account")}</p><p className="mt-1 break-all text-xs font-bold">{authUser?.email || data.form.registeredEmailNote}</p></div></div>
            ) : null}
            {!isStudentAuthenticated ? (
              <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center"><p className="text-sm font-bold text-amber-800">{data.form.submitMessages.loginRequired}</p><Link to="/login" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-700 px-4 text-xs font-black text-white"><LogIn size={15}/>{isFa ? "ورود به حساب" : "Log in"}</Link></div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {submitState.text ? (
                <p aria-live="polite"
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    submitState.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : submitState.type === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {submitState.text}
                </p>
              ) : null}

              <label className="block"><span className="mb-2 block text-xs font-black text-slate-700">{data.form.fields.subject}</span><select
                value={activeSubject}
                onChange={(e) => handleChange("subject", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
              >
                {data.form.subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select></label>
              <label className="block"><span className="mb-2 block text-xs font-black text-slate-700">{data.form.fields.message}</span><textarea
                rows="6"
                placeholder={data.form.fields.message}
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
              ></textarea></label>
              <div><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>{isFa ? "حداقل ۵ کاراکتر" : "Minimum 5 characters"}</span><span dir="ltr">{form.message.length}/{CONTACT_MESSAGE_MAX_LENGTH}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${form.message.length > CONTACT_MESSAGE_MAX_LENGTH * 0.9 ? "bg-amber-500" : "bg-primary-500"}`} style={{ width: `${Math.min(100, (form.message.length / CONTACT_MESSAGE_MAX_LENGTH) * 100)}%` }}/></div></div>
              <button
                type="submit"
                disabled={submitting || !isStudentAuthenticated}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={17} />
                {submitting
                  ? data.form.submitMessages.sending
                  : data.form.fields.submit}
              </button>
            </form>
          </section>

          {/* Right: Contact Info */}
          <section className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-black text-slate-950">
                {data.info.title}
              </h2>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <Mail size={22} />
                  </div>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-bold text-slate-700 transition hover:text-primary-700"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <svg
                      viewBox="0 0 16 16"
                      width="22"
                      height="22"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M13.601 2.326A7.854 7.854 0 0 0 8.002 0a7.94 7.94 0 0 0-6.89 11.89L0 16l4.265-1.114A7.94 7.94 0 0 0 8 16a7.94 7.94 0 0 0 7.94-7.94 7.9 7.9 0 0 0-2.339-5.734zm-5.6 12.38a6.6 6.6 0 0 1-3.36-.92l-.24-.145-2.53.66.676-2.466-.157-.251a6.6 6.6 0 0 1-1.007-3.505 6.62 6.62 0 1 1 6.617 6.627zm3.615-4.953c-.198-.099-1.173-.579-1.353-.645-.182-.066-.312-.099-.445.1s-.512.645-.627.777c-.115.132-.231.149-.429.05-.198-.1-.836-.308-1.59-.981-.587-.523-.985-1.168-1.1-1.366-.116-.198-.012-.305.087-.404.09-.089.198-.231.297-.347.099-.115.132-.198.198-.33.066-.132.033-.248-.017-.347-.05-.099-.445-1.074-.61-1.47-.161-.387-.325-.335-.446-.341l-.38-.007a.73.73 0 0 0-.528.248c-.182.198-.693.678-.693 1.653s.71 1.918.81 2.05c.1.132 1.387 2.118 3.361 2.972.47.203.836.324 1.122.415.472.15.902.129 1.24.078.378-.056 1.173-.48 1.339-.944.165-.463.165-.86.116-.943-.05-.083-.182-.132-.38-.232z" />
                    </svg>
                  </div>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-slate-700 transition hover:text-emerald-700"
                  >
                    {isFa
                      ? `\u202A${WHATSAPP_DISPLAY_NUMBER}\u202C`
                      : WHATSAPP_DISPLAY_NUMBER}
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <MapPin size={22} />
                  </div>
                  <p className="font-bold text-slate-700">{data.map.text}</p>
                </div>
                <div className="flex items-center gap-4 border-t border-slate-100 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      {data.info.workingHoursLabel}
                    </p>
                    <p className="mt-1 font-bold text-slate-800">
                      {data.info.workingHours}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm text-center">
              <h3 className="text-lg font-black text-slate-950">
                {data.followUs.title}
              </h3>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                {data.followUs.text}
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  {
                    href: WHATSAPP_CHANNEL_URL,
                    label: "WhatsApp",
                    icon: <WhatsAppIcon className="text-emerald-600" />,
                  },
                  {
                    href: TELEGRAM_CHANNEL_URL,
                    label: "Telegram",
                    icon: <TelegramIcon className="text-sky-500" />,
                  },
                  {
                    href: INSTAGRAM_URL,
                    label: "Instagram",
                    icon: <SocialBrandIcon brand="instagram" size={20} className="text-pink-600" />,
                  },
                ].map((item) => (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-black text-slate-600 transition hover:border-primary-100 hover:bg-primary-50 hover:text-primary-700"
                    key={item.label}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* FAQ Section */}
        <section className="mt-10 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm lg:p-12">
          <h2 className="mb-8 text-center text-3xl font-black text-slate-950">
            {data.faq.title}
          </h2>
          <div className="mx-auto max-w-4xl space-y-3">
            {data.faq.items.map((item, idx) => (
              <FAQAccordion answer={item.a} question={item.q} key={idx} />
            ))}
          </div>
        </section>
      </div>

      <div
        onClickCapture={(e) => {
          const target = e.target.closest("a, button");
          if (target) {
            e.preventDefault();
            document.getElementById("contact-form")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }}
      >
        <CTASection
          title={data.consultation.title}
          text={data.consultation.text}
          primaryBtn={data.consultation.btn}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setIsModalOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="contact-confirm-title" className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 id="contact-confirm-title" className="text-lg font-black text-slate-900">
              {data.modal.title}
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {data.modal.text}
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-black text-slate-900">{authUser?.name || (isFa ? "حساب شاگرد" : "Student account")}</p><p className="mt-1 break-all text-xs font-bold text-slate-500">{authUser?.email || "—"}</p><div className="mt-3 border-t border-slate-200 pt-3"><p className="text-xs font-bold text-slate-500">{data.form.fields.subject}</p><p className="mt-1 font-black text-slate-800">{activeSubject}</p></div></div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {data.modal.edit}
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={submitting}
                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-primary-700 disabled:opacity-70"
              >
                {submitting
                  ? data.form.submitMessages.sending
                  : data.modal.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
