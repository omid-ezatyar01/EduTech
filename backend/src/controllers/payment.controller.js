import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import User from "../models/User.js";
import {
  createPaymentSession,
  isValidHesabCheckoutUrl,
  verifyWebhookSignature,
} from "../services/hesabpay.service.js";
import {
  createNowPaymentsPayment,
  getNowPaymentsPayment,
  normalizeNowPaymentsCurrency,
  verifyNowPaymentsIpnSignature,
} from "../services/nowpayments.service.js";
import {
  createUniqueUsdtBscAmount,
  getDirectBscPaymentDetails,
  normalizeBscNetworkLabel,
  verifyDirectBscUsdtPayment,
} from "../services/bscUsdt.service.js";
import { getUsdRatesForCurrencies, quoteAfnFromUsdCents, quoteFromUsdCents } from "../services/exchangeRate.service.js";
import { getNextExchangeRateRefreshAt } from "../utils/exchangeRateSchedule.js";
import { completePayment } from "../services/paymentCompletion.service.js";
import { formatUsdCents, normalizeUsdToCents, roundUpDecimalAmount } from "../utils/money.js";
import {
  getNormalizedBankPaymentDisplay,
  hasUsableBankPaymentInfo,
} from "../utils/bankPaymentInfo.js";
import {
  getPlatformPricingSettings,
  getTeacherDeductionPercentage,
  resolveCourseDisplayPricing,
} from "../utils/platformSettings.js";
import { expireEnrollmentIfNeeded, isEnrollmentExpired, resolveCourseAccessWindow } from "../utils/courseAccess.js";
import {
  calculateTeacherIncomeLedger,
  summarizeTeacherIncomeRows,
  upsertTeacherIncomeSettlement,
} from "../utils/teacherIncomeLedger.js";
import { normalizeBankTransferSubmissionState } from "../utils/bankTransferSubmission.js";
import {
  notifyStudentBankTransferApproved,
  notifyTeacherBankTransferProof,
} from "../services/webPush.service.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";
import { sendCourseEnrollmentCongratsEmail } from "../utils/Email.js";
import {
  removePaymentProofIfLocal,
  savePaymentProofFromBuffer,
} from "../utils/paymentProofFile.js";
import { publishCourseEnrollmentEvents } from "../services/courseNotification.service.js";
import {
  normalizePricingRegion,
  resolveCourseCheckoutPricing,
  resolveRegionalDisplaySnapshot,
  resolveStudentPricingRegion,
} from "../utils/courseRegionalPricing.js";
import {
  recordCouponRedemption,
  resolveCouponForCheckout,
} from "../services/coupon.service.js";
import {
  getDirectCryptoTransactionTimeError,
  shouldPenalizeDirectCryptoVerificationFailure,
} from "../utils/directCryptoVerification.js";
import {
  claimHesabWebhookDelivery,
  completeHesabWebhookDelivery,
  failHesabWebhookDelivery,
} from "../services/hesabWebhookReplay.service.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS = 5;
const DIRECT_CRYPTO_VERIFY_COOLDOWN_MS = 60 * 1000;
const HESAB_SESSION_CREATION_GRACE_MS = 30 * 1000;
const directCryptoVerifyGuard = new Map();

const normalizeDirectBscTransactionHash = (value = "") =>
  String(value || "").trim().toLowerCase();

const getDirectBscTransactionHashMatcher = (value = "") => {
  const normalizedHash = normalizeDirectBscTransactionHash(value);
  const escapedHash = normalizedHash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedHash}$`, "i");
};

const releaseDirectCryptoTransactionReservation = async ({
  paymentAttemptId,
  transactionHash,
} = {}) => {
  const normalizedHash = normalizeDirectBscTransactionHash(transactionHash);
  if (!paymentAttemptId || !normalizedHash) return;

  await PaymentAttempt.updateOne(
    {
      _id: paymentAttemptId,
      status: { $in: ["PENDING", "EXPIRED"] },
      transactionSignature: getDirectBscTransactionHashMatcher(normalizedHash),
    },
    { $unset: { transactionSignature: 1 } },
  );
};

const apiError = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra });
const apiSuccess = (res, payload, code = 200) => res.status(code).json({ success: true, ...payload });
const webhookAck = (res, payload = {}) => res.status(200).json({ success: true, acknowledged: true, ...payload });

const compactObject = (value = {}) => Object.fromEntries(
  Object.entries(value).filter(([, entry]) => entry !== undefined),
);

const toPlainObject = (value) => (
  value && typeof value.toObject === "function" ? value.toObject() : value || {}
);

const getDocumentId = (value) => value?._id || value || undefined;

const toStudentCourseDto = (value) => {
  const course = toPlainObject(value);
  if (!course || typeof course !== "object" || Array.isArray(course)) {
    return getDocumentId(value);
  }
  return compactObject({
    _id: getDocumentId(course),
    title: course.title,
    price: course.price,
    currency: course.currency,
  });
};

const toStudentPaymentAttemptDto = (value) => {
  const attempt = toPlainObject(value);
  return compactObject({
    _id: getDocumentId(attempt),
    orderId: getDocumentId(attempt.orderId),
    courseId: getDocumentId(attempt.courseId),
    paymentReference: attempt.paymentReference,
    provider: attempt.provider,
    method: attempt.method,
    baseAmountUsdCents: attempt.baseAmountUsdCents,
    originalBaseAmountUsdCents: attempt.originalBaseAmountUsdCents,
    amount: attempt.amount,
    currency: attempt.currency,
    network: attempt.network,
    exchangeRate: attempt.exchangeRate,
    recipientAddress: attempt.recipientAddress,
    tokenMint: attempt.tokenMint,
    qrPayload:
      attempt.method === "USDT_BSC_DIRECT"
        ? attempt.rawCreateSessionResponse?.qrPayload
        : undefined,
    status: attempt.status,
    expiresAt: attempt.expiresAt,
    paidAt: attempt.paidAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  });
};

const toStudentPaymentHistoryDto = (value, attemptValue = null) => {
  const payment = toPlainObject(value);
  const attempt = attemptValue ? toPlainObject(attemptValue) : null;
  const attemptSummary = attempt
    ? compactObject({
        _id: getDocumentId(attempt),
        orderId: getDocumentId(attempt.orderId),
        status: attempt.status,
        expiresAt: attempt.expiresAt,
      })
    : getDocumentId(payment.paymentAttemptId);

  return compactObject({
    _id: getDocumentId(payment),
    orderId: getDocumentId(payment.orderId),
    courseId: toStudentCourseDto(payment.courseId || payment.course),
    paymentAttemptId: attemptSummary,
    baseAmountUsdCents: payment.baseAmountUsdCents,
    originalBaseAmountUsdCents: payment.originalBaseAmountUsdCents,
    pricingRegion: payment.pricingRegion,
    sourcePriceAmount: payment.sourcePriceAmount,
    sourcePriceCurrency: payment.sourcePriceCurrency,
    amount: payment.amount,
    gatewayAmount: payment.gatewayAmount,
    currency: payment.currency,
    gatewayCurrency: payment.gatewayCurrency,
    exchangeRate: payment.exchangeRate,
    provider: payment.provider,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    paymentStatus: payment.paymentStatus,
    attemptStatus: attempt?.status,
    paymentReference: payment.paymentReference,
    transactionId: payment.transactionId,
    transactionSignature: attempt?.transactionSignature || payment.transactionSignature,
    network: payment.network,
    recipientAddress: payment.recipientAddress,
    expiresAt: attempt?.expiresAt || payment.expiresAt,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  });
};

const resolveStudentClientUrl = () => {
  const explicit = process.env.STUDENT_CLIENT_URL || process.env.STUDENT_FRONTEND_URL;
  if (explicit) return String(explicit).trim().replace(/\/+$/, "");
  const clientUrl = process.env.CLIENT_URL ? String(process.env.CLIENT_URL).trim().replace(/\/+$/, "") : "";
  return clientUrl || "http://localhost:5173";
};

const isCoursePurchasable = (course) => {
  if (!course) return false;
  const statusOk = !course.status || ["published", "approved", "active"].includes(String(course.status));
  const publishOk = typeof course.isPublished === "boolean" ? course.isPublished : true;
  const endDate = course.endDate ? new Date(course.endDate) : null;
  const scheduledCourseEnded =
    endDate && !Number.isNaN(endDate.getTime()) && endDate <= new Date();
  return (
    statusOk &&
    publishOk &&
    !course.classEndedAt &&
    !course.classCancelledAt &&
    !scheduledCourseEnded
  );
};

const makePaymentReference = () => `PAY-${crypto.randomUUID()}`;
const setIfPresent = (target, key, value) => {
  if (value === null || value === undefined || value === "") return;
  target[key] = value;
};

const expireAttemptIfBasePriceChanged = async (
  attempt,
  baseAmountUsdCents,
  reasonPrefix,
  couponId = null,
) => {
  if (!attempt) return null;
  if (
    Number(attempt.baseAmountUsdCents || 0) === Number(baseAmountUsdCents || 0) &&
    String(attempt.couponId || "") === String(couponId || "")
  ) {
    return attempt;
  }

  attempt.status = "EXPIRED";
  attempt.expiresAt = new Date();
  attempt.note = `${reasonPrefix} after course price change from ${formatUsdCents(attempt.baseAmountUsdCents || 0)} USD to ${formatUsdCents(baseAmountUsdCents || 0)} USD`;
  await attempt.save();
  return null;
};

const expireAttemptIfStale = async (attempt, reason) => {
  if (!attempt) return null;

  const expiresAtMs = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : Number.NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
    return attempt;
  }

  attempt.status = "EXPIRED";
  attempt.expiresAt = Number.isFinite(expiresAtMs) ? new Date(expiresAtMs) : new Date();
  attempt.note = reason || "Payment attempt expired";
  await attempt.save();
  return null;
};

const isIssuedHesabAttempt = (attempt) =>
  isValidHesabCheckoutUrl(attempt?.providerUrl);

const getHesabIssuanceState = (attempt) =>
  String(attempt?.issuanceState || "NOT_STARTED").toUpperCase();

const isFreshUnstartedHesabAttempt = (attempt) => {
  if (getHesabIssuanceState(attempt) !== "NOT_STARTED") return false;
  const createdAtMs = attempt?.createdAt
    ? new Date(attempt.createdAt).getTime()
    : Number.NaN;
  return (
    Number.isFinite(createdAtMs) &&
    createdAtMs > Date.now() - HESAB_SESSION_CREATION_GRACE_MS
  );
};

const isAmbiguousHesabAttempt = (attempt) =>
  ["CREATING", "AMBIGUOUS", "ISSUED"].includes(getHesabIssuanceState(attempt));

const isRecoverableHesabAttempt = (attempt) => Boolean(
  isIssuedHesabAttempt(attempt) ||
  isAmbiguousHesabAttempt(attempt) ||
  isFreshUnstartedHesabAttempt(attempt),
);

const expirePendingAttempt = async (attempt, reason) => {
  if (!attempt || attempt.status !== "PENDING") return attempt;

  const expiredAt = new Date();
  attempt.status = "EXPIRED";
  attempt.expiresAt = expiredAt;
  attempt.note = reason || "Payment attempt expired";
  await attempt.save();
  await Payment.updateOne(
    {
      paymentAttemptId: attempt._id,
      paymentStatus: "pending",
    },
    {
      $set: {
        status: "expired",
        paymentStatus: "failed",
        failedAt: expiredAt,
        expiresAt: expiredAt,
        note: attempt.note,
      },
    },
  );
  return null;
};

const getStudentAttemptStatusUrl = (attempt) => (
  attempt?.method === "HESABPAY_HOSTED"
    ? `/payment/success?paymentAttemptId=${encodeURIComponent(String(attempt._id))}`
    : `/payment/crypto?attemptId=${encodeURIComponent(String(attempt?._id || ""))}`
);

const toActivePaymentPayload = (attempt, { resumed = true } = {}) => compactObject({
  orderId: getDocumentId(attempt?.orderId),
  paymentAttemptId: getDocumentId(attempt),
  paymentReference: attempt?.paymentReference,
  provider: attempt?.provider,
  resumed,
  status: attempt?.status,
  statusUrl: getStudentAttemptStatusUrl(attempt),
  paymentUrl: null,
  charge: compactObject({
    amount: attempt?.amount,
    currency: attempt?.currency,
    network: attempt?.network,
  }),
  expiresAt: attempt?.expiresAt,
  payment: toStudentPaymentAttemptDto(attempt),
});

const reconcileSucceededAttempt = async (attempt) => {
  if (!attempt || attempt.status !== "SUCCEEDED") return attempt;

  const paidAt =
    attempt.paidAt ||
    attempt.orderId?.paidAt ||
    attempt.createdAt ||
    new Date();
  await completePayment({
    paymentAttemptId: attempt._id,
    providerPaymentId: attempt.providerPaymentId,
    blockchainReference: attempt.blockchainReference,
    transactionSignature: attempt.transactionSignature,
    note: attempt.note || "Payment status reconciliation",
    paidAt,
    verifiedAt: attempt.verifiedAt || paidAt,
  });

  const refreshedAttempt = await PaymentAttempt.findById(attempt._id)
    .populate("orderId", "status paidAt");
  return refreshedAttempt || attempt;
};

const isExpiredByDate = (value) => {
  const expiresAtMs = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
};

const getRetryAfterSeconds = (targetTime) => {
  const ms = Math.max(0, Number(new Date(targetTime).getTime() - Date.now()));
  return Math.max(1, Math.ceil(ms / 1000));
};

const getDirectCryptoGuardKey = (attemptId, userId) => `${String(attemptId || "")}:${String(userId || "")}`;
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

const recordPaymentCouponRedemption = (payment) =>
  recordCouponRedemption({
    couponId: payment.couponId,
    couponCode: payment.couponCode,
    userId: payment.studentId,
    courseId: payment.courseId,
    orderId: payment.orderId || undefined,
    paymentId: payment._id,
    originalBaseAmountUsdCents:
      payment.originalBaseAmountUsdCents ?? payment.baseAmountUsdCents,
    discountAmountUsdCents: payment.discountAmountUsdCents || 0,
    finalBaseAmountUsdCents: payment.baseAmountUsdCents,
    redeemedAt: payment.paidAt || new Date(),
  });

const readDirectCryptoGuardState = (key) => {
  const state = directCryptoVerifyGuard.get(key);
  if (!state) return { failedCount: 0, blockUntil: null };

  const blockUntilMs = state.blockUntil ? new Date(state.blockUntil).getTime() : Number.NaN;
  if (Number.isFinite(blockUntilMs) && blockUntilMs <= Date.now()) {
    directCryptoVerifyGuard.delete(key);
    return { failedCount: 0, blockUntil: null };
  }

  return {
    failedCount: Number(state.failedCount || 0),
    blockUntil: state.blockUntil || null,
  };
};

const markDirectCryptoGuardFailure = (key) => {
  const current = readDirectCryptoGuardState(key);
  const failedCount = Number(current.failedCount || 0) + 1;
  const blockUntil =
    failedCount >= DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS
      ? new Date(Date.now() + DIRECT_CRYPTO_VERIFY_COOLDOWN_MS)
      : null;

  directCryptoVerifyGuard.set(key, {
    failedCount,
    blockUntil,
  });

  return {
    failedCount,
    blockUntil,
  };
};

const clearDirectCryptoGuardState = (key) => {
  directCryptoVerifyGuard.delete(key);
};

const couponResponse = (snapshot) =>
  snapshot
    ? {
        code: snapshot.couponCode,
        type: snapshot.couponType,
        value: snapshot.couponValue,
        originalAmountUsd:
          snapshot.originalBaseAmountUsdCents / 100,
        discountAmountUsd: snapshot.discountAmountUsdCents / 100,
        finalAmountUsd: snapshot.finalBaseAmountUsdCents / 100,
      }
    : null;

const getCourseForCheckout = async (courseId, pricingRegion = "international") => {
  const course = await Course.findById(courseId).select(
    "title slug price discountPrice teacherDiscountPercentage currency isFree pricingType prices paymentPlan status isPublished classEndedAt classCancelledAt startDate endDate",
  );
  if (!course) return null;
  const resolvedRegion = normalizePricingRegion(pricingRegion);
  let regionalPrice;
  let baseAmountUsdCents;
  if (String(course.pricingType || "single") === "regional") {
    ({ regionalPrice, baseAmountUsdCents } = await resolveCourseCheckoutPricing(
      course,
      resolvedRegion,
    ));
  } else {
    const pricing = await getPlatformPricingSettings();
    const displayPricing = resolveCourseDisplayPricing(
      course,
      pricing?.globalCourseDiscountPercentage || 0,
    );
    baseAmountUsdCents = normalizeUsdToCents(displayPricing.finalPrice);
    regionalPrice = {
      pricingType: "single",
      region: "international",
      requestedRegion: resolvedRegion,
      currency: "USD",
      regularPrice: displayPricing.originalPriceForDisplay || displayPricing.finalPrice,
      discountedPrice:
        displayPricing.originalPriceForDisplay > displayPricing.finalPrice
          ? displayPricing.finalPrice
          : null,
      finalPrice: displayPricing.finalPrice,
      isFree: displayPricing.finalPrice <= 0,
      usesInternationalPrice: false,
    };
  }
  return {
    course,
    regionalPrice,
    pricingRegion: resolvedRegion,
    baseAmountUsdCents,
  };
};

const getOrderSnapshotPayload = ({
  userId,
  courseId,
  baseAmountUsdCents,
  pricingRegion = "international",
  sourcePriceAmount = null,
  sourcePriceCurrency = null,
  sourceExchangeRate = null,
  sourceExchangeRateSource = null,
  sourceRateRetrievedAt = null,
  platformCommissionRate = null,
  couponSnapshot = null,
}) => ({
  userId,
  courseId,
  baseAmountUsdCents,
  pricingRegion,
  sourcePriceAmount,
  sourcePriceCurrency,
  sourceExchangeRate,
  sourceExchangeRateSource,
  sourceRateRetrievedAt,
  platformCommissionRate,
  originalBaseAmountUsdCents:
    couponSnapshot?.originalBaseAmountUsdCents ?? baseAmountUsdCents,
  couponId: couponSnapshot?.couponId || null,
  couponCode: couponSnapshot?.couponCode || "",
  couponType: couponSnapshot?.couponType || null,
  couponValue: couponSnapshot?.couponValue ?? null,
  discountAmountUsdCents: couponSnapshot?.discountAmountUsdCents || 0,
});

const orderSnapshotMatches = (order, snapshot) => (
  Number(order.baseAmountUsdCents || 0) === Number(snapshot.baseAmountUsdCents || 0) &&
  order.pricingRegion === snapshot.pricingRegion &&
  Number(order.sourcePriceAmount ?? -1) === Number(snapshot.sourcePriceAmount ?? -1) &&
  String(order.sourcePriceCurrency || "") === String(snapshot.sourcePriceCurrency || "") &&
  Number(order.sourceExchangeRate ?? -1) === Number(snapshot.sourceExchangeRate ?? -1) &&
  Number(order.platformCommissionRate ?? -1) === Number(snapshot.platformCommissionRate ?? -1) &&
  String(order.couponId || "") === String(snapshot.couponId || "") &&
  Number(order.discountAmountUsdCents || 0) === Number(snapshot.discountAmountUsdCents || 0)
);

const findOrCreatePendingOrder = async (input, session = null) => {
  const snapshot = getOrderSnapshotPayload(input);
  const { userId, courseId } = snapshot;
  const existing = await Order.findOne({ userId, courseId, status: "PENDING" }).session(session);
  if (existing) {
    const snapshotMatches = orderSnapshotMatches(existing, snapshot);
    if (!snapshotMatches) {
      const attemptExistsQuery = PaymentAttempt.exists({ orderId: existing._id });
      if (session) attemptExistsQuery.session(session);
      const hasAttempts = Boolean(await attemptExistsQuery);
      if (hasAttempts) {
        return { order: existing, snapshotMatches: false, hasAttempts: true };
      }

      const createdAtMs = existing.createdAt
        ? new Date(existing.createdAt).getTime()
        : Number.NaN;
      if (
        Number.isFinite(createdAtMs) &&
        createdAtMs > Date.now() - HESAB_SESSION_CREATION_GRACE_MS
      ) {
        return {
          order: existing,
          snapshotMatches: false,
          hasAttempts: false,
          initializing: true,
        };
      }

      Object.assign(existing, snapshot);
      await existing.save({ session });
    }
    return { order: existing, snapshotMatches: true, hasAttempts: false };
  }

  let order;
  try {
    order = await Order.create(
      [{ ...snapshot, status: "PENDING" }],
      session ? { session } : undefined,
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const winnerQuery = Order.findOne({ userId, courseId, status: "PENDING" });
    if (session) winnerQuery.session(session);
    const winner = await winnerQuery;
    if (!winner) throw error;
    return {
      order: winner,
      snapshotMatches: orderSnapshotMatches(winner, snapshot),
      hasAttempts: false,
      initializing: true,
    };
  }
  return { order, snapshotMatches: true, hasAttempts: false };
};

const createPaymentAttemptRecord = async ({ order, user, course, paymentReference = null, method, amount, currency, network = null, provider = null, exchangeRate = null, exchangeRateSource = null, rateRetrievedAt = null, providerPaymentId = null, blockchainReference = null, transactionSignature = null, providerUrl = null, expiresAt = null, rawCreateSessionResponse = null, recipientAddress = null, tokenMint = null }, session = null) => {
  const attemptPayload = {
    orderId: order._id,
    userId: user._id,
    courseId: course._id,
    paymentReference: paymentReference || makePaymentReference(),
    provider,
    method,
    baseAmountUsdCents: order.baseAmountUsdCents,
    originalBaseAmountUsdCents:
      order.originalBaseAmountUsdCents ?? order.baseAmountUsdCents,
    couponId: order.couponId || null,
    couponCode: order.couponCode || "",
    couponType: order.couponType || null,
    couponValue: order.couponValue ?? null,
    discountAmountUsdCents: order.discountAmountUsdCents || 0,
    amount,
    currency,
    customerEmail: user.email,
  };
  setIfPresent(attemptPayload, "network", network);
  setIfPresent(attemptPayload, "exchangeRate", exchangeRate);
  setIfPresent(attemptPayload, "exchangeRateSource", exchangeRateSource);
  setIfPresent(attemptPayload, "rateRetrievedAt", rateRetrievedAt);
  setIfPresent(attemptPayload, "providerPaymentId", providerPaymentId);
  setIfPresent(attemptPayload, "blockchainReference", blockchainReference);
  setIfPresent(attemptPayload, "transactionSignature", transactionSignature);
  setIfPresent(attemptPayload, "providerUrl", providerUrl);
  setIfPresent(attemptPayload, "expiresAt", expiresAt);
  setIfPresent(attemptPayload, "rawCreateSessionResponse", rawCreateSessionResponse);
  setIfPresent(attemptPayload, "recipientAddress", recipientAddress);
  setIfPresent(attemptPayload, "tokenMint", tokenMint);

  const attempt = await PaymentAttempt.create(
    [attemptPayload],
    session ? { session } : undefined,
  ).then((rows) => rows[0]);

  const legacyPayment = await Payment.create(
    [{
      studentId: user._id,
      courseId: course._id,
      orderId: order._id,
      paymentAttemptId: attempt._id,
      baseAmountUsdCents: order.baseAmountUsdCents,
      originalBaseAmountUsdCents:
        order.originalBaseAmountUsdCents ?? order.baseAmountUsdCents,
      couponId: order.couponId || null,
      couponCode: order.couponCode || "",
      couponType: order.couponType || null,
      couponValue: order.couponValue ?? null,
      discountAmountUsdCents: order.discountAmountUsdCents || 0,
      pricingRegion: order.pricingRegion || "international",
      sourcePriceAmount: order.sourcePriceAmount ?? null,
      sourcePriceCurrency: order.sourcePriceCurrency || null,
      sourceExchangeRate: order.sourceExchangeRate ?? null,
      sourceExchangeRateSource: order.sourceExchangeRateSource || null,
      sourceRateRetrievedAt: order.sourceRateRetrievedAt || null,
      platformCommissionRate: order.platformCommissionRate ?? null,
      amount: Number(amount || 0),
      gatewayAmount: Number(amount || 0),
      currency,
      gatewayCurrency: currency,
      provider: String(provider || "").toLowerCase(),
      status: "pending",
      paymentMethod:
        method === "NOWPAYMENTS_CRYPTO"
          ? "nowpayments_crypto"
          : method === "USDT_BSC_DIRECT"
            ? "usdt_bsc_direct"
            : "hesabpay",
      paymentStatus: "pending",
      paymentReference: attempt.paymentReference,
      hesabSessionId: providerPaymentId || null,
      hesabPaymentUrl: providerUrl || null,
      transactionId: providerPaymentId || null,
      providerPaymentId,
      blockchainReference,
      transactionSignature,
      network,
      exchangeRate,
      exchangeRateSource,
      expiresAt,
      customerEmail: user.email,
      rawCreateSessionResponse,
    }],
    session ? { session } : undefined,
  ).then((rows) => rows[0]);

  attempt.legacyPaymentId = legacyPayment._id;
  await attempt.save({ session });

  return { attempt, legacyPayment };
};

const NOWPAYMENTS_PROGRESS_STATUSES = new Set([
  "waiting",
  "confirming",
  "confirmed",
  "sending",
]);

const resolveNowPaymentsPaidAt = ({ attempt, payload } = {}) => {
  const existingPaidAt = attempt?.paidAt ? new Date(attempt.paidAt) : null;
  if (existingPaidAt && Number.isFinite(existingPaidAt.getTime())) {
    return existingPaidAt;
  }

  for (const value of [payload?.finished_at, payload?.payment_updated_at, payload?.updated_at]) {
    if (!value) continue;
    const providerPaidAt = new Date(value);
    if (Number.isFinite(providerPaidAt.getTime())) return providerPaidAt;
  }

  return new Date();
};

const applyNowPaymentsStatus = async ({ attempt, payload, source = "status" } = {}) => {
  if (!attempt || !payload || typeof payload !== "object") {
    throw new Error("Invalid NOWPayments reconciliation data");
  }

  const payloadPaymentId = payload?.payment_id ? String(payload.payment_id) : "";
  const payloadOrderId = String(payload?.order_id || "").trim();
  if (
    payloadPaymentId &&
    attempt.providerPaymentId &&
    payloadPaymentId !== String(attempt.providerPaymentId)
  ) {
    throw new Error("NOWPayments payment id mismatch");
  }
  if (payloadOrderId && payloadOrderId !== String(attempt.paymentReference || "")) {
    throw new Error("NOWPayments order id mismatch");
  }

  const paymentStatus = String(payload?.payment_status || "").trim().toLowerCase();
  const isAlreadyPaid = ["SUCCEEDED", "DUPLICATE_PAYMENT"].includes(attempt.status);
  const markManualReview = async (note) => {
    attempt.status = "MANUAL_REVIEW";
    attempt.note = note;
    attempt.verifiedAt = new Date();
    if (source === "ipn") attempt.rawWebhookPayload = payload;
    else attempt.rawVerificationPayload = payload;
    await attempt.save();
    return { manualReview: true, status: attempt.status };
  };

  // Provider notifications can arrive out of order. Once this attempt has
  // completed, no later payload may downgrade it. A repeated finished event
  // only re-runs idempotent fulfillment so a partially completed local write
  // can be repaired.
  if (isAlreadyPaid) {
    if (paymentStatus !== "finished") {
      return { ignored: true, status: attempt.status };
    }

    return completePayment({
      paymentAttemptId: attempt._id,
      providerPaymentId: payloadPaymentId || attempt.providerPaymentId,
      transactionSignature:
        String(payload?.payin_hash || payload?.txn_id || payload?.txid || "").trim() || null,
      rawWebhookPayload: source === "ipn" ? payload : null,
      rawVerificationPayload: source === "ipn" ? null : payload,
      note: source === "ipn"
        ? "NOWPayments IPN verification replay"
        : "NOWPayments provider status reconciliation replay",
      paidAt: resolveNowPaymentsPaidAt({ attempt, payload }),
      verifiedAt: new Date(),
    });
  }

  if (attempt.status === "MANUAL_REVIEW") {
    const hasCompleteProviderAmounts = [
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",
      "actually_paid",
    ].every((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== "");

    // A sparse status/IPN response must not erase a prior partial-payment or
    // amount-mismatch decision. Only a complete, final provider snapshot can
    // be revalidated below; otherwise an administrator must resolve it.
    if (paymentStatus !== "finished" || !hasCompleteProviderAmounts) {
      return { manualReview: true, status: attempt.status };
    }
  }

  const payAmount = String(payload?.pay_amount || "").trim();
  const normalizedPayAmount = payAmount ? roundUpDecimalAmount(payAmount, 2) : "";
  if (
    normalizedPayAmount &&
    normalizedPayAmount !== String(attempt.amount || "").trim()
  ) {
    return markManualReview("NOWPayments quoted amount mismatch");
  }

  const payloadCurrency = payload?.pay_currency
    ? normalizeNowPaymentsCurrency(payload.pay_currency)
    : null;
  const currencyMismatch = payloadCurrency && (
    String(payloadCurrency.currency || "").toUpperCase() !==
      String(attempt.currency || "").toUpperCase() ||
    (
      payloadCurrency.network &&
      attempt.network &&
      String(payloadCurrency.network).toUpperCase() !== String(attempt.network).toUpperCase()
    )
  );
  if (currencyMismatch) {
    return markManualReview("NOWPayments payment currency or network mismatch");
  }

  const payloadPriceCurrency = String(payload?.price_currency || "").trim().toUpperCase();
  if (payloadPriceCurrency && payloadPriceCurrency !== "USD") {
    return markManualReview("NOWPayments price currency mismatch");
  }
  if (
    payload?.price_amount !== undefined &&
    normalizeUsdToCents(payload.price_amount) !== Number(attempt.baseAmountUsdCents || 0)
  ) {
    return markManualReview("NOWPayments course price mismatch");
  }

  if (paymentStatus === "finished" && payload?.actually_paid !== undefined) {
    const actuallyPaid = Number(payload.actually_paid);
    const expectedAmount = Number(attempt.amount || 0);
    if (
      !Number.isFinite(actuallyPaid) ||
      !Number.isFinite(expectedAmount) ||
      actuallyPaid + 1e-8 < expectedAmount
    ) {
      return markManualReview("NOWPayments actual paid amount is below the checkout quote");
    }
  }

  attempt.providerPaymentId = payloadPaymentId || attempt.providerPaymentId;
  if (source === "ipn") attempt.rawWebhookPayload = payload;
  else attempt.rawVerificationPayload = payload;

  if (paymentStatus === "finished") {
    return completePayment({
      paymentAttemptId: attempt._id,
      providerPaymentId: attempt.providerPaymentId,
      transactionSignature:
        String(payload?.payin_hash || payload?.txn_id || payload?.txid || "").trim() || null,
      rawWebhookPayload: source === "ipn" ? payload : null,
      rawVerificationPayload: source === "ipn" ? null : payload,
      note: source === "ipn"
        ? "NOWPayments IPN verification"
        : "NOWPayments provider status reconciliation",
      paidAt: resolveNowPaymentsPaidAt({ attempt, payload }),
      verifiedAt: new Date(),
    });
  }

  if (paymentStatus === "partially_paid") {
    attempt.status = "MANUAL_REVIEW";
    attempt.note = "NOWPayments partial payment";
    attempt.verifiedAt = new Date();
    await attempt.save();
    return { manualReview: true, status: attempt.status };
  }

  if (["failed", "refunded"].includes(paymentStatus)) {
    attempt.status = "FAILED";
    attempt.failedAt = new Date();
    await attempt.save();
    return { status: attempt.status };
  }

  if (paymentStatus === "expired") {
    attempt.status = "EXPIRED";
    await attempt.save();
    return { status: attempt.status };
  }

  if (NOWPAYMENTS_PROGRESS_STATUSES.has(paymentStatus)) {
    attempt.status = "PENDING";
  }
  await attempt.save();
  return { status: attempt.status };
};

export const getUsdToAfnQuote = async (req, res) => {
  try {
    const amountUsd = Number(req.query.amount || 0);
    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      return apiError(res, 400, "Invalid amount");
    }

    const cents = normalizeUsdToCents(amountUsd);
    const quote = await quoteAfnFromUsdCents(cents);
    return apiSuccess(res, {
      rate: quote.exchangeRate,
      source: quote.exchangeRateSource,
      amountUsd,
      amountAfn: Number(quote.amount),
      currencyFrom: "USD",
      currencyTo: "AFN",
    });
  } catch (error) {
    console.error("getUsdToAfnQuote error:", error.message || error);
    return apiError(res, 500, "Unable to resolve exchange rate");
  }
};

export const getUsdExchangeQuote = async (req, res) => {
  try {
    const amountUsd = Number(req.query.amount || 0);
    const currencyTo = String(req.query.to || "AFN").trim().toUpperCase();

    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      return apiError(res, 400, "Invalid amount");
    }

    if (!["AFN", "IRR", "USDT"].includes(currencyTo)) {
      return apiError(res, 400, "Unsupported target currency");
    }

    const cents = normalizeUsdToCents(amountUsd);
    const quote = await quoteFromUsdCents(cents, currencyTo);

    res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");

    return apiSuccess(res, {
      rate: quote.exchangeRate,
      source: quote.exchangeRateSource,
      amountUsd,
      convertedAmount: Number(quote.amount),
      currencyFrom: "USD",
      currencyTo,
    });
  } catch (error) {
    console.error("getUsdExchangeQuote error:", error.message || error);
    return apiError(res, 500, "Unable to resolve exchange rate");
  }
};

export const getUsdExchangeRates = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const rates = await getUsdRatesForCurrencies(["AFN", "IRR", "USDT"]);
    const rawIrrRate = Number(rates?.IRR?.rate || 0);
    const tomanPerUsd = rawIrrRate / 10;

    return apiSuccess(res, {
      base: "USD",
      rates: {
        AFN: Number(rates?.AFN?.rate || 0),
        IRR: Number(rates?.IRR?.rate || 0),
        USDT: Number(rates?.USDT?.rate || 0),
      },
      normalizedRates: {
        TOMAN: tomanPerUsd,
      },
      units: {
        AFN: "afghanis_per_usd",
        IRR: "rials_per_usd",
        TOMAN: "tomans_per_usd",
        USDT: "usdt_per_usd",
      },
      sources: {
        AFN: rates?.AFN?.source || "unknown",
        IRR: rates?.IRR?.source || "unknown",
        TOMAN: rates?.IRR?.source || "unknown",
        USDT: rates?.USDT?.source || "unknown",
      },
      selectedFields: {
        AFN: rates?.AFN?.selectedField || null,
        IRR: rates?.IRR?.selectedField || null,
        USDT: rates?.USDT?.selectedField || null,
      },
      source: rates?.IRR?.source || rates?.AFN?.source || rates?.USDT?.source || "cache",
      nextRefreshAt: getNextExchangeRateRefreshAt().toISOString(),
    });
  } catch (error) {
    console.error("getUsdExchangeRates error:", error.message || error);
    return apiError(res, 500, "Unable to resolve exchange rates");
  }
};

export const createCheckout = async (req, res) => {
  try {
    const { courseId, paymentMethod, couponCode } = req.body || {};
    const method = String(paymentMethod || "").trim().toUpperCase();
    const pricingRegion = resolveStudentPricingRegion({
      profileCountry: req.user?.country,
      detectedRegion: req.body?.pricingRegion,
    });

    if (!courseId || !isValidObjectId(courseId)) {
      return apiError(res, 400, "Invalid courseId");
    }
    if (!["HESABPAY_HOSTED", "USDT_BSC_DIRECT"].includes(method)) {
      return apiError(res, 400, "Unsupported payment method");
    }

    const checkoutPricing =
      await getCourseForCheckout(courseId, pricingRegion);
    if (!checkoutPricing) return apiError(res, 404, "Course not found");
    const { course, regionalPrice } = checkoutPricing;
    let { baseAmountUsdCents } = checkoutPricing;
    if (!isCoursePurchasable(course)) return apiError(res, 400, "Course is not available for purchase");
    if (!Number.isFinite(baseAmountUsdCents) || baseAmountUsdCents <= 0) {
      return apiError(res, 400, "Invalid course price");
    }
    const couponSnapshot = await resolveCouponForCheckout({
      code: couponCode,
      userId: req.user._id,
      courseId: course._id,
      baseAmountUsdCents,
    });
    if (couponSnapshot) {
      baseAmountUsdCents = couponSnapshot.finalBaseAmountUsdCents;
    }

    const existingEnrollment = await Enrollment.findOne({
      studentId: req.user._id,
      courseId: course._id,
      enrollmentStatus: { $in: ["active", "completed"] },
      accessStatus: "allowed",
    });
    await expireEnrollmentIfNeeded(existingEnrollment, course);
    if (existingEnrollment && !isEnrollmentExpired(existingEnrollment)) {
      return apiError(res, 400, "You are already enrolled in this course");
    }

    const unresolvedAttempts = await PaymentAttempt.find({
      userId: req.user._id,
      courseId: course._id,
      status: { $in: ["PENDING", "EXPIRED", "MANUAL_REVIEW", "SUCCEEDED"] },
    }).sort({ createdAt: -1 });
    let activeAttempt = null;
    for (const candidate of unresolvedAttempts || []) {
      if (candidate.status === "SUCCEEDED") {
        const reconciledAttempt = await reconcileSucceededAttempt(candidate);
        const recoveredEnrollment = await Enrollment.findOne({
          studentId: req.user._id,
          courseId: course._id,
        });
        await expireEnrollmentIfNeeded(recoveredEnrollment, course);
        if (
          recoveredEnrollment &&
          recoveredEnrollment.enrollmentStatus === "active" &&
          recoveredEnrollment.accessStatus === "allowed" &&
          !isEnrollmentExpired(recoveredEnrollment)
        ) {
          return apiSuccess(res, toActivePaymentPayload(reconciledAttempt));
        }
        if (!recoveredEnrollment) {
          throw new Error("Succeeded payment fulfillment could not be recovered");
        }
        continue;
      }

      if (candidate.status === "MANUAL_REVIEW") {
        activeAttempt = candidate;
        break;
      }

      const issued = candidate.method === "HESABPAY_HOSTED"
        ? isRecoverableHesabAttempt(candidate)
        : Boolean(
            candidate.providerPaymentId ||
            candidate.providerUrl ||
            candidate.recipientAddress,
          );
      if (!issued) {
        if (candidate.status === "PENDING") {
          await expirePendingAttempt(
            candidate,
            "Orphaned payment attempt expired before provider session issuance",
          );
        }
        continue;
      }

      if (candidate.status === "PENDING" && isExpiredByDate(candidate.expiresAt)) {
        await expirePendingAttempt(
          candidate,
          "Issued payment attempt aged out while awaiting final verification",
        );
      }

      activeAttempt = candidate;
      break;
    }

    if (activeAttempt) {
      if (activeAttempt.method === method) {
        return apiSuccess(res, toActivePaymentPayload(activeAttempt));
      }
      return apiError(res, 409, "Another payment request is still active for this course", {
        code: "ACTIVE_PAYMENT_EXISTS",
        activePayment: toStudentPaymentAttemptDto(activeAttempt),
        paymentAttemptId: activeAttempt._id,
        paymentReference: activeAttempt.paymentReference,
        statusUrl: getStudentAttemptStatusUrl(activeAttempt),
      });
    }

    const platformCommissionRate = await getTeacherDeductionPercentage();
    let hesabPayQuote = null;
    let regionalDisplaySnapshot;
    const isAfghanistanHesabPay =
      method === "HESABPAY_HOSTED" && pricingRegion === "afghanistan";

    if (
      couponSnapshot ||
      (isAfghanistanHesabPay && regionalPrice?.currency !== "AFN")
    ) {
      hesabPayQuote = await quoteAfnFromUsdCents(baseAmountUsdCents);
      regionalDisplaySnapshot = {
        amount: Number(hesabPayQuote.amount || 0),
        currency: "AFN",
        exchangeRate: hesabPayQuote.exchangeRate,
        exchangeRateSource: hesabPayQuote.exchangeRateSource,
        rateRetrievedAt: hesabPayQuote.rateRetrievedAt,
      };
    } else {
      regionalDisplaySnapshot = await resolveRegionalDisplaySnapshot({
        resolvedPrice: couponSnapshot
          ? { currency: "USD", finalPrice: baseAmountUsdCents / 100 }
          : regionalPrice,
        requestedRegion: pricingRegion,
        baseAmountUsdCents,
      });
    }

    if (method === "HESABPAY_HOSTED" && !hesabPayQuote) {
      hesabPayQuote =
        regionalPrice?.currency === "AFN"
          ? {
              amount: Number(regionalPrice.finalPrice || 0),
              exchangeRate: regionalDisplaySnapshot.exchangeRate,
              exchangeRateSource: regionalDisplaySnapshot.exchangeRateSource,
              rateRetrievedAt: regionalDisplaySnapshot.rateRetrievedAt || new Date(),
            }
          : await quoteAfnFromUsdCents(baseAmountUsdCents);
    }
    const orderInput = {
      userId: req.user._id,
      courseId: course._id,
      baseAmountUsdCents,
      pricingRegion,
      sourcePriceAmount: regionalDisplaySnapshot.amount,
      sourcePriceCurrency: regionalDisplaySnapshot.currency,
      sourceExchangeRate: regionalDisplaySnapshot.exchangeRate,
      sourceExchangeRateSource: regionalDisplaySnapshot.exchangeRateSource,
      sourceRateRetrievedAt: regionalDisplaySnapshot.rateRetrievedAt,
      platformCommissionRate,
      couponSnapshot,
    };
    let orderResult = await findOrCreatePendingOrder(orderInput);
    let { order } = orderResult;
    if (!orderResult.snapshotMatches && orderResult.initializing) {
      return apiError(res, 409, "Another checkout quote is being initialized for this course", {
        code: "CHECKOUT_INITIALIZING",
        orderId: order._id,
      });
    }
    if (!orderResult.snapshotMatches && orderResult.hasAttempts) {
      const recoverableAttempt = await PaymentAttempt.findOne({
        orderId: order._id,
        status: { $in: ["PENDING", "EXPIRED", "MANUAL_REVIEW", "SUCCEEDED"] },
      }).sort({ createdAt: -1 });
      if (recoverableAttempt?.status === "SUCCEEDED") {
        const reconciledAttempt = await reconcileSucceededAttempt(recoverableAttempt);
        return apiSuccess(res, toActivePaymentPayload(reconciledAttempt));
      }
      const recoverableAttemptIssued = recoverableAttempt && (
        recoverableAttempt.status === "MANUAL_REVIEW" ||
        (
          recoverableAttempt.method === "HESABPAY_HOSTED"
            ? isRecoverableHesabAttempt(recoverableAttempt)
            : Boolean(
                recoverableAttempt.providerPaymentId ||
                recoverableAttempt.providerUrl ||
                recoverableAttempt.recipientAddress,
              )
        )
      );
      if (recoverableAttemptIssued) {
        if (
          recoverableAttempt.status === "PENDING" &&
          isExpiredByDate(recoverableAttempt.expiresAt)
        ) {
          await expirePendingAttempt(
            recoverableAttempt,
            "Issued payment attempt aged out while awaiting final verification",
          );
        }
        if (recoverableAttempt.method === method) {
          return apiSuccess(res, toActivePaymentPayload(recoverableAttempt));
        }
        return apiError(res, 409, "Another payment request is still recoverable for this course", {
          code: "ACTIVE_PAYMENT_EXISTS",
          activePayment: toStudentPaymentAttemptDto(recoverableAttempt),
          paymentAttemptId: recoverableAttempt._id,
          paymentReference: recoverableAttempt.paymentReference,
          statusUrl: getStudentAttemptStatusUrl(recoverableAttempt),
        });
      }

      // An Order is an immutable quote once any payment attempt references it.
      // Rotate the pending Order instead of rewriting the accepted snapshot.
      order.status = "CANCELLED";
      await order.save();
      orderResult = await findOrCreatePendingOrder(orderInput);
      ({ order } = orderResult);
    }

    if (method === "HESABPAY_HOSTED") {
      const quote = hesabPayQuote;
      let paymentAttempt = await PaymentAttempt.findOne({
        orderId: order._id,
        method: "HESABPAY_HOSTED",
        status: "PENDING",
      }).sort({ createdAt: -1 });

      if (paymentAttempt && isRecoverableHesabAttempt(paymentAttempt)) {
        if (
          isIssuedHesabAttempt(paymentAttempt) &&
          isExpiredByDate(paymentAttempt.expiresAt)
        ) {
          await expirePendingAttempt(
            paymentAttempt,
            "Issued HesabPay attempt aged out while awaiting final verification",
          );
        }
      } else if (paymentAttempt) {
        paymentAttempt = await expirePendingAttempt(
          paymentAttempt,
          "Safely unissued HesabPay attempt expired before provider session creation",
        );
      }

      if (paymentAttempt) {
        return apiSuccess(res, {
          orderId: order._id,
          paymentAttemptId: paymentAttempt._id,
          paymentReference: paymentAttempt.paymentReference,
          provider: "HESABPAY",
          resumed: true,
          statusUrl: `/payment/success?paymentAttemptId=${encodeURIComponent(String(paymentAttempt._id))}`,
          basePrice: {
            amount: formatUsdCents(baseAmountUsdCents),
            currency: "USD",
          },
          regionalPrice,
          pricingRegion,
          charge: {
            amount: paymentAttempt.amount,
            currency: paymentAttempt.currency || "AFN",
          },
          exchangeRate: paymentAttempt.exchangeRate || quote.exchangeRate,
          expiresAt: paymentAttempt.expiresAt,
          paymentUrl: null,
          coupon: couponResponse(couponSnapshot),
        });
      }

      const clientUrl = resolveStudentClientUrl();
      let attempt;
      let legacyPayment;
      try {
        ({ attempt, legacyPayment } = await createPaymentAttemptRecord({
          order,
          user: req.user,
          course,
          method: "HESABPAY_HOSTED",
          amount: quote.amount,
          currency: "AFN",
          network: "AFN",
          provider: "HESABPAY",
          exchangeRate: quote.exchangeRate,
          exchangeRateSource: quote.exchangeRateSource,
          rateRetrievedAt: quote.rateRetrievedAt,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          providerUrl: null,
          rawCreateSessionResponse: null,
        }));
      } catch (attemptError) {
        if (attemptError?.code === 11000) {
          const winningAttempt = await PaymentAttempt.findOne({
            orderId: order._id,
            status: { $in: ["PENDING", "MANUAL_REVIEW"] },
          }).sort({ createdAt: -1 });
          if (winningAttempt) {
            return apiSuccess(res, toActivePaymentPayload(winningAttempt));
          }
        }
        throw attemptError;
      }

      // Persist the provider-call boundary before any network request. A crash
      // after this point is ambiguous and must never be recycled automatically.
      const issuanceStartedAt = new Date();
      const issuanceClaim = await PaymentAttempt.updateOne(
        {
          _id: attempt._id,
          status: "PENDING",
          issuanceState: "NOT_STARTED",
        },
        {
          $set: {
            issuanceState: "CREATING",
            issuanceStartedAt,
          },
        },
      );
      if (Number(issuanceClaim?.modifiedCount || 0) !== 1) {
        const currentAttempt = await PaymentAttempt.findById(attempt._id);
        return apiSuccess(res, toActivePaymentPayload(currentAttempt || attempt));
      }
      attempt.issuanceState = "CREATING";
      attempt.issuanceStartedAt = issuanceStartedAt;
      const redirectQuery = new URLSearchParams({
        paymentAttemptId: String(attempt._id),
        ref: String(attempt.paymentReference),
        orderId: String(order._id),
      }).toString();
      const redirectSuccessUrl = `${clientUrl}/payment/success?${redirectQuery}`;
      const redirectFailureUrl = `${clientUrl}/payment/failure?${redirectQuery}`;

      let sessionData;
      try {
        sessionData = await createPaymentSession({
          email: req.user.email,
          userId: attempt._id,
          currency: "AFN",
          amount: Number(quote.amount),
          items: [{
            id: attempt.paymentReference,
            name: course.title,
            amount: Number(quote.amount),
            price: Number(quote.amount),
            currency: "AFN",
          }],
          redirectSuccessUrl,
          redirectFailureUrl,
        });
      } catch (sessionError) {
        const definitiveFailure = sessionError?.definitiveFailure === true;
        const failedAt = new Date();
        attempt.status = definitiveFailure ? "FAILED" : "MANUAL_REVIEW";
        attempt.failedAt = definitiveFailure ? failedAt : null;
        attempt.issuanceState = definitiveFailure
          ? "DEFINITIVELY_FAILED"
          : "AMBIGUOUS";
        attempt.issuanceCompletedAt = failedAt;
        attempt.note = definitiveFailure
          ? "HesabPay definitively rejected the session request"
          : "HesabPay session result is ambiguous; verify before retrying";
        await attempt.save();
        legacyPayment.status = definitiveFailure ? "failed" : "pending";
        legacyPayment.paymentStatus = definitiveFailure ? "failed" : "pending";
        legacyPayment.failedAt = definitiveFailure ? failedAt : null;
        legacyPayment.note = attempt.note;
        await legacyPayment.save();
        throw sessionError;
      }

      const paymentUrl = sessionData?.payment_url;
      if (
        sessionData?.success !== true ||
        Number(sessionData?.status_code) !== 10 ||
        !isValidHesabCheckoutUrl(paymentUrl)
      ) {
        attempt.status = "MANUAL_REVIEW";
        attempt.failedAt = null;
        attempt.issuanceState = "AMBIGUOUS";
        attempt.issuanceCompletedAt = new Date();
        attempt.note = "HesabPay did not return a valid successful checkout session";
        await attempt.save();
        legacyPayment.status = "pending";
        legacyPayment.paymentStatus = "pending";
        legacyPayment.failedAt = null;
        legacyPayment.note = attempt.note;
        await legacyPayment.save();
        return apiError(res, 502, attempt.note);
      }

      const providerPaymentId = sessionData.session_id || sessionData.payment_id || null;
      if (providerPaymentId) {
        attempt.providerPaymentId = String(providerPaymentId);
      }
      attempt.providerUrl = paymentUrl;
      attempt.issuanceState = "ISSUED";
      attempt.issuanceCompletedAt = new Date();
      attempt.rawCreateSessionResponse = sessionData?.rawResponse || sessionData;
      attempt.expiresAt = sessionData.expires_at ? new Date(sessionData.expires_at) : attempt.expiresAt;
      await attempt.save();

      legacyPayment.hesabSessionId = attempt.providerPaymentId;
      legacyPayment.hesabPaymentUrl = paymentUrl;
      legacyPayment.rawCreateSessionResponse = sessionData?.rawResponse || sessionData;
      legacyPayment.expiresAt = attempt.expiresAt;
      await legacyPayment.save();

      return apiSuccess(res, {
        orderId: order._id,
        paymentAttemptId: attempt._id,
        paymentReference: attempt.paymentReference,
        provider: "HESABPAY",
        resumed: false,
        basePrice: {
          amount: formatUsdCents(baseAmountUsdCents),
          currency: "USD",
        },
        charge: {
          amount: quote.amount,
          currency: "AFN",
        },
        exchangeRate: quote.exchangeRate,
        paymentUrl,
        coupon: couponResponse(couponSnapshot),
      });
    }

    if (method === "USDT_BSC_DIRECT") {
      const useDirectBscFlow = method === "USDT_BSC_DIRECT";

      if (useDirectBscFlow) {
        let existingAttempt = await PaymentAttempt.findOne({
          orderId: order._id,
          method: "USDT_BSC_DIRECT",
          status: "PENDING",
        }).sort({ createdAt: -1 });

        if (
          existingAttempt &&
          (existingAttempt.providerUrl || existingAttempt.recipientAddress)
        ) {
          if (isExpiredByDate(existingAttempt.expiresAt)) {
            await expirePendingAttempt(
              existingAttempt,
              "Issued direct BSC attempt aged out while awaiting verification",
            );
          }
          return apiSuccess(res, toActivePaymentPayload(existingAttempt));
        }

        existingAttempt = await expireAttemptIfBasePriceChanged(
          existingAttempt,
          baseAmountUsdCents,
          "Crypto attempt expired",
          couponSnapshot?.couponId,
        );
        existingAttempt = await expireAttemptIfStale(
          existingAttempt,
          "Direct BSC crypto attempt expired",
        );

        if (existingAttempt) {
          const currentDirectDetails = getDirectBscPaymentDetails(
            existingAttempt.amount || formatUsdCents(baseAmountUsdCents),
            existingAttempt.paymentReference || "",
          );
          const directConfigChanged =
            String(existingAttempt.recipientAddress || "").toLowerCase() !==
              String(currentDirectDetails.recipientAddress || "").toLowerCase() ||
            String(existingAttempt.tokenMint || "").toLowerCase() !==
              String(currentDirectDetails.tokenMint || "").toLowerCase() ||
            String(existingAttempt.network || "").toUpperCase() !==
              String(currentDirectDetails.network || "").toUpperCase();

          if (directConfigChanged) {
            existingAttempt.status = "EXPIRED";
            existingAttempt.note = "Superseded after direct BSC payment configuration change";
            existingAttempt.expiresAt = new Date();
            await existingAttempt.save();
            existingAttempt = null;
          }
        }

        if (existingAttempt) {
          return apiSuccess(res, {
            orderId: order._id,
            paymentAttemptId: existingAttempt._id,
            provider: "BSC_DIRECT",
            basePrice: {
              amount: formatUsdCents(baseAmountUsdCents),
              currency: "USD",
            },
            charge: {
              amount: existingAttempt.amount,
              currency: existingAttempt.currency,
              network: existingAttempt.network,
            },
            quoteBreakdown: {
              baseAmount: existingAttempt.amount || formatUsdCents(baseAmountUsdCents),
            },
            payAddress: existingAttempt.recipientAddress || "",
            tokenAddress: existingAttempt.tokenMint || "",
            paymentUrl: existingAttempt.providerUrl || existingAttempt.recipientAddress || "",
            expiresAt: existingAttempt.expiresAt,
            coupon: couponResponse(couponSnapshot),
          });
        }

        const paymentReference = makePaymentReference();
        const directQuote = createUniqueUsdtBscAmount(baseAmountUsdCents);
        const chargeAmount = directQuote.totalAmount;
        const directDetails = getDirectBscPaymentDetails(chargeAmount, paymentReference);
        let attempt;
        try {
          ({ attempt } = await createPaymentAttemptRecord({
            order,
            user: req.user,
            course,
            paymentReference,
            method: "USDT_BSC_DIRECT",
            amount: chargeAmount,
            currency: "USDT",
            network: normalizeBscNetworkLabel(),
            provider: "BSC_DIRECT",
            exchangeRate: "1",
            exchangeRateSource: null,
            expiresAt: new Date(Date.now() + Number(process.env.BSC_PAYMENT_EXPIRY_MINUTES || 60) * 60 * 1000),
            providerUrl: directDetails.paymentUrl,
            rawCreateSessionResponse: {
              baseAmount: directQuote.baseAmount,
              totalAmount: chargeAmount,
              qrPayload: directDetails.qrPayload,
            },
            recipientAddress: directDetails.recipientAddress,
            tokenMint: directDetails.tokenMint,
          }));
        } catch (attemptError) {
          if (attemptError?.code === 11000) {
            const winningAttempt = await PaymentAttempt.findOne({
              orderId: order._id,
              status: { $in: ["PENDING", "MANUAL_REVIEW"] },
            }).sort({ createdAt: -1 });
            if (winningAttempt) {
              return apiSuccess(res, toActivePaymentPayload(winningAttempt));
            }
          }
          throw attemptError;
        }

        return apiSuccess(res, {
          orderId: order._id,
          paymentAttemptId: attempt._id,
          provider: "BSC_DIRECT",
          basePrice: {
            amount: formatUsdCents(baseAmountUsdCents),
            currency: "USD",
          },
          regionalPrice,
          pricingRegion,
          charge: {
            amount: attempt.amount,
            currency: attempt.currency,
            network: attempt.network,
          },
          quoteBreakdown: {
            baseAmount: directQuote.baseAmount,
          },
          payAddress: attempt.recipientAddress || "",
          tokenAddress: attempt.tokenMint || "",
          payCurrency: "USDT",
          paymentUrl: attempt.providerUrl || attempt.recipientAddress || "",
          qrPayload: directDetails.qrPayload,
          expiresAt: attempt.expiresAt,
          coupon: couponResponse(couponSnapshot),
        });
      }

      const configuredNowPaymentsCurrency = normalizeNowPaymentsCurrency(
        process.env.NOWPAYMENTS_PAY_CURRENCY,
      );
      let existingAttempt = await PaymentAttempt.findOne({
        orderId: order._id,
        method: "NOWPAYMENTS_CRYPTO",
        status: "PENDING",
      }).sort({ createdAt: -1 });

      existingAttempt = await expireAttemptIfBasePriceChanged(
        existingAttempt,
        baseAmountUsdCents,
        "Crypto attempt expired",
        couponSnapshot?.couponId,
      );
      existingAttempt = await expireAttemptIfStale(
        existingAttempt,
        "NOWPayments crypto attempt expired",
      );

      if (
        existingAttempt &&
        (
          String(existingAttempt.currency || "").toUpperCase() !==
            String(configuredNowPaymentsCurrency.currency || "").toUpperCase() ||
          String(existingAttempt.network || "").toUpperCase() !==
            String(configuredNowPaymentsCurrency.network || "").toUpperCase()
        )
      ) {
        existingAttempt.status = "EXPIRED";
        existingAttempt.note = `Superseded after NOWPayments currency/network change to ${configuredNowPaymentsCurrency.currency || "UNKNOWN"} ${configuredNowPaymentsCurrency.network || ""}`.trim();
        existingAttempt.expiresAt = new Date();
        await existingAttempt.save();
        existingAttempt = null;
      }

      if (existingAttempt) {
        return apiSuccess(res, {
          orderId: order._id,
          paymentAttemptId: existingAttempt._id,
          provider: "NOWPAYMENTS",
            basePrice: {
              amount: formatUsdCents(baseAmountUsdCents),
              currency: "USD",
            },
            regionalPrice,
            pricingRegion,
          charge: {
            amount: existingAttempt.amount,
            currency: existingAttempt.currency,
            network: existingAttempt.network,
          },
          payAddress: existingAttempt.recipientAddress || "",
          tokenAddress: existingAttempt.tokenMint || "",
          payCurrency: String(process.env.NOWPAYMENTS_PAY_CURRENCY || "usdtbsc").trim().toUpperCase(),
          paymentUrl: existingAttempt.providerUrl || existingAttempt.recipientAddress || "",
          expiresAt: existingAttempt.expiresAt,
          coupon: couponResponse(couponSnapshot),
        });
      }

      const paymentReference = makePaymentReference();
      const exactUsdtAmount = formatUsdCents(baseAmountUsdCents);
      const nowPaymentsResponse = await createNowPaymentsPayment({
        priceAmount: Number(formatUsdCents(baseAmountUsdCents)),
        payAmount: Number(exactUsdtAmount),
        priceCurrency: "usd",
        orderId: paymentReference,
        orderDescription: `${process.env.APP_NAME || "EduTech"} course payment`,
      });
      if (!nowPaymentsResponse?.pay_amount) {
        return apiError(res, 502, "NOWPayments did not return a payable amount");
      }

      const normalizedCurrency = normalizeNowPaymentsCurrency(
        nowPaymentsResponse?.pay_currency || process.env.NOWPAYMENTS_PAY_CURRENCY,
      );
      const roundedChargeAmount = roundUpDecimalAmount(nowPaymentsResponse?.pay_amount || exactUsdtAmount, 2);
      const { attempt } = await createPaymentAttemptRecord({
        order,
        user: req.user,
        course,
        paymentReference,
        method: "NOWPAYMENTS_CRYPTO",
        amount: roundedChargeAmount,
        currency: normalizedCurrency.currency || "USDT",
        network: normalizedCurrency.network,
        provider: "NOWPAYMENTS",
        providerPaymentId: nowPaymentsResponse?.payment_id ? String(nowPaymentsResponse.payment_id) : null,
        providerUrl: String(nowPaymentsResponse?.invoice_url || nowPaymentsResponse?.pay_address || "").trim() || null,
        rawCreateSessionResponse: nowPaymentsResponse,
        recipientAddress: String(nowPaymentsResponse?.pay_address || "").trim() || null,
        tokenMint: String(process.env.BSC_USDT_CONTRACT_ADDRESS || "").trim() || null,
        expiresAt: nowPaymentsResponse?.expiration_estimate_date ? new Date(nowPaymentsResponse.expiration_estimate_date) : null,
      });

      return apiSuccess(res, {
        orderId: order._id,
        paymentAttemptId: attempt._id,
        provider: "NOWPAYMENTS",
          basePrice: {
            amount: formatUsdCents(baseAmountUsdCents),
            currency: "USD",
          },
          regionalPrice,
          pricingRegion,
        charge: {
          amount: attempt.amount,
          currency: attempt.currency,
          network: attempt.network,
        },
        payAddress: attempt.recipientAddress || "",
        tokenAddress: attempt.tokenMint || "",
        payCurrency: String(nowPaymentsResponse?.pay_currency || "").trim().toUpperCase(),
        paymentUrl: attempt.providerUrl || attempt.recipientAddress || "",
        expiresAt: attempt.expiresAt,
        coupon: couponResponse(couponSnapshot),
      });
    }

  } catch (error) {
    if (error?.code?.startsWith("COUPON_")) {
      return apiError(res, error.statusCode || 400, error.message, {
        code: error.code,
      });
    }
    console.error("createCheckout error:", error.message || error);
    if (/BSC RPC URL|BSC recipient address|BSC USDT contract address/i.test(String(error?.message || ""))) {
      return apiError(res, 500, "BSC payment configuration is invalid");
    }
    if (error?.provider === "NOWPAYMENTS") {
      const normalizedMessage = String(error.message || "").toLowerCase();
      if (normalizedMessage.includes("less than minimal")) {
        return apiError(
          res,
          400,
          "This course price is below the current minimum amount supported by USDT on BSC. Please use another payment method or increase the course price.",
        );
      }
      return apiError(
        res,
        error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502,
        `NOWPayments error: ${error.message || "Unable to create crypto payment"}`,
      );
    }
    if (error?.provider === "HESABPAY") {
      return apiError(
        res,
        error.status && error.status >= 400 && error.status < 500 ? 400 : 502,
        `HesabPay error: ${error.message || "Unable to create payment session"}`,
      );
    }
    return apiError(res, 500, "Internal server error");
  }
};

export const validateCheckoutCoupon = async (req, res) => {
  try {
    const pricingRegion = resolveStudentPricingRegion({
      profileCountry: req.user?.country,
      detectedRegion: req.body?.pricingRegion,
    });
    const checkoutPricing = await getCourseForCheckout(
      req.body.courseId,
      pricingRegion,
    );
    if (!checkoutPricing?.course) {
      return apiError(res, 404, "Course not found");
    }
    if (!isCoursePurchasable(checkoutPricing.course)) {
      return apiError(res, 400, "Course is not available for purchase");
    }
    const coupon = await resolveCouponForCheckout({
      code: req.body.code,
      userId: req.user._id,
      courseId: checkoutPricing.course._id,
      baseAmountUsdCents: checkoutPricing.baseAmountUsdCents,
    });
    return apiSuccess(res, { coupon: couponResponse(coupon) });
  } catch (error) {
    if (error?.code?.startsWith("COUPON_")) {
      return apiError(res, error.statusCode || 400, error.message, {
        code: error.code,
      });
    }
    console.error("validateCheckoutCoupon error:", error.message || error);
    return apiError(res, 500, "Unable to validate coupon");
  }
};

export const verifyDirectCryptoPayment = async (req, res) => {
  try {
    const { paymentAttemptId } = req.params;
    const { txHash } = req.body || {};
    const normalizedTxHash = normalizeDirectBscTransactionHash(txHash);

    let attempt = await PaymentAttempt.findById(paymentAttemptId).populate("orderId", "status userId courseId");
    if (!attempt || String(attempt.userId) !== String(req.user._id)) {
      return apiError(res, 404, "Payment not found");
    }
    const guardKey = getDirectCryptoGuardKey(attempt._id, req.user._id);

    if (attempt.method !== "USDT_BSC_DIRECT") {
      return apiError(res, 409, "This payment attempt does not support direct crypto verification");
    }

    if (attempt.status === "SUCCEEDED") {
      attempt = await reconcileSucceededAttempt(attempt);
      clearDirectCryptoGuardState(guardKey);
      return apiSuccess(res, {
        orderId: attempt.orderId?._id || attempt.orderId,
        paymentAttemptId: attempt._id,
        status: attempt.status,
        orderStatus: attempt.orderId?.status || "PAID",
        payment: toStudentPaymentAttemptDto(attempt),
      });
    }

    if (attempt.status === "PENDING" && isExpiredByDate(attempt.expiresAt)) {
      attempt.status = "EXPIRED";
      attempt.note = attempt.note || "Payment attempt expired before verification";
      await attempt.save();
    }

    if (!["PENDING", "EXPIRED"].includes(attempt.status)) {
      return apiError(res, 409, "This payment request cannot be verified in its current state", {
        code: "PAYMENT_REQUEST_NOT_VERIFIABLE",
        status: attempt.status,
      });
    }

    const runtimeGuardState = readDirectCryptoGuardState(guardKey);
    const runtimeBlockUntilMs = runtimeGuardState.blockUntil
      ? new Date(runtimeGuardState.blockUntil).getTime()
      : Number.NaN;
    if (Number.isFinite(runtimeBlockUntilMs) && runtimeBlockUntilMs > Date.now()) {
      const retryAt = new Date(runtimeBlockUntilMs);
      return apiError(res, 429, "Please wait a moment before verifying again", {
        code: "PAYMENT_VERIFICATION_COOLDOWN",
        retryAfterSeconds: getRetryAfterSeconds(retryAt),
        retryAt: retryAt.toISOString(),
        cooldownAfterAttempts: DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS,
      });
    }

    const verificationBlockedUntilMs = attempt.verificationBlockedUntil
      ? new Date(attempt.verificationBlockedUntil).getTime()
      : Number.NaN;
    if (
      Number.isFinite(verificationBlockedUntilMs) &&
      verificationBlockedUntilMs > Date.now()
    ) {
      const retryAt = new Date(verificationBlockedUntilMs);
      return apiError(res, 429, "Please wait a moment before verifying again", {
        code: "PAYMENT_VERIFICATION_COOLDOWN",
        retryAfterSeconds: getRetryAfterSeconds(retryAt),
        retryAt: retryAt.toISOString(),
        cooldownAfterAttempts: DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS,
      });
    }

    attempt.lastVerificationAttemptAt = new Date();
    await attempt.save();

    const existingTxUsage = await PaymentAttempt.findOne({
      _id: { $ne: attempt._id },
      transactionSignature: getDirectBscTransactionHashMatcher(normalizedTxHash),
    }).select("_id status");
    if (existingTxUsage) {
      return apiError(res, 409, "This transaction hash has already been used", {
        code: "TX_HASH_ALREADY_USED",
      });
    }

    try {
      const reservedAttempt = await PaymentAttempt.findOneAndUpdate(
        {
          _id: attempt._id,
          status: { $in: ["PENDING", "EXPIRED"] },
          $or: [
            { transactionSignature: { $exists: false } },
            { transactionSignature: null },
            { transactionSignature: "" },
            {
              transactionSignature:
                getDirectBscTransactionHashMatcher(normalizedTxHash),
            },
          ],
        },
        {
          $set: {
            transactionSignature: normalizedTxHash,
          },
        },
        { returnDocument: "after" },
      ).populate("orderId", "status userId courseId");

      if (!reservedAttempt) {
        const latestAttempt = await PaymentAttempt.findById(attempt._id).select("transactionSignature status");
        if (
          latestAttempt &&
          latestAttempt.transactionSignature &&
          normalizeDirectBscTransactionHash(latestAttempt.transactionSignature) !==
            normalizedTxHash
        ) {
          return apiError(res, 409, "Another transaction hash is already attached to this payment request", {
            code: "PAYMENT_REQUEST_ALREADY_LOCKED",
          });
        }
      } else {
        attempt = reservedAttempt;
      }
    } catch (reservationError) {
      if (reservationError?.code === 11000) {
        return apiError(res, 409, "This transaction hash has already been used", {
          code: "TX_HASH_ALREADY_USED",
        });
      }
      throw reservationError;
    }

    let verificationResult;
    try {
      verificationResult = await verifyDirectBscUsdtPayment({
        txHash: normalizedTxHash,
        expectedRecipientAddress: attempt.recipientAddress,
        expectedTokenAddress: attempt.tokenMint,
        expectedAmount: attempt.amount,
      });
    } catch (verificationError) {
      const code = String(verificationError.code || "").toUpperCase();
      const shouldPenalize = shouldPenalizeDirectCryptoVerificationFailure(code);
      const runtimeFailureState = shouldPenalize
        ? markDirectCryptoGuardFailure(guardKey)
        : { blockUntil: null };
      const nextVerificationAttempts = Number(attempt.verificationAttempts || 0) +
        (shouldPenalize ? 1 : 0);
      const verificationBlockedUntil = shouldPenalize
        ? runtimeFailureState.blockUntil ||
          (nextVerificationAttempts >= DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS
            ? new Date(Date.now() + DIRECT_CRYPTO_VERIFY_COOLDOWN_MS)
            : null)
        : attempt.verificationBlockedUntil || null;
      await PaymentAttempt.updateOne(
        {
          _id: attempt._id,
          status: { $in: ["PENDING", "EXPIRED"] },
        },
        {
          $set: {
            verificationAttempts: nextVerificationAttempts,
            lastVerificationAttemptAt: new Date(),
            verificationBlockedUntil,
          },
          $unset: { transactionSignature: 1 },
        },
      );
      console.warn("verifyDirectCryptoPayment rejected transaction", {
        paymentAttemptId: String(attempt?._id || ""),
        txHash: normalizedTxHash,
        code,
        reason: verificationError.message || String(verificationError || ""),
        expectedAmount: attempt?.amount || "",
        expectedRecipientAddress: attempt?.recipientAddress || "",
        expectedTokenAddress: attempt?.tokenMint || "",
        expiresAt: attempt?.expiresAt || null,
        verificationAttempts: nextVerificationAttempts,
        verificationBlockedUntil,
      });
      if (code === "TX_NOT_FOUND") return apiError(res, 404, "Transaction not found", { code });
      if (code === "TX_FAILED") return apiError(res, 409, "Blockchain transaction failed", { code });
      if (code === "WRONG_NETWORK") return apiError(res, 409, "Wrong network", { code, expectedNetwork: attempt?.network || "BNB_CHAIN" });
      if (code === "WRONG_TOKEN_CONTRACT") return apiError(res, 409, "Wrong token contract", { code, expectedTokenAddress: attempt?.tokenMint || null });
      if (code === "WRONG_RECIPIENT") return apiError(res, 409, "Wrong recipient", { code, expectedRecipientAddress: attempt?.recipientAddress || null });
      if (code === "INCORRECT_AMOUNT") return apiError(res, 409, "Incorrect amount", {
        code,
        expectedAmount: attempt?.amount || null,
        expectedCurrency: attempt?.currency || "USDT",
        actualReceivedAmount: verificationError?.actualAmount || null,
      });
      if (code === "INSUFFICIENT_CONFIRMATIONS") return apiError(res, 409, "Transaction is still confirming", { code });
      console.error("verifyDirectCryptoPayment verification error:", verificationError.message || verificationError);
      return apiError(res, 502, "Unable to verify blockchain payment right now", { code: code || "BLOCKCHAIN_VERIFY_UNAVAILABLE" });
    }

    const transactionTimeError = getDirectCryptoTransactionTimeError({
      blockTimestamp: verificationResult?.blockTimestamp,
      attemptCreatedAt: attempt?.createdAt,
      attemptExpiresAt: attempt?.expiresAt,
    });

    if (transactionTimeError === "TX_OLDER_THAN_PAYMENT_REQUEST") {
      await releaseDirectCryptoTransactionReservation({
        paymentAttemptId: attempt._id,
        transactionHash: normalizedTxHash,
      });
      return apiError(res, 409, "This transaction is older than this payment request", {
        code: "TX_OLDER_THAN_PAYMENT_REQUEST",
      });
    }

    if (transactionTimeError === "TX_MINED_AFTER_PAYMENT_EXPIRY") {
      await releaseDirectCryptoTransactionReservation({
        paymentAttemptId: attempt._id,
        transactionHash: normalizedTxHash,
      });
      return apiError(res, 409, "This transaction was mined after this payment request expired", {
        code: "TX_MINED_AFTER_PAYMENT_EXPIRY",
        expiresAt: attempt?.expiresAt || null,
      });
    }

    const result = await completePayment({
      paymentAttemptId: attempt._id,
      transactionSignature: normalizedTxHash,
      rawVerificationPayload: verificationResult,
      note: "Direct BSC USDT verification",
      paidAt: verificationResult.blockTimestamp || attempt.paidAt || new Date(),
      verifiedAt: new Date(),
      senderAccount: verificationResult.senderAddress,
    });
    clearDirectCryptoGuardState(guardKey);

    await PaymentAttempt.updateOne(
      { _id: attempt._id },
      {
        $set: {
          verificationAttempts: 0,
          lastVerificationAttemptAt: new Date(),
          verificationBlockedUntil: null,
        },
      },
    );

    const freshAttempt = await PaymentAttempt.findById(attempt._id).populate("orderId", "status paidAt");
    return apiSuccess(res, {
      orderId: freshAttempt?.orderId?._id || attempt.orderId,
      paymentAttemptId: attempt._id,
      status: freshAttempt?.status || attempt.status,
      orderStatus: freshAttempt?.orderId?.status || "PENDING",
      duplicate: result?.duplicate || false,
      payment: toStudentPaymentAttemptDto(freshAttempt || attempt),
    });
  } catch (error) {
    console.error("verifyDirectCryptoPayment error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

export const createHesabPaySession = async (req, res) => {
  req.body = { ...(req.body || {}), paymentMethod: "HESABPAY_HOSTED" };
  return createCheckout(req, res);
};

export const hesabPayWebhook = async (req, res) => {
  let deliveryClaim = null;
  const rejectClaimedDelivery = async (statusCode, message) => {
    if (deliveryClaim?.state === "CLAIMED") {
      await failHesabWebhookDelivery({
        receiptId: deliveryClaim.receipt?._id,
        claimToken: deliveryClaim.claimToken,
      });
      deliveryClaim = null;
    }
    return apiError(res, statusCode, message);
  };

  try {
    const webhookData = req.body;
    if (!webhookData || typeof webhookData !== "object") {
      return apiError(res, 400, "Invalid webhook payload");
    }
    const { signature, timestamp } = webhookData;
    if (!signature || !timestamp) {
      return apiError(res, 400, "Missing signature or timestamp");
    }
    if (
      String(signature).length > 4096 ||
      String(timestamp).length > 128
    ) {
      return apiError(res, 400, "Invalid signature or timestamp");
    }

    const verifyResult = await verifyWebhookSignature(signature, timestamp);
    if (verifyResult?.success !== true) {
      return apiError(res, 401, "Invalid webhook signature");
    }

    deliveryClaim = await claimHesabWebhookDelivery({
      signature,
      timestamp,
      payload: webhookData,
    });
    if (deliveryClaim.state === "PAYLOAD_MISMATCH") {
      return apiError(res, 409, "Webhook credential was reused with a different payload");
    }
    if (deliveryClaim.state === "PROCESSED") {
      return webhookAck(res, {
        duplicate: true,
        message: "Webhook was already processed",
      });
    }
    if (deliveryClaim.state === "IN_PROGRESS") {
      return apiError(res, 503, "Webhook is already being processed");
    }
    if (deliveryClaim.state !== "CLAIMED") {
      return apiError(res, 503, "Webhook could not be claimed for processing");
    }

    const merchantReference = String(webhookData?.user_id || "").trim();
    const itemReference = String(webhookData?.items?.[0]?.id || "").trim();
    if (!merchantReference && !itemReference) {
      return rejectClaimedDelivery(422, "Missing HesabPay merchant payment reference");
    }

    let attempt = null;
    if (merchantReference) {
      attempt = isValidObjectId(merchantReference)
        ? await PaymentAttempt.findOne({
            _id: merchantReference,
            method: "HESABPAY_HOSTED",
            provider: "HESABPAY",
          })
        : await PaymentAttempt.findOne({
            paymentReference: merchantReference,
            method: "HESABPAY_HOSTED",
            provider: "HESABPAY",
          });
    }
    if (!merchantReference && itemReference) {
      attempt = await PaymentAttempt.findOne({
        paymentReference: itemReference,
        method: "HESABPAY_HOSTED",
        provider: "HESABPAY",
      });
    }
    if (!attempt) {
      return rejectClaimedDelivery(404, "Payment record not found");
    }
    if (itemReference && itemReference !== String(attempt.paymentReference || "")) {
      return rejectClaimedDelivery(409, "HesabPay payment reference mismatch");
    }

    const ownedOrder = await Order.findOne({
      _id: attempt.orderId,
      userId: attempt.userId,
      courseId: attempt.courseId,
    });
    if (!ownedOrder) {
      return rejectClaimedDelivery(409, "Payment ownership validation failed");
    }

    const quoteAmount = Number(attempt.amount || 0);
    const webhookAmount = Number(webhookData.amount);
    if (
      !Number.isFinite(quoteAmount) ||
      quoteAmount <= 0 ||
      !Number.isFinite(webhookAmount) ||
      Math.abs(webhookAmount - quoteAmount) > 0.000001
    ) {
      return rejectClaimedDelivery(422, "Webhook amount mismatch");
    }

    const suppliedCurrencies = [
      webhookData.currency,
      ...(Array.isArray(webhookData.items)
        ? webhookData.items.map((item) => item?.currency)
        : []),
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .map((value) => String(value).trim().toUpperCase());
    const expectedCurrency = String(attempt.currency || "").trim().toUpperCase();
    if (
      suppliedCurrencies.some(
        (currency) => currency !== "AFN" || currency !== expectedCurrency,
      )
    ) {
      return rejectClaimedDelivery(422, "Webhook currency mismatch");
    }

    if (webhookData.success === true && Number(webhookData.status_code) === 10) {
      const providerPaymentId =
        webhookData.session_id ||
        webhookData.transaction_id ||
        attempt.providerPaymentId ||
        null;
      const transactionSignature =
        webhookData.transaction_id || attempt.transactionSignature || null;
      const result = await completePayment({
        paymentAttemptId: attempt._id,
        providerPaymentId,
        transactionSignature,
        rawWebhookPayload: webhookData,
        note: "HesabPay webhook verification",
        paidAt: new Date(),
        verifiedAt: new Date(),
        senderAccount: webhookData.sender_account || null,
      });

      await completeHesabWebhookDelivery({
        receiptId: deliveryClaim.receipt._id,
        claimToken: deliveryClaim.claimToken,
        paymentAttemptId: attempt._id,
      });
      deliveryClaim = null;

      return webhookAck(res, {
        message: result?.duplicate ? "Duplicate payment detected" : "Webhook processed successfully",
      });
    }

    if (!["SUCCEEDED", "DUPLICATE_PAYMENT"].includes(attempt.status)) {
      attempt.status = "FAILED";
      attempt.failedAt = new Date();
      attempt.verifiedAt = new Date();
      attempt.issuanceState = "DEFINITIVELY_FAILED";
      attempt.issuanceCompletedAt = attempt.verifiedAt;
      attempt.rawWebhookPayload = webhookData;
      attempt.providerPaymentId =
        webhookData.session_id ||
        webhookData.transaction_id ||
        attempt.providerPaymentId;
      attempt.transactionSignature =
        webhookData.transaction_id || attempt.transactionSignature;
      await attempt.save();
      await syncLegacyPaymentRecord({
        order: ownedOrder,
        attempt,
        course: null,
        rawWebhookPayload: webhookData,
        note: "HesabPay failure webhook",
        transactionId: webhookData.transaction_id || null,
        senderAccount: webhookData.sender_account || null,
      });
    }
    await completeHesabWebhookDelivery({
      receiptId: deliveryClaim.receipt._id,
      claimToken: deliveryClaim.claimToken,
      paymentAttemptId: attempt._id,
    });
    deliveryClaim = null;
    return webhookAck(res, { message: "Webhook processed (payment marked as failed)" });
  } catch (error) {
    if (deliveryClaim?.state === "CLAIMED") {
      try {
        await failHesabWebhookDelivery({
          receiptId: deliveryClaim.receipt?._id,
          claimToken: deliveryClaim.claimToken,
        });
      } catch (receiptError) {
        console.error("Unable to release HesabPay webhook claim:", receiptError.message || receiptError);
      }
    }
    console.error("hesabPayWebhook error:", error.message || error);
    return apiError(res, 500, "Webhook processing error");
  }
};

export const nowPaymentsWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-nowpayments-sig"];
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      return apiError(res, 400, "Invalid NOWPayments payload");
    }

    if (!verifyNowPaymentsIpnSignature({ signature, payload })) {
      return apiError(res, 401, "Invalid NOWPayments signature");
    }

    const providerPaymentId = payload?.payment_id ? String(payload.payment_id) : "";
    const paymentReference = String(payload?.order_id || "").trim();
    const attemptMatchers = [];
    if (providerPaymentId) attemptMatchers.push({ providerPaymentId });
    if (paymentReference) attemptMatchers.push({ paymentReference });
    const attempt = attemptMatchers.length
      ? await PaymentAttempt.findOne({
          method: "NOWPAYMENTS_CRYPTO",
          $or: attemptMatchers,
        })
      : null;

    if (!attempt) {
      // The provider can deliver an IPN immediately after creating a payment,
      // before the local attempt finishes saving. A retryable response lets the
      // provider deliver it again instead of permanently losing the completion.
      return apiError(res, 503, "Payment attempt is not ready for processing");
    }

    const paymentStatus = String(payload?.payment_status || "").trim().toLowerCase();
    const result = await applyNowPaymentsStatus({ attempt, payload, source: "ipn" });
    if (result?.ignored) {
      return webhookAck(res, { message: "Stale NOWPayments status ignored" });
    }
    if (result?.manualReview) {
      return webhookAck(res, { message: "Payment requires manual review" });
    }
    if (paymentStatus === "finished") {
      return webhookAck(res, {
        message: result?.duplicate ? "Duplicate payment detected" : "NOWPayments payment completed",
      });
    }
    return webhookAck(res, { message: "NOWPayments status recorded" });
  } catch (error) {
    console.error("nowPaymentsWebhook error:", error.message || error);
    return apiError(res, 500, "NOWPayments webhook processing error");
  }
};

export const getStudentPaymentStatus = async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    const id = req.params.paymentAttemptId || req.params.reference;
    let attempt;
    if (orderId) {
      attempt = await PaymentAttempt.findOne({
        orderId,
        userId: req.user._id,
        status: "SUCCEEDED",
      })
        .sort({ createdAt: -1 })
        .populate("orderId", "status paidAt");
      if (!attempt) {
        attempt = await PaymentAttempt.findOne({
          orderId,
          userId: req.user._id,
        })
          .sort({ createdAt: -1 })
          .populate("orderId", "status paidAt");
      }
    } else {
      attempt = isValidObjectId(id)
        ? await PaymentAttempt.findById(id).populate("orderId", "status paidAt")
        : await PaymentAttempt.findOne({ paymentReference: id, userId: req.user._id }).populate("orderId", "status paidAt");
    }

    if (!attempt || String(attempt.userId) !== String(req.user._id)) {
      return apiError(res, 404, "Payment not found");
    }

    if (
      attempt.method === "NOWPAYMENTS_CRYPTO" &&
      attempt.providerPaymentId &&
      !["SUCCEEDED", "DUPLICATE_PAYMENT"].includes(attempt.status)
    ) {
      try {
        const providerPayment = await getNowPaymentsPayment(attempt.providerPaymentId);
        await applyNowPaymentsStatus({
          attempt,
          payload: providerPayment,
          source: "status",
        });
        attempt = await PaymentAttempt.findById(attempt._id).populate("orderId", "status paidAt");
      } catch (syncError) {
        // Keep the local attempt recoverable. A later poll or IPN can reconcile
        // it when the provider is reachable again.
        console.warn("NOWPayments status reconciliation failed:", syncError.message || syncError);
      }
    }

    if (attempt.status === "PENDING" && attempt.method !== "NOWPAYMENTS_CRYPTO") {
      const expiredAttempt = await expireAttemptIfStale(
        attempt,
        "Payment attempt expired before completion",
      );
      if (!expiredAttempt) {
        attempt = await PaymentAttempt.findById(attempt._id).populate("orderId", "status paidAt");
      }
    }

    if (attempt.status === "SUCCEEDED") {
      attempt = await reconcileSucceededAttempt(attempt);
    }

    return apiSuccess(res, {
      orderId: attempt.orderId?._id || attempt.orderId,
      paymentAttemptId: attempt._id,
      status: attempt.status,
      orderStatus: attempt.orderId?.status || "PENDING",
      payment: toStudentPaymentAttemptDto(attempt),
    });
  } catch (error) {
    console.error("getStudentPaymentStatus error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

const approveExternalBankTransferPayment = async ({
  payment,
  reviewerId,
  reviewerNote = "",
}) => {
  const enrollment = await Enrollment.findById(payment.enrollmentId || payment.enrollment);
  if (!enrollment) {
    throw new Error("Related enrollment not found");
  }

  const course = await Course.findById(payment.courseId);
  if (!course) {
    throw new Error("Course not found for payment");
  }
  const teacherId = getCourseTeacherId(course);
  const teacher = teacherId ? await User.findById(teacherId).select("name").lean() : null;

  const hasPreviousPaidPayment = await Payment.exists({
    _id: { $ne: payment._id },
    enrollmentId: enrollment._id,
    paymentStatus: "paid",
  });
  const shouldSendEnrollmentEmail =
    enrollment.enrollmentStatus !== "active" || enrollment.accessStatus !== "allowed";
  const shouldIncrement = !hasPreviousPaidPayment;
  if (shouldIncrement && course.maxStudents && course.enrolledStudentsCount >= course.maxStudents) {
    throw new Error("Course is full, cannot verify this payment");
  }

  payment.paymentStatus = "paid";
  payment.status = "paid";
  payment.paidAt = new Date();
  payment.verifiedAt = new Date();
  payment.verifiedBy = reviewerId;
  payment.reviewedByTeacher = reviewerId;
  payment.reviewedByTeacherAt = new Date();
  payment.bankTransferReviewStatus = "approved_by_teacher";
  payment.note = reviewerNote || payment.note;
  await payment.save();
  await recordPaymentCouponRedemption(payment);

  const accessWindow = resolveCourseAccessWindow({
    course,
    paidAt: payment.paidAt,
    previousAccessExpiresAt: enrollment.accessExpiresAt,
  });

  enrollment.paymentId = payment._id;
  enrollment.enrollmentStatus = "active";
  enrollment.accessStatus = "allowed";
  enrollment.status = "active";
  enrollment.accessStartsAt = accessWindow.accessStartsAt;
  enrollment.accessExpiresAt = accessWindow.accessExpiresAt;
  enrollment.paymentPlan = accessWindow.paymentPlan;
  enrollment.lastRenewedAt = payment.paidAt;
  await enrollment.save();

  if (shouldIncrement) {
    await Course.findByIdAndUpdate(course._id, {
      $inc: { enrolledStudentsCount: 1 },
    });
    course.enrolledStudentsCount = Number(course.enrolledStudentsCount || 0) + 1;
  }

  if (shouldSendEnrollmentEmail) {
    await publishCourseEnrollmentEvents({
      courseId: course._id,
      enrollmentId: enrollment._id,
      studentId: enrollment.studentId,
    });
  }
  await ensureCourseAutoStarted(course);

  if (shouldSendEnrollmentEmail) {
    const student = await User.findById(enrollment.studentId).select("name email").lean();
    if (student?.email) {
      sendCourseEnrollmentCongratsEmail({
        to: student.email,
        name: student.name,
        courseTitle: course.title,
        teacherName: teacher?.name || "",
        paymentPlan: enrollment.paymentPlan || "",
        accessStartsAt: enrollment.accessStartsAt || null,
        accessExpiresAt: enrollment.accessExpiresAt || null,
        amount: payment.amount ?? "",
        currency: payment.currency || "",
        paymentMethod: payment.paymentMethod || "",
        paidAt: payment.paidAt || null,
      }).catch((error) => {
        console.warn(`Failed to send enrollment email: ${error.message}`);
      });
    }
  }

  notifyStudentBankTransferApproved({
    studentId: enrollment.studentId,
    courseTitle: course.title || "",
    teacherName: teacher?.name || "",
  }).catch((notificationError) => {
    console.warn(
      `Failed to send student bank-transfer approval push notification: ${notificationError.message}`,
    );
  });

  return payment;
};

const rejectExternalBankTransferPayment = async ({
  payment,
  reviewerId,
  reviewerNote = "",
}) => {
  payment.paymentStatus = "failed";
  payment.status = "failed";
  payment.failedAt = new Date();
  payment.reviewedByTeacher = reviewerId;
  payment.reviewedByTeacherAt = new Date();
  payment.bankTransferReviewStatus = "rejected_by_teacher";
  payment.note = reviewerNote || payment.note;
  await payment.save();

  const enrollment = await Enrollment.findById(payment.enrollmentId || payment.enrollment);
  if (enrollment && enrollment.enrollmentStatus === "pending") {
    enrollment.enrollmentStatus = "cancelled";
    enrollment.accessStatus = "blocked";
    enrollment.status = "cancelled";
    await enrollment.save();
  }

  return payment;
};

export const getCourseBankPaymentDetails = async (req, res) => {
  try {
    const courseId = String(req.params.courseId || "").trim();
    if (!isValidObjectId(courseId)) {
      return apiError(res, 400, "Invalid course ID");
    }

    const course = await Course.findById(courseId)
      .select("title price discountPrice teacherDiscountPercentage currency isFree pricingType prices paymentPlan teacher teacherId createdBy status isPublished classEndedAt classCancelledAt endDate")
      .lean();

    if (!course || !isCoursePurchasable(course)) {
      return apiError(res, 404, "Course not found");
    }

    const teacherId = String(course.teacher || course.teacherId || course.createdBy || "").trim();
    if (!isValidObjectId(teacherId)) {
      return apiError(res, 404, "Teacher payment information was not found");
    }

    const teacher = await User.findOne({
      _id: teacherId,
      role: "teacher",
      status: "active",
      "teacherApplication.status": "approved",
    })
      .select("name bankPaymentInfo")
      .lean();

    if (!teacher) {
      return apiError(res, 404, "Teacher payment information was not found");
    }

    const bankPaymentInfo = getNormalizedBankPaymentDisplay(teacher.bankPaymentInfo || {});
    const hasBankInfo = hasUsableBankPaymentInfo(bankPaymentInfo);
    if (!hasBankInfo) {
      return apiError(res, 404, "This teacher has not added bank payment details yet");
    }

    const latestBankTransferPayment = await Payment.findOne({
      studentId: req.user._id,
      courseId: course._id,
      paymentMethod: "bank_transfer",
    })
      .sort({ createdAt: -1 })
      .select("status paymentStatus bankTransferReviewStatus paymentProofSubmittedAt createdAt updatedAt")
      .lean();

    const submissionState = normalizeBankTransferSubmissionState(latestBankTransferPayment);
    const pricingRegion = resolveStudentPricingRegion({
      profileCountry: req.user?.country,
      detectedRegion: req.query?.pricingRegion,
    });
    let regionalPrice = null;
    let baseAmountUsdCents;
    if (String(course.pricingType || "single") === "regional") {
      ({ regionalPrice, baseAmountUsdCents } = await resolveCourseCheckoutPricing(
        course,
        pricingRegion,
      ));
    } else {
      const pricing = await getPlatformPricingSettings();
      const displayPricing = resolveCourseDisplayPricing(
        course,
        pricing?.globalCourseDiscountPercentage || 0,
      );
      baseAmountUsdCents = normalizeUsdToCents(displayPricing.finalPrice);
    }
    if (baseAmountUsdCents <= 0) {
      return apiError(res, 400, "Bank transfer is not available for free courses");
    }
    const couponSnapshot = await resolveCouponForCheckout({
      code: req.query?.couponCode,
      userId: req.user._id,
      courseId: course._id,
      baseAmountUsdCents,
    });
    if (couponSnapshot) {
      baseAmountUsdCents = couponSnapshot.finalBaseAmountUsdCents;
    }
    const quoteCurrency = String(bankPaymentInfo.country || "").toUpperCase() === "IR"
      ? "IRR"
      : "AFN";
    const quote =
      !couponSnapshot && regionalPrice?.currency === quoteCurrency
        ? {
            amount: regionalPrice.finalPrice,
            exchangeRate: null,
            exchangeRateSource: "regional_course_price",
          }
        : !couponSnapshot && regionalPrice?.currency === "TOMAN" && quoteCurrency === "IRR"
          ? {
              amount: Number(regionalPrice.finalPrice || 0) * 10,
              exchangeRate: null,
              exchangeRateSource: "regional_course_price",
            }
          : await quoteFromUsdCents(baseAmountUsdCents, quoteCurrency);
    const regionalDisplaySnapshot = await resolveRegionalDisplaySnapshot({
      resolvedPrice: couponSnapshot
        ? { currency: "USD", finalPrice: baseAmountUsdCents / 100 }
        : regionalPrice || {
            currency: "USD",
            finalPrice: baseAmountUsdCents / 100,
          },
      requestedRegion: pricingRegion,
      baseAmountUsdCents,
    });

    return apiSuccess(res, {
      course: {
        _id: course._id,
        title: course.title || "",
      },
      teacher: {
        _id: teacher._id,
        name: teacher.name || "",
      },
      bankPaymentInfo,
      paymentAmount: {
        amount: Number(quote.amount || 0),
        currency: quoteCurrency,
        baseAmountUsd: baseAmountUsdCents / 100,
        paymentPlan: course.paymentPlan || "monthly",
        pricingRegion,
      },
      regionalDisplayPrice: regionalDisplaySnapshot,
      submissionState,
      coupon: couponResponse(couponSnapshot),
    });
  } catch (error) {
    if (error?.code?.startsWith("COUPON_")) {
      return apiError(res, error.statusCode || 400, error.message, { code: error.code });
    }
    return apiError(res, 500, error.message || "Unable to load bank payment details");
  }
};

export const submitBankTransferPayment = async (req, res) => {
  let savedProofPath = "";
  try {
    const courseId = String(req.body.courseId || "").trim();
    const countryCode = String(req.body.countryCode || "").trim().toUpperCase();
    if (!req.file) {
      return apiError(res, 400, "Payment proof file is required");
    }

    const course = await Course.findById(courseId).select(
      "title slug price discountPrice teacherDiscountPercentage currency isFree pricingType prices paymentPlan status isPublished classEndedAt classCancelledAt startDate endDate teacher teacherId createdBy maxStudents enrolledStudentsCount",
    );
    if (!course || !isCoursePurchasable(course)) {
      return apiError(res, 404, "Course not found");
    }

    const pricingRegion = resolveStudentPricingRegion({
      profileCountry: req.user?.country,
      detectedRegion: countryCode,
    });
    let regionalPrice = null;
    let baseAmountUsdCents;
    if (String(course.pricingType || "single") === "regional") {
      ({ regionalPrice, baseAmountUsdCents } = await resolveCourseCheckoutPricing(
        course,
        pricingRegion,
      ));
    } else {
      const pricing = await getPlatformPricingSettings();
      const displayPricing = resolveCourseDisplayPricing(
        course,
        pricing?.globalCourseDiscountPercentage || 0,
      );
      baseAmountUsdCents = normalizeUsdToCents(displayPricing.finalPrice);
    }
    if (baseAmountUsdCents <= 0) {
      return apiError(res, 400, "Bank transfer is not available for free courses");
    }
    const couponSnapshot = await resolveCouponForCheckout({
      code: req.body?.couponCode,
      userId: req.user._id,
      courseId: course._id,
      baseAmountUsdCents,
    });
    if (couponSnapshot) {
      baseAmountUsdCents = couponSnapshot.finalBaseAmountUsdCents;
    }

    const teacherId = String(getCourseTeacherId(course) || "").trim();
    const teacher = await User.findOne({
      _id: teacherId,
      role: "teacher",
      status: "active",
      "teacherApplication.status": "approved",
    }).select("_id name bankPaymentInfo");

    if (!teacher) {
      return apiError(res, 404, "Teacher payment information was not found");
    }

    const hasBankInfo = hasUsableBankPaymentInfo(teacher.bankPaymentInfo || {});
    if (!hasBankInfo) {
      return apiError(res, 400, "Teacher has not added bank payment details yet");
    }

    const latestBankTransferPayment = await Payment.findOne({
      studentId: req.user._id,
      courseId: course._id,
      paymentMethod: "bank_transfer",
    })
      .sort({ createdAt: -1 })
      .select("_id status paymentStatus bankTransferReviewStatus paymentProofSubmittedAt createdAt updatedAt");

    const submissionState = normalizeBankTransferSubmissionState(latestBankTransferPayment);
    if (latestBankTransferPayment && !submissionState.canResubmit) {
      return apiError(res, 409, submissionState.message, {
        submissionState,
      });
    }

    const activeEnrollment = await Enrollment.findOne({
      studentId: req.user._id,
      courseId: course._id,
      enrollmentStatus: "active",
      accessStatus: "allowed",
    });
    if (activeEnrollment && !isEnrollmentExpired(activeEnrollment)) {
      return apiError(res, 409, "You are already enrolled in this course");
    }

    const quoteCurrency = countryCode === "IR" ? "IRR" : "AFN";
    const quote =
      !couponSnapshot && regionalPrice?.currency === quoteCurrency
        ? {
            amount: regionalPrice.finalPrice,
            exchangeRate: null,
            exchangeRateSource: "regional_course_price",
          }
        : !couponSnapshot && regionalPrice?.currency === "TOMAN" && quoteCurrency === "IRR"
          ? {
              amount: Number(regionalPrice.finalPrice || 0) * 10,
              exchangeRate: null,
              exchangeRateSource: "regional_course_price",
            }
          : await quoteFromUsdCents(baseAmountUsdCents, quoteCurrency);
    const regionalDisplaySnapshot = await resolveRegionalDisplaySnapshot({
      resolvedPrice: couponSnapshot
        ? { currency: "USD", finalPrice: baseAmountUsdCents / 100 }
        : regionalPrice || {
            currency: "USD",
            finalPrice: baseAmountUsdCents / 100,
          },
      requestedRegion: pricingRegion,
      baseAmountUsdCents,
    });
    const paymentReference = makePaymentReference();
    const proofPath = await savePaymentProofFromBuffer(req.user._id, req.file.buffer);
    savedProofPath = proofPath;

    const enrollment = await Enrollment.findOneAndUpdate(
      {
        studentId: req.user._id,
        courseId: course._id,
      },
      {
        $setOnInsert: {
          enrolledAt: new Date(),
        },
        $set: {
          enrollmentStatus: "pending",
          accessStatus: "blocked",
          status: "inactive",
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const payload = {
      enrollmentId: enrollment._id,
      baseAmountUsdCents,
      originalBaseAmountUsdCents:
        couponSnapshot?.originalBaseAmountUsdCents ?? baseAmountUsdCents,
      couponId: couponSnapshot?.couponId || null,
      couponCode: couponSnapshot?.couponCode || "",
      couponType: couponSnapshot?.couponType || null,
      couponValue: couponSnapshot?.couponValue ?? null,
      discountAmountUsdCents: couponSnapshot?.discountAmountUsdCents || 0,
      pricingRegion,
      sourcePriceAmount: regionalDisplaySnapshot.amount,
      sourcePriceCurrency: regionalDisplaySnapshot.currency,
      sourceExchangeRate: regionalDisplaySnapshot.exchangeRate,
      sourceExchangeRateSource: regionalDisplaySnapshot.exchangeRateSource,
      sourceRateRetrievedAt: regionalDisplaySnapshot.rateRetrievedAt,
      platformCommissionRate: await getTeacherDeductionPercentage(),
      amount: Number(quote.amount || 0),
      gatewayAmount: Number(quote.amount || 0),
      currency: quoteCurrency,
      gatewayCurrency: quoteCurrency,
      provider: "teacher_bank_transfer",
      paymentMethod: "bank_transfer",
      paymentStatus: "pending",
      status: "pending",
      paymentReference: paymentReference,
      exchangeRate: quote.exchangeRate,
      exchangeRateSource: quote.exchangeRateSource,
      customerEmail: req.user.email,
      senderAccount: String(req.body.senderAccount || "").trim(),
      paymentProof: proofPath,
      paymentProofOriginalName: String(req.file.originalname || "").trim(),
      paymentProofSubmittedAt: new Date(),
      bankTransferReviewStatus: "pending_teacher_review",
      reviewedByTeacher: null,
      reviewedByTeacherAt: null,
      verifiedBy: null,
      verifiedAt: null,
      failedAt: null,
      paidAt: null,
      note: String(req.body.note || "").trim(),
      isExternalCollection: true,
    };

    const payment = await Payment.create({
      studentId: req.user._id,
      courseId: course._id,
      ...payload,
    });
    savedProofPath = "";

    enrollment.paymentId = payment._id;
    await enrollment.save();

    notifyTeacherBankTransferProof({
      teacherId: teacher._id,
      teacherName: teacher.name || "",
      studentName: req.user?.name || req.user?.email || "",
      courseTitle: course.title || "",
      paymentReference: payment.paymentReference || "",
    }).catch((notificationError) => {
      console.warn(
        `Failed to send teacher bank-transfer proof push notification: ${notificationError.message}`,
      );
    });

    return apiSuccess(res, {
      message: "Bank transfer payment proof submitted successfully",
      payment,
    }, 201);
  } catch (error) {
    await removePaymentProofIfLocal(savedProofPath);
    if (error?.code?.startsWith("COUPON_")) {
      return apiError(res, error.statusCode || 400, error.message, { code: error.code });
    }
    console.error("submitBankTransferPayment error:", error.message || error);
    return apiError(res, 500, "Unable to submit bank transfer payment");
  }
};

export const getTeacherBankTransferPayments = async (req, res) => {
  try {
    const courseIds = await Course.find(teacherCourseFilter(req.user._id)).distinct("_id");
    const status = String(req.query.status || "").trim();
    const filter = {
      courseId: { $in: courseIds },
      paymentMethod: "bank_transfer",
    };
    if (status) {
      filter.bankTransferReviewStatus = status;
    }

    const payments = await Payment.find(filter)
      .populate("studentId", "name email")
      .populate("courseId", "title paymentPlan")
      .sort({ createdAt: -1 })
      .lean();

    return apiSuccess(res, { payments });
  } catch (error) {
    console.error("getTeacherBankTransferPayments error:", error.message || error);
    return apiError(res, 500, "Unable to load bank transfer payments");
  }
};

export const approveTeacherBankTransferPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.paymentMethod !== "bank_transfer") {
      return apiError(res, 404, "Bank transfer payment not found");
    }

    const course = await Course.findOne({
      _id: payment.courseId,
      ...teacherCourseFilter(req.user._id),
    }).select("_id");
    if (!course) {
      return apiError(res, 403, "You are not allowed to review this payment");
    }

    if (payment.bankTransferReviewStatus === "approved_by_teacher" || payment.paymentStatus === "paid") {
      await recordPaymentCouponRedemption(payment);
      return apiSuccess(res, { message: "Payment already approved", payment });
    }

    const approvedPayment = await approveExternalBankTransferPayment({
      payment,
      reviewerId: req.user._id,
      reviewerNote: String(req.body.note || "").trim(),
    });

    return apiSuccess(res, {
      message: "Bank transfer payment approved successfully",
      payment: approvedPayment,
    });
  } catch (error) {
    console.error("approveTeacherBankTransferPayment error:", error.message || error);
    return apiError(res, 500, error.message || "Unable to approve bank transfer payment");
  }
};

export const rejectTeacherBankTransferPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.paymentMethod !== "bank_transfer") {
      return apiError(res, 404, "Bank transfer payment not found");
    }

    const course = await Course.findOne({
      _id: payment.courseId,
      ...teacherCourseFilter(req.user._id),
    }).select("_id");
    if (!course) {
      return apiError(res, 403, "You are not allowed to review this payment");
    }

    if (payment.bankTransferReviewStatus === "rejected_by_teacher" || payment.paymentStatus === "failed") {
      return apiSuccess(res, { message: "Payment already rejected", payment });
    }

    const rejectedPayment = await rejectExternalBankTransferPayment({
      payment,
      reviewerId: req.user._id,
      reviewerNote: String(req.body.note || "").trim(),
    });

    return apiSuccess(res, {
      message: "Bank transfer payment rejected successfully",
      payment: rejectedPayment,
    });
  } catch (error) {
    console.error("rejectTeacherBankTransferPayment error:", error.message || error);
    return apiError(res, 500, error.message || "Unable to reject bank transfer payment");
  }
};

export const getStudentPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      studentId: req.user._id,
    })
      .populate("courseId", "title price currency")
      .populate("paymentAttemptId", "status expiresAt orderId paymentReference transactionSignature")
      .sort({ createdAt: -1 });

    const normalizedPayments = [];

    for (const paymentDoc of payments) {
      const payment = typeof paymentDoc?.toObject === "function"
        ? paymentDoc.toObject()
        : paymentDoc;
      const attemptRef = paymentDoc?.paymentAttemptId;
      let attempt = attemptRef && typeof attemptRef === "object" ? attemptRef : null;

      if (attempt?.status === "PENDING") {
        const refreshedAttempt = await expireAttemptIfStale(
          attempt,
          "Payment attempt expired before completion",
        );
        if (!refreshedAttempt && payment?.paymentAttemptId?._id) {
          attempt = await PaymentAttempt.findById(payment.paymentAttemptId._id)
            .select("status expiresAt orderId paymentReference transactionSignature");
        } else if (refreshedAttempt) {
          attempt = refreshedAttempt;
        }
      }

      const attemptStatus = String(attempt?.status || "").toUpperCase();
      const normalizedStatusMap = {
        SUCCEEDED: "paid",
        FAILED: "failed",
        EXPIRED: "expired",
        MANUAL_REVIEW: "pending",
        DUPLICATE_PAYMENT: "pending",
        PENDING: "pending",
      };

      if (attemptStatus) {
        const normalizedStatus = normalizedStatusMap[attemptStatus] || payment.status || payment.paymentStatus;
        payment.status = normalizedStatus;
        payment.paymentStatus = normalizedStatus === "paid" ? "paid" : normalizedStatus;
      }

      if (
        String(payment?.status || payment?.paymentStatus || "").toLowerCase() === "pending" &&
        isExpiredByDate(attempt?.expiresAt || payment?.expiresAt)
      ) {
        payment.status = "expired";
        payment.paymentStatus = "failed";
      }

      normalizedPayments.push(toStudentPaymentHistoryDto(payment, attempt));
    }
    return apiSuccess(res, { payments: normalizedPayments });
  } catch (error) {
    console.error("getStudentPaymentHistory error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

export const confirmStudentPaymentRedirect = async (req, res) => {
  try {
    const paymentAttemptId = req.params.paymentAttemptId || req.body?.paymentAttemptId || req.query?.paymentAttemptId;
    const reference = req.params.reference || req.body?.reference || req.query?.reference;
    const attempt = paymentAttemptId
      ? await PaymentAttempt.findOne({ _id: paymentAttemptId, userId: req.user._id })
      : await PaymentAttempt.findOne({ paymentReference: reference, userId: req.user._id });

    if (!attempt) return apiError(res, 404, "Payment not found");
    if (attempt.status === "SUCCEEDED") {
      const reconciledAttempt = await reconcileSucceededAttempt(attempt);
      return apiSuccess(res, {
        message: "Payment already confirmed",
        payment: toStudentPaymentAttemptDto(reconciledAttempt || attempt),
      });
    }

    if (attempt.provider !== "HESABPAY") {
      return apiError(res, 409, "Redirect confirmation is only supported for HesabPay");
    }

    if (String(process.env.NODE_ENV) === "production" && String(process.env.HESABPAY_ALLOW_REDIRECT_CONFIRM || "").toLowerCase() !== "true") {
      return apiError(res, 409, "Payment is pending webhook confirmation");
    }

    const payment = await Payment.findOne({ paymentAttemptId: attempt._id, studentId: req.user._id });
    if (payment?.status === "paid") {
      await completePayment({
        paymentAttemptId: attempt._id,
        providerPaymentId: attempt.providerPaymentId,
        transactionSignature: attempt.transactionSignature,
        rawVerificationPayload: req.body || null,
        note: "Confirmed from HesabPay success redirect",
        paidAt: payment.paidAt || new Date(),
        verifiedAt: new Date(),
      });
      const reconciledAttempt = await PaymentAttempt.findById(attempt._id)
        .populate("orderId", "status paidAt");
      return apiSuccess(res, {
        message: "Payment already confirmed",
        payment: toStudentPaymentAttemptDto(reconciledAttempt || attempt),
      });
    }

    return apiError(res, 409, "Payment is pending webhook confirmation");
  } catch (error) {
    console.error("confirmStudentPaymentRedirect error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

export const getTeacherEarnings = async (req, res) => {
  try {
    const monthKey = String(req.query.month || "").trim();
    const courseId = String(req.query.courseId || "").trim();
    const paymentPlan = String(req.query.paymentPlan || "").trim().toLowerCase();
    const payoutStatus = String(req.query.payoutStatus || "").trim().toLowerCase();
    return apiSuccess(
      res,
      await calculateTeacherIncomeLedger({
        teacherId: req.user._id,
        monthKey,
        courseId,
        paymentPlan,
        payoutStatus,
      }),
    );
  } catch (error) {
    console.error("getTeacherEarnings error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

export const getAdminTeacherIncomeLedger = async (req, res) => {
  try {
    const monthKey = String(req.query.month || "").trim();
    const teacherId = String(req.query.teacherId || "").trim();
    const courseId = String(req.query.courseId || "").trim();
    const paymentPlan = String(req.query.paymentPlan || "").trim().toLowerCase();
    const payoutStatus = String(req.query.payoutStatus || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const ledger = await calculateTeacherIncomeLedger({
      teacherId: teacherId || null,
      monthKey,
      courseId,
      paymentPlan,
      payoutStatus,
    });

    const filteredRows = search
      ? ledger.settlementRows.filter((row) =>
        [
          row.teacherName,
          row.teacherEmail,
          row.courseTitle,
          row.monthKey,
          row.periodLabel,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)))
      : ledger.settlementRows;
    const filteredSummary = summarizeTeacherIncomeRows({
      rows: filteredRows,
      defaultCommissionRate: ledger.currentCommissionRate ?? ledger.commissionRate,
    });

    const startIndex = (page - 1) * limit;
    const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);

    return apiSuccess(res, {
      ...ledger,
      ...filteredSummary,
      teacherShareRate:
        Math.round((100 - Number(filteredSummary.commissionRate || 0)) * 100) / 100,
      settlementRows: paginatedRows,
      meta: {
        page,
        limit,
        total: filteredRows.length,
        totalPages: Math.max(1, Math.ceil(filteredRows.length / limit)),
      },
    });
  } catch (error) {
    console.error("getAdminTeacherIncomeLedger error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};

export const updateTeacherIncomeSettlementStatus = async (req, res) => {
  try {
    const teacherId = String(req.body.teacherId || "").trim();
    const courseId = String(req.body.courseId || "").trim();
    const monthKey = String(req.body.monthKey || "").trim();
    const cycleStartDay = Number(req.body.cycleStartDay || 1) === 15 ? 15 : 1;
    const status = String(req.body.status || "").trim().toLowerCase();
    const note = String(req.body.note || "").trim();

    const settlement = await upsertTeacherIncomeSettlement({
      teacherId,
      courseId,
      monthKey,
      cycleStartDay,
      status,
      paidBy: req.user?._id || null,
      note,
    });

    return apiSuccess(res, {
      settlement,
      message: "Teacher income payout status updated successfully",
    });
  } catch (error) {
    console.error("updateTeacherIncomeSettlementStatus error:", error.message || error);
    return apiError(res, 500, "Internal server error");
  }
};
