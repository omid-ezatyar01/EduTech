import {
  ArrowRightLeft,
  CheckCircle2,
  Hash,
  MessageCircle,
  ShieldCheck,
  StickyNote,
  Users,
} from "lucide-react";
import { useSupportStaffLanguage } from "../services/supportStaffLanguageContext.js";

export default function SupportTeamGuide() {
  const { isFa } = useSupportStaffLanguage();
  const workflows = [
    {
      icon: MessageCircle,
      title: isFa ? "۱. خواندن و گرفتن تکت" : "1. Read and claim",
      text: isFa
        ? "تکت خوانده‌نشده را باز کنید، گفتگو را بررسی کنید و سپس آن را به خودتان بسپارید تا اعضای تیم مسئول آن را بدانند."
        : "Open an unread ticket, check the conversation, then assign it to yourself so teammates know who owns it.",
    },
    {
      icon: StickyNote,
      title: isFa ? "۲. هماهنگی خصوصی" : "2. Coordinate privately",
      text: isFa
        ? "برای اطلاعات مربوط به همان تکت از یادداشت داخلی استفاده کنید. کاربران هرگز یادداشت داخلی را نمی‌بینند."
        : "Use an internal note for ticket-specific context. Users never see internal notes.",
    },
    {
      icon: ArrowRightLeft,
      title: isFa ? "۳. پاسخ و تعیین وضعیت" : "3. Reply and set status",
      text: isFa
        ? "پس از پرسش از کاربر وضعیت «در انتظار کاربر»، هنگام بررسی «در حال بررسی» و پس از تکمیل پاسخ «حل شده» را انتخاب کنید."
        : "Use Waiting for user after asking a question, In progress while investigating, and Resolved when the answer is complete.",
    },
    {
      icon: CheckCircle2,
      title: isFa ? "۴. بستن پس از تکمیل" : "4. Close only when finished",
      text: isFa
        ? "تکت حل‌شده می‌تواند دوباره باز شود. فقط وقتی کار دیگری باقی نمانده است تکت را ببندید."
        : "Resolved tickets may be reopened. Close a ticket only when no more work is expected.",
    },
  ];
  return (
    <section className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#0B4FD8] to-[#00A99D] p-6 text-white shadow-lg">
        <ShieldCheck size={32} />
        <h2 className="mt-3 text-2xl font-black">
          {isFa ? "روش کار تیم پشتیبانی" : "How the support team works"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-blue-50">
          {isFa
            ? "این محیط پاسخ‌های قابل مشاهده برای کاربر، یادداشت‌های خصوصی تکت و گفتگوهای کارمندان را از هم جدا می‌کند. برای جلوگیری از پاسخ تکراری و انتقال ناقص، مراحل زیر را دنبال کنید."
            : "This workspace separates user-facing replies, private ticket notes, and staff conversations. Follow the workflow below to avoid duplicate replies and lost handoffs."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Icon className="text-[#0B4FD8]" size={23} />
            <h3 className="mt-3 font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {text}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GuideCard
          icon={StickyNote}
          title={isFa ? "یادداشت داخلی" : "Internal note"}
          text={
            isFa
              ? "خصوصی و مربوط به یک تکت است. برای جزئیات بررسی، کنترل پرداخت و اطلاعات انتقال تکت استفاده کنید."
              : "Private and attached to one ticket. Use it for investigation details, payment checks, and handoff context."
          }
        />
        <GuideCard
          icon={Hash}
          title={isFa ? "گفتگوی عمومی تیم" : "General team room"}
          text={
            isFa
              ? "با مدیر و همه کارمندان فعال پشتیبانی مشترک است. برای مشکلات عمومی، اعلان‌ها و موارد مرتبط با چند تکت استفاده کنید."
              : "Shared with the admin and all active support staff. Use it for incidents, announcements, and help that affects several tickets."
          }
        />
        <GuideCard
          icon={Users}
          title={isFa ? "پیام خصوصی" : "Direct message"}
          text={
            isFa
              ? "گفتگوی خصوصی میان دو عضو پشتیبانی است. برای انتقال سریع یا پرسشی که مربوط به متن تکت نیست استفاده کنید."
              : "Private between two support members. Use it for a quick handoff or question that does not belong in the ticket."
          }
        />
      </div>

      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-black text-amber-900">
          {isFa ? "قوانین مهم تیم" : "Important team rules"}
        </h3>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-sm font-semibold leading-6 text-amber-900/80">
          <li>{isFa ? "هرگز رمز عبور، کد یک‌بارمصرف یا اطلاعات محرمانه کامل پرداخت کاربر را درخواست نکنید." : "Never request a user password, OTP, or complete payment secret."}</li>
          <li>{isFa ? "پیش از بررسی یا پاسخ دادن، تکت را بگیرید." : "Claim a ticket before investigating or replying."}</li>
          <li>{isFa ? "تکت گرفته‌شده را بدون نوشتن دلیل انتقال به صف برنگردانید." : "Never return an owned ticket to the queue without recording a handoff reason."}</li>
          <li>{isFa ? "پاسخ‌های کاربر را واضح، محترمانه و بدون جزئیات داخلی بنویسید." : "Keep user-visible replies clear, respectful, and free of internal details."}</li>
          <li>{isFa ? "مشکلات فوری پرداخت یا امنیت حساب را روی اولویت فوری قرار دهید." : "Move urgent payment or account-security incidents to Urgent priority."}</li>
          <li>{isFa ? "اگر مشکلی ممکن است کاربران دیگر را نیز تحت تأثیر قرار دهد، از گفتگوی عمومی تیم استفاده کنید." : "Use the team room when an issue may affect other users."}</li>
        </ul>
      </article>
    </section>
  );
}

function GuideCard({ icon: Icon, title, text }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <Icon className="text-teal-600" size={22} />
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        {text}
      </p>
    </article>
  );
}
