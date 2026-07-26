import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  Globe2,
  Landmark,
  Percent,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { getToken } from "../../services/portal.js";
import { buildAuthHeaders, getApiBase, parseJsonResponse } from "../../services/http.js";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";
import useLatestRequest from "../hooks/useLatestRequest.js";
import {
  clearAdminPageCache,
  getAdminPageCacheKey,
  readAdminPageCache,
  writeAdminPageCache,
} from "../utils/adminPageCache.js";
import {
  formatDisplayCurrencyAmount,
  getDisplayCurrency,
  getDisplayCurrencyAmount,
  replaceIranRialTextForDisplay,
} from "../utils/currencyDisplay.js";

const ADMIN_TEACHER_INCOME_TEXT = {
  "Teacher payout details": "جزئیات تسویه مدرس",
  Sales: "فروش",
  Revenue: "درآمد",
  "Platform cut": "سهم سیستم",
  "Teacher share": "سهم مدرس",
  "Direct collection": "دریافت مستقیم",
  "Platform deduction": "کسر سیستم",
  "Direct to teacher": "واریز مستقیم به مدرس",
  "No payment details were returned for this payout row.": "برای این ردیف تسویه، جزئیات پرداختی برنگشت.",
  Student: "شاگرد",
  "Payment method": "روش پرداخت",
  Market: "بازار",
  "Charged amount": "مبلغ دریافت‌شده",
  "Base revenue": "درآمد پایه",
  "Rate / snapshot": "رخ / اسنپ‌شات",
  Reference: "مرجع",
  "Paid at": "تاریخ پرداخت",
  Paid: "پرداخت‌شده",
  Unpaid: "پرداخت‌نشده",
  Plan: "پلن",
  Monthly: "ماهانه",
  "Whole period": "تمام دوره",
  "Payment details": "جزئیات پرداخت",
  "No data": "بدون داده",
  "Teacher payout control": "کنترل تسویه مدرسان",
  "Track payout rows, course income, payment channels, and payment-day exchange snapshots exactly as teachers see them.":
    "ردیف‌های تسویه، درآمد کورس، روش‌های پرداخت و نرخ روز پرداخت را دقیقاً همان‌طور که مدرس می‌بیند دنبال کنید.",
  "Settled teacher payouts": "تسویه‌های انجام‌شده مدرسان",
  "Teacher amount already marked as paid": "مبلغی که برای مدرس پرداخت‌شده ثبت شده است",
  "Awaiting payout": "در انتظار تسویه",
  "Teacher amount still pending settlement": "مبلغی که هنوز برای مدرس تسویه نشده است",
  Platform: "سیستم",
  "paid cycles": "دوره پرداخت‌شده",
  "waiting cycles": "دوره در انتظار",
  "All payout rows in current dataset": "مجموع همه ردیف‌های تسویه در داده فعلی",
  "Total teacher amount across all rows": "مجموع سهم مدرس در همه ردیف‌ها",
  "Platform commission": "کمیسیون سیستم",
  "Platform amount across all rows": "مجموع سهم سیستم در همه ردیف‌ها",
  "Visible rows": "ردیف‌های قابل نمایش",
  "Filtered payout rows on this page": "ردیف‌های فیلترشده در این صفحه",
  "Courses in report": "کورس‌های گزارش",
  "Teachers in report": "مدرسان در گزارش",
  "Top payment method": "روش پرداخت غالب",
  "Top market": "بازار غالب",
  "Settled teacher share": "سهم تسویه‌شده مدرس",
  "Amount already released to teachers": "مبلغی که قبلاً به مدرسان پرداخت شده است",
  "Pending teacher share": "سهم در انتظار مدرس",
  "Amount still waiting for payout": "مبلغی که هنوز در انتظار پرداخت است",
  "Settled sales": "فروش‌های تسویه‌شده",
  "Successful enrollments inside paid payout cycles": "ثبت‌نام‌های موفق در دوره‌های تسویه‌شده",
  "Pending sales": "فروش‌های در انتظار",
  "Successful enrollments inside unpaid payout cycles": "ثبت‌نام‌های موفق در دوره‌های تسویه‌نشده",
  "Direct bank collections": "دریافت مستقیم بانکی",
  "Money collected directly by teachers from students": "مبلغی که مستقیماً توسط مدرس از شاگرد دریافت شده است",
  "Platform deduction due": "سهم قابل‌کسر سیستم",
  "Platform amount still owed from direct bank payments": "مبلغی که از پرداخت‌های بانکی مستقیم باید به سیستم پرداخت شود",
  "Filter payout report": "فیلتر گزارش تسویه",
  "Filter by month, teacher, course, settlement status, or search by teacher/course name.":
    "بر اساس ماه، مدرس، کورس، وضعیت تسویه یا نام مدرس و کورس فیلتر کنید.",
  "active filters": "فیلتر فعال",
  Reset: "بازنشانی",
  "Month / Period": "ماه / بازه",
  "All months": "همه ماه‌ها",
  Teacher: "مدرس",
  "All teachers": "همه مدرسان",
  Course: "کورس",
  "All courses": "همه کورس‌ها",
  "Payment plan": "پلن پرداخت",
  "All payment plans": "همه پلن‌های پرداخت",
  "Payout status": "وضعیت تسویه",
  "All payout statuses": "همه وضعیت‌های تسویه",
  Search: "جستجو",
  "Search teacher or course": "جستجوی مدرس یا کورس",
  "Teacher payout rows": "ردیف‌های تسویه مدرس",
  "Admin payout rows are aligned with the teacher income page, including exact payment-day exchange snapshots inside details.":
    "ردیف‌های تسویه ادمین با صفحه درآمد مدرس هماهنگ هستند و جزئیات نرخ دقیق روز پرداخت را هم نشان می‌دهند.",
  "rows on this page": "ردیف در این صفحه",
  "Showing demo payout data so you can preview the system layout.":
    "برای پیش‌نمایش ساختار سیستم، داده نمونه نمایش داده می‌شود.",
  "No teacher income rows found.": "هیچ ردیف درآمد مدرس پیدا نشد.",
  Status: "وضعیت",
  Details: "جزئیات",
  Previous: "قبلی",
  Page: "صفحه",
  of: "از",
  Next: "بعدی",
  Afghanistan: "افغانستان",
  Iran: "ایران",
  International: "بین‌المللی",
  Bank: "بانک",
  "Crypto Gateway": "درگاه کریپتو",
  "Visa / MasterCard": "ویزا / مسترکارت",
  "HesabPay (Visa / MasterCard)": "حساب‌پی (ویزا / مسترکارت)",
};

const translateTeacherIncomeText = (text, language) => {
  if (language !== "fa") return text;
  return ADMIN_TEACHER_INCOME_TEXT[text] || text;
};

const formatMoney = (amount, language = "en") => {
  const value = Number(amount || 0);
  const isFa = language === "fa";
  return `${new Intl.NumberFormat(isFa ? "fa-AF" : "en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} ${isFa ? "دالر" : "USD"}`;
};

const formatGatewayAmount = (amount, currency, language = "en") => {
  return formatDisplayCurrencyAmount(amount, currency, language, {
    maximumFractionDigits: String(currency || "").toUpperCase() === "USDT" ? 6 : 2,
  });
};

const formatSourcePrice = (item = {}, language = "en") => {
  if (item.sourcePriceAmount === null || item.sourcePriceAmount === undefined) {
    return "";
  }
  return formatDisplayCurrencyAmount(
    item.sourcePriceAmount,
    item.sourcePriceCurrency || "USD",
    language,
  );
};

const formatDate = (value, language = "en") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(language === "fa" ? "fa-AF" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatPaymentPlanLabel = (paymentPlan = "", tr) => {
  const normalized = String(paymentPlan || "").toLowerCase();
  if (normalized === "whole_period") return tr("Whole period");
  return tr("Monthly");
};

const payoutStatusStyles = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  unpaid: "border-amber-200 bg-amber-50 text-amber-700",
};

const ADMIN_TEACHER_INCOME_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_TEACHER_INCOME_PAGE_SIZE = 30;

const getAdminTeacherIncomeCacheKey = ({
  page,
  month,
  teacherId,
  courseId,
  paymentPlan,
  payoutStatus,
  search,
}) =>
  getAdminPageCacheKey("teacher-income", {
    page,
    month,
    teacherId,
    courseId,
    paymentPlan,
    payoutStatus,
    search,
  });

const normalizeOptions = (options = {}) => ({
  availableMonths: Array.isArray(options.availableMonths) ? options.availableMonths : [],
  availableTeachers: Array.isArray(options.availableTeachers) ? options.availableTeachers : [],
  availableCourses: Array.isArray(options.availableCourses) ? options.availableCourses : [],
});

const normalizeSummary = (payload = {}) => ({
  reportCurrency: payload.reportCurrency || "USD",
  totalRevenue: Number(payload.totalRevenue || 0),
  platformCommission: Number(payload.platformCommission || 0),
  teacherEarnings: Number(payload.teacherEarnings || 0),
  teacherPayoutTotal: Number(payload.teacherPayoutTotal || 0),
  teacherPayoutDue: Number(payload.teacherPayoutDue || 0),
  settledTeacherPayout: Number(payload.settledTeacherPayout || 0),
  directToTeacherAmount: Number(payload.directToTeacherAmount || 0),
  platformDeductionDue: Number(payload.platformDeductionDue || 0),
  externalCollectedRevenue: Number(payload.externalCollectedRevenue || 0),
  paymentsCount: Number(payload.paymentsCount || 0),
  teachersCount: Number(payload.teachersCount || 0),
  coursesCount: Number(payload.coursesCount || 0),
  settledPaymentsCount: Number(payload.settledPaymentsCount || 0),
  outstandingPaymentsCount: Number(payload.outstandingPaymentsCount || 0),
  paidRowsCount: Number(payload.paidRowsCount || 0),
  unpaidRowsCount: Number(payload.unpaidRowsCount || 0),
  commissionRate: Number(payload.commissionRate || 15),
  currentCommissionRate: Number(payload.currentCommissionRate || payload.commissionRate || 15),
  commissionRatesUsed: Array.isArray(payload.commissionRatesUsed)
    ? payload.commissionRatesUsed
    : [],
  paymentMethodBreakdown: Array.isArray(payload.paymentMethodBreakdown)
    ? payload.paymentMethodBreakdown
    : [],
  regionBreakdown: Array.isArray(payload.regionBreakdown)
    ? payload.regionBreakdown
    : [],
  reconciliation: {
    expectedTeacherEarnings: Number(payload?.reconciliation?.expectedTeacherEarnings || 0),
    actualTeacherEarnings: Number(payload?.reconciliation?.actualTeacherEarnings || 0),
    difference: Number(payload?.reconciliation?.difference || 0),
    isBalanced: payload?.reconciliation?.isBalanced !== false,
  },
  moneyFlow: {
    directCount: Number(payload?.moneyFlow?.directCount || 0),
    directAmount: Number(payload?.moneyFlow?.directAmount || 0),
    deductionDue: Number(payload?.moneyFlow?.deductionDue || 0),
    platformCount: Number(payload?.moneyFlow?.platformCount || 0),
    platformRevenue: Number(payload?.moneyFlow?.platformRevenue || 0),
    platformTeacherShare: Number(payload?.moneyFlow?.platformTeacherShare || 0),
  },
  generatedAt: payload.generatedAt || null,
});

const normalizeMeta = (meta = {}) => ({
  page: Number(meta.page || 1),
  totalPages: Number(meta.totalPages || 1),
  total: Number(meta.total || 0),
});

const getSnapshotLabel = (item = {}) => {
  const baseRevenue = Number(item?.baseRevenue || item?.totalRevenue || 0);
  const gatewayAmount = Number(item?.gatewayAmount || 0);
  const gatewayCurrency = String(item?.gatewayCurrency || "").toUpperCase();

  if (baseRevenue > 0 && gatewayAmount > 0 && gatewayCurrency) {
    const displayAmount = getDisplayCurrencyAmount(gatewayAmount, gatewayCurrency);
    const displayCurrency = getDisplayCurrency(gatewayCurrency);
    if (gatewayCurrency === "USD" || gatewayCurrency === "USDT") {
      return `${baseRevenue} USD -> ${displayAmount} ${displayCurrency}`;
    }
    const computedRate = Math.round((displayAmount / baseRevenue) * 1000000) / 1000000;
    return `${baseRevenue} USD -> ${displayAmount} ${displayCurrency} (1 USD = ${computedRate} ${displayCurrency})`;
  }

  return replaceIranRialTextForDisplay(item?.pricingSnapshotLabel) || "-";
};

function SummaryCard({ icon: Icon, title, value, note, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone] || "bg-blue-50 text-blue-700";

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{note}</p>
    </article>
  );
}

function InsightCard({ icon: Icon, title, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900">{value}</p>
        </div>
      </div>
    </article>
  );
}

function BreakdownCard({ title, subtitle, rows, labelKey, language }) {
  const highestRevenue = Math.max(
    1,
    ...(Array.isArray(rows) ? rows : []).map((row) => Number(row.totalRevenue || 0)),
  );

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{subtitle}</p>
      </div>
      <div className="mt-4 space-y-4">
        {rows.length ? (
          rows.map((row) => {
            const revenue = Number(row.totalRevenue || 0);
            const width = Math.max(4, Math.round((revenue / highestRevenue) * 100));
            const rowKey = row.methodKey || row.regionKey || row[labelKey];
            return (
              <div key={rowKey}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">
                      {row[labelKey] || (language === "fa" ? "نامشخص" : "Unknown")}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {Number(row.paymentsCount || 0).toLocaleString()}{" "}
                      {language === "fa" ? "پرداخت" : "payments"}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-black text-slate-900">
                      {formatMoney(revenue, language)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                      {language === "fa" ? "سهم مدرس" : "Teacher"}:{" "}
                      {formatMoney(row.teacherEarnings, language)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState label={language === "fa" ? "داده‌ای موجود نیست" : "No data available"} />
        )}
      </div>
    </article>
  );
}

function FilterField({ label, value, onChange, children }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
      >
        {children}
      </select>
    </label>
  );
}

function SectionCard({ title, subtitle, children, actions = null }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function PayoutHealthCard({ title, value, note, tone = "blue" }) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  }[tone] || "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold opacity-80">{note}</p>
    </div>
  );
}

function MoneyFlowCard({ title, value, note, accent = "blue", bullets = [] }) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50/70 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    amber: "border-amber-200 bg-amber-50/80 text-amber-800",
  }[accent] || "border-blue-200 bg-blue-50/70 text-blue-800";

  return (
    <article className={`rounded-[24px] border p-5 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{title}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-3 text-sm font-semibold leading-6 opacity-90">{note}</p>
      {bullets.length ? (
        <div className="mt-4 space-y-2">
          {bullets.map((item) => (
            <div key={item} className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PaymentSourcePill({ isExternalCollection, tr }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${
        isExternalCollection
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isExternalCollection ? tr("Direct to teacher") : tr("Platform cut")}
    </span>
  );
}

function getPaymentMethodVisual(methodCode = "", methodLabel = "", tr) {
  const normalized = String(methodCode || methodLabel || "").trim().toLowerCase();

  if (normalized.includes("bank")) {
    return {
      icon: Landmark,
      label: tr("Bank"),
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (normalized.includes("usdt") || normalized.includes("crypto") || normalized.includes("nowpayments")) {
    return {
      icon: Wallet,
      label: tr("Crypto Gateway"),
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    icon: CreditCard,
    label: tr("Visa / MasterCard"),
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function PaymentMethodPill({ methodCode, methodLabel, tr }) {
  const visual = getPaymentMethodVisual(methodCode, methodLabel, tr);
  const Icon = visual.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${visual.className}`}>
      <Icon size={12} />
      {visual.label}
    </span>
  );
}

function PaymentDetailsModal({ row, onClose, tr, language }) {
  if (!row) return null;

  const paymentDetails = Array.isArray(row.paymentDetails) ? row.paymentDetails : [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">{tr("Teacher payout details")}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{row.courseTitle}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {row.teacherName} • {row.monthKey} • {row.periodLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-white px-5 py-4 md:grid-cols-6">
          <MiniValue label={tr("Sales")} value={String(row.salesCount || 0)} />
          <MiniValue label={tr("Revenue")} value={formatMoney(row.totalRevenue, language)} />
          <MiniValue label={tr("Platform cut")} value={formatMoney(row.platformCommission, language)} />
          <MiniValue label={tr("Teacher share")} value={formatMoney(row.teacherEarnings, language)} emphasize />
          <MiniValue label={tr("Direct collection")} value={formatMoney(row.directToTeacherAmount, language)} />
          <MiniValue label={tr("Platform deduction")} value={formatMoney(row.platformDeductionDue, language)} />
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              {language === "fa" ? "پرداخت‌های پلتفرمی" : "Platform-settled payments"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {language === "fa"
                ? "در این پرداخت‌ها، پول اول داخل سیستم آمده و بعد سهم مدرس از طریق تسویه پرداخت می‌شود."
                : "In these payments, money reached the platform first and the teacher share is paid out through settlement."}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">
              {language === "fa" ? "پرداخت‌های مستقیم به مدرس" : "Direct-to-teacher payments"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {language === "fa"
                ? "در این پرداخت‌ها، پول نزد مدرس مانده و فقط سهم سیستم باید بعداً از او گرفته شود."
                : "In these payments, the money stays with the teacher and only the platform deduction is still owed later."}
            </p>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {paymentDetails.length === 0 ? (
            <div className="p-5">
              <EmptyState label={tr("No payment details were returned for this payout row.")} />
            </div>
          ) : (
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">{tr("Student")}</th>
                  <th className="px-4 py-3 font-black">{tr("Payment method")}</th>
                  <th className="px-4 py-3 font-black">{tr("Market")}</th>
                  <th className="px-4 py-3 font-black">{tr("Charged amount")}</th>
                  <th className="px-4 py-3 font-black">{tr("Base revenue")}</th>
                  <th className="px-4 py-3 font-black">{tr("Teacher share")}</th>
                  <th className="px-4 py-3 font-black">{tr("Direct collection")}</th>
                  <th className="px-4 py-3 font-black">{tr("Platform deduction")}</th>
                  <th className="px-4 py-3 font-black">{tr("Rate / snapshot")}</th>
                  <th className="px-4 py-3 font-black">{tr("Reference")}</th>
                  <th className="px-4 py-3 font-black">{tr("Paid at")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentDetails.map((item) => (
                  <tr key={item.paymentId || item.paymentReference || item.transactionId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{item.studentName || "-"}</p>
                      <p className="text-xs font-semibold text-slate-500">{item.studentEmail || "-"}</p>
                      <div className="mt-2">
                        <PaymentSourcePill isExternalCollection={Boolean(item.isExternalCollection)} tr={tr} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-700">{item.paymentMethod || "-"}</p>
                        <PaymentMethodPill methodCode={item.paymentMethodCode} methodLabel={item.paymentMethod} tr={tr} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                          {item.regionLabel || "-"}
                        </span>
                        {formatSourcePrice(item, "en") ? (
                          <p className="mt-1 text-[10px] font-bold text-slate-500" dir="ltr">
                            {formatSourcePrice(item, "en")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatGatewayAmount(item.gatewayAmount, item.gatewayCurrency, language)}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{formatMoney(item.baseRevenue, language)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700">{formatMoney(item.teacherEarnings, language)}</td>
                    <td className="px-4 py-3 font-black text-amber-700">{formatMoney(item.directToTeacherAmount, language)}</td>
                    <td className="px-4 py-3 font-black text-blue-700">{formatMoney(item.platformDeductionDue, language)}</td>
                    <td className="max-w-[320px] px-4 py-3 text-xs font-semibold leading-6 text-slate-600">{getSnapshotLabel(item)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{item.paymentReference || "-"}</p>
                      <p className="text-xs text-slate-500">{item.transactionId || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDate(item.paidAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniValue({ label, value, emphasize = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-lg font-black ${emphasize ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function MobilePayoutCard({
  row,
  tr,
  language,
  savingKey,
  onStatusChange,
  onOpenDetails,
}) {
  const rowKey = `${row.teacherId}:${row.courseId}:${row.monthKey}`;
  const isSaving = savingKey === rowKey;
  const statusClass = payoutStatusStyles[row.status] || payoutStatusStyles.unpaid;

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-slate-950">{row.teacherName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{row.teacherEmail || "-"}</p>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>
          {row.status === "paid" ? tr("Paid") : tr("Unpaid")}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="font-black text-slate-900">{row.courseTitle}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {row.monthKey} • {row.periodLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <PaymentMethodPill
            methodCode={row.paymentDetails?.[0]?.paymentMethodCode}
            methodLabel={row.paymentDetails?.[0]?.paymentMethod}
            tr={tr}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniValue label={tr("Plan")} value={formatPaymentPlanLabel(row.paymentPlan, tr)} />
        <MiniValue label={tr("Sales")} value={String(row.salesCount || 0)} />
        <MiniValue label={tr("Revenue")} value={formatMoney(row.totalRevenue, language)} />
        <MiniValue label={tr("Teacher share")} value={formatMoney(row.teacherEarnings, language)} emphasize />
        <MiniValue label={tr("Direct collection")} value={formatMoney(row.directToTeacherAmount, language)} />
        <MiniValue label={tr("Platform deduction")} value={formatMoney(row.platformDeductionDue, language)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <PaymentSourcePill isExternalCollection={Number(row.directToTeacherAmount || 0) > 0} tr={tr} />
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">
          {Number(row.directToTeacherAmount || 0) > 0
            ? (language === "fa" ? "این ردیف شامل پول مستقیم نزد مدرس است" : "This row includes teacher-held direct money")
            : (language === "fa" ? "این ردیف از تسویه‌های داخلی پلتفرم است" : "This row comes from platform-settled payments")}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative min-w-[120px]">
          <select
            value={row.status}
            onChange={(event) => onStatusChange(row, event.target.value)}
            disabled={isSaving}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-black text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
          >
            <option value="unpaid">{tr("Unpaid")}</option>
            <option value="paid">{tr("Paid")}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          type="button"
          onClick={() => onOpenDetails(row)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
        >
          <Eye size={14} />
          {tr("Payment details")}
        </button>

        {isSaving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        ) : null}
      </div>

      {row.paidAt ? (
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {tr("Paid at")}: {formatDate(row.paidAt, language)}
        </p>
      ) : null}
    </article>
  );
}

export default function AdminTeacherIncomePage() {
  const { t, tr, language, isRTL } = useAdminI18n();
  const pageTr = (text) => translateTeacherIncomeText(tr(text), language);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(normalizeSummary());
  const [meta, setMeta] = useState(normalizeMeta());
  const [filters, setFilters] = useState({
    month: "",
    teacherId: "",
    courseId: "",
    paymentPlan: "",
    payoutStatus: "",
    search: "",
  });
  const [options, setOptions] = useState(normalizeOptions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [savingKey, setSavingKey] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const token = useMemo(() => getToken(), []);
  const incomeRequest = useLatestRequest();

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      const cacheKey = getAdminTeacherIncomeCacheKey({
        page,
        month: filters.month,
        teacherId: filters.teacherId,
        courseId: filters.courseId,
        paymentPlan: filters.paymentPlan,
        payoutStatus: filters.payoutStatus,
        search: filters.search,
      });

      const cached = readAdminPageCache(cacheKey, {
        maxAgeMs: ADMIN_TEACHER_INCOME_CACHE_TTL_MS,
      });

      if (cached) {
        setRows(Array.isArray(cached.rows) ? cached.rows : []);
        setSummary(normalizeSummary(cached.summary));
        setOptions(normalizeOptions(cached.options));
        setMeta(normalizeMeta(cached.meta));
        setLoading(false);
        setError("");
        return;
      } else {
        setLoading(true);
        setError("");
      }

      await incomeRequest.runLatest(
        async () => {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(ADMIN_TEACHER_INCOME_PAGE_SIZE),
          });
          if (filters.month) params.set("month", filters.month);
          if (filters.teacherId) params.set("teacherId", filters.teacherId);
          if (filters.courseId) params.set("courseId", filters.courseId);
          if (filters.paymentPlan) params.set("paymentPlan", filters.paymentPlan);
          if (filters.payoutStatus) params.set("payoutStatus", filters.payoutStatus);
          if (filters.search.trim()) params.set("search", filters.search.trim());

          const response = await fetch(`${getApiBase()}/admin/teacher-income?${params.toString()}`, {
            headers: buildAuthHeaders(),
          });
          const data = await parseJsonResponse(response);
          if (data?.success === false) {
            throw new Error(data?.message || "Failed to load teacher income");
          }
          return data;
        },
        {
          onSuccess: (data) => {
            const nextRows = Array.isArray(data?.settlementRows)
              ? data.settlementRows
              : [];
            const nextSummary = normalizeSummary(data);
            const nextOptions = normalizeOptions(data);
            const nextMeta = normalizeMeta(data?.meta);

            setRows(nextRows);
            setSummary(nextSummary);
            setOptions(nextOptions);
            setMeta(nextMeta);
            setError("");

            writeAdminPageCache(cacheKey, {
              rows: nextRows,
              summary: nextSummary,
              options: nextOptions,
              meta: nextMeta,
            });
          },
          onError: (err) => {
            setRows([]);
            setSummary(normalizeSummary());
            setMeta(normalizeMeta());
            setError(err.message || "Failed to load teacher income");
          },
          onFinally: () => {
            setLoading(false);
          },
        },
      );
    };

    run();
  }, [
    filters.courseId,
    filters.month,
    filters.paymentPlan,
    filters.payoutStatus,
    filters.search,
    filters.teacherId,
    incomeRequest,
    page,
    refreshSeed,
    token,
  ]);

  const visibleRows = rows;

  const activeFilterCount = useMemo(
    () =>
      [filters.month, filters.teacherId, filters.courseId, filters.paymentPlan, filters.payoutStatus, filters.search.trim()]
        .filter(Boolean)
        .length,
    [filters.courseId, filters.month, filters.paymentPlan, filters.payoutStatus, filters.search, filters.teacherId],
  );

  const topPaymentMethod = pageTr(
    summary.paymentMethodBreakdown[0]?.methodLabel || "No data",
  );
  const topMarket = pageTr(
    summary.regionBreakdown[0]?.regionLabel || "No data",
  );

  const paymentSourceSummary = summary.moneyFlow;

  const handleStatusChange = async (row, nextStatus) => {
    if (!token) return;
    const key = `${row.teacherId}:${row.courseId}:${row.monthKey}`;
    setSavingKey(key);

    try {
      const response = await fetch(`${getApiBase()}/admin/teacher-income/status`, {
        method: "PATCH",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          teacherId: row.teacherId,
          courseId: row.courseId,
          monthKey: row.monthKey,
          cycleStartDay: row.cycleStartDay || 1,
          status: nextStatus,
          note: row.note || "",
        }),
      });
      const data = await parseJsonResponse(response);
      if (data?.success === false) {
        throw new Error(data?.message || "Failed to update payout status");
      }

      clearAdminPageCache("admin:teacher-income");
      setRefreshSeed((current) => current + 1);

      setRows((prev) =>
        prev.map((item) =>
          item.teacherId === row.teacherId &&
          item.courseId === row.courseId &&
          item.monthKey === row.monthKey
            ? {
                ...item,
                status: nextStatus,
                paidAt: nextStatus === "paid" ? new Date().toISOString() : null,
              }
            : item,
        ),
      );

      setSummary((prev) => {
        const currentStatus = row.status;
        if (currentStatus === nextStatus) return prev;
        return {
          ...prev,
          paidRowsCount:
            Number(prev.paidRowsCount || 0) +
            (nextStatus === "paid" ? 1 : 0) -
            (currentStatus === "paid" ? 1 : 0),
          unpaidRowsCount:
            Number(prev.unpaidRowsCount || 0) +
            (nextStatus === "unpaid" ? 1 : 0) -
            (currentStatus === "unpaid" ? 1 : 0),
        };
      });

      setSelectedRow((prev) => {
        if (!prev) return prev;
        if (
          prev.teacherId === row.teacherId &&
          prev.courseId === row.courseId &&
          prev.monthKey === row.monthKey
        ) {
          return {
            ...prev,
            status: nextStatus,
            paidAt: nextStatus === "paid" ? new Date().toISOString() : null,
          };
        }
        return prev;
      });
    } catch (err) {
      setError(err.message || "Failed to update payout status");
    } finally {
      setSavingKey("");
    }
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({
      month: "",
      teacherId: "",
      courseId: "",
      paymentPlan: "",
      payoutStatus: "",
      search: "",
    });
  };

  return (
    <section dir={isRTL ? "rtl" : "ltr"} className={`space-y-6 ${isRTL ? "text-right" : "text-left"}`}>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_40%),linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_48%,#F8FAFC_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-black text-blue-700">
              <Wallet size={14} />
              {pageTr("Teacher payout control")}
            </div>
            <h1 className="mt-4 text-3xl font-black text-slate-950">{t("pages.teacherIncome.title")}</h1>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
              {pageTr("Track payout rows, course income, payment channels, and payment-day exchange snapshots exactly as teachers see them.")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <SummaryCard
              icon={CheckCircle2}
              title={pageTr("Settled teacher payouts")}
              value={formatMoney(summary.settledTeacherPayout, language)}
              note={pageTr("Teacher amount already marked as paid")}
              tone="emerald"
            />
            <SummaryCard
              icon={Clock3}
              title={pageTr("Awaiting payout")}
              value={formatMoney(summary.teacherPayoutDue, language)}
              note={pageTr("Teacher amount still pending settlement")}
              tone="amber"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
            <Percent size={16} className="text-blue-700" />
            {pageTr("Teacher share")}: {Math.max(0, 100 - Number(summary.commissionRate || 0))}% • {pageTr("Platform")} {summary.commissionRate || 15}%
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
            <BadgeCheck size={16} className="text-emerald-600" />
            {summary.paidRowsCount || 0} {pageTr("paid cycles")}
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
            <Clock3 size={16} className="text-amber-600" />
            {summary.unpaidRowsCount || 0} {pageTr("waiting cycles")}
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 ${
          summary.reconciliation?.isBalanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black">
            {summary.reconciliation?.isBalanced
              ? language === "fa"
                ? "گزارش مالی با گزارش مدرس متوازن است"
                : "Financial report reconciled with the teacher view"
              : language === "fa"
                ? "اختلاف مالی نیاز به بررسی دارد"
                : "Financial difference requires review"}
          </p>
          <span className="text-xs font-bold" dir="ltr">
            {language === "fa" ? "اختلاف:" : "Difference:"}{" "}
            {formatMoney(summary.reconciliation?.difference, language)}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold leading-5">
          {language === "fa"
            ? "سهم مدرس = مجموع تسویه‌های پلتفرمی + دریافت مستقیم − سهم پلتفرم از پرداخت مستقیم"
            : "Teacher share = platform payout total + direct collections − direct-payment platform deduction."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={DollarSign} title={pageTr("Base revenue")} value={formatMoney(summary.totalRevenue, language)} note={pageTr("All payout rows in current dataset")} tone="blue" />
        <SummaryCard icon={Wallet} title={pageTr("Teacher share")} value={formatMoney(summary.teacherEarnings, language)} note={pageTr("Total teacher amount across all rows")} tone="emerald" />
        <SummaryCard icon={BadgeCheck} title={pageTr("Platform commission")} value={formatMoney(summary.platformCommission, language)} note={pageTr("Platform amount across all rows")} tone="amber" />
        <SummaryCard icon={CalendarRange} title={pageTr("Visible rows")} value={String(visibleRows.length)} note={pageTr("Filtered payout rows on this page")} tone="violet" />
        <SummaryCard icon={CreditCard} title={pageTr("Direct bank collections")} value={formatMoney(summary.directToTeacherAmount, language)} note={pageTr("Money collected directly by teachers from students")} tone="amber" />
        <SummaryCard icon={Percent} title={pageTr("Platform deduction due")} value={formatMoney(summary.platformDeductionDue, language)} note={pageTr("Platform amount still owed from direct bank payments")} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InsightCard icon={BookOpen} title={pageTr("Courses in report")} value={String(summary.coursesCount || 0)} />
        <InsightCard icon={BadgeCheck} title={pageTr("Teachers in report")} value={String(summary.teachersCount || 0)} />
        <InsightCard icon={CreditCard} title={pageTr("Top payment method")} value={topPaymentMethod} />
        <InsightCard icon={Globe2} title={pageTr("Top market")} value={topMarket} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title={language === "fa" ? "درآمد بر اساس روش پرداخت" : "Revenue by payment method"}
          subtitle={
            language === "fa"
              ? "مجموع فروش و سهم مدرس برای هر کانال پرداخت."
              : "Sales and teacher share across every payment channel."
          }
          rows={summary.paymentMethodBreakdown}
          labelKey="methodLabel"
          language={language}
        />
        <BreakdownCard
          title={language === "fa" ? "درآمد بر اساس منطقه قیمت‌گذاری" : "Revenue by pricing region"}
          subtitle={
            language === "fa"
              ? "منطقه از قیمت ذخیره‌شده هنگام پرداخت گرفته می‌شود، نه ارز درگاه."
              : "Region comes from the saved checkout price, not the gateway currency."
          }
          rows={summary.regionBreakdown}
          labelKey="regionLabel"
          language={language}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <PayoutHealthCard
          title={pageTr("Settled teacher share")}
          value={formatMoney(summary.settledTeacherPayout, language)}
          note={pageTr("Amount already released to teachers")}
          tone="emerald"
        />
        <PayoutHealthCard
          title={pageTr("Pending teacher share")}
          value={formatMoney(summary.teacherPayoutDue, language)}
          note={pageTr("Amount still waiting for payout")}
          tone="amber"
        />
        <PayoutHealthCard
          title={pageTr("Settled sales")}
          value={String(summary.settledPaymentsCount || 0)}
          note={pageTr("Successful enrollments inside paid payout cycles")}
          tone="blue"
        />
        <PayoutHealthCard
          title={pageTr("Pending sales")}
          value={String(summary.outstandingPaymentsCount || 0)}
          note={pageTr("Successful enrollments inside unpaid payout cycles")}
          tone="violet"
        />
      </div>

      <SectionCard
        title={language === "fa" ? "تفکیک روشن جریان اقتصادی" : "Clear Economic Split"}
        subtitle={
          language === "fa"
            ? "این بخش نشان می‌دهد کدام پول در اختیار پلتفرم بوده و کدام پول مستقیماً نزد مدرس مانده است."
            : "This section separates money held by the platform from money collected directly by teachers."
        }
      >
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <MoneyFlowCard
            title={language === "fa" ? "پول‌های در اختیار پلتفرم" : "Platform-held money"}
            value={formatMoney(summary.teacherEarnings, language)}
            note={
              language === "fa"
                ? "این ردیف‌ها از روش‌های پرداختی آمده‌اند که ابتدا داخل سیستم جمع شده و بعد برای مدرس تسویه می‌شوند."
                : "These rows came through payment channels where money first reached the platform and is then settled out to teachers."
            }
            accent="emerald"
            bullets={[
              `${language === "fa" ? "درآمد پایه این جریان" : "Base revenue in this flow"}: ${formatMoney(paymentSourceSummary.platformRevenue, language)}`,
              `${language === "fa" ? "پرداخت‌های این جریان" : "Payments in this flow"}: ${paymentSourceSummary.platformCount}`,
              `${language === "fa" ? "سهم مدرس در این جریان" : "Teacher share in this flow"}: ${formatMoney(paymentSourceSummary.platformTeacherShare, language)}`,
            ]}
          />
          <MoneyFlowCard
            title={language === "fa" ? "پول‌های مستقیم نزد مدرس" : "Teacher-held direct money"}
            value={formatMoney(summary.directToTeacherAmount, language)}
            note={
              language === "fa"
                ? "این پول داخل حساب پلتفرم نیامده و مستقیم توسط مدرس از شاگرد دریافت شده است."
                : "This money never reached the platform account and was collected directly by the teacher from students."
            }
            accent="amber"
            bullets={[
              `${language === "fa" ? "سهم قابل‌کسر سیستم" : "Platform deduction still due"}: ${formatMoney(summary.platformDeductionDue, language)}`,
              `${language === "fa" ? "تعداد پرداخت مستقیم" : "Direct-payment count"}: ${paymentSourceSummary.directCount}`,
              `${language === "fa" ? "خالص نزد مدرس بعد از کسر" : "Net left with teacher after deduction"}: ${formatMoney(Math.max(0, summary.directToTeacherAmount - summary.platformDeductionDue), language)}`,
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={pageTr("Filter payout report")}
        subtitle={pageTr("Filter by month, teacher, course, settlement status, or search by teacher/course name.")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
              <Filter size={14} />
              {activeFilterCount} {pageTr("active filters")}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
            >
              <X size={14} />
              {pageTr("Reset")}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 p-5 xl:grid-cols-6">
          <FilterField label={pageTr("Month / Period")} value={filters.month} onChange={(value) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, month: value }));
          }}>
            <option value="">{pageTr("All months")}</option>
            {options.availableMonths.map((item) => (
              <option key={item.monthKey} value={item.monthKey}>
                {item.monthKey} • {item.label}
              </option>
            ))}
          </FilterField>

          <FilterField label={pageTr("Teacher")} value={filters.teacherId} onChange={(value) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, teacherId: value }));
          }}>
            <option value="">{pageTr("All teachers")}</option>
            {options.availableTeachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </FilterField>

          <FilterField label={pageTr("Course")} value={filters.courseId} onChange={(value) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, courseId: value }));
          }}>
            <option value="">{pageTr("All courses")}</option>
            {options.availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </FilterField>

          <FilterField label={pageTr("Payment plan")} value={filters.paymentPlan} onChange={(value) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, paymentPlan: value }));
          }}>
            <option value="">{pageTr("All payment plans")}</option>
            <option value="monthly">{pageTr("Monthly")}</option>
            <option value="whole_period">{pageTr("Whole period")}</option>
          </FilterField>

          <FilterField label={pageTr("Payout status")} value={filters.payoutStatus} onChange={(value) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, payoutStatus: value }));
          }}>
            <option value="">{pageTr("All payout statuses")}</option>
            <option value="paid">{pageTr("Paid")}</option>
            <option value="unpaid">{pageTr("Unpaid")}</option>
          </FilterField>

          <label className="space-y-2">
            <span className="block text-xs font-black text-slate-500">{pageTr("Search")}</span>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, search: event.target.value }));
                }}
                placeholder={pageTr("Search teacher or course")}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-blue-500"
              />
            </div>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title={pageTr("Teacher payout rows")}
        subtitle={pageTr("Admin payout rows are aligned with the teacher income page, including exact payment-day exchange snapshots inside details.")}
        actions={
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
            <CalendarRange size={14} />
            {visibleRows.length} {pageTr("rows on this page")}
          </div>
        }
      >

        {error ? (
          <div className="px-5 pt-4">
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 p-4 md:hidden">
          {!loading && visibleRows.length === 0 ? (
            <EmptyState label={pageTr("No teacher income rows found.")} />
          ) : (
            visibleRows.map((row) => (
              <MobilePayoutCard
                key={`${row.teacherId}:${row.courseId}:${row.monthKey}`}
                row={row}
                tr={pageTr}
                language={language}
                savingKey={savingKey}
                onStatusChange={handleStatusChange}
                onOpenDetails={setSelectedRow}
              />
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1480px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">{pageTr("Teacher")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Month / Period")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Course")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Plan")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Sales")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Revenue")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Platform cut")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Teacher share")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Status")}</th>
                <th className="px-4 py-3 font-black">{pageTr("Details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    {pageTr("No teacher income rows found.")}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const statusClass = payoutStatusStyles[row.status] || payoutStatusStyles.unpaid;
                  const rowKey = `${row.teacherId}:${row.courseId}:${row.monthKey}`;
                  const isSaving = savingKey === rowKey;
                  return (
                    <tr key={rowKey} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{row.teacherName}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.teacherEmail || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{row.monthKey}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.periodLabel}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{row.courseTitle}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                          {formatPaymentPlanLabel(row.paymentPlan, pageTr)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.salesCount}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{formatMoney(row.totalRevenue, language)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatMoney(row.platformCommission, language)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <p className="font-black text-emerald-700">{formatMoney(row.teacherEarnings, language)}</p>
                          <PaymentSourcePill isExternalCollection={Number(row.directToTeacherAmount || 0) > 0} tr={pageTr} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass}`}>
                              {row.status === "paid" ? pageTr("Paid") : pageTr("Unpaid")}
                            </span>
                            {isSaving ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                            ) : null}
                          </div>
                          <div className="relative inline-flex items-center">
                            <select
                              value={row.status}
                              onChange={(event) => handleStatusChange(row, event.target.value)}
                              disabled={isSaving}
                              className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60"
                            >
                              <option value="unpaid">{pageTr("Unpaid")}</option>
                              <option value="paid">{pageTr("Paid")}</option>
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2 text-slate-400" />
                          </div>
                          {row.paidAt ? (
                            <p className="text-xs font-semibold text-slate-500">{formatDate(row.paidAt, language)}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
                        >
                          <Eye size={14} />
                          {pageTr("Payment details")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {pageTr("Previous")}
          </button>
          <span className="text-xs font-bold text-slate-500">
            {pageTr("Page")} {page} {pageTr("of")} {meta.totalPages || 1}
          </span>
          <button
            disabled={page >= (meta.totalPages || 1)}
            onClick={() => setPage((prev) => Math.min(meta.totalPages || 1, prev + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {pageTr("Next")}
          </button>
        </div>
      </SectionCard>

      <PaymentDetailsModal row={selectedRow} onClose={() => setSelectedRow(null)} tr={pageTr} language={language} />
    </section>
  );
}
