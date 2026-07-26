import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  Globe2,
  Landmark,
  RefreshCw,
  Wallet,
  X,
  Percent,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import {
  approveTeacherBankTransferPayment,
  fetchTeacherBankTransferPayments,
  fetchTeacherEarningsSummary,
  rejectTeacherBankTransferPayment,
} from "../../services/teacherPortalService";
import { getApiBase } from "../../services/http";
import { getAuthUser } from "../../services/portal";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";
import {
  formatDisplayCurrencyAmount,
  getDisplayCurrency,
  getDisplayCurrencyAmount,
  replaceIranRialTextForDisplay,
} from "../utils/currencyDisplay";

const formatMoney = (value, language = "fa") => {
  const amount = Number(value || 0);
  const amountLabel = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${amountLabel} ${language === "fa" ? "دالر" : "USD"}`;
};

const formatMonthLabel = (monthKey = "", periodLabel = "", language = "fa") => {
  if (!monthKey) return language === "fa" ? "همه ماه‌ها" : "All months";
  return periodLabel ? `${monthKey} • ${periodLabel}` : monthKey;
};

const formatPaymentPlanLabel = (paymentPlan = "", language = "fa") => {
  const normalized = String(paymentPlan || "").toLowerCase();
  if (normalized === "whole_period") {
    return language === "fa" ? "پرداخت یک‌جای کل دوره" : "Whole Period";
  }
  return language === "fa" ? "پرداخت ماهانه" : "Monthly";
};

const formatPaymentMethodInsightLabel = (value = "", language = "fa") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return language === "fa" ? "بدون داده" : "No data";
  if (normalized.includes("hesabpay") || normalized.includes("visa") || normalized.includes("mastercard")) {
    return "Visa / MasterCard";
  }
  if (normalized.includes("usdt")) {
    return "USDT";
  }
  if (normalized.includes("bank")) {
    return language === "fa" ? "بانک" : "Bank";
  }
  return value;
};

const formatCompactDate = (value, language = "fa") => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString(language === "fa" ? "fa-AF" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
};

const resolveProofUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const apiBase = getApiBase();
  const apiOrigin = apiBase.replace(/\/api\/v\d+$/i, "").replace(/\/+$/, "");
  return `${apiOrigin}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const getPaymentSnapshotLabel = (item = {}) => {
  const baseRevenue = Number(item?.baseRevenue || item?.totalRevenue || 0);
  const gatewayAmount = Number(item?.gatewayAmount || 0);
  const gatewayCurrency = String(item?.gatewayCurrency || "").toUpperCase();

  if (baseRevenue > 0 && gatewayAmount > 0 && gatewayCurrency) {
    const displayAmount = getDisplayCurrencyAmount(gatewayAmount, gatewayCurrency);
    const displayCurrency = getDisplayCurrency(gatewayCurrency);
    const computedRate = Math.round((displayAmount / baseRevenue) * 1000000) / 1000000;
    if (gatewayCurrency === "AFN" || gatewayCurrency === "IRR") {
      return `${baseRevenue} USD -> ${displayAmount} ${displayCurrency} (1 USD = ${computedRate} ${displayCurrency})`;
    }
    return `${baseRevenue} USD -> ${displayAmount} ${displayCurrency}`;
  }

  return replaceIranRialTextForDisplay(item?.pricingSnapshotLabel) || "-";
};

const formatGatewayAmount = (amount, currency, language = "en") =>
  formatDisplayCurrencyAmount(amount, currency, language, {
    maximumFractionDigits: String(currency || "").toUpperCase() === "USDT" ? 6 : 2,
  });

const formatSourcePrice = (item = {}, language = "en") => {
  if (item.sourcePriceAmount === null || item.sourcePriceAmount === undefined) {
    return "";
  }
  const priceLabel = formatDisplayCurrencyAmount(
    item.sourcePriceAmount,
    item.sourcePriceCurrency || "USD",
    language,
  );
  const currency = String(item.sourcePriceCurrency || "USD").toUpperCase();
  const rate = Number(item.sourceExchangeRate || 0);
  if (!(rate > 0) || currency === "USD") return priceLabel;
  return `${priceLabel} • 1 USD = ${formatDisplayCurrencyAmount(rate, currency, language)}`;
};

const statusMap = {
  paid: {
    fa: "تسویه‌شده",
    en: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  unpaid: {
    fa: "پرداخت‌نشده",
    en: "Unpaid",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

const DEFAULT_SUMMARY = {
  commissionRate: 15,
  totalRevenue: 0,
  platformCommission: 0,
  teacherEarnings: 0,
  teacherPayoutTotal: 0,
  teacherPayoutDue: 0,
  settledTeacherPayout: 0,
  directToTeacherAmount: 0,
  platformDeductionDue: 0,
  externalCollectedRevenue: 0,
  paymentsCount: 0,
  settledPaymentsCount: 0,
  outstandingPaymentsCount: 0,
  paidRowsCount: 0,
  unpaidRowsCount: 0,
  reportCurrency: "USD",
  currentCommissionRate: 15,
  commissionRatesUsed: [],
  reconciliation: {
    expectedTeacherEarnings: 0,
    actualTeacherEarnings: 0,
    difference: 0,
    isBalanced: true,
  },
  moneyFlow: {
    directCount: 0,
    directAmount: 0,
    deductionDue: 0,
    platformCount: 0,
    platformRevenue: 0,
    platformTeacherShare: 0,
  },
  generatedAt: null,
  paymentMethodBreakdown: [],
  regionBreakdown: [],
  recentPayments: [],
  settlementRows: [],
  availableMonths: [],
  availableCourses: [],
};

const INCOME_CACHE_TTL_MS = 5 * 60 * 1000;

const getTeacherIncomeCacheKey = (filters = {}) =>
  getTeacherPageCacheKey("income", {
    month: String(filters?.month || ""),
    courseId: String(filters?.courseId || ""),
    paymentPlan: String(filters?.paymentPlan || ""),
    payoutStatus: String(filters?.payoutStatus || ""),
  });

export default function TeacherIncome() {
  const { language, isRTL, setLanguage } = useTeacherLanguage();
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [filters, setFilters] = useState({
    month: "",
    courseId: "",
    paymentPlan: "",
    payoutStatus: "",
  });
  const [selectedRow, setSelectedRow] = useState(null);
  const [pendingBankPayments, setPendingBankPayments] = useState([]);
  const [bankPaymentsLoading, setBankPaymentsLoading] = useState(false);
  const [bankReviewLoadingId, setBankReviewLoadingId] = useState("");

  const teacher = useMemo(() => {
    const user = getAuthUser();
    return user || { name: "Teacher", email: "teacher@edutech.study", role: "teacher" };
  }, []);

  useLiveDataRefresh(() => setRefreshSeed((prev) => prev + 1), {
    intervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisible: false,
  });

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      const cacheKey = getTeacherIncomeCacheKey(filters);
      const cached = readTeacherPageCache(cacheKey, { maxAgeMs: INCOME_CACHE_TTL_MS });
      if (cached) {
        setSummary(cached.summary);
        setError(cached.error || "");
        setLoading(false);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const data = await fetchTeacherEarningsSummary({
          signal: controller.signal,
          month: filters.month,
          courseId: filters.courseId,
          paymentPlan: filters.paymentPlan,
          payoutStatus: filters.payoutStatus,
        });
        if (!mounted) return;
        const resolvedData = data || {};
        const nextSummary = {
          ...DEFAULT_SUMMARY,
          ...resolvedData,
          settlementRows: Array.isArray(resolvedData?.settlementRows) ? resolvedData.settlementRows : [],
          paymentMethodBreakdown: Array.isArray(resolvedData?.paymentMethodBreakdown) ? resolvedData.paymentMethodBreakdown : [],
          regionBreakdown: Array.isArray(resolvedData?.regionBreakdown) ? resolvedData.regionBreakdown : [],
          recentPayments: Array.isArray(resolvedData?.recentPayments) ? resolvedData.recentPayments : [],
          availableMonths: Array.isArray(resolvedData?.availableMonths) ? resolvedData.availableMonths : [],
          availableCourses: Array.isArray(resolvedData?.availableCourses) ? resolvedData.availableCourses : [],
        };
        setSummary(nextSummary);
        setError("");
        writeTeacherPageCache(cacheKey, {
          summary: nextSummary,
          error: "",
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!mounted) return;
        const nextSummary = {
          ...DEFAULT_SUMMARY,
          settlementRows: [],
          paymentMethodBreakdown: [],
          regionBreakdown: [],
          recentPayments: [],
          availableMonths: [],
          availableCourses: [],
        };
        const nextError =
          language === "fa"
            ? "دریافت داده‌های درآمد ممکن نشد."
            : "Unable to load income data.";
        setSummary(nextSummary);
        setError(nextError);
        writeTeacherPageCache(cacheKey, {
          summary: nextSummary,
          error: nextError,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [filters, language, refreshSeed]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadPendingBankPayments = async () => {
      try {
        setBankPaymentsLoading(true);
        const rows = await fetchTeacherBankTransferPayments({
          signal: controller.signal,
          status: "pending_teacher_review",
        });
        if (!mounted) return;
        setPendingBankPayments(Array.isArray(rows) ? rows : []);
      } catch {
        if (!mounted) return;
        setPendingBankPayments([]);
      } finally {
        if (mounted) setBankPaymentsLoading(false);
      }
    };

    loadPendingBankPayments();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [refreshSeed]);

  const filterSummary = useMemo(() => {
    if (filters.month || filters.courseId || filters.paymentPlan || filters.payoutStatus) {
      return language === "fa"
        ? "درآمد این بخش براساس ماه، کورس، نوع پرداخت کورس و وضعیت تسویه فیلتر شده است."
        : "This income view is filtered by month, course, course payment plan, and settlement status.";
    }
    return language === "fa"
      ? "درآمد همه کورس‌های شما با وضعیت تسویه، روش پرداخت و بازار نمایش داده می‌شود."
      : "Income from all of your courses is shown together with payout status, payment method, and market.";
  }, [filters.courseId, filters.month, filters.paymentPlan, filters.payoutStatus, language]);

  const teacherShareRate = useMemo(
    () => Math.max(0, 100 - Number(summary.commissionRate || 0)),
    [summary.commissionRate],
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const totalCoursesInReport = useMemo(
    () => new Set(summary.settlementRows.map((row) => String(row.courseId || ""))).size,
    [summary.settlementRows],
  );

  const topPaymentMethod = useMemo(
    () => formatPaymentMethodInsightLabel(summary.paymentMethodBreakdown[0]?.methodLabel || "", language),
    [language, summary.paymentMethodBreakdown],
  );

  const topMarket = useMemo(
    () => summary.regionBreakdown[0]?.regionLabel || (language === "fa" ? "بدون داده" : "No data"),
    [language, summary.regionBreakdown],
  );

  const paymentSourceSummary = summary.moneyFlow || DEFAULT_SUMMARY.moneyFlow;

  const statCards = [
    {
      icon: DollarSign,
      title: language === "fa" ? "مجموع فروش" : "Gross Sales",
      value: formatMoney(summary.totalRevenue, language),
      description:
        language === "fa"
          ? "مجموع فروش واقعی در فیلتر فعلی"
          : "All successful sales in the current report",
      tone: "blue",
    },
    {
      icon: Wallet,
      title: language === "fa" ? "سهم خالص مدرس" : "Net Teacher Share",
      value: formatMoney(summary.teacherEarnings, language),
      description:
        language === "fa"
          ? "فروش منهای سهم پلتفرم"
          : "Gross sales minus platform commission",
      tone: "emerald",
    },
    {
      icon: Percent,
      title: language === "fa" ? "سهم پلتفرم" : "Platform Commission",
      value: formatMoney(summary.platformCommission, language),
      description:
        language === "fa"
          ? `نرخ موثر گزارش: ${summary.commissionRate || 0}٪`
          : `Effective report rate: ${summary.commissionRate || 0}%`,
      tone: "amber",
    },
    {
      icon: CircleDollarSign,
      title: language === "fa" ? "در انتظار تسویه" : "Awaiting Payout",
      value: formatMoney(summary.teacherPayoutDue, language),
      description:
        language === "fa"
          ? "فقط سهمی که باید از طرف پلتفرم به شما پرداخت شود"
          : "Only the share still payable to you by the platform",
      tone: "violet",
    },
    {
      icon: BadgeCheck,
      title: language === "fa" ? "تسویه‌شده توسط پلتفرم" : "Settled by Platform",
      value: formatMoney(summary.settledTeacherPayout, language),
      description:
        language === "fa"
          ? "سهمی که قبلاً از طرف پلتفرم پرداخت شده است"
          : "Teacher share already released by the platform",
      tone: "emerald",
    },
    {
      icon: CreditCard,
      title: language === "fa" ? "دریافت مستقیم بانکی" : "Direct Bank Collections",
      value: formatMoney(summary.directToTeacherAmount, language),
      description:
        language === "fa"
          ? "مبلغی که مستقیماً به کارت/حساب شما واریز شده است"
          : "Amount students paid directly into your bank/card",
      tone: "amber",
    },
    {
      icon: Percent,
      title: language === "fa" ? "سهم قابل‌کسر سیستم" : "Platform Deduction Due",
      value: formatMoney(summary.platformDeductionDue, language),
      description:
        language === "fa"
          ? "مبلغی که از پرداخت‌های بانکی مستقیم باید به سیستم تعلق بگیرد"
          : "Amount owed to the platform from direct bank payments",
      tone: "blue",
    },
  ];

  const insightCards = [
    {
      icon: CalendarRange,
      label: language === "fa" ? "دوره فعال" : "Active Period",
      value:
        summary.availableMonths.find((item) => item.monthKey === filters.month)?.label ||
        (language === "fa" ? "همه دوره‌ها" : "All periods"),
    },
    {
      icon: BookOpen,
      label: language === "fa" ? "کورس‌های این گزارش" : "Courses in Report",
      value: String(totalCoursesInReport || 0),
    },
    {
      icon: CreditCard,
      label: language === "fa" ? "روش غالب پرداخت" : "Top Payment Method",
      value: topPaymentMethod,
    },
    {
      icon: Globe2,
      label: language === "fa" ? "بازار غالب" : "Top Market",
      value: topMarket,
    },
  ];

  const resetFilters = () => {
    setFilters({
      month: "",
      courseId: "",
      paymentPlan: "",
      payoutStatus: "",
    });
  };

  const handleBankPaymentReview = async (paymentId, action) => {
    if (!paymentId) return;

    try {
      setBankReviewLoadingId(paymentId);
      if (action === "approve") {
        await approveTeacherBankTransferPayment(paymentId, "");
      } else {
        await rejectTeacherBankTransferPayment(paymentId, "");
      }
      setPendingBankPayments((prev) => prev.filter((item) => String(item?._id || "") !== String(paymentId)));
      setRefreshSeed((prev) => prev + 1);
    } catch (err) {
      setError(
        err?.message ||
          (language === "fa"
            ? "بررسی پرداخت بانکی انجام نشد."
            : "Unable to review bank transfer payment."),
      );
    } finally {
      setBankReviewLoadingId("");
    }
  };

  return (
    <TeacherLayout teacher={teacher} language={language} onLanguageChange={setLanguage}>
      <section
        className={`space-y-6 rounded-[28px] border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6 ${
          isRTL ? "text-right" : "text-left"
        }`}
      >
        <div className="overflow-hidden rounded-[28px] border border-[#D9E4F2] bg-[radial-gradient(circle_at_top_left,_rgba(11,79,216,0.15),_transparent_42%),linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_50%,#F5FFFC_100%)] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-white/90 px-3 py-1 text-xs font-black text-[#0B4FD8]">
                <Wallet size={14} />
                {language === "fa" ? "گزارش درآمد مدرس" : "Teacher Income Report"}
              </div>
              <h1 className="mt-4 text-2xl font-black text-[#0F172A] sm:text-3xl">
                {language === "fa" ? "درآمد، پرداخت‌ها و سهم شما" : "Your earnings, payments, and net share"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                {filterSummary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px] xl:max-w-[380px]">
              <HeroMetricCard
                title={language === "fa" ? "سهم خالص شما" : "Your Net Share"}
                value={formatMoney(summary.teacherEarnings, language)}
                note={language === "fa" ? "از تمام پرداخت‌های تاییدشده" : "From all confirmed payments"}
              />
              <HeroMetricCard
                title={language === "fa" ? "در انتظار تسویه" : "Awaiting Payout"}
                value={formatMoney(summary.teacherPayoutDue, language)}
                note={language === "fa" ? "مبلغ باقی‌مانده نزد پلتفرم" : "Remaining platform-held amount"}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
              <Filter size={16} className="text-[#0B4FD8]" />
              {language === "fa"
                ? `سهم مدرس: ${teacherShareRate}٪ • سهم سیستم: ${summary.commissionRate || 15}٪`
                : `Teacher share: ${teacherShareRate}% • Platform commission: ${summary.commissionRate || 15}%`}
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
              <BadgeCheck size={16} className="text-emerald-600" />
              {language === "fa"
                ? `${summary.paidRowsCount || 0} دوره تسویه‌شده`
                : `${summary.paidRowsCount || 0} paid cycles`}
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
              <Clock3 size={16} className="text-amber-600" />
              {language === "fa"
                ? `${summary.unpaidRowsCount || 0} دوره در انتظار`
                : `${summary.unpaidRowsCount || 0} waiting cycles`}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                {language === "fa" ? "فیلتر گزارش" : "Report Filters"}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {language === "fa"
                  ? "ماه، کورس، نوع پرداخت کورس یا وضعیت تسویه را انتخاب کنید."
                  : "Filter by month, course, course plan, or payout status."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                <Filter size={14} />
                {language === "fa"
                  ? `${activeFilterCount} فیلتر فعال`
                  : `${activeFilterCount} active filters`}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
              >
                <RefreshCw size={14} />
                {language === "fa" ? "بازنشانی" : "Reset"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterField
              label={language === "fa" ? "ماه / دوره" : "Month / Period"}
              value={filters.month}
              onChange={(value) => setFilters((prev) => ({ ...prev, month: value }))}
            >
              <option value="">{language === "fa" ? "همه ماه‌ها" : "All months"}</option>
              {summary.availableMonths.map((item) => (
                <option key={item.monthKey} value={item.monthKey}>
                  {formatMonthLabel(item.monthKey, item.label, language)}
                </option>
              ))}
            </FilterField>

            <FilterField
              label={language === "fa" ? "کورس" : "Course"}
              value={filters.courseId}
              onChange={(value) => setFilters((prev) => ({ ...prev, courseId: value }))}
            >
              <option value="">{language === "fa" ? "همه کورس‌ها" : "All courses"}</option>
              {summary.availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </FilterField>

            <FilterField
              label={language === "fa" ? "نوع پرداخت کورس" : "Course Payment Plan"}
              value={filters.paymentPlan}
              onChange={(value) => setFilters((prev) => ({ ...prev, paymentPlan: value }))}
            >
              <option value="">{language === "fa" ? "همه نوع‌ها" : "All plans"}</option>
              <option value="monthly">{formatPaymentPlanLabel("monthly", language)}</option>
              <option value="whole_period">{formatPaymentPlanLabel("whole_period", language)}</option>
            </FilterField>

            <FilterField
              label={language === "fa" ? "وضعیت تسویه" : "Payout Status"}
              value={filters.payoutStatus}
              onChange={(value) => setFilters((prev) => ({ ...prev, payoutStatus: value }))}
            >
              <option value="">{language === "fa" ? "همه وضعیت‌ها" : "All statuses"}</option>
              <option value="paid">{language === "fa" ? "تسویه‌شده" : "Paid"}</option>
              <option value="unpaid">{language === "fa" ? "پرداخت‌نشده" : "Unpaid"}</option>
            </FilterField>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <TeacherPageLoader
            label={language === "fa" ? "در حال بارگذاری درآمد" : "Loading earnings"}
            minHeight="min-h-[260px]"
          />
        ) : (
          <>
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
                      ? "گزارش مالی متوازن است"
                      : "Financial report reconciled"
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

            <SectionCard
              title={language === "fa" ? "رسیدهای بانکی در انتظار تایید" : "Pending Bank Transfer Proofs"}
              subtitle={
                language === "fa"
                  ? "وقتی شاگرد رسید انتقال بانکی را می‌فرستد، از این بخش آن را تایید یا رد کنید."
                  : "When a student sends a bank-transfer receipt, approve or reject it here."
              }
            >
              <div className="space-y-3 p-4">
                {bankPaymentsLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-600">
                    {language === "fa" ? "در حال بارگذاری رسیدها..." : "Loading proofs..."}
                  </div>
                ) : pendingBankPayments.length === 0 ? (
                  <EmptyCard
                    label={language === "fa" ? "فعلاً رسید بانکی در انتظار ندارید." : "No bank-transfer proofs are waiting right now."}
                  />
                ) : (
                  pendingBankPayments.map((payment) => {
                    const paymentId = String(payment?._id || "");
                    const isSaving = bankReviewLoadingId === paymentId;
                    const proofUrl = resolveProofUrl(payment?.paymentProof);
                    return (
                      <div key={paymentId} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <PaymentSourcePill isExternalCollection language={language} />
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">
                                {language === "fa" ? "در انتظار بررسی شما" : "Waiting for your review"}
                              </span>
                            </div>
                            <p className="text-base font-black text-slate-950">
                              {payment?.courseId?.title || (language === "fa" ? "کورس" : "Course")}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <MiniValue label={language === "fa" ? "شاگرد" : "Student"} value={payment?.studentId?.name || payment?.studentId?.email || "-"} />
                              <MiniValue label={language === "fa" ? "مرجع" : "Reference"} value={payment?.paymentReference || "-"} />
                              <MiniValue label={language === "fa" ? "فروش پایه" : "Base revenue"} value={formatMoney(Number(payment?.baseAmountUsdCents || 0) / 100, language)} emphasize />
                              <MiniValue label={language === "fa" ? "فرستنده" : "Sender"} value={payment?.senderAccount || "-"} />
                            </div>
                            {payment?.note ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                                <span className="font-black text-slate-800">{language === "fa" ? "یادداشت شاگرد:" : "Student note:"}</span> {payment.note}
                              </div>
                            ) : null}
                            {payment?.paymentProof ? (
                              <div className="space-y-3 xl:hidden">
                                <a
                                  href={proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                                >
                                  <Eye size={14} />
                                  {language === "fa" ? "دیدن رسید" : "View proof"}
                                </a>
                              </div>
                            ) : null}
                          </div>

                          <div className="w-full xl:w-[310px]">
                            {payment?.paymentProof ? (
                              <a
                                href={proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-3 hidden overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 xl:block"
                              >
                                <img
                                  src={proofUrl}
                                  alt={language === "fa" ? "رسید پرداخت" : "Payment proof"}
                                  className="block h-48 w-full object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ) : null}
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                              <button
                                type="button"
                                onClick={() => handleBankPaymentReview(paymentId, "approve")}
                                disabled={isSaving}
                                className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {isSaving ? (language === "fa" ? "..." : "...") : language === "fa" ? "تایید و فعال‌سازی شاگرد" : "Approve and activate student"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBankPaymentReview(paymentId, "reject")}
                                disabled={isSaving}
                                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {language === "fa" ? "رد و اجازه ارسال دوباره" : "Reject and allow resubmission"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((item) => (
                <StatCard
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  value={item.value}
                  description={item.description}
                  tone={item.tone}
                />
              ))}
            </div>

            <SectionCard
              title={language === "fa" ? "تفکیک روشن مسیر پول" : "Clear Money Flow Split"}
              subtitle={
                language === "fa"
                  ? "یک بخش پول‌هایی است که پلتفرم جمع کرده و باید برای شما تسویه کند. بخش دیگر پول‌هایی است که مستقیم به حساب شما رسیده و فقط سهم سیستم از آن باقی مانده است."
                  : "One side is money the platform collected and settles to you. The other side is money students paid directly to you, where only the platform deduction remains due."
              }
            >
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <MoneyFlowCard
                  title={language === "fa" ? "پول‌های پلتفرمی" : "Platform-collected money"}
                  amount={formatMoney(summary.teacherPayoutTotal, language)}
                  note={
                    language === "fa"
                      ? "این پرداخت‌ها اول به سیستم رسیده‌اند و سهم شما از همان‌جا برایتان پرداخت می‌شود."
                      : "These payments were collected by the platform first, then your share is released from the platform."
                  }
                  accent="emerald"
                  bullets={[
                    `${language === "fa" ? "سهم پرداخت‌شده به شما" : "Already paid to you"}: ${formatMoney(summary.settledTeacherPayout, language)}`,
                    `${language === "fa" ? "در انتظار تسویه" : "Still awaiting payout"}: ${formatMoney(summary.teacherPayoutDue, language)}`,
                    `${language === "fa" ? "تعداد این پرداخت‌ها" : "Payments in this flow"}: ${paymentSourceSummary.platformCount}`,
                  ]}
                />
                <MoneyFlowCard
                  title={language === "fa" ? "پول‌های مستقیم به شما" : "Direct-to-you money"}
                  amount={formatMoney(summary.directToTeacherAmount, language)}
                  note={
                    language === "fa"
                      ? "این مبلغ مستقیم به کارت یا حساب شما رفته و داخل موجودی پلتفرم نیست."
                      : "This amount went straight to your own bank/card and is not held by the platform."
                  }
                  accent="amber"
                  bullets={[
                    `${language === "fa" ? "سهم قابل‌کسر سیستم" : "Platform deduction due"}: ${formatMoney(summary.platformDeductionDue, language)}`,
                    `${language === "fa" ? "پرداخت‌های مستقیم" : "Direct payments"}: ${paymentSourceSummary.directCount}`,
                    `${language === "fa" ? "مانده نزد شما بعد از کسر" : "Remaining with you after deduction"}: ${formatMoney(Math.max(0, summary.directToTeacherAmount - summary.platformDeductionDue), language)}`,
                  ]}
                />
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {insightCards.map((item) => (
                <InsightCard
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BreakdownCard
                icon={CreditCard}
                title={language === "fa" ? "تفکیک بر اساس روش پرداخت" : "By Payment Method"}
                emptyLabel={language === "fa" ? "داده‌ای برای روش‌های پرداخت وجود ندارد." : "No payment-method data yet."}
                rows={summary.paymentMethodBreakdown}
                language={language}
                labelKey="methodLabel"
              />
              <BreakdownCard
                icon={Globe2}
                title={language === "fa" ? "تفکیک بر اساس کشور / بازار" : "By Country / Market"}
                emptyLabel={language === "fa" ? "داده‌ای برای کشورها وجود ندارد." : "No country/market data yet."}
                rows={summary.regionBreakdown}
                language={language}
                labelKey="regionLabel"
              />
            </div>

            <SectionCard
              title={language === "fa" ? "تراکنش‌های اخیر" : "Recent Payments"}
              subtitle={
                language === "fa"
                  ? "هر پرداخت با روش پرداخت، بازار و سهم مدرس در دالر."
                  : "Each payment with payment method, market, and teacher share in USD."
              }
            >
              <div className="space-y-3 p-4 md:hidden">
                {summary.recentPayments.length === 0 ? (
                  <EmptyCard
                    label={language === "fa" ? "هیچ پرداخت اخیر یافت نشد." : "No recent payments were found."}
                  />
                ) : (
                  summary.recentPayments.map((row) => (
                    <MobilePaymentCard key={row.paymentId || `${row.courseId}-${row.paidAt || row.monthKey}`} row={row} language={language} />
                  ))
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="hidden w-full min-w-[920px] text-sm md:table">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کورس" : "Course"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "روش پرداخت" : "Payment Method"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "بازار" : "Market"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "فروش پایه" : "Base Revenue"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "سهم مدرس" : "Teacher Share"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "دریافت مستقیم" : "Direct Collection"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کسر سیستم" : "Platform Deduction"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "تاریخ" : "Paid At"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                          {language === "fa" ? "هیچ پرداخت اخیر یافت نشد." : "No recent payments were found."}
                        </td>
                      </tr>
                    ) : (
                      summary.recentPayments.map((row) => (
                        <tr key={row.paymentId || `${row.courseId}-${row.paidAt || row.monthKey}`} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-bold text-slate-900">{row.courseTitle}</td>
                          <td className="px-4 py-3">
                            <div className="space-y-2">
                              <p className="font-semibold text-slate-700">{row.paymentMethod}</p>
                              <PaymentMethodPill methodCode={row.paymentMethodCode} methodLabel={row.paymentMethod} language={language} />
                              <PaymentSourcePill isExternalCollection={Boolean(row.isExternalCollection)} language={language} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                                {row.regionLabel}
                              </span>
                              {formatSourcePrice(row, "en") ? (
                                <p className="mt-1 text-[10px] font-bold text-slate-500" dir="ltr">
                                  {formatSourcePrice(row, "en")}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700" dir="ltr">
                            {formatGatewayAmount(row.gatewayAmount, row.gatewayCurrency, "en")}
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900" dir="ltr">
                            {formatMoney(row.totalRevenue, language)}
                          </td>
                          <td className="px-4 py-3 font-black text-emerald-700" dir="ltr">
                            {formatMoney(row.teacherEarnings, language)}
                          </td>
                          <td className="px-4 py-3 font-black text-amber-700" dir="ltr">
                            {formatMoney(row.directToTeacherAmount, language)}
                          </td>
                          <td className="px-4 py-3 font-black text-blue-700" dir="ltr">
                            {formatMoney(row.platformDeductionDue, language)}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                            {formatCompactDate(row.paidAt, language)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title={language === "fa" ? "درآمد ماهانه به تفکیک کورس" : "Monthly Course Income"}
              subtitle={
                language === "fa"
                  ? "برای هر ردیف می‌توانید جزئیات همه پرداخت‌های شاگردان را ببینید."
                  : "Open each row to review the student payments behind that income line."
              }
            >
              <div className="space-y-3 p-4 md:hidden">
                {summary.settlementRows.length === 0 ? (
                  <EmptyCard
                    label={language === "fa" ? "برای این فیلتر درآمدی پیدا نشد." : "No income rows were found for this filter."}
                  />
                ) : (
                  summary.settlementRows.map((row) => (
                    <MobileSettlementCard
                      key={`${row.courseId}-${row.monthKey}`}
                      row={row}
                      language={language}
                      onOpen={() => setSelectedRow(row)}
                    />
                  ))
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="hidden w-full min-w-[1120px] text-sm md:table">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "ماه / دوره" : "Month / Period"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کورس" : "Course"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "نوع پرداخت کورس" : "Course Payment Plan"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "تعداد فروش" : "Sales"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کل فروش" : "Revenue"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "سهم سیستم" : "Platform Cut"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "سهم مدرس" : "Teacher Share"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "دریافت مستقیم" : "Direct Collection"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کسر سیستم" : "Platform Deduction"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "وضعیت تسویه" : "Payout Status"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "جزئیات" : "Details"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.settlementRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                          {language === "fa" ? "برای این فیلتر درآمدی پیدا نشد." : "No income rows were found for this filter."}
                        </td>
                      </tr>
                    ) : (
                      summary.settlementRows.map((row) => {
                        const status = statusMap[row.status] || statusMap.unpaid;
                        return (
                          <tr key={`${row.courseId}-${row.monthKey}`} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3">
                              <p className="font-black text-slate-900">{row.monthKey}</p>
                              <p className="text-xs font-semibold text-slate-500">{row.periodLabel}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">{row.courseTitle}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                                {formatPaymentPlanLabel(row.paymentPlan, language)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{row.salesCount}</td>
                            <td className="px-4 py-3 font-black text-slate-900" dir="ltr">
                              {formatMoney(row.totalRevenue, language)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700" dir="ltr">
                              {formatMoney(row.platformCommission, language)}
                            </td>
                            <td className="px-4 py-3 font-black text-emerald-700" dir="ltr">
                              {formatMoney(row.teacherEarnings, language)}
                            </td>
                            <td className="px-4 py-3 font-black text-amber-700" dir="ltr">
                              {formatMoney(row.directToTeacherAmount, language)}
                            </td>
                            <td className="px-4 py-3 font-black text-blue-700" dir="ltr">
                              {formatMoney(row.platformDeductionDue, language)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}>
                                  {language === "fa" ? status.fa : status.en}
                                </span>
                                {row.paidAt ? (
                                  <p className="text-xs font-semibold text-slate-500">
                                    {language === "fa" ? "تاریخ تسویه:" : "Paid at:"} {formatCompactDate(row.paidAt, language)}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setSelectedRow(row)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
                              >
                                <Eye size={14} />
                                <span>{language === "fa" ? "جزئیات پرداخت‌ها" : "Payment details"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </section>

      <PaymentDetailsModal row={selectedRow} onClose={() => setSelectedRow(null)} language={language} />
    </TeacherLayout>
  );
}

function HeroMetricCard({ title, value, note }) {
  return (
    <article className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-sm backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">{note}</p>
    </article>
  );
}

function MoneyFlowCard({
  title,
  amount,
  note,
  accent = "blue",
  bullets = [],
}) {
  const accentClass = {
    blue: "border-blue-200 bg-blue-50/70 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    amber: "border-amber-200 bg-amber-50/80 text-amber-800",
  }[accent] || "border-blue-200 bg-blue-50/70 text-blue-800";

  return (
    <article className={`rounded-[24px] border p-5 ${accentClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{title}</p>
      <p className="mt-3 text-3xl font-black">{amount}</p>
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

function FilterField({ label, value, onChange, children }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0B4FD8]"
      >
        {children}
      </select>
    </label>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function StatCard({ icon: Icon, title, value, description, tone = "blue" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone] || "bg-blue-50 text-blue-700";

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>
    </article>
  );
}

function InsightCard({ icon: Icon, label, value }) {
  const normalizedValue = String(value ?? "").trim();
  const isCompactNumericValue = normalizedValue.length <= 4 && /^[\d.,]+$/.test(normalizedValue);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0B4FD8] shadow-sm">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p
            className={`mt-1 break-words font-black text-slate-900 ${
              isCompactNumericValue ? "text-3xl leading-none" : "text-sm leading-6"
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({ icon: Icon, title, rows = [], emptyLabel, language, labelKey }) {
  const maxRevenue = Math.max(...rows.map((item) => Number(item.totalRevenue || 0)), 0);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-[#0B4FD8]">
            <Icon size={18} />
          </span>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm font-medium text-slate-500">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const progress = maxRevenue > 0
                ? Math.max(8, Math.round((Number(row.totalRevenue || 0) / maxRevenue) * 100))
                : 0;

              return (
                <div key={row.methodKey || row.regionKey || row[labelKey]} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-900">{row[labelKey]}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {language === "fa" ? "تعداد پرداخت" : "Payments"}: {row.paymentsCount}
                      </p>
                    </div>
                    {"gatewayCurrency" in row ? (
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                        {getDisplayCurrency(row.gatewayCurrency)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0B4FD8] to-teal-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <MiniValue
                      label={language === "fa" ? "فروش پایه" : "Base Revenue"}
                      value={formatMoney(row.totalRevenue, language)}
                    />
                    <MiniValue
                      label={language === "fa" ? "دریافت مستقیم" : "Direct Collection"}
                      value={formatMoney(row.directToTeacherAmount, language)}
                    />
                    <MiniValue
                      label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
                      value={formatMoney(row.teacherEarnings, language)}
                      emphasize
                    />
                    <MiniValue
                      label={language === "fa" ? "کسر سیستم" : "Platform Deduction"}
                      value={formatMoney(row.platformDeductionDue, language)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniValue({ label, value, emphasize = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-black ${emphasize ? "text-emerald-700" : "text-slate-900"}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function PaymentSourcePill({ isExternalCollection, language }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${
        isExternalCollection
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isExternalCollection
        ? (language === "fa" ? "واریز مستقیم به مدرس" : "Direct to teacher")
        : (language === "fa" ? "تسویه از طرف پلتفرم" : "Platform-settled")}
    </span>
  );
}

function getPaymentMethodVisual(methodCode = "", methodLabel = "", language = "fa") {
  const normalized = String(methodCode || methodLabel || "").trim().toLowerCase();

  if (normalized.includes("bank")) {
    return {
      icon: Landmark,
      label: language === "fa" ? "انتقال بانکی" : "Bank transfer",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (normalized.includes("usdt") || normalized.includes("crypto") || normalized.includes("nowpayments")) {
    return {
      icon: Wallet,
      label: language === "fa" ? "کریپتو / USDT" : "Crypto / USDT",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    icon: CreditCard,
    label: language === "fa" ? "کارت / حساب‌پی" : "Card / HesabPay",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function PaymentMethodPill({ methodCode, methodLabel, language }) {
  const visual = getPaymentMethodVisual(methodCode, methodLabel, language);
  const Icon = visual.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${visual.className}`}>
      <Icon size={12} />
      {visual.label}
    </span>
  );
}

function MobilePaymentCard({ row, language }) {
  const isExternalCollection = Boolean(row.isExternalCollection);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{row.courseTitle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-500">{row.paymentMethod}</p>
            <PaymentMethodPill methodCode={row.paymentMethodCode} methodLabel={row.paymentMethod} language={language} />
            <PaymentSourcePill isExternalCollection={isExternalCollection} language={language} />
          </div>
        </div>
        <div className="text-end">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
            {row.regionLabel}
          </span>
          {formatSourcePrice(row, "en") ? (
            <p className="mt-1 text-[10px] font-bold text-slate-500" dir="ltr">
              {formatSourcePrice(row, "en")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniValue
          label={language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}
          value={formatGatewayAmount(row.gatewayAmount, row.gatewayCurrency, "en")}
        />
        <MiniValue
          label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
          value={formatMoney(row.teacherEarnings, language)}
          emphasize
        />
        <MiniValue
          label={language === "fa" ? "دریافت مستقیم" : "Direct Collection"}
          value={formatMoney(row.directToTeacherAmount, language)}
        />
        <MiniValue
          label={language === "fa" ? "کسر سیستم" : "Platform Deduction"}
          value={formatMoney(row.platformDeductionDue, language)}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        {language === "fa" ? "تاریخ پرداخت:" : "Paid at:"} {formatCompactDate(row.paidAt, language)}
      </p>
    </div>
  );
}

function MobileSettlementCard({ row, language, onOpen }) {
  const status = statusMap[row.status] || statusMap.unpaid;
  const hasDirectCollection = Number(row.directToTeacherAmount || 0) > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{row.courseTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{row.monthKey} • {row.periodLabel}</p>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}>
          {language === "fa" ? status.fa : status.en}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniValue
          label={language === "fa" ? "نوع پرداخت کورس" : "Course Plan"}
          value={formatPaymentPlanLabel(row.paymentPlan, language)}
        />
        <MiniValue
          label={language === "fa" ? "فروش" : "Sales"}
          value={String(row.salesCount || 0)}
        />
        <MiniValue
          label={language === "fa" ? "کل فروش" : "Revenue"}
          value={formatMoney(row.totalRevenue, language)}
        />
        <MiniValue
          label={language === "fa" ? "دریافت مستقیم" : "Direct Collection"}
          value={formatMoney(row.directToTeacherAmount, language)}
        />
        <MiniValue
          label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
          value={formatMoney(row.teacherEarnings, language)}
          emphasize
        />
        <MiniValue
          label={language === "fa" ? "کسر سیستم" : "Platform Deduction"}
          value={formatMoney(row.platformDeductionDue, language)}
        />
      </div>
      {hasDirectCollection ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          {language === "fa"
            ? "این مبلغ مستقیم به حساب/کارت شما واریز شده و جدا از تسویه پلتفرم حساب می‌شود."
            : "This amount was paid straight to your bank/card and is tracked separately from platform payout."}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-[#0B4FD8] hover:text-[#0B4FD8]"
      >
        <Eye size={16} />
        <span>{language === "fa" ? "دیدن جزئیات پرداخت‌ها" : "View payment details"}</span>
      </button>
    </div>
  );
}

function PaymentDetailsModal({ row, onClose, language }) {
  if (!row) return null;

  const details = Array.isArray(row.paymentDetails) ? row.paymentDetails : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              {language === "fa" ? "جزئیات پرداخت‌های شاگردان" : "Student Payment Details"}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {row.courseTitle} • {formatPaymentPlanLabel(row.paymentPlan, language)} • {row.monthKey}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {language === "fa"
                ? "تمام ارقام این جدول از اطلاعات ذخیره‌شده روز پرداخت گرفته می‌شود، نه نرخ امروز."
                : "All values here come from the stored payment-day snapshot, not today's exchange rate."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label={language === "fa" ? "بستن" : "Close"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 md:grid-cols-4">
          <MiniValue
            label={language === "fa" ? "کل فروش" : "Revenue"}
            value={formatMoney(row.totalRevenue, language)}
          />
          <MiniValue
            label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
            value={formatMoney(row.teacherEarnings, language)}
            emphasize
          />
          <MiniValue
            label={language === "fa" ? "دریافت مستقیم" : "Direct Collection"}
            value={formatMoney(row.directToTeacherAmount, language)}
          />
          <MiniValue
            label={language === "fa" ? "کسر سیستم" : "Platform Deduction"}
            value={formatMoney(row.platformDeductionDue, language)}
          />
        </div>

        <div className="max-h-[75vh] overflow-auto">
          <div className="space-y-3 p-4 md:hidden">
            {details.length === 0 ? (
              <EmptyCard
                label={language === "fa" ? "جزئیات پرداختی برای این ردیف وجود ندارد." : "No payment details are available for this row."}
              />
            ) : (
              details.map((item) => (
                <div key={item.paymentId || `${item.studentEmail}-${item.paidAt || ""}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{item.studentName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{item.studentEmail || "-"}</p>
                      {item.isExternalCollection ? (
                        <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
                          {language === "fa" ? "واریز مستقیم به مدرس" : "Direct to teacher"}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-end">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                        {item.regionLabel}
                      </span>
                      {formatSourcePrice(item, "en") ? (
                        <p className="mt-1 text-[10px] font-bold text-slate-500" dir="ltr">
                          {formatSourcePrice(item, "en")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MiniValue
                      label={language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}
                      value={formatGatewayAmount(item.gatewayAmount, item.gatewayCurrency, "en")}
                    />
                    <MiniValue
                      label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
                      value={formatMoney(item.teacherEarnings, language)}
                      emphasize
                    />
                    <MiniValue
                      label={language === "fa" ? "دریافت مستقیم" : "Direct Collection"}
                      value={formatMoney(item.directToTeacherAmount, language)}
                    />
                    <MiniValue
                      label={language === "fa" ? "کسر سیستم" : "Platform Deduction"}
                      value={formatMoney(item.platformDeductionDue, language)}
                    />
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      {language === "fa" ? "رخ / اسنپ‌شات روز پرداخت" : "Payment-Day Snapshot"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600" dir="ltr">
                      {getPaymentSnapshotLabel(item)}
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {language === "fa" ? "تاریخ پرداخت:" : "Paid at:"} {formatCompactDate(item.paidAt, language)}
                  </p>
                </div>
              ))
            )}
          </div>

          <table className="hidden w-full min-w-[1080px] text-sm md:table">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "شاگرد" : "Student"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "ایمیل" : "Email"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "روش پرداخت" : "Payment Method"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "بازار" : "Market"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "نرخ / اسنپ‌شات روز پرداخت" : "Payment-Day Rate Snapshot"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "فروش پایه" : "Base Revenue"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "سهم مدرس" : "Teacher Share"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "دریافت مستقیم" : "Direct Collection"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "کسر سیستم" : "Platform Deduction"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "مرجع" : "Reference"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "تاریخ" : "Paid At"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                    {language === "fa" ? "جزئیات پرداختی برای این ردیف وجود ندارد." : "No payment details are available for this row."}
                  </td>
                </tr>
              ) : (
                details.map((item) => (
                  <tr key={item.paymentId || `${item.studentEmail}-${item.paidAt || ""}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.studentName}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{item.studentEmail || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-700">{item.paymentMethod}</p>
                        <PaymentMethodPill methodCode={item.paymentMethodCode} methodLabel={item.paymentMethod} language={language} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                          {item.regionLabel}
                        </span>
                        {formatSourcePrice(item, "en") ? (
                          <p className="mt-1 text-[10px] font-bold text-slate-500" dir="ltr">
                            {formatSourcePrice(item, "en")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700" dir="ltr">
                      {formatGatewayAmount(item.gatewayAmount, item.gatewayCurrency, "en")}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600" dir="ltr">
                      {getPaymentSnapshotLabel(item)}
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900" dir="ltr">{formatMoney(item.baseRevenue, language)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700" dir="ltr">{formatMoney(item.teacherEarnings, language)}</td>
                    <td className="px-4 py-3 font-black text-slate-900" dir="ltr">{formatMoney(item.directToTeacherAmount, language)}</td>
                    <td className="px-4 py-3 font-black text-amber-700" dir="ltr">{formatMoney(item.platformDeductionDue, language)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.paymentReference || item.transactionId || "-"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                      {formatCompactDate(item.paidAt, language)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
