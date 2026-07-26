import { useEffect, useMemo, useState } from "react";
import { CreditCard, Receipt, FileText, Clock, BadgeCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout from "./StudentLayout.jsx";
import PaymentStatsCard from "./PaymentStatsCard.jsx";
import PaymentFilterBar from "./PaymentFilterBar.jsx";
import PaymentTable from "./PaymentTable.jsx";
import FinancialSummaryCard from "./FinancialSummaryCard.jsx";
import PaymentHelpCard from "./PaymentHelpCard.jsx";
import PaymentDetailsModal from "./PaymentDetailsModal.jsx";
import { formatUsd } from "../../services/purchaseService.js";
import {
  getStudentPaymentHistory,
} from "../../services/paymentGateway.js";
import { clearAuth, setAuthNotice } from "../../services/portal.js";
import {
  getLocalizedRequestErrorMessage,
  isUnauthorizedError,
} from "../../services/http.js";
import { fetchStudentEnrollments } from "../../services/courseService.js";
import {
  formatDisplayCurrencyAmount,
  getDisplayCurrency,
  getDisplayCurrencyAmount,
} from "../utils/currencyDisplay.js";

const DATE_FILTER_ALL = "all_time";
const DATE_FILTER_LAST_MONTH = "last_month";
const DATE_FILTER_THIS_YEAR = "this_year";
const STATUS_FILTER_ALL = "all_statuses";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toDisplayDateTime = (value, locale) => {
  if (!value) return { date: "-", time: "-" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };

  return {
    date: new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
};

const toEnglishInvoiceDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const isLocallyExpiredPayment = (payment = {}, nowMs = Date.now()) => {
  const rawStatus = String(payment?.status || payment?.paymentStatus || "").toLowerCase();
  if (rawStatus !== "pending") return false;
  const expiresAtMs = payment?.expiresAt ? new Date(payment.expiresAt).getTime() : Number.NaN;
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
};

const formatPaymentAmount = (amount, currency = "USD", language = "fa") => {
  return formatDisplayCurrencyAmount(amount, currency, language);
};

const formatPaymentMethod = (payment, language = "fa") => {
  const normalizedMethod = String(payment?.paymentMethod || "").toLowerCase();

  if (normalizedMethod === "hesabpay") {
    return "HesabPay (Visa / MasterCard)";
  }

  if (normalizedMethod === "usdt_bsc_direct") {
    return language === "fa" ? "کریپتو (USDT)" : "Crypto (USDT)";
  }

  if (normalizedMethod === "nowpayments_crypto") {
    return language === "fa" ? "کریپتو" : "Crypto";
  }

  if (normalizedMethod === "bank_transfer") {
    return language === "fa" ? "انتقال بانکی" : "Bank Transfer";
  }

  if (payment?.provider) {
    return String(payment.provider).toUpperCase();
  }

  return payment?.paymentMethod
    ? String(payment.paymentMethod).replaceAll("_", " ")
    : "HesabPay";
};

const resolveUsdEquivalent = (payment = {}) => {
  const gatewayAmount = Number(payment?.gatewayAmount || payment?.amount || 0);
  const gatewayCurrency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  const storedBaseUsd = Number(payment?.baseAmountUsdCents || 0) / 100;
  const storedRate = Number(payment?.exchangeRate || 0);

  if (gatewayCurrency === "USD" || gatewayCurrency === "USDT") {
    return gatewayAmount;
  }

  if (["AFN", "IRR"].includes(gatewayCurrency) && Number.isFinite(storedRate) && storedRate > 0) {
    return gatewayAmount / storedRate;
  }

  if (Number.isFinite(storedBaseUsd) && storedBaseUsd > 0) {
    return storedBaseUsd;
  }

  return 0;
};

const toUiPayment = (payment, t, locale, language = "fa") => {
  const chargeAmount = Number(payment?.gatewayAmount || payment?.amount || 0);
  const chargeCurrency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  const displayChargeAmount = getDisplayCurrencyAmount(chargeAmount, chargeCurrency);
  const displayChargeCurrency = getDisplayCurrency(chargeCurrency);
  const baseAmountNumber = resolveUsdEquivalent(payment);
  const rawStatus = String(payment?.status || payment?.paymentStatus || "pending").toLowerCase();
  const normalizedMethod = String(payment?.paymentMethod || "").toLowerCase();
  const statusMap = {
    paid: { uiStatus: "success", label: t.statusSuccess },
    pending: { uiStatus: "pending", label: t.statusPending },
    failed: { uiStatus: "failed", label: t.statusFailed },
    cancelled: { uiStatus: "failed", label: t.statusCancelled },
    expired: { uiStatus: "failed", label: t.statusExpired },
    refunded: { uiStatus: "refunded", label: t.statusRefunded },
  };
  const statusMeta = statusMap[rawStatus] || {
    uiStatus: "pending",
    label: t.statusPending,
  };
  const { date, time } = toDisplayDateTime(payment?.paidAt || payment?.createdAt, locale);
  const isPendingDirectBsc = rawStatus === "pending" && normalizedMethod === "usdt_bsc_direct";
  const isPendingHostedCrypto = rawStatus === "pending" && normalizedMethod === "nowpayments_crypto";
  const isPendingHesabPay = rawStatus === "pending" && normalizedMethod === "hesabpay";
  const paymentUrl = payment?.hesabPaymentUrl || payment?.providerUrl || "";

  return {
    id: payment?._id || payment?.paymentReference,
    orderId: payment?.orderId?._id || payment?.orderId || "",
    courseId: payment?.courseId?._id || payment?.course?._id || payment?.courseId || "",
    date,
    time,
    description: t.coursePurchase,
    service: payment?.courseId?.title || payment?.course?.title || t.course,
    amount: formatPaymentAmount(chargeAmount, chargeCurrency, language),
    amountNumber: displayChargeAmount,
    baseAmountNumber,
    currency: displayChargeCurrency,
    method: formatPaymentMethod(payment, language),
    paymentMethodCode: normalizedMethod,
    status: statusMeta.uiStatus,
    statusLabel: statusMeta.label,
    invoice: payment?.paymentReference || "-",
    transactionId: payment?.transactionSignature || payment?.transactionId || "-",
    transactionSignature: payment?.transactionSignature || "",
    paymentAttemptId: payment?.paymentAttemptId?._id || payment?.paymentAttemptId || "",
    paymentReference: payment?.paymentReference || "",
    recipientAddress: payment?.recipientAddress || "",
    network: payment?.network || "",
    paymentUrl,
    expiresAt: payment?.expiresAt || null,
    canResumePendingPayment: ((isPendingDirectBsc || isPendingHostedCrypto) && Boolean(payment?.paymentAttemptId))
      || (isPendingHesabPay && Boolean(paymentUrl)),
    canManagePendingCrypto: (isPendingDirectBsc || isPendingHostedCrypto) && Boolean(payment?.paymentAttemptId),
    supportsTxHashVerification: isPendingDirectBsc,
    isPendingDirectBsc,
    isPendingHostedCrypto,
    isPendingHesabPay,
    rawStatus,
    createdAt: payment?.createdAt || null,
  };
};

const dedupePendingPayments = (items = []) => {
  const seenPendingKeys = new Set();

  return items.filter((payment) => {
    if (payment?.status !== "pending") {
      return true;
    }

    const pendingKey = [
      payment?.orderId || payment?.service || "",
      payment?.paymentMethodCode || "",
      payment?.currency || "",
      String(payment?.baseAmountNumber || payment?.amountNumber || 0),
    ].join(":");

    if (seenPendingKeys.has(pendingKey)) {
      return false;
    }

    seenPendingKeys.add(pendingKey);
    return true;
  });
};

const removePendingPaymentsForPaidCourses = (items = []) => {
  const paidOrderIds = new Set(
    items
      .filter((payment) => payment?.status === "success" && payment?.orderId)
      .map((payment) => String(payment.orderId)),
  );
  const paidCourseIds = new Set(
    items
      .filter((payment) => payment?.status === "success" && payment?.courseId)
      .map((payment) => String(payment.courseId)),
  );

  return items.filter((payment) => {
    if (payment?.status !== "pending") {
      return true;
    }

    if (payment?.orderId && paidOrderIds.has(String(payment.orderId))) {
      return false;
    }

    if (payment?.courseId && paidCourseIds.has(String(payment.courseId))) {
      return false;
    }

    return true;
  });
};

const hasRealPaymentData = (payment = {}) => {
  const courseTitle = String(payment?.courseId?.title || payment?.course?.title || "").trim();
  const reference = String(payment?.paymentReference || "").trim();
  const amount = Number(payment?.amount);
  const status = String(payment?.status || payment?.paymentStatus || "").trim().toLowerCase();
  const allowedStatuses = new Set(["paid", "pending"]);

  return Boolean(courseTitle) && Boolean(reference) && Number.isFinite(amount) && amount > 0 && allowedStatuses.has(status);
};

export default function Payments({ language = "fa" }) {
  const isFa = language === "fa";
  const locale = isFa ? "fa-AF" : "en-US";
  const t = useMemo(() => ({
    statusSuccess: isFa ? "موفق" : "Success",
    statusPending: isFa ? "در انتظار" : "Pending",
    statusFailed: isFa ? "ناموفق" : "Failed",
    statusCancelled: isFa ? "لغو شده" : "Cancelled",
    statusExpired: isFa ? "منقضی" : "Expired",
    statusRefunded: isFa ? "بازپرداخت" : "Refunded",
    allStatuses: isFa ? "همه وضعیت‌ها" : "All Statuses",
    allTime: isFa ? "همه زمان‌ها" : "All Time",
    lastMonth: isFa ? "ماه گذشته" : "Last Month",
    thisYear: isFa ? "امسال" : "This Year",
    loadErrorFa: "خطا در دریافت پرداخت‌ها",
    invoiceError: isFa
      ? "دانلود فاکتور انجام نشد. لطفاً دوباره تلاش کنید."
      : "Unable to download the invoice. Please try again.",
    dashboard: isFa ? "داشبورد" : "Dashboard",
    payments: isFa ? "پرداخت‌ها" : "Payments",
    subtitle: isFa
      ? "وضعیت پرداخت‌ها، تاییدها و پیگیری سفارش‌های شما"
      : "Track your payment statuses, confirmations, and order follow-ups.",
    newPayment: isFa ? "پرداخت جدید" : "New Payment",
    loading: isFa ? "در حال دریافت پرداخت‌ها" : "Loading payments",
    emptyTitle: isFa ? "هیچ تراکنشی یافت نشد" : "No transactions found",
    emptySubtitle: isFa
      ? "با این فیلترها تراکنشی پیدا نشد."
      : "No transactions matched these filters.",
    totalPayments: isFa ? "کل پرداخت‌ها" : "Total Payments",
    totalPaymentsSubtitle: isFa ? "رکورد پرداخت" : "Payment records",
    paidAmount: isFa ? "مبلغ کل پرداخت شده" : "Total Paid Amount",
    paidAmountSubtitle: isFa ? "تراکنش‌های موفق" : "Successful transactions",
    pendingAmount: isFa ? "در انتظار پرداخت" : "Pending Payments",
    pendingTransactions: isFa ? "تراکنش" : "transactions",
    activeSubscriptions: isFa ? "اشتراک فعال" : "Active Subscriptions",
    enrolledCourses: isFa ? "کورس ثبت‌شده" : "Enrolled courses",
    refunded: isFa ? "بازپرداخت" : "Refunded",
    refundedSubtitle: isFa ? "تراکنش برگشت‌خورده" : "Refunded transactions",
    all: isFa ? "همه" : "All",
    coursePurchase: isFa ? "خرید کورس" : "Course Purchase",
    course: isFa ? "کورس" : "Course",
  }), [isFa]);

  const navigate = useNavigate();
  const [livePayments, setLivePayments] = useState([]);
  const [liveEnrollments, setLiveEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTER_ALL);
  const [dateFilter, setDateFilter] = useState(DATE_FILTER_ALL);

  const [detailsPayment, setDetailsPayment] = useState(null);

  const statusOptions = useMemo(
    () => [
      { value: STATUS_FILTER_ALL, label: t.allStatuses },
      { value: "success", label: t.statusSuccess },
      { value: "pending", label: t.statusPending },
    ],
    [t.allStatuses, t.statusPending, t.statusSuccess],
  );
  const dateOptions = useMemo(
    () => [
      { value: DATE_FILTER_ALL, label: t.allTime },
      { value: DATE_FILTER_LAST_MONTH, label: t.lastMonth },
      { value: DATE_FILTER_THIS_YEAR, label: t.thisYear },
    ],
    [t.allTime, t.lastMonth, t.thisYear],
  );

  useEffect(() => {
    let isMounted = true;

    const loadPaymentHistory = async () => {
      try {
        setLoading(true);
        const [payments, enrollments] = await Promise.all([
          getStudentPaymentHistory(),
          fetchStudentEnrollments(),
        ]);
        if (!isMounted) return;
        setLivePayments(payments);
        setLiveEnrollments(Array.isArray(enrollments) ? enrollments : []);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        if (err.message === "NOT_AUTHENTICATED" || isUnauthorizedError(err)) {
          setAuthNotice("Not authorized for this resource");
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        setError(
          getLocalizedRequestErrorMessage(
            err,
            language,
            t.loadErrorFa,
            "Failed to load payments.",
          ),
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPaymentHistory();

    return () => {
      isMounted = false;
    };
  }, [language, navigate, refreshSeed, t.loadErrorFa]);

  useEffect(() => {
    const triggerRefresh = () => setRefreshSeed((value) => value + 1);
    window.addEventListener("auth_change", triggerRefresh);
    window.addEventListener("edutech_data_changed", triggerRefresh);
    return () => {
      window.removeEventListener("auth_change", triggerRefresh);
      window.removeEventListener("edutech_data_changed", triggerRefresh);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const payments = useMemo(
    () =>
      removePendingPaymentsForPaidCourses(
        dedupePendingPayments(
          livePayments
            .filter((payment) => !isLocallyExpiredPayment(payment, nowMs))
            .filter(hasRealPaymentData)
            .map((payment) => toUiPayment(payment, t, locale, language)),
        ),
      ),
    [language, livePayments, locale, nowMs, t],
  );

  const stats = useMemo(
    () => ({
      total: payments.length,
      success: payments.filter((p) => p.status === "success").length,
      pending: payments.filter((p) => p.status === "pending").length,
      activeSubscriptions: liveEnrollments.filter((enrollment) =>
        ["active", "completed"].includes(enrollment?.enrollmentStatus),
      ).length,
    }),
    [payments, liveEnrollments],
  );

  const paidAmount = useMemo(
    () => payments.filter((p) => p.status === "success").reduce((sum, p) => sum + (p.baseAmountNumber || 0), 0),
    [payments],
  );

  const pendingAmount = useMemo(
    () => payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + (p.baseAmountNumber || 0), 0),
    [payments],
  );

  const paymentStats = [
    {
      title: t.totalPayments,
      value: String(stats.total),
      subtitle: t.totalPaymentsSubtitle,
      icon: Receipt,
      colorClass: "bg-purple-50 text-purple-600",
      type: "total",
    },
    {
      title: t.paidAmount,
      value: formatUsd(paidAmount, language, "USD"),
      subtitle: t.paidAmountSubtitle,
      icon: FileText,
      colorClass: "bg-green-50 text-green-600",
      type: "paid",
    },
    {
      title: t.pendingAmount,
      value: formatUsd(pendingAmount, language, "USD"),
      subtitle: `${stats.pending} ${t.pendingTransactions}`,
      icon: Clock,
      colorClass: "bg-amber-50 text-amber-600",
      type: "pending",
    },
    {
      title: t.activeSubscriptions,
      value: String(stats.activeSubscriptions),
      subtitle: t.enrolledCourses,
      icon: BadgeCheck,
      colorClass: "bg-blue-50 text-blue-600",
      type: "subscription",
    },
  ];

  const tabs = [
    { id: "all", label: t.all, count: stats.total },
    { id: "success", label: t.statusSuccess, count: stats.success },
    { id: "pending", label: t.statusPending, count: stats.pending },
  ];

  const filteredPayments = payments.filter((p) => {
    const matchTab = activeTab === "all" || p.status === activeTab;
    const matchStatus = statusFilter === STATUS_FILTER_ALL || p.status === statusFilter;
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastMonthDate = new Date(now);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const matchDate =
      dateFilter === DATE_FILTER_ALL ||
      (dateFilter === DATE_FILTER_LAST_MONTH &&
        createdAt &&
        !Number.isNaN(createdAt.getTime()) &&
        createdAt >= lastMonthDate) ||
      (dateFilter === DATE_FILTER_THIS_YEAR &&
        createdAt &&
        !Number.isNaN(createdAt.getTime()) &&
        createdAt >= startOfYear);
    const q = searchQuery.trim();
    const matchSearch =
      !q ||
      p.invoice.includes(q) ||
      p.service.includes(q) ||
      p.description.includes(q) ||
      p.transactionId.includes(q);
    return matchTab && matchStatus && matchDate && matchSearch;
  });

  const handleDownloadInvoice = async (payment) => {
    if (!payment || typeof document === "undefined") return;

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const invoiceRoot = document.createElement("div");
      invoiceRoot.setAttribute("aria-hidden", "true");
      invoiceRoot.style.position = "fixed";
      invoiceRoot.style.left = "-99999px";
      invoiceRoot.style.top = "0";
      invoiceRoot.style.width = "760px";
      invoiceRoot.style.padding = "0";
      invoiceRoot.style.zIndex = "-1";

      const issueDate = toEnglishInvoiceDateTime(payment.createdAt);
      const invoiceStatusLabel =
        payment.status === "success"
          ? "Success"
          : payment.status === "pending"
            ? "Pending"
            : payment.status === "failed"
              ? "Failed"
              : payment.status === "refunded"
                ? "Refunded"
                : "Status Updated";
      const statusTone =
        payment.status === "success"
          ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" }
          : payment.status === "pending"
            ? { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" }
            : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

      invoiceRoot.innerHTML = `
        <div style="width:760px;background:#f8fbff;padding:18px;font-family:Arial, sans-serif;color:#0f172a;">
          <div style="border:1px solid #dbeafe;border-radius:24px;background:#ffffff;overflow:hidden;box-shadow:0 16px 36px rgba(15,23,42,0.08);">
            <div style="padding:24px 26px;background:linear-gradient(135deg,#eff6ff 0%,#f8fbff 55%,#ecfeff 100%);border-bottom:1px solid #dbeafe;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;direction:ltr;">
                <div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;color:#2563eb;text-transform:uppercase;">
                    EduTech Online Academy
                  </div>
                  <h1 style="margin:12px 0 6px;font-size:28px;line-height:1.15;font-weight:900;color:#0f172a;">
                    Course Payment Invoice
                  </h1>
                  <p style="margin:0;font-size:14px;line-height:1.8;color:#475569;">
                    Official payment receipt for enrollment and follow-up of EduTech learning services.
                  </p>
                </div>
                <div style="min-width:220px;text-align:right;">
                  <div style="font-size:12px;color:#64748b;font-weight:700;">Invoice Number</div>
                  <div style="margin-top:6px;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:0.08em;">${escapeHtml(payment.invoice)}</div>
                </div>
              </div>
            </div>

            <div style="padding:22px 26px 18px;direction:ltr;">
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
                ${[
                  ["Course Name", payment.service],
                  ["Description", "Course Purchase"],
                  ["Payment Type", "Full course tuition"],
                  ["Payment Date", issueDate],
                  ["Reference", payment.invoice],
                  ["Transaction ID", payment.transactionId || "-"],
                ]
                  .map(
                    ([label, value]) => `
                  <div style="border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#64748b;margin-bottom:7px;text-transform:uppercase;">${escapeHtml(label)}</div>
                    <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1.7;word-break:break-word;direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(value)}</div>
                  </div>`,
                  )
                  .join("")}
              </div>

              <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                ${[
                  ["Payment Method", payment.method],
                  ["Status", invoiceStatusLabel],
                ]
                  .map(
                    ([label, value]) => `
                  <div style="border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#64748b;margin-bottom:7px;text-transform:uppercase;">${escapeHtml(label)}</div>
                    <div style="font-size:14px;font-weight:800;color:${label === "Status" ? statusTone.text : "#0f172a"};line-height:1.7;direction:ltr;text-align:left;">${escapeHtml(value)}</div>
                  </div>`,
                  )
                  .join("")}
              </div>

              <div style="margin-top:16px;border:1px solid #dbeafe;border-radius:20px;overflow:hidden;">
                <div style="display:grid;grid-template-columns:1.5fr 0.8fr 0.8fr;background:#eff6ff;padding:12px 16px;font-size:11px;font-weight:900;color:#1e3a8a;direction:ltr;text-transform:uppercase;">
                  <div>Service</div>
                  <div style="text-align:center;">Status</div>
                  <div style="text-align:right;">Amount</div>
                </div>
                <div style="display:grid;grid-template-columns:1.5fr 0.8fr 0.8fr;padding:16px;background:#ffffff;font-size:14px;font-weight:800;color:#0f172a;direction:ltr;">
                  <div>${escapeHtml(payment.service)}</div>
                  <div style="text-align:center;color:${statusTone.text};">${escapeHtml(invoiceStatusLabel)}</div>
                  <div style="text-align:right;direction:ltr;">${escapeHtml(payment.amount)}</div>
                </div>
              </div>

              <div style="margin-top:16px;">
                <div style="width:100%;border:1px solid #cbd5e1;border-radius:20px;background:#ffffff;padding:16px 18px;">
                  <div style="display:flex;justify-content:space-between;gap:16px;font-size:13px;font-weight:700;color:#475569;">
                    <span>Payable Amount</span>
                    <span dir="ltr">${escapeHtml(payment.amount)}</span>
                  </div>
                  <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:16px;font-size:18px;font-weight:900;color:#0f172a;">
                    <span>Total</span>
                    <span dir="ltr">${escapeHtml(payment.amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style="padding:18px 26px 24px;direction:ltr;">
              <div style="border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;padding:16px 18px;">
                <div style="font-size:11px;font-weight:900;color:#0f172a;margin-bottom:8px;text-transform:uppercase;">
                  Important Note
                </div>
                <div style="font-size:13px;line-height:1.9;color:#475569;">
                  This invoice was issued as the official payment receipt in the EduTech system. Keep the invoice number and transaction ID for any future follow-up or support request.
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(invoiceRoot);

      const canvas = await html2canvas(invoiceRoot.firstElementChild, {
        scale: 1.65,
        backgroundColor: "#f8fbff",
        useCORS: true,
      });

      document.body.removeChild(invoiceRoot);

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 36;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 18;
      const imageData = canvas.toDataURL("image/jpeg", 0.86);

      pdf.addImage(imageData, "JPEG", 18, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 36;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 18;
        pdf.addPage();
        pdf.addImage(imageData, "JPEG", 18, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 36;
      }

      pdf.save(`edutech-invoice-${payment.invoice || payment.id || "payment"}.pdf`);
    } catch (err) {
      setError(
        getLocalizedRequestErrorMessage(
          err,
          language,
          t.invoiceError,
          t.invoiceError,
        ),
      );
    }
  };

  const handleOpenDetails = (payment) => {
    setDetailsPayment(payment);
  };

  const handleCloseDetails = () => {
    setDetailsPayment(null);
  };

  const handleResumePendingPayment = (payment) => {
    if (payment?.canManagePendingCrypto && payment?.paymentAttemptId) {
      navigate(`/payment/crypto?attemptId=${encodeURIComponent(payment.paymentAttemptId)}`);
      return;
    }

    if (payment?.paymentMethodCode === "hesabpay" && payment?.paymentUrl) {
      window.location.href = payment.paymentUrl;
      return;
    }

    setError(
      language === "fa"
        ? "امکان ادامه این پرداخت در حال حاضر وجود ندارد."
        : "This payment cannot be resumed right now.",
    );
  };

  return (
    <StudentLayout language={language}>
      <div className="mb-6 px-1 sm:px-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link className="transition hover:text-primary-700" to="/student/dashboard">
          {t.dashboard}
        </Link>
        <span>/</span>
        <span className="text-slate-900">{t.payments}</span>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{t.payments}</h1>
          <p className="mt-2 text-lg font-medium text-slate-600">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={() => navigate("/live-courses")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-primary-700"
        >
          <CreditCard size={18} /> {t.newPayment}
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {paymentStats.map((stat, idx) => (
          <PaymentStatsCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid gap-6">
        <FinancialSummaryCard
          paidAmount={paidAmount}
          pendingAmount={pendingAmount}
          language={language}
        />

        <div className="min-w-0 flex flex-col gap-6">
          <PaymentFilterBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            statusOptions={statusOptions}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            dateOptions={dateOptions}
            language={language}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
              <h3 className="text-xl font-black text-slate-900">{t.loading}</h3>
            </div>
          ) : filteredPayments.length > 0 ? (
            <PaymentTable
              payments={filteredPayments}
              onDownload={handleDownloadInvoice}
              onDetails={handleOpenDetails}
              language={language}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20 text-center shadow-sm">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                <Receipt size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900">{t.emptyTitle}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{t.emptySubtitle}</p>
            </div>
          )}
        </div>

        <PaymentHelpCard language={language} />
      </div>
      <div className="h-8" aria-hidden="true" />

      <PaymentDetailsModal
        key={detailsPayment?.id || "payment-details"}
        isOpen={!!detailsPayment}
        onClose={handleCloseDetails}
        payment={detailsPayment}
        onDownload={handleDownloadInvoice}
        onResumePendingPayment={handleResumePendingPayment}
        language={language}
      />
    </StudentLayout>
  );
}
