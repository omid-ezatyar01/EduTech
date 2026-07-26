import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import User from "../models/User.js";
import { createPaymentSession, verifyWebhookSignature } from "../services/hesabpay.service.js";
import {
  createNowPaymentsPayment,
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
  getPricingRegionForCountry,
  normalizePricingRegion,
  resolveCourseCheckoutPricing,
} from "../utils/courseRegionalPricing.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS = 5;
const DIRECT_CRYPTO_VERIFY_COOLDOWN_MS = 60 * 1000;
const DIRECT_CRYPTO_MAX_FAILED_VERIFY_ATTEMPTS = 8;
const directCryptoVerifyGuard = new Map();

const apiError = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra });
const apiSuccess = (res, payload, code = 200) => res.status(code).json({ success: true, ...payload });
const webhookAck = (res, payload = {}) => res.status(200).json({ success: true, acknowledged: true, ...payload });

const resolveStudentClientUrl = () => {
  const explicit = process.env.STUDENT_CLIENT_URL || process.env.STUDENT_FRONTEND_URL;
  if (explicit) return String(explicit).trim().replace(/\/+$/, "");
  const clientUrl = process.env.CLIENT_URL ? String(process.env.CLIENT_URL).trim().replace(/\/+$/, "") : "";
  return clientUrl || "http://localhost:5173";
};

const getNextKabulNoonIso = () => {
  const offsetMinutes = 270;
  const shiftedNow = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();
  const hour = shiftedNow.getUTCHours();
  const minute = shiftedNow.getUTCMinutes();
  const second = shiftedNow.getUTCSeconds();
  const millisecond = shiftedNow.getUTCMilliseconds();
  const useTomorrow =
    hour > 12 ||
    (hour === 12 && (minute > 0 || second > 0 || millisecond > 0));
  const nextNoonMs =
    Date.UTC(year, month, day + (useTomorrow ? 1 : 0), 12, 0, 0, 0) - offsetMinutes * 60 * 1000;
  return new Date(nextNoonMs).toISOString();
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

const expireAttemptIfBasePriceChanged = async (attempt, baseAmountUsdCents, reasonPrefix) => {
  if (!attempt) return null;
  if (Number(attempt.baseAmountUsdCents || 0) === Number(baseAmountUsdCents || 0)) {
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

const findOrCreatePendingOrder = async ({
  userId,
  courseId,
  baseAmountUsdCents,
  pricingRegion = "international",
  sourcePriceAmount = null,
  sourcePriceCurrency = null,
  platformCommissionRate = null,
}, session = null) => {
  const existing = await Order.findOne({ userId, courseId, status: "PENDING" }).session(session);
  if (existing) {
    if (
      Number(existing.baseAmountUsdCents || 0) !== Number(baseAmountUsdCents || 0) ||
      existing.pricingRegion !== pricingRegion ||
      Number(existing.sourcePriceAmount ?? -1) !== Number(sourcePriceAmount ?? -1) ||
      String(existing.sourcePriceCurrency || "") !== String(sourcePriceCurrency || "") ||
      Number(existing.platformCommissionRate ?? -1) !== Number(platformCommissionRate ?? -1)
    ) {
      existing.baseAmountUsdCents = baseAmountUsdCents;
      existing.pricingRegion = pricingRegion;
      existing.sourcePriceAmount = sourcePriceAmount;
      existing.sourcePriceCurrency = sourcePriceCurrency;
      existing.platformCommissionRate = platformCommissionRate;
      await existing.save({ session });
    }
    return existing;
  }

  return Order.create([{
    userId,
    courseId,
    baseAmountUsdCents,
    pricingRegion,
    sourcePriceAmount,
    sourcePriceCurrency,
    platformCommissionRate,
    status: "PENDING",
  }], session ? { session } : undefined).then((rows) => rows[0]);
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
      pricingRegion: order.pricingRegion || "international",
      sourcePriceAmount: order.sourcePriceAmount ?? null,
      sourcePriceCurrency: order.sourcePriceCurrency || null,
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
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    const rates = await getUsdRatesForCurrencies(["AFN", "IRR", "USDT"]);

    return apiSuccess(res, {
      base: "USD",
      rates: {
        AFN: Number(rates?.AFN?.rate || 0),
        IRR: Number(rates?.IRR?.rate || 0),
        USDT: Number(rates?.USDT?.rate || 0),
      },
      source: rates?.AFN?.source || rates?.IRR?.source || rates?.USDT?.source || "cache",
      nextRefreshAt: getNextKabulNoonIso(),
    });
  } catch (error) {
    console.error("getUsdExchangeRates error:", error.message || error);
    return apiError(res, 500, "Unable to resolve exchange rates");
  }
};

export const createCheckout = async (req, res) => {
  try {
    const { courseId, paymentMethod } = req.body || {};
    const method = String(paymentMethod || "").trim().toUpperCase();
    const pricingRegion = normalizePricingRegion(
      req.body?.pricingRegion,
      getPricingRegionForCountry(req.user?.country),
    );

    if (!courseId || !isValidObjectId(courseId)) {
      return apiError(res, 400, "Invalid courseId");
    }
    if (!["HESABPAY_HOSTED", "USDT_BSC_DIRECT"].includes(method)) {
      return apiError(res, 400, "Unsupported payment method");
    }

    const { course, baseAmountUsdCents, regionalPrice } =
      await getCourseForCheckout(courseId, pricingRegion);
    if (!course) return apiError(res, 404, "Course not found");
    if (!isCoursePurchasable(course)) return apiError(res, 400, "Course is not available for purchase");
    if (!Number.isFinite(baseAmountUsdCents) || baseAmountUsdCents <= 0) {
      return apiError(res, 400, "Invalid course price");
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

    const platformCommissionRate = await getTeacherDeductionPercentage();
    const order = await findOrCreatePendingOrder(
      {
        userId: req.user._id,
        courseId: course._id,
        baseAmountUsdCents,
        pricingRegion,
        sourcePriceAmount: regionalPrice?.finalPrice ?? null,
        sourcePriceCurrency: regionalPrice?.currency || null,
        platformCommissionRate,
      },
    );

    if (method === "HESABPAY_HOSTED") {
      const quote =
        regionalPrice?.currency === "AFN"
          ? {
              amount: Number(regionalPrice.finalPrice || 0),
              exchangeRate: null,
              exchangeRateSource: "regional_course_price",
              rateRetrievedAt: new Date(),
            }
          : await quoteAfnFromUsdCents(baseAmountUsdCents);
      let paymentAttempt = await PaymentAttempt.findOne({
        orderId: order._id,
        method: "HESABPAY_HOSTED",
        status: "PENDING",
      }).sort({ createdAt: -1 });

      paymentAttempt = await expireAttemptIfBasePriceChanged(
        paymentAttempt,
        baseAmountUsdCents,
        "HesabPay attempt expired",
      );
      if (
        paymentAttempt &&
        regionalPrice?.currency === "AFN" &&
        Number(paymentAttempt.amount || 0) !== Number(quote.amount || 0)
      ) {
        paymentAttempt.status = "EXPIRED";
        paymentAttempt.expiresAt = new Date();
        paymentAttempt.note = "HesabPay attempt expired after the regional AFN price changed";
        await paymentAttempt.save();
        paymentAttempt = null;
      }
      paymentAttempt = await expireAttemptIfStale(
        paymentAttempt,
        "HesabPay attempt expired after checkout timeout",
      );

      if (paymentAttempt) {
        return apiSuccess(res, {
          orderId: order._id,
          paymentAttemptId: paymentAttempt._id,
          provider: "HESABPAY",
          basePrice: {
            amount: formatUsdCents(baseAmountUsdCents),
            currency: "USD",
          },
          regionalPrice,
          pricingRegion,
          charge: {
            amount: paymentAttempt.amount,
            currency: "AFN",
          },
          exchangeRate: paymentAttempt.exchangeRate || quote.exchangeRate,
          paymentUrl: paymentAttempt.providerUrl,
        });
      }

      const clientUrl = resolveStudentClientUrl();
      const redirectSuccessUrl = `${clientUrl}/payment/success?orderId=${order._id}`;
      const redirectFailureUrl = `${clientUrl}/payment/failure?orderId=${order._id}`;
      const attemptSeed = makePaymentReference();
      const { attempt, legacyPayment } = await createPaymentAttemptRecord({
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
      });

      let sessionData;
      try {
        sessionData = await createPaymentSession({
          email: req.user.email,
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
        attempt.status = "FAILED";
        attempt.failedAt = new Date();
        await attempt.save();
        legacyPayment.status = "failed";
        legacyPayment.paymentStatus = "failed";
        legacyPayment.failedAt = new Date();
        await legacyPayment.save();
        throw sessionError;
      }

      const paymentUrl = sessionData?.payment_url || sessionData?.paymentUrl || (sessionData?.session_id ? `https://checkout.hesabpay.com/pay/${sessionData.session_id}` : null);
      if (!paymentUrl) return apiError(res, 502, "HesabPay did not return a payment URL");

      attempt.providerPaymentId = sessionData.session_id || sessionData.payment_id || attemptSeed;
      attempt.providerUrl = paymentUrl;
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
        provider: "HESABPAY",
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

        existingAttempt = await expireAttemptIfBasePriceChanged(
          existingAttempt,
          baseAmountUsdCents,
          "Crypto attempt expired",
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
          });
        }

        const paymentReference = makePaymentReference();
        const directQuote = createUniqueUsdtBscAmount(baseAmountUsdCents);
        const chargeAmount = directQuote.totalAmount;
        const directDetails = getDirectBscPaymentDetails(chargeAmount, paymentReference);
        const { attempt } = await createPaymentAttemptRecord({
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
        });

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
      });
    }

  } catch (error) {
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
    return apiError(res, 500, "Internal server error");
  }
};

export const verifyDirectCryptoPayment = async (req, res) => {
  try {
    const { paymentAttemptId } = req.params;
    const { txHash } = req.body || {};
    const normalizedTxHash = String(txHash || "").trim();

    let attempt = await PaymentAttempt.findById(paymentAttemptId).populate("orderId", "status userId courseId");
    if (!attempt || String(attempt.userId) !== String(req.user._id)) {
      return apiError(res, 404, "Payment not found");
    }
    const guardKey = getDirectCryptoGuardKey(attempt._id, req.user._id);

    if (attempt.method !== "USDT_BSC_DIRECT") {
      return apiError(res, 409, "This payment attempt does not support direct crypto verification");
    }

    if (attempt.status === "PENDING") {
      const refreshedAttempt = await expireAttemptIfStale(
        attempt,
        "Direct BSC crypto attempt expired before verification",
      );
      if (!refreshedAttempt) {
        attempt = await PaymentAttempt.findById(paymentAttemptId).populate("orderId", "status userId courseId");
      } else {
        attempt = refreshedAttempt;
      }
    }

    if (attempt.status === "SUCCEEDED") {
      clearDirectCryptoGuardState(guardKey);
      return apiSuccess(res, {
        orderId: attempt.orderId?._id || attempt.orderId,
        paymentAttemptId: attempt._id,
        status: attempt.status,
        orderStatus: attempt.orderId?.status || "PAID",
        payment: attempt,
      });
    }

    if (attempt.status === "EXPIRED" || isExpiredByDate(attempt.expiresAt)) {
      if (attempt.status !== "EXPIRED") {
        attempt.status = "EXPIRED";
        attempt.note = attempt.note || "Payment attempt expired before verification";
        await attempt.save();
      }

      return apiError(res, 409, "This payment request has expired and can no longer be verified", {
        code: "PAYMENT_REQUEST_EXPIRED",
        expiresAt: attempt.expiresAt || null,
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

    if (Number(attempt.verificationAttempts || 0) >= DIRECT_CRYPTO_MAX_FAILED_VERIFY_ATTEMPTS) {
      return apiError(
        res,
        429,
        "Too many failed verification attempts for this payment request",
        {
          code: "PAYMENT_VERIFICATION_ATTEMPTS_EXCEEDED",
          maxAttempts: DIRECT_CRYPTO_MAX_FAILED_VERIFY_ATTEMPTS,
        },
      );
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
      transactionSignature: normalizedTxHash,
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
          status: "PENDING",
          $or: [
            { transactionSignature: { $exists: false } },
            { transactionSignature: null },
            { transactionSignature: "" },
            { transactionSignature: normalizedTxHash },
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
          String(latestAttempt.transactionSignature).trim() !== normalizedTxHash
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
      const runtimeFailureState = markDirectCryptoGuardFailure(guardKey);
      const nextVerificationAttempts = Number(attempt.verificationAttempts || 0) + 1;
      const verificationBlockedUntil = runtimeFailureState.blockUntil ||
        (nextVerificationAttempts >= DIRECT_CRYPTO_VERIFY_COOLDOWN_AFTER_FAILED_ATTEMPTS
          ? new Date(Date.now() + DIRECT_CRYPTO_VERIFY_COOLDOWN_MS)
          : null);
      await PaymentAttempt.updateOne(
        {
          _id: attempt._id,
          status: "PENDING",
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
      const code = String(verificationError.code || "").toUpperCase();
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

    const txMinedAtMs = verificationResult?.blockTimestamp
      ? new Date(verificationResult.blockTimestamp).getTime()
      : Number.NaN;
    const attemptCreatedAtMs = attempt?.createdAt ? new Date(attempt.createdAt).getTime() : Number.NaN;
    const attemptExpiresAtMs = attempt?.expiresAt ? new Date(attempt.expiresAt).getTime() : Number.NaN;

    if (Number.isFinite(txMinedAtMs) && Number.isFinite(attemptCreatedAtMs) && txMinedAtMs < attemptCreatedAtMs) {
      return apiError(res, 409, "This transaction is older than this payment request", {
        code: "TX_OLDER_THAN_PAYMENT_REQUEST",
      });
    }

    if (Number.isFinite(txMinedAtMs) && Number.isFinite(attemptExpiresAtMs) && txMinedAtMs > attemptExpiresAtMs) {
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
      paidAt: new Date(),
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
      payment: freshAttempt || attempt,
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
  try {
    const webhookData = req.body;
    if (!webhookData || typeof webhookData !== "object") return webhookAck(res, { message: "Invalid webhook payload" });
    const { signature, timestamp } = webhookData;
    if (!signature || !timestamp) return webhookAck(res, { message: "Missing signature or timestamp" });

    const verifyResult = await verifyWebhookSignature(signature, timestamp);
    const isVerified = verifyResult?.success === true && (verifyResult?.status_code === undefined || Number(verifyResult.status_code) === 10);
    if (!isVerified) return webhookAck(res, { message: "Invalid webhook signature" });

    const paymentReference = webhookData?.items?.[0]?.id;
    if (!paymentReference) return webhookAck(res, { message: "Missing payment reference in webhook items" });

    const attempt = await PaymentAttempt.findOne({ paymentReference, method: "HESABPAY_HOSTED" });
    if (!attempt) return webhookAck(res, { message: "Payment record not found" });

    attempt.rawWebhookPayload = webhookData;
    attempt.providerPaymentId = webhookData.session_id || webhookData.transaction_id || attempt.providerPaymentId;
    attempt.transactionSignature = webhookData.transaction_id || attempt.transactionSignature;
    attempt.providerUrl = attempt.providerUrl || webhookData.redirect_url || null;
    attempt.verifiedAt = new Date();
    await attempt.save();

    const quoteAmount = Number(attempt.amount || 0);
    const webhookAmount = Number(webhookData.amount);
    if (!Number.isFinite(webhookAmount) || Math.abs(webhookAmount - quoteAmount) > 0.000001) {
      return webhookAck(res, { message: "Webhook amount mismatch" });
    }

    if (webhookData.success === true && Number(webhookData.status_code) === 10) {
      const result = await completePayment({
        paymentAttemptId: attempt._id,
        providerPaymentId: attempt.providerPaymentId,
        transactionSignature: attempt.transactionSignature,
        rawWebhookPayload: webhookData,
        note: "HesabPay webhook verification",
        paidAt: new Date(),
        verifiedAt: new Date(),
        senderAccount: webhookData.sender_account || null,
      });

      return apiSuccess(res, {
        message: result?.duplicate ? "Duplicate payment detected" : "Webhook processed successfully",
      });
    }

    attempt.status = "FAILED";
    attempt.failedAt = new Date();
    await attempt.save();
    return apiSuccess(res, { message: "Webhook processed (payment marked as failed)" });
  } catch (error) {
    console.error("hesabPayWebhook error:", error.message || error);
    return webhookAck(res, { message: "Webhook processing error" });
  }
};

export const nowPaymentsWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-nowpayments-sig"];
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      return webhookAck(res, { message: "Invalid NOWPayments payload" });
    }

    if (!verifyNowPaymentsIpnSignature({ signature, payload })) {
      return webhookAck(res, { message: "Invalid NOWPayments signature" });
    }

    const providerPaymentId = payload?.payment_id ? String(payload.payment_id) : "";
    const paymentReference = String(payload?.order_id || "").trim();
    const attempt = providerPaymentId
      ? await PaymentAttempt.findOne({ providerPaymentId, method: "NOWPAYMENTS_CRYPTO" })
      : await PaymentAttempt.findOne({ paymentReference, method: "NOWPAYMENTS_CRYPTO" });

    if (!attempt) {
      return webhookAck(res, { message: "Payment attempt not found" });
    }

    attempt.rawWebhookPayload = payload;
    attempt.providerPaymentId = providerPaymentId || attempt.providerPaymentId;

    const payAmount = String(payload?.pay_amount || "").trim();
    const normalizedPayAmount = payAmount ? roundUpDecimalAmount(payAmount, 2) : "";
    if (
      normalizedPayAmount &&
      normalizedPayAmount !== String(attempt.amount || "").trim()
    ) {
      attempt.status = "MANUAL_REVIEW";
      attempt.note = "NOWPayments amount mismatch";
      attempt.verifiedAt = new Date();
      await attempt.save();
      return webhookAck(res, { message: "Amount mismatch requires manual review" });
    }

    const paymentStatus = String(payload?.payment_status || "").trim().toLowerCase();

    if (paymentStatus === "finished") {
      const result = await completePayment({
        paymentAttemptId: attempt._id,
        providerPaymentId: attempt.providerPaymentId,
        transactionSignature:
          String(payload?.payin_hash || payload?.txn_id || payload?.txid || "").trim() || null,
        rawWebhookPayload: payload,
        note: "NOWPayments IPN verification",
        paidAt: new Date(),
        verifiedAt: new Date(),
      });

      return webhookAck(res, {
        message: result?.duplicate ? "Duplicate payment detected" : "NOWPayments payment completed",
      });
    }

    if (paymentStatus === "partially_paid") {
      attempt.status = "MANUAL_REVIEW";
      attempt.note = "NOWPayments partial payment";
      attempt.verifiedAt = new Date();
      await attempt.save();
      return webhookAck(res, { message: "Partial payment sent to manual review" });
    }

    if (paymentStatus === "failed") {
      attempt.status = "FAILED";
      attempt.failedAt = new Date();
      await attempt.save();
      return webhookAck(res, { message: "Payment marked failed" });
    }

    if (paymentStatus === "expired") {
      attempt.status = "EXPIRED";
      await attempt.save();
      return webhookAck(res, { message: "Payment marked expired" });
    }

    await attempt.save();
    return webhookAck(res, { message: "NOWPayments status recorded" });
  } catch (error) {
    console.error("nowPaymentsWebhook error:", error.message || error);
    return webhookAck(res, { message: "NOWPayments webhook processing error" });
  }
};

export const getStudentPaymentStatus = async (req, res) => {
  try {
    const id = req.params.paymentAttemptId || req.params.reference;
    let attempt = isValidObjectId(id)
      ? await PaymentAttempt.findById(id).populate("orderId", "status paidAt")
      : await PaymentAttempt.findOne({ paymentReference: id, userId: req.user._id }).populate("orderId", "status paidAt");

    if (!attempt || String(attempt.userId) !== String(req.user._id)) {
      return apiError(res, 404, "Payment not found");
    }

    if (attempt.status === "PENDING") {
      const expiredAttempt = await expireAttemptIfStale(
        attempt,
        "Payment attempt expired before completion",
      );
      if (!expiredAttempt) {
        attempt = await PaymentAttempt.findById(attempt._id).populate("orderId", "status paidAt");
      }
    }

    return apiSuccess(res, {
      orderId: attempt.orderId?._id || attempt.orderId,
      paymentAttemptId: attempt._id,
      status: attempt.status,
      orderStatus: attempt.orderId?.status || "PENDING",
      payment: attempt,
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
      .select("title price discountPrice teacherDiscountPercentage currency isFree pricingType prices paymentPlan teacher teacherId createdBy status isPublished")
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
    const pricingRegion = normalizePricingRegion(
      req.query?.pricingRegion,
      getPricingRegionForCountry(req.user?.country),
    );
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
    const quoteCurrency = String(bankPaymentInfo.country || "").toUpperCase() === "IR"
      ? "IRR"
      : "AFN";
    const quote =
      regionalPrice?.currency === quoteCurrency
        ? {
            amount: regionalPrice.finalPrice,
            exchangeRate: null,
            exchangeRateSource: "regional_course_price",
          }
        : regionalPrice?.currency === "TOMAN" && quoteCurrency === "IRR"
          ? {
              amount: Number(regionalPrice.finalPrice || 0) * 10,
              exchangeRate: null,
              exchangeRateSource: "regional_course_price",
            }
          : await quoteFromUsdCents(baseAmountUsdCents, quoteCurrency);

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
      submissionState,
    });
  } catch (error) {
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

    const pricingRegion = normalizePricingRegion(
      countryCode,
      getPricingRegionForCountry(req.user?.country),
    );
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
      regionalPrice?.currency === quoteCurrency
        ? {
            amount: regionalPrice.finalPrice,
            exchangeRate: null,
            exchangeRateSource: "regional_course_price",
          }
        : regionalPrice?.currency === "TOMAN" && quoteCurrency === "IRR"
          ? {
              amount: Number(regionalPrice.finalPrice || 0) * 10,
              exchangeRate: null,
              exchangeRateSource: "regional_course_price",
            }
          : await quoteFromUsdCents(baseAmountUsdCents, quoteCurrency);
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
      pricingRegion,
      sourcePriceAmount: regionalPrice?.finalPrice ?? null,
      sourcePriceCurrency: regionalPrice?.currency || null,
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
      .populate("paymentAttemptId", "status expiresAt orderId transactionSignature providerPaymentId")
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
            .select("status expiresAt orderId transactionSignature providerPaymentId");
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
        DUPLICATE_PAYMENT: "paid",
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

      const visibleStatus = String(payment?.status || payment?.paymentStatus || "").toLowerCase();
      if (!["pending", "paid"].includes(visibleStatus)) {
        continue;
      }

      normalizedPayments.push(payment);
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
      return apiSuccess(res, { message: "Payment already confirmed", payment: attempt });
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
      return apiSuccess(res, { message: "Payment already confirmed", payment: attempt });
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
