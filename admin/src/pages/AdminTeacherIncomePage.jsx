import { useEffect, useMemo, useRef, useState } from "react";
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

const ADMIN_TEACHER_INCOME_TEXT = {
  "Teacher payout details": "جزئیات تسویه مدرس",
  Sales: "فروش",
  Revenue: "درآمد",
  "Platform cut": "سهم سیستم",
  "Teacher share": "سهم مدرس",
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
  const normalizedCurrency = String(currency || "").toUpperCase();
  const fractionDigits = normalizedCurrency === "USDT" ? 6 : 2;
  return `${new Intl.NumberFormat(language === "fa" ? "fa-AF" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number(amount || 0))} ${normalizedCurrency || ""}`.trim();
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
const ADMIN_TEACHER_INCOME_REQUEST_GUARD_TTL_MS = 15 * 1000;
const recentTeacherIncomeRequestKeys = new Map();

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

const shouldSkipRecentTeacherIncomeRequest = (key) => {
  const now = Date.now();
  const lastTime = Number(recentTeacherIncomeRequestKeys.get(key) || 0);
  if (lastTime && now - lastTime < ADMIN_TEACHER_INCOME_REQUEST_GUARD_TTL_MS) {
    return true;
  }
  recentTeacherIncomeRequestKeys.set(key, now);
  return false;
};

const normalizeOptions = (options = {}) => ({
  availableMonths: Array.isArray(options.availableMonths) ? options.availableMonths : [],
  availableTeachers: Array.isArray(options.availableTeachers) ? options.availableTeachers : [],
  availableCourses: Array.isArray(options.availableCourses) ? options.availableCourses : [],
});

const normalizeSummary = (payload = {}) => ({
  totalRevenue: Number(payload.totalRevenue || 0),
  platformCommission: Number(payload.platformCommission || 0),
  teacherEarnings: Number(payload.teacherEarnings || 0),
  paidRowsCount: Number(payload.paidRowsCount || 0),
  unpaidRowsCount: Number(payload.unpaidRowsCount || 0),
  commissionRate: Number(payload.commissionRate || 15),
});

const normalizeMeta = (meta = {}) => ({
  page: Number(meta.page || 1),
  totalPages: Number(meta.totalPages || 1),
  total: Number(meta.total || 0),
});

const ADMIN_TEACHER_INCOME_DEMO_SOURCE = {
  commissionRate: 10,
  settlementRows: [
    {
      teacherId: "demo-teacher-1",
      teacherName: "Ahmad Rahimi",
      teacherEmail: "ahmad@example.com",
      courseId: "demo-course-1",
      courseTitle: "English Conversation Mastery",
      monthKey: "2026-07",
      cycleStartDay: 1,
      periodLabel: "Jul 1, 2026 - Jul 31, 2026",
      paymentPlan: "monthly",
      salesCount: 4,
      totalRevenue: 240,
      platformCommission: 24,
      teacherEarnings: 216,
      status: "unpaid",
      paidAt: null,
      paymentDetails: [
        {
          paymentId: "demo-pay-1",
          studentName: "Farid Wafa",
          studentEmail: "farid@example.com",
          paymentMethod: "Visa / MasterCard",
          paymentMethodCode: "hesabpay",
          regionLabel: "Afghanistan",
          gatewayCurrency: "AFN",
          gatewayAmount: 4200,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 4200 AFN (1 USD = 70 AFN)",
          paymentReference: "PAY-DEMO-001",
          transactionId: "HSP-001",
          paidAt: "2026-07-02T09:00:00.000Z",
        },
        {
          paymentId: "demo-pay-2",
          studentName: "Mina Azizi",
          studentEmail: "mina@example.com",
          paymentMethod: "USDT",
          paymentMethodCode: "usdt_bsc_direct",
          regionLabel: "International",
          gatewayCurrency: "USDT",
          gatewayAmount: 55,
          baseRevenue: 55,
          teacherEarnings: 49.5,
          pricingSnapshotLabel: "55 USD -> 55 USDT",
          paymentReference: "PAY-DEMO-002",
          transactionId: "0x-demo-2",
          paidAt: "2026-07-04T11:15:00.000Z",
        },
        {
          paymentId: "demo-pay-3",
          studentName: "Sahar Nouri",
          studentEmail: "sahar@example.com",
          paymentMethod: "Bank",
          paymentMethodCode: "bank_transfer",
          regionLabel: "Iran",
          gatewayCurrency: "IRR",
          gatewayAmount: 2520000,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 2520000 IRR (1 USD = 42000 IRR)",
          paymentReference: "PAY-DEMO-003",
          transactionId: "BNK-003",
          paidAt: "2026-07-05T08:20:00.000Z",
        },
        {
          paymentId: "demo-pay-4",
          studentName: "Jawad Rahman",
          studentEmail: "jawad@example.com",
          paymentMethod: "Visa / MasterCard",
          paymentMethodCode: "hesabpay",
          regionLabel: "Afghanistan",
          gatewayCurrency: "AFN",
          gatewayAmount: 4550,
          baseRevenue: 65,
          teacherEarnings: 58.5,
          pricingSnapshotLabel: "65 USD -> 4550 AFN (1 USD = 70 AFN)",
          paymentReference: "PAY-DEMO-004",
          transactionId: "HSP-004",
          paidAt: "2026-07-08T13:10:00.000Z",
        },
      ],
    },
    {
      teacherId: "demo-teacher-1",
      teacherName: "Ahmad Rahimi",
      teacherEmail: "ahmad@example.com",
      courseId: "demo-course-2",
      courseTitle: "Business Email Writing",
      monthKey: "2026-06",
      cycleStartDay: 15,
      periodLabel: "Jun 15, 2026 - Jul 14, 2026",
      paymentPlan: "whole_period",
      salesCount: 2,
      totalRevenue: 165,
      platformCommission: 16.5,
      teacherEarnings: 148.5,
      status: "paid",
      paidAt: "2026-07-01T00:00:00.000Z",
      paymentDetails: [
        {
          paymentId: "demo-pay-5",
          studentName: "Laila Noorzai",
          studentEmail: "laila@example.com",
          paymentMethod: "Visa / MasterCard",
          paymentMethodCode: "hesabpay",
          regionLabel: "Afghanistan",
          gatewayCurrency: "AFN",
          gatewayAmount: 7350,
          baseRevenue: 105,
          teacherEarnings: 94.5,
          pricingSnapshotLabel: "105 USD -> 7350 AFN (1 USD = 70 AFN)",
          paymentReference: "PAY-DEMO-005",
          transactionId: "HSP-005",
          paidAt: "2026-06-27T09:20:00.000Z",
        },
        {
          paymentId: "demo-pay-6",
          studentName: "Reza Karimi",
          studentEmail: "reza@example.com",
          paymentMethod: "Crypto Gateway",
          paymentMethodCode: "nowpayments_crypto",
          regionLabel: "Iran",
          gatewayCurrency: "IRR",
          gatewayAmount: 2520000,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 2520000 IRR (1 USD = 42000 IRR)",
          paymentReference: "PAY-DEMO-006",
          transactionId: "NP-006",
          paidAt: "2026-06-28T08:30:00.000Z",
        },
      ],
    },
    {
      teacherId: "demo-teacher-2",
      teacherName: "Maryam Azizi",
      teacherEmail: "maryam@example.com",
      courseId: "demo-course-3",
      courseTitle: "IELTS Writing Bootcamp",
      monthKey: "2026-07",
      cycleStartDay: 1,
      periodLabel: "Jul 1, 2026 - Jul 31, 2026",
      paymentPlan: "monthly",
      salesCount: 3,
      totalRevenue: 180,
      platformCommission: 18,
      teacherEarnings: 162,
      status: "paid",
      paidAt: "2026-07-10T00:00:00.000Z",
      paymentDetails: [
        {
          paymentId: "demo-pay-7",
          studentName: "Nadia Wafa",
          studentEmail: "nadia@example.com",
          paymentMethod: "USDT",
          paymentMethodCode: "usdt_bsc_direct",
          regionLabel: "International",
          gatewayCurrency: "USDT",
          gatewayAmount: 60,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 60 USDT",
          paymentReference: "PAY-DEMO-007",
          transactionId: "0x-demo-7",
          paidAt: "2026-07-07T15:00:00.000Z",
        },
        {
          paymentId: "demo-pay-8",
          studentName: "Ehsan Hakimi",
          studentEmail: "ehsan@example.com",
          paymentMethod: "Bank",
          paymentMethodCode: "bank_transfer",
          regionLabel: "Iran",
          gatewayCurrency: "IRR",
          gatewayAmount: 2520000,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 2520000 IRR (1 USD = 42000 IRR)",
          paymentReference: "PAY-DEMO-008",
          transactionId: "BNK-008",
          paidAt: "2026-07-09T10:35:00.000Z",
        },
        {
          paymentId: "demo-pay-9",
          studentName: "Shabnam Rahimi",
          studentEmail: "shabnam@example.com",
          paymentMethod: "Visa / MasterCard",
          paymentMethodCode: "hesabpay",
          regionLabel: "Afghanistan",
          gatewayCurrency: "AFN",
          gatewayAmount: 4200,
          baseRevenue: 60,
          teacherEarnings: 54,
          pricingSnapshotLabel: "60 USD -> 4200 AFN (1 USD = 70 AFN)",
          paymentReference: "PAY-DEMO-009",
          transactionId: "HSP-009",
          paidAt: "2026-07-11T12:25:00.000Z",
        },
      ],
    },
  ],
};

const buildDemoTeacherIncomeState = ({
  page = 1,
  month = "",
  teacherId = "",
  courseId = "",
  paymentPlan = "",
  payoutStatus = "",
  search = "",
} = {}) => {
  const allRows = Array.isArray(ADMIN_TEACHER_INCOME_DEMO_SOURCE.settlementRows)
    ? ADMIN_TEACHER_INCOME_DEMO_SOURCE.settlementRows
    : [];
  const normalizedSearch = String(search || "").trim().toLowerCase();

  const filteredRows = allRows.filter((row) => {
    if (month && String(row.monthKey) !== String(month)) return false;
    if (teacherId && String(row.teacherId) !== String(teacherId)) return false;
    if (courseId && String(row.courseId) !== String(courseId)) return false;
    if (paymentPlan && String(row.paymentPlan) !== String(paymentPlan)) return false;
    if (payoutStatus && String(row.status) !== String(payoutStatus)) return false;
    if (
      normalizedSearch &&
      ![
        row.teacherName,
        row.teacherEmail,
        row.courseTitle,
        row.monthKey,
        row.periodLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    ) {
      return false;
    }
    return true;
  });

  const pageSize = ADMIN_TEACHER_INCOME_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(Math.max(1, Number(page || 1)), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pagedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  return {
    rows: pagedRows,
    summary: {
      totalRevenue: filteredRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0),
      platformCommission: filteredRows.reduce((sum, row) => sum + Number(row.platformCommission || 0), 0),
      teacherEarnings: filteredRows.reduce((sum, row) => sum + Number(row.teacherEarnings || 0), 0),
      paidRowsCount: filteredRows.filter((row) => row.status === "paid").length,
      unpaidRowsCount: filteredRows.filter((row) => row.status === "unpaid").length,
      commissionRate: ADMIN_TEACHER_INCOME_DEMO_SOURCE.commissionRate,
    },
    options: {
      availableMonths: Array.from(
        new Map(
          allRows.map((row) => [row.monthKey, { monthKey: row.monthKey, label: row.periodLabel }]),
        ).values(),
      ),
      availableTeachers: Array.from(
        new Map(
          allRows.map((row) => [row.teacherId, { id: row.teacherId, name: row.teacherName }]),
        ).values(),
      ),
      availableCourses: Array.from(
        new Map(
          allRows.map((row) => [row.courseId, { id: row.courseId, title: row.courseTitle }]),
        ).values(),
      ),
    },
    meta: {
      page: safePage,
      totalPages,
      total: filteredRows.length,
    },
  };
};

const getSnapshotLabel = (item = {}) => {
  if (item?.pricingSnapshotLabel) return item.pricingSnapshotLabel;

  const baseRevenue = Number(item?.baseRevenue || item?.totalRevenue || 0);
  const gatewayAmount = Number(item?.gatewayAmount || 0);
  const gatewayCurrency = String(item?.gatewayCurrency || "").toUpperCase();

  if (baseRevenue > 0 && gatewayAmount > 0 && gatewayCurrency) {
    if (gatewayCurrency === "USD" || gatewayCurrency === "USDT") {
      return `${baseRevenue} USD -> ${gatewayAmount} ${gatewayCurrency}`;
    }
    const computedRate = Math.round((gatewayAmount / baseRevenue) * 1000000) / 1000000;
    return `${baseRevenue} USD -> ${gatewayAmount} ${gatewayCurrency} (1 USD = ${computedRate} ${gatewayCurrency})`;
  }

  return "-";
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

        <div className="grid gap-4 border-b border-slate-200 bg-white px-5 py-4 md:grid-cols-4">
          <MiniValue label={tr("Sales")} value={String(row.salesCount || 0)} />
          <MiniValue label={tr("Revenue")} value={formatMoney(row.totalRevenue, language)} />
          <MiniValue label={tr("Platform cut")} value={formatMoney(row.platformCommission, language)} />
          <MiniValue label={tr("Teacher share")} value={formatMoney(row.teacherEarnings, language)} emphasize />
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
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{item.paymentMethod || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                        {item.regionLabel || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatGatewayAmount(item.gatewayAmount, item.gatewayCurrency, language)}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{formatMoney(item.baseRevenue, language)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700">{formatMoney(item.teacherEarnings, language)}</td>
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
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniValue label={tr("Plan")} value={formatPaymentPlanLabel(row.paymentPlan, tr)} />
        <MiniValue label={tr("Sales")} value={String(row.salesCount || 0)} />
        <MiniValue label={tr("Revenue")} value={formatMoney(row.totalRevenue, language)} />
        <MiniValue label={tr("Teacher share")} value={formatMoney(row.teacherEarnings, language)} emphasize />
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
  const [usingDemoData, setUsingDemoData] = useState(false);

  const token = useMemo(() => getToken(), []);
  const incomeRequest = useLatestRequest();
  const lastIncomeRequestKeyRef = useRef("");

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

      const requestKey = JSON.stringify({
        page,
        month: filters.month,
        teacherId: filters.teacherId,
        courseId: filters.courseId,
        paymentPlan: filters.paymentPlan,
        payoutStatus: filters.payoutStatus,
        search: filters.search,
      });
      if (lastIncomeRequestKeyRef.current === requestKey) {
        return;
      }
      if (shouldSkipRecentTeacherIncomeRequest(requestKey)) {
        return;
      }
      lastIncomeRequestKeyRef.current = requestKey;

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
            const hasRealPayload = Array.isArray(data?.settlementRows);
            const shouldUseDemoFallback =
              !hasRealPayload ||
              (
                Number(data?.meta?.total || 0) === 0 &&
                !filters.month &&
                !filters.teacherId &&
                !filters.courseId &&
                !filters.paymentPlan &&
                !filters.payoutStatus &&
                !filters.search.trim()
              );
            const demoState = buildDemoTeacherIncomeState({
              page,
              month: filters.month,
              teacherId: filters.teacherId,
              courseId: filters.courseId,
              paymentPlan: filters.paymentPlan,
              payoutStatus: filters.payoutStatus,
              search: filters.search,
            });

            const nextRows = shouldUseDemoFallback ? demoState.rows : data.settlementRows;
            const nextSummary = shouldUseDemoFallback ? demoState.summary : normalizeSummary(data);
            const nextOptions = shouldUseDemoFallback ? demoState.options : normalizeOptions(data);
            const nextMeta = shouldUseDemoFallback ? demoState.meta : normalizeMeta(data?.meta);

            setRows(nextRows);
            setSummary(nextSummary);
            setOptions(nextOptions);
            setMeta(nextMeta);
            setUsingDemoData(shouldUseDemoFallback);

            writeAdminPageCache(cacheKey, {
              rows: nextRows,
              summary: nextSummary,
              options: nextOptions,
              meta: nextMeta,
            });
          },
          onError: (err) => {
            const demoState = buildDemoTeacherIncomeState({
              page,
              month: filters.month,
              teacherId: filters.teacherId,
              courseId: filters.courseId,
              paymentPlan: filters.paymentPlan,
              payoutStatus: filters.payoutStatus,
              search: filters.search,
            });
            setRows(demoState.rows);
            setSummary(demoState.summary);
            setOptions(demoState.options);
            setMeta(demoState.meta);
            setUsingDemoData(true);
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
    token,
  ]);

  const visibleRows = rows;

  const paidSummary = useMemo(() => {
    return visibleRows
      .filter((row) => row.status === "paid")
      .reduce(
        (acc, row) => {
          acc.revenue += Number(row.totalRevenue || 0);
          acc.platform += Number(row.platformCommission || 0);
          acc.teacher += Number(row.teacherEarnings || 0);
          acc.sales += Number(row.salesCount || 0);
          return acc;
        },
        { revenue: 0, platform: 0, teacher: 0, sales: 0 },
      );
  }, [visibleRows]);

  const unpaidSummary = useMemo(() => {
    return visibleRows
      .filter((row) => row.status === "unpaid")
      .reduce(
        (acc, row) => {
          acc.revenue += Number(row.totalRevenue || 0);
          acc.platform += Number(row.platformCommission || 0);
          acc.teacher += Number(row.teacherEarnings || 0);
          acc.sales += Number(row.salesCount || 0);
          return acc;
        },
        { revenue: 0, platform: 0, teacher: 0, sales: 0 },
      );
  }, [visibleRows]);

  const activeFilterCount = useMemo(
    () =>
      [filters.month, filters.teacherId, filters.courseId, filters.paymentPlan, filters.payoutStatus, filters.search.trim()]
        .filter(Boolean)
        .length,
    [filters.courseId, filters.month, filters.paymentPlan, filters.payoutStatus, filters.search, filters.teacherId],
  );

  const teacherCount = useMemo(
    () => new Set(visibleRows.map((row) => String(row.teacherId || ""))).size,
    [visibleRows],
  );

  const courseCount = useMemo(
    () => new Set(visibleRows.map((row) => String(row.courseId || ""))).size,
    [visibleRows],
  );

  const topPaymentMethod = useMemo(() => {
    const counts = new Map();
    visibleRows.forEach((row) => {
      const details = Array.isArray(row.paymentDetails) ? row.paymentDetails : [];
      details.forEach((item) => {
        const key = String(item.paymentMethod || item.paymentMethodCode || "-");
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const [best] = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
    return pageTr(best?.[0] || "No data");
  }, [pageTr, visibleRows]);

  const topMarket = useMemo(() => {
    const counts = new Map();
    visibleRows.forEach((row) => {
      const details = Array.isArray(row.paymentDetails) ? row.paymentDetails : [];
      details.forEach((item) => {
        const key = String(item.regionLabel || "-");
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const [best] = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
    return pageTr(best?.[0] || "No data");
  }, [pageTr, visibleRows]);

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
              value={formatMoney(paidSummary.teacher, language)}
              note={pageTr("Teacher amount already marked as paid")}
              tone="emerald"
            />
            <SummaryCard
              icon={Clock3}
              title={pageTr("Awaiting payout")}
              value={formatMoney(unpaidSummary.teacher, language)}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={DollarSign} title={pageTr("Base revenue")} value={formatMoney(summary.totalRevenue, language)} note={pageTr("All payout rows in current dataset")} tone="blue" />
        <SummaryCard icon={Wallet} title={pageTr("Teacher share")} value={formatMoney(summary.teacherEarnings, language)} note={pageTr("Total teacher amount across all rows")} tone="emerald" />
        <SummaryCard icon={BadgeCheck} title={pageTr("Platform commission")} value={formatMoney(summary.platformCommission, language)} note={pageTr("Platform amount across all rows")} tone="amber" />
        <SummaryCard icon={CalendarRange} title={pageTr("Visible rows")} value={String(visibleRows.length)} note={pageTr("Filtered payout rows on this page")} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InsightCard icon={BookOpen} title={pageTr("Courses in report")} value={String(courseCount || 0)} />
        <InsightCard icon={BadgeCheck} title={pageTr("Teachers in report")} value={String(teacherCount || 0)} />
        <InsightCard icon={CreditCard} title={pageTr("Top payment method")} value={topPaymentMethod} />
        <InsightCard icon={Globe2} title={pageTr("Top market")} value={topMarket} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <PayoutHealthCard
          title={pageTr("Settled teacher share")}
          value={formatMoney(paidSummary.teacher, language)}
          note={pageTr("Amount already released to teachers")}
          tone="emerald"
        />
        <PayoutHealthCard
          title={pageTr("Pending teacher share")}
          value={formatMoney(unpaidSummary.teacher, language)}
          note={pageTr("Amount still waiting for payout")}
          tone="amber"
        />
        <PayoutHealthCard
          title={pageTr("Settled sales")}
          value={String(paidSummary.sales || 0)}
          note={pageTr("Successful enrollments inside paid payout cycles")}
          tone="blue"
        />
        <PayoutHealthCard
          title={pageTr("Pending sales")}
          value={String(unpaidSummary.sales || 0)}
          note={pageTr("Successful enrollments inside unpaid payout cycles")}
          tone="violet"
        />
      </div>

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

        {usingDemoData ? (
          <div className="px-5 pt-4">
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700">
              {pageTr("Showing demo payout data so you can preview the system layout.")}
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
                      <td className="px-4 py-3 font-black text-emerald-700">{formatMoney(row.teacherEarnings, language)}</td>
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
