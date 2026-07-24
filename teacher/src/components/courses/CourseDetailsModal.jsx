import {
  CalendarDays,
  Clock3,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  Layers3,
  Link as LinkIcon,
  Loader2,
  PlayCircle,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { formatProgressLabel } from "../../utils/courseProgress";
import {
  formatDateTimeInZone,
  getBrowserTimeZone,
} from "../../utils/timezone";

const COURSE_IMAGE_FALLBACK = "/logo.png";

function formatNumber(value, language) {
  return Number(value || 0).toLocaleString(language === "fa" ? "fa-AF" : "en-US");
}

function formatDate(value, language, withTime = false) {
  if (!value) return language === "fa" ? "ثبت نشده" : "Not added";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function formatLevel(level, language) {
  const key = String(level || "").trim().toLowerCase();
  const map = {
    beginner: { fa: "مبتدی", en: "Beginner" },
    intermediate: { fa: "متوسط", en: "Intermediate" },
    advanced: { fa: "پیشرفته", en: "Advanced" },
  };
  return map[key]?.[language] || level || (language === "fa" ? "ثبت نشده" : "Not added");
}

function formatMeetingType(meetingType, language) {
  const key = String(meetingType || "").trim().toLowerCase();
  const map = {
    google_meet: { fa: "Google Meet", en: "Google Meet" },
    zoom: { fa: "Zoom", en: "Zoom" },
    physical: { fa: "حضوری", en: "In person" },
    recorded: { fa: "ضبط‌شده", en: "Recorded" },
  };
  return map[key]?.[language] || meetingType || (language === "fa" ? "ثبت نشده" : "Not added");
}

function formatPaymentPlan(paymentPlan, language) {
  return String(paymentPlan || "").toLowerCase() === "whole_period"
    ? (language === "fa" ? "پرداخت یک‌باره" : "One-time payment")
    : (language === "fa" ? "پرداخت ماهانه" : "Monthly payment");
}

function formatCourseType(courseType, language) {
  return String(courseType || "").toLowerCase() === "special"
    ? (language === "fa" ? "کورس ویژه" : "Special course")
    : (language === "fa" ? "کورس عمومی" : "General course");
}

function formatCurrencyLabel(currency, language) {
  const normalized = String(currency || "USD").toUpperCase();
  if (language === "fa") return normalized === "USD" ? "دالر" : normalized;
  return normalized;
}

function formatMoney(amount, language, currency = "USD", fallback = null) {
  const numeric = Number(amount || 0);
  if (!(numeric > 0)) {
    return fallback || (language === "fa" ? `۰ ${formatCurrencyLabel(currency, language)}` : `0 ${currency}`);
  }
  return `${formatNumber(numeric, language)} ${formatCurrencyLabel(currency, language)}`;
}

function getScheduleSummary(schedule, language) {
  const rows = Array.isArray(schedule) ? schedule : [];
  if (!rows.length) return language === "fa" ? "ثبت نشده" : "Not added";
  return language === "fa"
    ? `${formatNumber(rows.length, language)} روز در هفته`
    : `${rows.length} day(s) per week`;
}

function StatusBadge({ course }) {
  const statusClassMap = {
    published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    approved: "bg-blue-50 text-blue-700 ring-blue-100",
    pending: "bg-amber-50 text-amber-700 ring-amber-100",
    draft: "bg-violet-50 text-violet-700 ring-violet-100",
    rejected: "bg-red-50 text-red-700 ring-red-100",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  const statusClass = course.classEndedAt
    ? "bg-[#0B4FD8]/10 text-[#0B4FD8] ring-[#0B4FD8]/15"
    : course.status === "cancelled" || course.classCancelledAt
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : course.cancellationRequest?.status === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : course.classStartedAt
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : statusClassMap[course.status] || "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-black ring-1 ${statusClass}`}>
      {course.statusLabel}
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, hint = "", accent = "blue" }) {
  const accentClass = accent === "teal"
    ? "bg-teal-50 text-teal-700"
    : accent === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : accent === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-[#0B4FD8]/10 text-[#0B4FD8]";

  return (
    <div className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accentClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-500">{label}</p>
          <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900 [overflow-wrap:anywhere]">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KeyValueRow({ label, value, dir = "rtl", valueClassName = "" }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <div
        dir={dir}
        className={`max-w-[65%] break-words text-sm font-black text-slate-900 [overflow-wrap:anywhere] ${valueClassName}`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, icon: Icon, tone = "blue" }) {
  const toneClass = tone === "teal"
    ? "bg-teal-50 text-teal-700"
    : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-[#0B4FD8]/10 text-[#0B4FD8]";

  return (
    <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h4 className="text-base font-black text-slate-950">{title}</h4>
          {subtitle ? (
            <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ScheduleRows({ schedule = [], language }) {
  if (!Array.isArray(schedule) || !schedule.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[#E2E8F0] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        {language === "fa" ? "تقسیم اوقات ثبت نشده است." : "No schedule added."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {schedule.map((slot, index) => (
        <div
          key={`${slot.day || "day"}-${slot.startTime || "start"}-${index}`}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0B4FD8]/10 text-xs font-black text-[#0B4FD8]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">{slot.day || "-"}</p>
            <p className="text-xs font-semibold text-slate-500">
              {language === "fa" ? "جلسه آموزشی" : "Teaching slot"}
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700" dir="ltr">
            {[slot.startTime, slot.endTime].filter(Boolean).join(" - ") || "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewLinks({ links = [], language }) {
  if (!links.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[#E2E8F0] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        {language === "fa" ? "لینک پیش‌نمایش اضافه نشده است." : "No preview links added."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <a
          key={`${link}-${index}`}
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 transition hover:border-[#0B4FD8]/30 hover:bg-[#0B4FD8]/[0.03]"
        >
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-500">
              {language === "fa" ? `لینک ${formatNumber(index + 1, language)}` : `Link ${index + 1}`}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">{link}</p>
          </div>
          <ExternalLink size={16} className="shrink-0 text-[#0B4FD8]" />
        </a>
      ))}
    </div>
  );
}

export default function CourseDetailsModal({
  open,
  course,
  onClose,
  language,
  isRTL,
  onManageStudents,
  onManageContent,
  isLoading = false,
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const normalizedCourse = course || null;
  const isEndedCourse = Boolean(normalizedCourse?.classEndedAt);

  const derived = useMemo(() => {
    const current = normalizedCourse || {};
    const schedule = Array.isArray(current.schedule) ? current.schedule : [];
    const previewLinks = Array.isArray(current.previewVideoUrls) ? current.previewVideoUrls.filter(Boolean) : [];
    const currency = current.currency || "USD";
    return {
      description:
        String(current.description || current.subtitle || "").trim() ||
        (language === "fa" ? "توضیحات ثبت نشده است." : "No description added."),
      schedule,
      previewLinks,
      priceLabel: Number(current.price || 0) > 0
        ? formatMoney(current.price, language, currency)
        : language === "fa"
          ? "رایگان"
          : "Free",
      finalPriceLabel: Number(current.finalPriceForStudents || 0) > 0
        ? formatMoney(current.finalPriceForStudents, language, currency)
        : (Number(current.price || 0) > 0 ? formatMoney(current.price, language, currency) : (language === "fa" ? "رایگان" : "Free")),
      teacherReceiveLabel: formatMoney(
        current.teacherReceiveAmount,
        language,
        currency,
        language === "fa" ? `۰ ${formatCurrencyLabel(currency, language)}` : `0 ${currency}`,
      ),
      teacherPriceLabel: formatMoney(
        current.teacherEffectivePrice,
        language,
        currency,
        Number(current.price || 0) > 0 ? formatMoney(current.price, language, currency) : (language === "fa" ? "رایگان" : "Free"),
      ),
      teacherDiscountLabel: `${formatNumber(current.teacherDiscountPercentage || 0, language)}%`,
      discountLabel: `${formatNumber(current.globalCourseDiscountPercentage || 0, language)}%`,
      levelLabel: formatLevel(current.level, language),
      courseTypeLabel: formatCourseType(current.courseType, language),
      meetingTypeLabel: formatMeetingType(current.meetingType, language),
      paymentPlanLabel: formatPaymentPlan(current.paymentPlan, language),
      languageLabel: current.language || (language === "fa" ? "ثبت نشده" : "Not added"),
      maxStudentsLabel: current.maxStudents ? formatNumber(current.maxStudents, language) : (language === "fa" ? "ثبت نشده" : "Not added"),
      minStudentsLabel: current.minimumStudentsToStart ? formatNumber(current.minimumStudentsToStart, language) : (language === "fa" ? "۱" : "1"),
      totalSessionsLabel: current.totalSessions ? formatNumber(current.totalSessions, language) : (language === "fa" ? "ثبت نشده" : "Not added"),
      durationWeeksLabel: current.durationWeeks
        ? (language === "fa" ? `${formatNumber(current.durationWeeks, language)} هفته` : `${current.durationWeeks} weeks`)
        : (current.duration || (language === "fa" ? "ثبت نشده" : "Not added")),
      studentsLabel: formatNumber(current.students, language),
      scheduleSummary: getScheduleSummary(schedule, language),
    };
  }, [language, normalizedCourse]);

  if (!open || !normalizedCourse) return null;

  const progressValue = Math.max(0, Math.min(100, Number(normalizedCourse.progress || 0)));
  const minimumStudentsStatus = normalizedCourse.minimumStudentsReached
    ? (language === "fa" ? "حداقل شاگرد تکمیل شده" : "Minimum reached")
    : (language === "fa" ? "هنوز به حداقل شاگرد نرسیده" : "Minimum not reached yet");
  const meetingLinkLabel = normalizedCourse.meetingLink
    ? (language === "fa" ? "لینک جلسه آماده است" : "Session link is ready")
    : (language === "fa" ? "هنوز لینک جلسه ثبت نشده" : "Session link not added yet");
  const cancellationStatus = String(normalizedCourse.cancellationRequest?.status || "none").toLowerCase();
  const hasCancellationData =
    cancellationStatus !== "none" ||
    normalizedCourse.cancellationRequest?.reason ||
    normalizedCourse.cancellationRequest?.adminResponse;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0F172A]/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-slate-50 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]"
        dir={isRTL ? "rtl" : "ltr"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-4 sm:px-6">
          <div className={`min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0B4FD8]">
              {language === "fa" ? "جزئیات کورس" : "Course details"}
            </p>
            <h3 className="mt-2 text-lg font-black leading-8 text-[#0F172A] sm:text-2xl">
              {normalizedCourse.title}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge course={normalizedCourse} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {derived.levelLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {derived.courseTypeLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={language === "fa" ? "بستن" : "Close"}
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [direction:ltr]">
          <div dir={isRTL ? "rtl" : "ltr"} className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-[#0B4FD8]/15 bg-[#0B4FD8]/5 px-4 py-3 text-sm font-bold text-[#0B4FD8]">
                <Loader2 size={16} className="animate-spin" />
                <span>{language === "fa" ? "در حال بارگذاری جزئیات کامل کورس" : "Loading full course details"}</span>
              </div>
            ) : null}

            <section className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm">
              <div className="grid gap-0 xl:grid-cols-[260px_minmax(0,1.08fr)_minmax(320px,0.92fr)]">
                <div className="h-56 bg-slate-100 xl:h-full">
                  <img
                    src={normalizedCourse.thumbnailUrl || COURSE_IMAGE_FALLBACK}
                    alt={normalizedCourse.title || "Course"}
                    className={`h-full w-full ${normalizedCourse.thumbnailUrl ? "bg-slate-50 object-contain" : "object-contain p-8"}`}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = COURSE_IMAGE_FALLBACK;
                      event.currentTarget.className = "h-full w-full object-contain p-8";
                    }}
                  />
                </div>

                <div className="space-y-5 border-t border-[#E2E8F0] p-4 sm:p-5 xl:border-s xl:border-t-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoTile
                      icon={Users}
                      label={language === "fa" ? "شاگردان فعلی" : "Current students"}
                      value={derived.studentsLabel}
                      hint={minimumStudentsStatus}
                      accent={normalizedCourse.minimumStudentsReached ? "emerald" : "amber"}
                    />
                    <InfoTile
                      icon={Wallet}
                      label={language === "fa" ? "مبلغ دریافتی مدرس" : "Teacher payout"}
                      value={derived.teacherReceiveLabel}
                      hint={language === "fa" ? "پس از کسر سهم پلتفرم" : "After platform deduction"}
                      accent="emerald"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-slate-500">
                        {language === "fa" ? "پیشرفت کورس" : "Course progress"}
                      </p>
                      <span className="text-sm font-black text-slate-900" dir="ltr">
                        {normalizedCourse.progressLabel || formatProgressLabel(progressValue, language)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9]"
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-600 [overflow-wrap:anywhere]">
                    {derived.description}
                  </p>
                </div>

                <div className="border-t border-[#E2E8F0] bg-slate-50/80 p-4 sm:p-5 xl:border-s xl:border-t-0">
                  <div className="mb-4">
                    <h4 className="text-base font-black text-slate-950">
                      {language === "fa" ? "خلاصه اجرایی" : "Operational overview"}
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                      {language === "fa"
                        ? "خلاصه مهم مدیریتی برای پیگیری روزانه این کورس."
                        : "Key operational details for managing this course."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-2 shadow-sm">
                    <KeyValueRow label={language === "fa" ? "ایجاد شده" : "Created"} value={formatDate(normalizedCourse.createdAt, language)} />
                    <KeyValueRow
                      label={language === "fa" ? "شروع به وقت کورس" : "Start in course time"}
                      value={formatDateTimeInZone(
                        normalizedCourse.startDate,
                        normalizedCourse.timezone || "Asia/Kabul",
                        language,
                      )}
                    />
                    <KeyValueRow
                      label={language === "fa" ? "شروع به وقت محل شما" : "Start in your local time"}
                      value={formatDateTimeInZone(
                        normalizedCourse.startDate,
                        getBrowserTimeZone(),
                        language,
                      )}
                    />
                    <KeyValueRow label={language === "fa" ? "تاریخ پایان" : "End date"} value={formatDate(normalizedCourse.endDate, language, true)} />
                    <KeyValueRow label={language === "fa" ? "شروع واقعی صنف" : "Class started"} value={formatDate(normalizedCourse.classStartedAt, language, true)} />
                    <KeyValueRow label={language === "fa" ? "پایان واقعی صنف" : "Class ended"} value={formatDate(normalizedCourse.classEndedAt, language, true)} />
                    <KeyValueRow label={language === "fa" ? "لغو صنف" : "Class cancelled"} value={formatDate(normalizedCourse.classCancelledAt, language, true)} />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <InfoTile icon={GraduationCap} label={language === "fa" ? "حداکثر شاگرد" : "Max students"} value={derived.maxStudentsLabel} accent="teal" />
                  <InfoTile icon={Users} label={language === "fa" ? "حداقل شروع صنف" : "Minimum to start"} value={derived.minStudentsLabel} hint={minimumStudentsStatus} accent={normalizedCourse.minimumStudentsReached ? "emerald" : "amber"} />
                  <InfoTile icon={Layers3} label={language === "fa" ? "تعداد جلسات" : "Total sessions"} value={derived.totalSessionsLabel} accent="blue" />
                  <InfoTile icon={CalendarDays} label={language === "fa" ? "مدت کورس" : "Course duration"} value={derived.durationWeeksLabel} accent="teal" />
                  <InfoTile icon={Tag} label={language === "fa" ? "روش پرداخت" : "Payment plan"} value={derived.paymentPlanLabel} accent="amber" />
                  <InfoTile icon={PlayCircle} label={language === "fa" ? "نوع برگزاری" : "Delivery type"} value={derived.meetingTypeLabel} hint={meetingLinkLabel} accent={normalizedCourse.meetingLink ? "emerald" : "blue"} />
                </div>

                <SectionCard
                  title={language === "fa" ? "لینک‌های پیش‌نمایش" : "Preview links"}
                  subtitle={language === "fa" ? "برای بررسی و به‌روزرسانی محتوای معرفی کورس." : "Use these to review or update the course teaser content."}
                  icon={LinkIcon}
                  tone="teal"
                >
                  <PreviewLinks links={derived.previewLinks} language={language} />
                </SectionCard>

                {hasCancellationData ? (
                  <SectionCard
                    title={language === "fa" ? "وضعیت درخواست لغو" : "Cancellation request"}
                    subtitle={language === "fa" ? "اگر برای این صنف درخواست لغو ثبت شده باشد، جزئیات آن اینجاست." : "Details of any cancellation workflow for this course."}
                    icon={Clock3}
                    tone={cancellationStatus === "pending" ? "amber" : "blue"}
                  >
                    <div className="rounded-2xl bg-slate-50 px-4 py-2">
                      <KeyValueRow label={language === "fa" ? "وضعیت" : "Status"} value={normalizedCourse.cancellationRequest?.status || (language === "fa" ? "ندارد" : "None")} valueClassName="capitalize" />
                      <KeyValueRow label={language === "fa" ? "دلیل مدرس" : "Teacher reason"} value={normalizedCourse.cancellationRequest?.reason || (language === "fa" ? "ثبت نشده" : "Not added")} />
                      <KeyValueRow label={language === "fa" ? "پاسخ مدیر" : "Admin response"} value={normalizedCourse.cancellationRequest?.adminResponse || (language === "fa" ? "ثبت نشده" : "Not added")} />
                      <KeyValueRow label={language === "fa" ? "زمان درخواست" : "Requested at"} value={formatDate(normalizedCourse.cancellationRequest?.requestedAt, language, true)} />
                    </div>
                  </SectionCard>
                ) : null}
              </div>

              <div className="space-y-4">
                <SectionCard
                  title={language === "fa" ? "زمان‌بندی صنف" : "Class schedule"}
                  subtitle={derived.scheduleSummary}
                  icon={CalendarDays}
                  tone="teal"
                >
                  <ScheduleRows schedule={derived.schedule} language={language} />
                </SectionCard>

                <SectionCard
                  title={language === "fa" ? "تنظیمات برگزاری" : "Delivery settings"}
                  subtitle={language === "fa" ? "برای آماده‌سازی جلسه و هماهنگی با شاگردان." : "Useful for preparing sessions and coordinating with students."}
                  icon={Clock3}
                  tone="blue"
                >
                  <div className="rounded-2xl bg-slate-50 px-4 py-2">
                    <KeyValueRow label={language === "fa" ? "دسته‌بندی" : "Category"} value={normalizedCourse.categoryPathLabel || normalizedCourse.category || (language === "fa" ? "ثبت نشده" : "Not added")} />
                    <KeyValueRow label={language === "fa" ? "زبان کورس" : "Course language"} value={derived.languageLabel} />
                    <KeyValueRow label={language === "fa" ? "نوع کورس" : "Course type"} value={derived.courseTypeLabel} />
                    <KeyValueRow label={language === "fa" ? "مدل برگزاری" : "Meeting type"} value={derived.meetingTypeLabel} />
                    <KeyValueRow
                      label={language === "fa" ? "لینک جلسه" : "Meeting link"}
                      value={
                        normalizedCourse.meetingLink ? (
                          <a
                            href={normalizedCourse.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-[#0B4FD8] hover:underline"
                          >
                            <span className="truncate">{normalizedCourse.meetingLink}</span>
                            <ExternalLink size={14} />
                          </a>
                        ) : meetingLinkLabel
                      }
                      dir={normalizedCourse.meetingLink ? "ltr" : "rtl"}
                      valueClassName={!normalizedCourse.meetingLink ? "text-slate-600" : ""}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title={language === "fa" ? "خلاصه مالی" : "Pricing overview"}
                  subtitle={language === "fa" ? "برای بررسی مبلغ نمایش‌داده‌شده به شاگرد و دریافتی مدرس." : "Review what students pay and what the teacher receives."}
                  icon={Wallet}
                  tone="amber"
                >
                  <div className="rounded-2xl bg-slate-50 px-4 py-2">
                    <KeyValueRow label={language === "fa" ? "قیمت پایه" : "Base price"} value={derived.priceLabel} />
                    <KeyValueRow label={language === "fa" ? "تخفیف مدرس" : "Teacher discount"} value={derived.teacherDiscountLabel} dir="ltr" />
                    <KeyValueRow label={language === "fa" ? "قیمت بعد از تخفیف مدرس" : "Teacher effective price"} value={derived.teacherPriceLabel} />
                    <KeyValueRow label={language === "fa" ? "تخفیف عمومی پلتفرم" : "Global platform discount"} value={derived.discountLabel} dir="ltr" />
                    <KeyValueRow label={language === "fa" ? "قیمت نهایی برای شاگرد" : "Final student price"} value={derived.finalPriceLabel} />
                    <KeyValueRow label={language === "fa" ? "دریافتی مدرس" : "Teacher payout"} value={derived.teacherReceiveLabel} />
                    <KeyValueRow label={language === "fa" ? "روش پرداخت" : "Payment plan"} value={derived.paymentPlanLabel} />
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 gap-2 border-t border-[#E2E8F0] bg-white p-4 sm:grid-cols-2 sm:p-5">
          <button
            type="button"
            onClick={onManageStudents}
            disabled={isEndedCourse}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
              isEndedCourse
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-[#E2E8F0] bg-white text-slate-700 hover:border-[#0B4FD8] hover:bg-[#0B4FD8]/5 hover:text-[#0B4FD8]"
            }`}
          >
            <Users size={16} />
            {language === "fa" ? "مدیریت شاگردان" : "Manage students"}
          </button>
          <button
            type="button"
            onClick={onManageContent}
            disabled={isEndedCourse}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black shadow-sm transition ${
              isEndedCourse
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-gradient-to-l from-[#0B4FD8] to-[#00B8A9] text-white hover:opacity-95"
            }`}
          >
            <FolderOpen size={16} />
            {language === "fa" ? "مدیریت محتوا" : "Manage content"}
          </button>
        </div>
      </div>
    </div>
  );
}
