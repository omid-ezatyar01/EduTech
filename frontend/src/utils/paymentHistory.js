import { buildHostedPaymentStatusPath } from "./hostedPaymentReturn.js";

const asText = (value) => String(value || "").trim();

const knownStatuses = new Set([
  "paid",
  "succeeded",
  "pending",
  "failed",
  "cancelled",
  "canceled",
  "expired",
  "refunded",
  "manual_review",
  "duplicate_payment",
]);

const normalizeStatus = (value) =>
  asText(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");

export const resolvePaymentHistoryStatus = (payment = {}, nowMs = 0) => {
  const populatedAttemptStatus =
    payment?.paymentAttemptId && typeof payment.paymentAttemptId === "object"
      ? payment.paymentAttemptId.status
      : "";
  const statusCandidates = [
    payment?.attemptStatus,
    payment?.paymentAttemptStatus,
    populatedAttemptStatus,
    payment?.status,
    payment?.paymentStatus,
  ];
  const status =
    statusCandidates.map(normalizeStatus).find((candidate) => knownStatuses.has(candidate)) ||
    "pending";

  if (status !== "pending" || !(nowMs > 0) || !payment?.expiresAt) return status;

  const expiresAtMs = new Date(payment.expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs ? "expired" : status;
};

export const getPaymentAttemptId = (payment = {}) =>
  asText(payment?.paymentAttemptId?._id || payment?.paymentAttemptId);

export const buildPaymentRecoveryPath = (payment = {}, nowMs = 0) => {
  const status = resolvePaymentHistoryStatus(payment, nowMs);
  const method = asText(payment?.paymentMethod || payment?.method).toLowerCase();
  const paymentAttemptId = getPaymentAttemptId(payment);

  if (
    method === "usdt_bsc_direct" &&
    ["pending", "expired"].includes(status) &&
    paymentAttemptId
  ) {
    return `/payment/crypto?attemptId=${encodeURIComponent(paymentAttemptId)}`;
  }

  if (method === "nowpayments_crypto" && status === "pending" && paymentAttemptId) {
    return `/payment/crypto?attemptId=${encodeURIComponent(paymentAttemptId)}`;
  }

  if (method === "hesabpay" && status === "pending") {
    // A HesabPay checkout URL is a one-time provider session. Always return to
    // EduTech's own status page instead of reopening that potentially consumed URL.
    return buildHostedPaymentStatusPath(payment);
  }

  return "";
};

