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
  RefreshCw,
  Wallet,
  X,
  Percent,
} from "lucide-react";
import TeacherLayout from "../layouts/TeacherLayout";
import TeacherPageLoader from "../components/common/TeacherPageLoader";
import useTeacherLanguage from "../hooks/useTeacherLanguage";
import useLiveDataRefresh from "../hooks/useLiveDataRefresh";
import { fetchTeacherEarningsSummary } from "../../services/teacherPortalService";
import { getAuthUser } from "../../services/portal";
import {
  getTeacherPageCacheKey,
  readTeacherPageCache,
  writeTeacherPageCache,
} from "../utils/teacherPageCache";

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

const getPaymentSnapshotLabel = (item = {}) => {
  if (item?.pricingSnapshotLabel) return item.pricingSnapshotLabel;

  const baseRevenue = Number(item?.baseRevenue || item?.totalRevenue || 0);
  const gatewayAmount = Number(item?.gatewayAmount || 0);
  const gatewayCurrency = String(item?.gatewayCurrency || "").toUpperCase();

  if (baseRevenue > 0 && gatewayAmount > 0 && gatewayCurrency) {
    const computedRate = Math.round((gatewayAmount / baseRevenue) * 1000000) / 1000000;
    if (gatewayCurrency === "AFN" || gatewayCurrency === "IRR") {
      return `${baseRevenue} USD -> ${gatewayAmount} ${gatewayCurrency} (1 USD = ${computedRate} ${gatewayCurrency})`;
    }
    return `${baseRevenue} USD -> ${gatewayAmount} ${gatewayCurrency}`;
  }

  return "-";
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
  paymentsCount: 0,
  paidRowsCount: 0,
  unpaidRowsCount: 0,
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

const applyTeacherIncomeFilters = (data, filters = {}) => {
  const month = String(filters.month || "");
  const courseId = String(filters.courseId || "");
  const paymentPlan = String(filters.paymentPlan || "");
  const payoutStatus = String(filters.payoutStatus || "");

  let settlementRows = Array.isArray(data?.settlementRows) ? data.settlementRows : [];

  if (month) settlementRows = settlementRows.filter((row) => String(row.monthKey) === month);
  if (courseId) settlementRows = settlementRows.filter((row) => String(row.courseId) === courseId);
  if (paymentPlan) settlementRows = settlementRows.filter((row) => String(row.paymentPlan) === paymentPlan);
  if (payoutStatus) settlementRows = settlementRows.filter((row) => String(row.status) === payoutStatus);

  const paymentIds = new Set(
    settlementRows.flatMap((row) => (Array.isArray(row.paymentDetails) ? row.paymentDetails.map((item) => item.paymentId) : [])),
  );

  const recentPayments = (Array.isArray(data?.recentPayments) ? data.recentPayments : [])
    .filter((item) => paymentIds.size === 0 || paymentIds.has(item.paymentId));

  const summarizeBy = (items, keyName, labelName, extraKeys = []) => {
    const map = new Map();
    items.forEach((item) => {
      const key = String(item[keyName] || item[labelName] || "");
      const existing = map.get(key) || {
        [keyName]: item[keyName],
        [labelName]: item[labelName],
        paymentsCount: 0,
        totalRevenue: 0,
        teacherEarnings: 0,
      };
      extraKeys.forEach((extraKey) => {
        if (!(extraKey in existing)) existing[extraKey] = item[extraKey];
      });
      existing.paymentsCount += 1;
      existing.totalRevenue += Number(item.baseRevenue || item.totalRevenue || 0);
      existing.teacherEarnings += Number(item.teacherEarnings || 0);
      map.set(key, existing);
    });
    return Array.from(map.values()).map((row) => ({
      ...row,
      totalRevenue: Math.round(row.totalRevenue * 100) / 100,
      teacherEarnings: Math.round(row.teacherEarnings * 100) / 100,
    }));
  };

  return {
    ...data,
    totalRevenue: settlementRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0),
    platformCommission: settlementRows.reduce((sum, row) => sum + Number(row.platformCommission || 0), 0),
    teacherEarnings: settlementRows.reduce((sum, row) => sum + Number(row.teacherEarnings || 0), 0),
    paymentsCount: settlementRows.reduce((sum, row) => sum + Number(row.salesCount || 0), 0),
    paidRowsCount: settlementRows.filter((row) => row.status === "paid").length,
    unpaidRowsCount: settlementRows.filter((row) => row.status === "unpaid").length,
    settlementRows,
    recentPayments,
    paymentMethodBreakdown: summarizeBy(
      settlementRows.flatMap((row) => row.paymentDetails || []),
      "paymentMethodCode",
      "paymentMethod",
    ).map((row) => ({
      methodKey: row.paymentMethodCode,
      methodLabel: row.paymentMethod,
      paymentsCount: row.paymentsCount,
      totalRevenue: row.totalRevenue,
      teacherEarnings: row.teacherEarnings,
    })),
    regionBreakdown: summarizeBy(
      settlementRows.flatMap((row) => row.paymentDetails || []),
      "regionLabel",
      "regionLabel",
      ["gatewayCurrency"],
    ).map((row) => ({
      regionKey: row.regionLabel?.toLowerCase().replace(/\s+/g, "_"),
      regionLabel: row.regionLabel,
      gatewayCurrency: row.gatewayCurrency,
      paymentsCount: row.paymentsCount,
      totalRevenue: row.totalRevenue,
      teacherEarnings: row.teacherEarnings,
    })),
  };
};

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
        const resolvedData = applyTeacherIncomeFilters(data || {}, filters);
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
  }, [filters.courseId, filters.month, filters.paymentPlan, filters.payoutStatus, refreshSeed]);

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

  const paidSettlementSummary = useMemo(() => {
    return summary.settlementRows
      .filter((row) => row.status === "paid")
      .reduce(
        (acc, row) => {
          acc.totalRevenue += Number(row.totalRevenue || 0);
          acc.platformCommission += Number(row.platformCommission || 0);
          acc.teacherEarnings += Number(row.teacherEarnings || 0);
          acc.paymentsCount += Number(row.salesCount || 0);
          return acc;
        },
        {
          totalRevenue: 0,
          platformCommission: 0,
          teacherEarnings: 0,
          paymentsCount: 0,
        },
      );
  }, [summary.settlementRows]);

  const unpaidSettlementSummary = useMemo(() => {
    return summary.settlementRows
      .filter((row) => row.status === "unpaid")
      .reduce(
        (acc, row) => {
          acc.totalRevenue += Number(row.totalRevenue || 0);
          acc.platformCommission += Number(row.platformCommission || 0);
          acc.teacherEarnings += Number(row.teacherEarnings || 0);
          acc.paymentsCount += Number(row.salesCount || 0);
          return acc;
        },
        {
          totalRevenue: 0,
          platformCommission: 0,
          teacherEarnings: 0,
          paymentsCount: 0,
        },
      );
  }, [summary.settlementRows]);

  const statCards = [
    {
      icon: DollarSign,
      title: language === "fa" ? "فروش تسویه‌شده" : "Settled Revenue",
      value: formatMoney(paidSettlementSummary.totalRevenue, language),
      description:
        language === "fa"
          ? "فقط فروش‌هایی که توسط سیستم تسویه شده‌اند"
          : "Only revenue from cycles already paid by the system",
      tone: "blue",
    },
    {
      icon: Wallet,
      title: language === "fa" ? "سهم پرداخت‌شده شما" : "Paid Out to You",
      value: formatMoney(paidSettlementSummary.teacherEarnings, language),
      description:
        language === "fa"
          ? "مبلغی که واقعاً برای شما تسویه شده است"
          : "Net amount already settled to you",
      tone: "emerald",
    },
    {
      icon: Percent,
      title: language === "fa" ? "سهم سیستمِ تسویه‌شده" : "Settled Platform Share",
      value: formatMoney(paidSettlementSummary.platformCommission, language),
      description:
        language === "fa"
          ? `فقط از ردیف‌های تسویه‌شده • ${summary.commissionRate || 15}٪`
          : `Only from settled rows • ${summary.commissionRate || 15}%`,
      tone: "amber",
    },
    {
      icon: CircleDollarSign,
      title: language === "fa" ? "در انتظار تسویه" : "Awaiting Payout",
      value: formatMoney(unpaidSettlementSummary.teacherEarnings, language),
      description:
        language === "fa"
          ? `${unpaidSettlementSummary.paymentsCount || 0} پرداخت در ${summary.unpaidRowsCount || 0} دوره`
          : `${unpaidSettlementSummary.paymentsCount || 0} payments across ${summary.unpaidRowsCount || 0} waiting cycles`,
      tone: "violet",
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
                title={language === "fa" ? "فروش تسویه‌شده" : "Settled Revenue"}
                value={formatMoney(paidSettlementSummary.totalRevenue, language)}
                note={language === "fa" ? "فقط فروش‌های تسویه‌شده" : "Only settled revenue"}
              />
              <HeroMetricCard
                title={language === "fa" ? "سهم تسویه‌شده شما" : "Settled Your Share"}
                value={formatMoney(paidSettlementSummary.teacherEarnings, language)}
                note={language === "fa" ? `${teacherShareRate}٪ سهم مدرسِ پرداخت‌شده` : `${teacherShareRate}% settled teacher share`}
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
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "تاریخ" : "Paid At"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          {language === "fa" ? "هیچ پرداخت اخیر یافت نشد." : "No recent payments were found."}
                        </td>
                      </tr>
                    ) : (
                      summary.recentPayments.map((row) => (
                        <tr key={row.paymentId || `${row.courseId}-${row.paidAt || row.monthKey}`} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-bold text-slate-900">{row.courseTitle}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{row.paymentMethod}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                              {row.regionLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700" dir="ltr">
                            {`${new Intl.NumberFormat("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: row.gatewayCurrency === "USDT" ? 6 : 2,
                            }).format(Number(row.gatewayAmount || 0))} ${row.gatewayCurrency || ""}`}
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900" dir="ltr">
                            {formatMoney(row.totalRevenue, language)}
                          </td>
                          <td className="px-4 py-3 font-black text-emerald-700" dir="ltr">
                            {formatMoney(row.teacherEarnings, language)}
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
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "وضعیت تسویه" : "Payout Status"}</th>
                      <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "جزئیات" : "Details"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.settlementRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
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
                        {row.gatewayCurrency}
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
                      label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
                      value={formatMoney(row.teacherEarnings, language)}
                      emphasize
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

function MobilePaymentCard({ row, language }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{row.courseTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{row.paymentMethod}</p>
        </div>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
          {row.regionLabel}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniValue
          label={language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}
          value={`${new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: row.gatewayCurrency === "USDT" ? 6 : 2,
          }).format(Number(row.gatewayAmount || 0))} ${row.gatewayCurrency || ""}`}
        />
        <MiniValue
          label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
          value={formatMoney(row.teacherEarnings, language)}
          emphasize
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
          label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
          value={formatMoney(row.teacherEarnings, language)}
          emphasize
        />
      </div>
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
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                      {item.regionLabel}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MiniValue
                      label={language === "fa" ? "مبلغ پرداختی" : "Charged Amount"}
                      value={`${new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: item.gatewayCurrency === "USDT" ? 6 : 2,
                      }).format(Number(item.gatewayAmount || 0))} ${item.gatewayCurrency || ""}`}
                    />
                    <MiniValue
                      label={language === "fa" ? "سهم مدرس" : "Teacher Share"}
                      value={formatMoney(item.teacherEarnings, language)}
                      emphasize
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
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "مرجع" : "Reference"}</th>
                <th className="px-4 py-3 text-start font-bold">{language === "fa" ? "تاریخ" : "Paid At"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {language === "fa" ? "جزئیات پرداختی برای این ردیف وجود ندارد." : "No payment details are available for this row."}
                  </td>
                </tr>
              ) : (
                details.map((item) => (
                  <tr key={item.paymentId || `${item.studentEmail}-${item.paidAt || ""}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.studentName}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">{item.studentEmail || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{item.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                        {item.regionLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700" dir="ltr">
                      {`${new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: item.gatewayCurrency === "USDT" ? 6 : 2,
                      }).format(Number(item.gatewayAmount || 0))} ${item.gatewayCurrency || ""}`}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600" dir="ltr">
                      {getPaymentSnapshotLabel(item)}
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900" dir="ltr">{formatMoney(item.baseRevenue, language)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700" dir="ltr">{formatMoney(item.teacherEarnings, language)}</td>
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
