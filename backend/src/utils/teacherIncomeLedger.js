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
  return payment?.paymentMethod || "Payment";
};

const resolveRegionMeta = (payment = {}) => {
  const currency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  if (currency === "AFN") {
    return { key: "afghanistan", label: "Afghanistan", currency };
  }
  if (currency === "IRR") {
    return { key: "iran", label: "Iran", currency };
  }
  return { key: "international", label: "International", currency };
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
    .populate("teacher", "name")
    .populate("teacherId", "name")
    .populate("createdBy", "name")
    .lean();

  if (!courses.length) {
    return {
      commissionRate,
      teacherShareRate: roundMoney(100 - Number(commissionRate || 0)),
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
      paymentsCount: 0,
      courseWise: [],
      paymentMethodBreakdown: [],
      regionBreakdown: [],
      recentPayments: [],
      settlementRows: [],
      availableMonths: [],
      availableCourses: [],
      availableTeachers: [],
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
    .select("courseId amount baseAmountUsdCents currency gatewayAmount gatewayCurrency paymentMethod exchangeRate exchangeRateSource paidAt createdAt studentId customerEmail paymentReference transactionId transactionSignature")
    .populate("studentId", "_id name nameFa firstName firstNameFa email")
    .lean();

  const rowMap = new Map();
  const monthMap = new Map();
  const paymentMethodMap = new Map();
  const regionMap = new Map();
  const recentPayments = [];

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
    const commissionAmount = (amountUsd * commissionRate) / 100;
    const teacherAmount = amountUsd - commissionAmount;
    const methodLabel = resolvePaymentMethodLabel(payment);
    const methodKey = String(payment?.paymentMethod || "unknown").toLowerCase() || "unknown";
    const regionMeta = resolveRegionMeta(payment);
    const gatewayAmount = Number(payment?.gatewayAmount || payment?.amount || 0);
    const pricingSnapshot = resolveStoredPricingSnapshot(payment);

    const existing = rowMap.get(rowKey) || {
      teacherId: String(resolvedTeacherId),
      teacherName: getCourseTeacherName(course),
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
      paymentDetails: [],
      status: "unpaid",
      paidAt: null,
      note: "",
      settlementId: null,
    };

    existing.salesCount += 1;
    existing.totalRevenue += amountUsd;
    existing.platformCommission += commissionAmount;
    existing.paymentDetails.push({
      paymentId: String(payment._id || ""),
      studentName: getStudentDisplayName(payment?.studentId, payment?.customerEmail),
      studentEmail: payment?.studentId?.email || payment?.customerEmail || "",
      paymentMethod: methodLabel,
      paymentMethodCode: methodKey,
      regionLabel: regionMeta.label,
      gatewayCurrency: regionMeta.currency,
      gatewayAmount: roundMoney(gatewayAmount),
      baseRevenue: roundMoney(amountUsd),
      teacherEarnings: roundMoney(teacherAmount),
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

    const existingMethod = paymentMethodMap.get(methodKey) || {
      methodKey,
      methodLabel,
      paymentsCount: 0,
      totalRevenue: 0,
      teacherEarnings: 0,
    };
    existingMethod.paymentsCount += 1;
    existingMethod.totalRevenue += amountUsd;
    existingMethod.teacherEarnings += teacherAmount;
    paymentMethodMap.set(methodKey, existingMethod);

    const existingRegion = regionMap.get(regionMeta.key) || {
      regionKey: regionMeta.key,
      regionLabel: regionMeta.label,
      gatewayCurrency: regionMeta.currency,
      paymentsCount: 0,
      totalRevenue: 0,
      teacherEarnings: 0,
    };
    existingRegion.paymentsCount += 1;
    existingRegion.totalRevenue += amountUsd;
    existingRegion.teacherEarnings += teacherAmount;
    regionMap.set(regionMeta.key, existingRegion);

    recentPayments.push({
      paymentId: String(payment._id || ""),
      courseId: String(course._id),
      courseTitle: course.title || "Course",
      monthKey: window.monthKey,
      paymentMethod: methodLabel,
      paymentMethodCode: methodKey,
      regionLabel: regionMeta.label,
      gatewayCurrency: regionMeta.currency,
      gatewayAmount: roundMoney(gatewayAmount),
      totalRevenue: roundMoney(amountUsd),
      teacherEarnings: roundMoney(teacherAmount),
      paidAt: payment.paidAt || payment.createdAt || null,
    });
  }

  let rows = Array.from(rowMap.values()).map((row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    platformCommission: roundMoney(row.platformCommission),
    teacherEarnings: roundMoney(row.totalRevenue - row.platformCommission),
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

  const totalRevenue = roundMoney(rows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0));
  const platformCommission = roundMoney(rows.reduce((sum, row) => sum + Number(row.platformCommission || 0), 0));
  const teacherEarnings = roundMoney(rows.reduce((sum, row) => sum + Number(row.teacherEarnings || 0), 0));
  const paymentsCount = rows.reduce((sum, row) => sum + Number(row.salesCount || 0), 0);
  const teacherShareRate = roundMoney(100 - Number(commissionRate || 0));

  const courseWiseMap = new Map();
  rows.forEach((row) => {
    const existing = courseWiseMap.get(row.courseId) || {
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      salesCount: 0,
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
    };
    existing.salesCount += Number(row.salesCount || 0);
    existing.totalRevenue += Number(row.totalRevenue || 0);
    existing.platformCommission += Number(row.platformCommission || 0);
    existing.teacherEarnings += Number(row.teacherEarnings || 0);
    courseWiseMap.set(row.courseId, existing);
  });

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
    commissionRate,
    teacherShareRate,
    totalRevenue,
    platformCommission,
    teacherEarnings,
    paymentsCount,
    paidRowsCount: rows.filter((row) => row.status === "paid").length,
    unpaidRowsCount: rows.filter((row) => row.status === "unpaid").length,
    courseWise: Array.from(courseWiseMap.values()).map((row) => ({
      ...row,
      totalRevenue: roundMoney(row.totalRevenue),
      platformCommission: roundMoney(row.platformCommission),
      teacherEarnings: roundMoney(row.teacherEarnings),
    })),
    paymentMethodBreakdown: Array.from(paymentMethodMap.values())
      .map((row) => ({
        ...row,
        totalRevenue: roundMoney(row.totalRevenue),
        teacherEarnings: roundMoney(row.teacherEarnings),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    regionBreakdown: Array.from(regionMap.values())
      .map((row) => ({
        ...row,
        totalRevenue: roundMoney(row.totalRevenue),
        teacherEarnings: roundMoney(row.teacherEarnings),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    recentPayments: recentPayments
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
      .slice(0, 12),
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
