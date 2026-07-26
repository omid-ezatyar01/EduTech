import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import TeacherIncomeSettlement from "../models/TeacherIncomeSettlement.js";
import { getTeacherDeductionPercentage } from "./platformSettings.js";
import { roundMoney } from "./teacherEarnings.js";

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const getCourseTeacherId = (course = {}) =>
  course?.teacher?._id ||
  course?.teacherId?._id ||
  course?.createdBy?._id ||
  course?.teacher ||
  course?.teacherId ||
  course?.createdBy ||
  null;

const getCourseTeacherName = (course = {}) =>
  course?.teacher?.name ||
  course?.teacherId?.name ||
  course?.createdBy?.name ||
  "Teacher";

const getCourseTeacherEmail = (course = {}) =>
  course?.teacher?.email ||
  course?.teacherId?.email ||
  course?.createdBy?.email ||
  "";

const getPaymentPlanLabel = (paymentPlan = "") => (
  String(paymentPlan || "").toLowerCase() === "whole_period" ? "whole_period" : "monthly"
);

const getStudentDisplayName = (student = {}, fallbackEmail = "") =>
  student?.nameFa ||
  student?.firstNameFa ||
  student?.name ||
  student?.firstName ||
  student?.email ||
  fallbackEmail ||
  "Student";

const resolveUsdAmount = (payment = {}) => {
  const baseUsd = Number(payment?.baseAmountUsdCents || 0) / 100;
  if (Number.isFinite(baseUsd) && baseUsd > 0) return baseUsd;

  const amount = Number(payment?.amount || 0);
  const currency = String(payment?.currency || "").toUpperCase();
  if (currency === "USD" || currency === "USDT") {
    return amount;
  }

  return 0;
};

const resolvePaymentMethodLabel = (payment = {}) => {
  const method = String(payment?.paymentMethod || "").toLowerCase();
  if (method === "hesabpay") return "HesabPay (Visa / MasterCard)";
  if (method === "usdt_bsc_direct") return "Crypto (USDT BSC)";
  if (method === "nowpayments_crypto") return "Crypto Gateway";
  if (method === "bank_transfer") return "Bank Transfer";
  return payment?.paymentMethod || "Payment";
};

const resolveRegionMeta = (payment = {}) => {
  const explicitRegion = String(
    payment?.pricingRegion || payment?.orderId?.pricingRegion || "",
  ).toLowerCase();
  const sourceCurrency = String(
    payment?.sourcePriceCurrency || payment?.orderId?.sourcePriceCurrency || "",
  ).toUpperCase();
  if (["afghanistan", "iran", "international"].includes(explicitRegion)) {
    return {
      key: explicitRegion,
      label:
        explicitRegion === "afghanistan"
          ? "Afghanistan"
          : explicitRegion === "iran"
            ? "Iran"
            : "International",
      currency:
        sourceCurrency ||
        (explicitRegion === "afghanistan"
          ? "AFN"
          : explicitRegion === "iran"
            ? "TOMAN"
            : "USD"),
    };
  }

  const currency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  if (currency === "AFN") {
    return { key: "afghanistan", label: "Afghanistan", currency };
  }
  if (currency === "IRR" || currency === "TOMAN") {
    return { key: "iran", label: "Iran", currency };
  }
  return { key: "international", label: "International", currency };
};

const normalizeCommissionRate = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.min(100, Number(fallback) || 0));
  return Math.max(0, Math.min(100, numeric));
};

export const summarizeTeacherIncomeRows = ({
  rows = [],
  defaultCommissionRate = 0,
} = {}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const paymentDetails = safeRows.flatMap((row) =>
    (Array.isArray(row.paymentDetails) ? row.paymentDetails : []).map((payment) => ({
      ...payment,
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      monthKey: row.monthKey,
      settlementStatus: row.status,
    })),
  );

  const totalRevenue = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0),
  );
  const platformCommission = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.platformCommission || 0), 0),
  );
  const teacherEarnings = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.teacherEarnings || 0), 0),
  );
  const teacherPayoutTotal = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.teacherPayoutDue || 0), 0),
  );
  const teacherPayoutDue = roundMoney(
    safeRows
      .filter((row) => row.status !== "paid")
      .reduce((sum, row) => sum + Number(row.teacherPayoutDue || 0), 0),
  );
  const settledTeacherPayout = roundMoney(
    safeRows
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + Number(row.teacherPayoutDue || 0), 0),
  );
  const directToTeacherAmount = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.directToTeacherAmount || 0), 0),
  );
  const platformDeductionDue = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.platformDeductionDue || 0), 0),
  );
  const externalCollectedRevenue = roundMoney(
    safeRows.reduce((sum, row) => sum + Number(row.externalCollectedRevenue || 0), 0),
  );
  const paymentsCount = safeRows.reduce(
    (sum, row) => sum + Number(row.salesCount || 0),
    0,
  );
  const expectedTeacherEarnings = roundMoney(
    teacherPayoutTotal + directToTeacherAmount - platformDeductionDue,
  );
  const reconciliationDifference = roundMoney(
    teacherEarnings - expectedTeacherEarnings,
  );
  const effectiveCommissionRate =
    totalRevenue > 0
      ? roundMoney((platformCommission / totalRevenue) * 100)
      : normalizeCommissionRate(defaultCommissionRate);
  const commissionRatesUsed = Array.from(
    new Set(
      paymentDetails
        .map((payment) => normalizeCommissionRate(
          payment.commissionRate,
          defaultCommissionRate,
        ))
        .filter((rate) => Number.isFinite(rate)),
    ),
  ).sort((a, b) => a - b);
  const moneyFlow = paymentDetails.reduce(
    (summary, payment) => {
      if (payment.isExternalCollection) {
        summary.directCount += 1;
        summary.directAmount += Number(payment.directToTeacherAmount || 0);
        summary.deductionDue += Number(payment.platformDeductionDue || 0);
      } else {
        summary.platformCount += 1;
        summary.platformRevenue += Number(payment.baseRevenue || 0);
        summary.platformTeacherShare += Number(payment.teacherEarnings || 0);
      }
      return summary;
    },
    {
      directCount: 0,
      directAmount: 0,
      deductionDue: 0,
      platformCount: 0,
      platformRevenue: 0,
      platformTeacherShare: 0,
    },
  );
  moneyFlow.directAmount = roundMoney(moneyFlow.directAmount);
  moneyFlow.deductionDue = roundMoney(moneyFlow.deductionDue);
  moneyFlow.platformRevenue = roundMoney(moneyFlow.platformRevenue);
  moneyFlow.platformTeacherShare = roundMoney(moneyFlow.platformTeacherShare);

  const courseWiseMap = new Map();
  const paymentMethodMap = new Map();
  const regionMap = new Map();

  safeRows.forEach((row) => {
    const course = courseWiseMap.get(row.courseId) || {
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      salesCount: 0,
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
      teacherPayoutDue: 0,
      settledTeacherPayout: 0,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
      externalCollectedRevenue: 0,
    };
    course.salesCount += Number(row.salesCount || 0);
    course.totalRevenue += Number(row.totalRevenue || 0);
    course.platformCommission += Number(row.platformCommission || 0);
    course.teacherEarnings += Number(row.teacherEarnings || 0);
    course.teacherPayoutDue += row.status === "paid" ? 0 : Number(row.teacherPayoutDue || 0);
    course.settledTeacherPayout += row.status === "paid" ? Number(row.teacherPayoutDue || 0) : 0;
    course.directToTeacherAmount += Number(row.directToTeacherAmount || 0);
    course.platformDeductionDue += Number(row.platformDeductionDue || 0);
    course.externalCollectedRevenue += Number(row.externalCollectedRevenue || 0);
    courseWiseMap.set(row.courseId, course);
  });

  paymentDetails.forEach((payment) => {
    const methodKey = String(payment.paymentMethodCode || "unknown");
    const method = paymentMethodMap.get(methodKey) || {
      methodKey,
      methodLabel: payment.paymentMethod || "Payment",
      paymentsCount: 0,
      totalRevenue: 0,
      teacherEarnings: 0,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
    };
    method.paymentsCount += 1;
    method.totalRevenue += Number(payment.baseRevenue || 0);
    method.teacherEarnings += Number(payment.teacherEarnings || 0);
    method.directToTeacherAmount += Number(payment.directToTeacherAmount || 0);
    method.platformDeductionDue += Number(payment.platformDeductionDue || 0);
    paymentMethodMap.set(methodKey, method);

    const regionKey = String(payment.pricingRegion || payment.regionKey || "international");
    const region = regionMap.get(regionKey) || {
      regionKey,
      regionLabel: payment.regionLabel || "International",
      gatewayCurrency: payment.sourcePriceCurrency || payment.gatewayCurrency || "USD",
      paymentsCount: 0,
      totalRevenue: 0,
      teacherEarnings: 0,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
    };
    region.paymentsCount += 1;
    region.totalRevenue += Number(payment.baseRevenue || 0);
    region.teacherEarnings += Number(payment.teacherEarnings || 0);
    region.directToTeacherAmount += Number(payment.directToTeacherAmount || 0);
    region.platformDeductionDue += Number(payment.platformDeductionDue || 0);
    regionMap.set(regionKey, region);
  });

  const roundBreakdown = (row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    platformCommission:
      row.platformCommission === undefined
        ? undefined
        : roundMoney(row.platformCommission),
    teacherEarnings: roundMoney(row.teacherEarnings),
    teacherPayoutDue:
      row.teacherPayoutDue === undefined
        ? undefined
        : roundMoney(row.teacherPayoutDue),
    settledTeacherPayout:
      row.settledTeacherPayout === undefined
        ? undefined
        : roundMoney(row.settledTeacherPayout),
    directToTeacherAmount: roundMoney(row.directToTeacherAmount),
    platformDeductionDue: roundMoney(row.platformDeductionDue),
    externalCollectedRevenue:
      row.externalCollectedRevenue === undefined
        ? undefined
        : roundMoney(row.externalCollectedRevenue),
  });

  return {
    reportCurrency: "USD",
    commissionRate: effectiveCommissionRate,
    currentCommissionRate: normalizeCommissionRate(defaultCommissionRate),
    commissionRatesUsed,
    totalRevenue,
    platformCommission,
    teacherEarnings,
    teacherPayoutTotal,
    teacherPayoutDue,
    settledTeacherPayout,
    directToTeacherAmount,
    platformDeductionDue,
    externalCollectedRevenue,
    netTeacherPosition: roundMoney(teacherPayoutDue - platformDeductionDue),
    paymentsCount,
    teachersCount: new Set(safeRows.map((row) => String(row.teacherId || ""))).size,
    coursesCount: new Set(safeRows.map((row) => String(row.courseId || ""))).size,
    settledPaymentsCount: safeRows
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + Number(row.salesCount || 0), 0),
    outstandingPaymentsCount: safeRows
      .filter((row) => row.status !== "paid")
      .reduce((sum, row) => sum + Number(row.salesCount || 0), 0),
    paidRowsCount: safeRows.filter((row) => row.status === "paid").length,
    unpaidRowsCount: safeRows.filter((row) => row.status !== "paid").length,
    reconciliation: {
      expectedTeacherEarnings,
      actualTeacherEarnings: teacherEarnings,
      difference: reconciliationDifference,
      isBalanced: Math.abs(reconciliationDifference) < 0.01,
    },
    moneyFlow,
    courseWise: Array.from(courseWiseMap.values())
      .map(roundBreakdown)
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    paymentMethodBreakdown: Array.from(paymentMethodMap.values())
      .map(roundBreakdown)
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    regionBreakdown: Array.from(regionMap.values())
      .map(roundBreakdown)
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    recentPayments: paymentDetails
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
      .slice(0, 12),
  };
};

const resolveStoredPricingSnapshot = (payment = {}) => {
  const gatewayCurrency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  const exchangeRate = String(payment?.exchangeRate || "").trim();
  const exchangeRateSource = String(payment?.exchangeRateSource || "").trim();
  const baseUsd = Number(payment?.baseAmountUsdCents || 0) / 100;
  const gatewayAmount = Number(payment?.gatewayAmount || payment?.amount || 0);
  const computedRate =
    baseUsd > 0 && gatewayAmount > 0 ? Math.round((gatewayAmount / baseUsd) * 1000000) / 1000000 : 0;

  if (gatewayCurrency === "AFN" || gatewayCurrency === "IRR") {
    return {
      snapshotLabel:
        baseUsd > 0 && gatewayAmount > 0
          ? `${baseUsd} USD -> ${gatewayAmount} ${gatewayCurrency}${
            exchangeRate || computedRate
              ? ` (1 USD = ${exchangeRate || computedRate} ${gatewayCurrency})`
              : ""
          }`
          : exchangeRate
            ? `1 USD = ${exchangeRate} ${gatewayCurrency}`
            : "",
      exchangeRate,
      exchangeRateSource,
    };
  }

  if (gatewayCurrency === "USDT") {
    return {
      snapshotLabel: exchangeRateSource
        ? `${exchangeRateSource} USD -> ${gatewayAmount} USDT`
        : baseUsd > 0 && gatewayAmount > 0
          ? `${baseUsd} USD -> ${gatewayAmount} USDT`
          : "",
      exchangeRate,
      exchangeRateSource,
    };
  }

  return {
    snapshotLabel: baseUsd > 0 ? `${baseUsd} USD` : "",
    exchangeRate,
    exchangeRateSource,
  };
};

const getCycleStartDay = (course = {}) => {
  const startDate = course?.startDate ? new Date(course.startDate) : null;
  const day = startDate && !Number.isNaN(startDate.getTime()) ? startDate.getUTCDate() : 1;
  return day === 15 ? 15 : 1;
};

const formatMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const startOfUtcDay = (dateValue) => {
  const date = new Date(dateValue);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const endOfUtcDay = (dateValue) => {
  const date = new Date(dateValue);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
};

const addUtcMonths = (dateValue, months) =>
  new Date(Date.UTC(
    dateValue.getUTCFullYear(),
    dateValue.getUTCMonth() + months,
    dateValue.getUTCDate(),
  ));

export const buildSettlementWindow = ({ paidAt, cycleStartDay = 1 }) => {
  const source = paidAt ? new Date(paidAt) : new Date();
  const safeDate = Number.isNaN(source.getTime()) ? new Date() : source;
  const year = safeDate.getUTCFullYear();
  const month = safeDate.getUTCMonth();
  const day = safeDate.getUTCDate();

  if (cycleStartDay === 15) {
    const periodStart = day >= 15
      ? new Date(Date.UTC(year, month, 15))
      : new Date(Date.UTC(year, month - 1, 15));
    const nextPeriodStart = addUtcMonths(periodStart, 1);
    const periodEnd = new Date(nextPeriodStart.getTime() - 1);

    return {
      cycleStartDay: 15,
      monthKey: formatMonthKey(periodStart),
      periodStart,
      periodEnd,
    };
  }

  const periodStart = new Date(Date.UTC(year, month, 1));
  const nextPeriodStart = new Date(Date.UTC(year, month + 1, 1));
  const periodEnd = new Date(nextPeriodStart.getTime() - 1);

  return {
    cycleStartDay: 1,
    monthKey: formatMonthKey(periodStart),
    periodStart,
    periodEnd,
  };
};

const formatWindowLabel = ({ periodStart, periodEnd }) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const format = (value) =>
    value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return `${format(start)} - ${format(end)}`;
};

export const calculateTeacherIncomeLedger = async ({
  teacherId = null,
  monthKey = "",
  courseId = "",
  paymentPlan = "",
  payoutStatus = "",
} = {}) => {
  const commissionRate = await getTeacherDeductionPercentage();
  const courseFilter = teacherId ? teacherCourseFilter(teacherId) : {};
  if (courseId) {
    courseFilter._id = courseId;
  }
  if (paymentPlan) {
    courseFilter.paymentPlan = paymentPlan;
  }

  const courses = await Course.find(courseFilter)
    .select("title startDate teacher teacherId createdBy paymentPlan")
    .populate("teacher", "name email")
    .populate("teacherId", "name email")
    .populate("createdBy", "name email")
    .lean();

  if (!courses.length) {
    const emptySummary = summarizeTeacherIncomeRows({
      rows: [],
      defaultCommissionRate: commissionRate,
    });
    return {
      ...emptySummary,
      teacherShareRate: roundMoney(100 - Number(emptySummary.commissionRate || 0)),
      settlementRows: [],
      availableMonths: [],
      availableCourses: [],
      availableTeachers: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const courseIds = courses.map((course) => course._id);
  const courseMap = new Map(courses.map((course) => [String(course._id), course]));
  const teacherIds = Array.from(
    new Set(
      courses
        .map((course) => getCourseTeacherId(course))
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );

  const payments = await Payment.find({
    courseId: { $in: courseIds },
    $or: [{ status: "paid" }, { paymentStatus: "paid" }],
  })
    .select("courseId orderId amount baseAmountUsdCents pricingRegion sourcePriceAmount sourcePriceCurrency sourceExchangeRate sourceExchangeRateSource sourceRateRetrievedAt platformCommissionRate currency gatewayAmount gatewayCurrency paymentMethod exchangeRate exchangeRateSource paidAt createdAt studentId customerEmail paymentReference transactionId transactionSignature isExternalCollection")
    .populate("studentId", "_id name nameFa firstName firstNameFa email")
    .populate("orderId", "pricingRegion sourcePriceAmount sourcePriceCurrency sourceExchangeRate sourceExchangeRateSource sourceRateRetrievedAt platformCommissionRate")
    .lean();

  const rowMap = new Map();
  const monthMap = new Map();

  for (const payment of payments) {
    if (!payment?.studentId?._id) continue;
    const course = courseMap.get(String(payment.courseId));
    if (!course) continue;

    const resolvedTeacherId = getCourseTeacherId(course);
    if (!resolvedTeacherId) continue;

    const cycleStartDay = getCycleStartDay(course);
    const window = buildSettlementWindow({
      paidAt: payment.paidAt || payment.createdAt || new Date(),
      cycleStartDay,
    });

    if (monthKey && window.monthKey !== monthKey) continue;

    const rowKey = [
      String(resolvedTeacherId),
      String(course._id),
      window.monthKey,
    ].join(":");

    const amountUsd = resolveUsdAmount(payment);
    const paymentCommissionRate = normalizeCommissionRate(
      payment?.platformCommissionRate ?? payment?.orderId?.platformCommissionRate,
      commissionRate,
    );
    const commissionAmount = (amountUsd * paymentCommissionRate) / 100;
    const teacherAmount = amountUsd - commissionAmount;
    const isExternalCollection =
      String(payment?.paymentMethod || "").toLowerCase() === "bank_transfer" ||
      Boolean(payment?.isExternalCollection);
    const teacherPayoutAmount = isExternalCollection ? 0 : teacherAmount;
    const directToTeacherAmount = isExternalCollection ? amountUsd : 0;
    const platformDeductionDue = isExternalCollection ? commissionAmount : 0;
    const methodLabel = resolvePaymentMethodLabel(payment);
    const methodKey = String(payment?.paymentMethod || "unknown").toLowerCase() || "unknown";
    const regionMeta = resolveRegionMeta(payment);
    const gatewayAmount = Number(payment?.gatewayAmount || payment?.amount || 0);
    const gatewayCurrency = String(
      payment?.gatewayCurrency || payment?.currency || "USD",
    ).toUpperCase();
    const pricingSnapshot = resolveStoredPricingSnapshot(payment);

    const existing = rowMap.get(rowKey) || {
      teacherId: String(resolvedTeacherId),
      teacherName: getCourseTeacherName(course),
      teacherEmail: getCourseTeacherEmail(course),
      courseId: String(course._id),
      courseTitle: course.title || "Course",
      monthKey: window.monthKey,
      cycleStartDay,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      periodLabel: formatWindowLabel(window),
      paymentPlan: getPaymentPlanLabel(course.paymentPlan),
      salesCount: 0,
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
      teacherPayoutDue: 0,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
      externalCollectedRevenue: 0,
      paymentDetails: [],
      status: "unpaid",
      paidAt: null,
      note: "",
      settlementId: null,
    };

    existing.salesCount += 1;
    existing.totalRevenue += amountUsd;
    existing.platformCommission += commissionAmount;
    existing.teacherPayoutDue += teacherPayoutAmount;
    existing.directToTeacherAmount += directToTeacherAmount;
    existing.platformDeductionDue += platformDeductionDue;
    existing.externalCollectedRevenue += isExternalCollection ? amountUsd : 0;
    existing.paymentDetails.push({
      paymentId: String(payment._id || ""),
      studentName: getStudentDisplayName(payment?.studentId, payment?.customerEmail),
      studentEmail: payment?.studentId?.email || payment?.customerEmail || "",
      paymentMethod: methodLabel,
      paymentMethodCode: methodKey,
      regionLabel: regionMeta.label,
      gatewayCurrency,
      gatewayAmount: roundMoney(gatewayAmount),
      baseRevenue: roundMoney(amountUsd),
      teacherEarnings: roundMoney(teacherAmount),
      teacherPayoutAmount: roundMoney(teacherPayoutAmount),
      directToTeacherAmount: roundMoney(directToTeacherAmount),
      platformDeductionDue: roundMoney(platformDeductionDue),
      isExternalCollection,
      pricingRegion: regionMeta.key,
      sourcePriceAmount:
        payment?.sourcePriceAmount ?? payment?.orderId?.sourcePriceAmount ?? null,
      sourcePriceCurrency:
        payment?.sourcePriceCurrency ||
        payment?.orderId?.sourcePriceCurrency ||
        regionMeta.currency,
      sourceExchangeRate:
        payment?.sourceExchangeRate ?? payment?.orderId?.sourceExchangeRate ?? null,
      sourceExchangeRateSource:
        payment?.sourceExchangeRateSource ||
        payment?.orderId?.sourceExchangeRateSource ||
        null,
      sourceRateRetrievedAt:
        payment?.sourceRateRetrievedAt ||
        payment?.orderId?.sourceRateRetrievedAt ||
        null,
      commissionRate: paymentCommissionRate,
      platformCommission: roundMoney(commissionAmount),
      pricingSnapshotLabel: pricingSnapshot.snapshotLabel,
      exchangeRate: pricingSnapshot.exchangeRate,
      exchangeRateSource: pricingSnapshot.exchangeRateSource,
      paymentReference: payment?.paymentReference || "",
      transactionId: payment?.transactionSignature || payment?.transactionId || "",
      paidAt: payment.paidAt || payment.createdAt || null,
    });
    rowMap.set(rowKey, existing);
    monthMap.set(window.monthKey, {
      monthKey: window.monthKey,
      label: window.periodLabel,
      cycleStartDay,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
    });

  }

  let rows = Array.from(rowMap.values()).map((row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    platformCommission: roundMoney(row.platformCommission),
    teacherEarnings: roundMoney(row.totalRevenue - row.platformCommission),
    teacherPayoutDue: roundMoney(row.teacherPayoutDue),
    directToTeacherAmount: roundMoney(row.directToTeacherAmount),
    platformDeductionDue: roundMoney(row.platformDeductionDue),
    externalCollectedRevenue: roundMoney(row.externalCollectedRevenue),
    paymentDetails: Array.isArray(row.paymentDetails)
      ? row.paymentDetails.sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
      : [],
  }));

  const settlementFilter = {};
  if (teacherId) settlementFilter.teacherId = teacherId;
  if (courseId) settlementFilter.courseId = courseId;
  if (monthKey) settlementFilter.monthKey = monthKey;
  if (!teacherId && teacherIds.length) {
    settlementFilter.teacherId = { $in: teacherIds };
  }

  const settlements = await TeacherIncomeSettlement.find(settlementFilter)
    .select("teacherId courseId monthKey status paidAt note")
    .lean();

  const settlementMap = new Map(
    settlements.map((item) => ([
      `${String(item.teacherId)}:${String(item.courseId)}:${item.monthKey}`,
      item,
    ])),
  );

  rows = rows.map((row) => {
    if (Number(row.teacherPayoutDue || 0) <= 0) {
      return {
        ...row,
        status: "paid",
      };
    }

    const settlement = settlementMap.get(
      `${row.teacherId}:${row.courseId}:${row.monthKey}`,
    );
    if (!settlement) return row;

    return {
      ...row,
      status: settlement.status || "unpaid",
      paidAt: settlement.paidAt || null,
      note: settlement.note || "",
      settlementId: String(settlement._id),
    };
  });

  if (payoutStatus) {
    rows = rows.filter((row) => row.status === payoutStatus);
  }

  rows.sort((a, b) => {
    const monthCompare = String(b.monthKey).localeCompare(String(a.monthKey));
    if (monthCompare !== 0) return monthCompare;
    const teacherCompare = String(a.teacherName).localeCompare(String(b.teacherName));
    if (teacherCompare !== 0) return teacherCompare;
    return String(a.courseTitle).localeCompare(String(b.courseTitle));
  });

  const reportSummary = summarizeTeacherIncomeRows({
    rows,
    defaultCommissionRate: commissionRate,
  });
  const teacherShareRate = roundMoney(
    100 - Number(reportSummary.commissionRate || 0),
  );

  const availableTeachers = Array.from(
    new Map(
      courses
        .map((course) => [String(getCourseTeacherId(course) || ""), {
          id: String(getCourseTeacherId(course) || ""),
          name: getCourseTeacherName(course),
        }])
        .filter(([id]) => Boolean(id)),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...reportSummary,
    teacherShareRate,
    settlementRows: rows,
    availableMonths: Array.from(monthMap.values()).sort((a, b) =>
      String(b.monthKey).localeCompare(String(a.monthKey)),
    ),
    availableCourses: courses
      .map((course) => ({
        id: String(course._id),
        title: course.title || "Course",
        paymentPlan: getPaymentPlanLabel(course.paymentPlan),
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    availableTeachers,
    generatedAt: new Date().toISOString(),
  };
};

export const upsertTeacherIncomeSettlement = async ({
  teacherId,
  courseId,
  monthKey,
  cycleStartDay = 1,
  status,
  paidBy = null,
  note = "",
}) => {
  const sampleCourse = await Course.findById(courseId).select("startDate").lean();
  const window = buildSettlementWindow({
    paidAt:
      cycleStartDay === 15
        ? new Date(`${monthKey}-15T00:00:00.000Z`)
        : new Date(`${monthKey}-01T00:00:00.000Z`),
    cycleStartDay: cycleStartDay || getCycleStartDay(sampleCourse),
  });

  const update = {
    cycleStartDay: window.cycleStartDay,
    periodStart: startOfUtcDay(window.periodStart),
    periodEnd: endOfUtcDay(window.periodEnd),
    status,
    note: String(note || "").trim(),
    paidAt: status === "paid" ? new Date() : null,
    paidBy: status === "paid" ? paidBy : null,
  };

  return TeacherIncomeSettlement.findOneAndUpdate(
    { teacherId, courseId, monthKey },
    {
      $set: update,
      $setOnInsert: { teacherId, courseId, monthKey },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    },
  );
};
