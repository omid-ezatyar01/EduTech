import Payment from "../models/Payment.js";

const mapStatus = (status = "") => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "SUCCEEDED") return "paid";
  // A duplicate attempt means money may have moved after the order was already
  // paid. Keep it out of revenue/payout queries until it is reviewed/refunded.
  if (normalized === "DUPLICATE_PAYMENT") return "pending";
  if (normalized === "MANUAL_REVIEW") return "pending";
  if (normalized === "EXPIRED") return "expired";
  if (normalized === "FAILED") return "failed";
  return "pending";
};

const mapPaymentStatus = (status = "") => {
  const mappedStatus = mapStatus(status);
  return mappedStatus === "expired" ? "failed" : mappedStatus;
};

const mapMethod = (method = "") => {
  const normalized = String(method || "").toUpperCase();
  if (normalized === "NOWPAYMENTS_CRYPTO") return "nowpayments_crypto";
  if (normalized === "USDT_BSC_DIRECT") return "usdt_bsc_direct";
  return "hesabpay";
};

const mapProvider = (provider = "") => String(provider || "").toLowerCase();

export const syncLegacyPaymentRecord = async ({ order, attempt, course, transactionId = null, senderAccount = null, note = "", rawWebhookPayload = null, rawCreateSessionResponse = null, rawVerificationPayload = null }, session = null) => {
  const payload = {
    studentId: order.userId,
    courseId: order.courseId,
    orderId: order._id,
    paymentAttemptId: attempt._id,
    enrollmentId: null,
    baseAmountUsdCents: attempt.baseAmountUsdCents,
    originalBaseAmountUsdCents:
      attempt.originalBaseAmountUsdCents ??
      order.originalBaseAmountUsdCents ??
      attempt.baseAmountUsdCents,
    couponId: attempt.couponId || order.couponId || null,
    couponCode: attempt.couponCode || order.couponCode || "",
    couponType: attempt.couponType || order.couponType || null,
    couponValue: attempt.couponValue ?? order.couponValue ?? null,
    discountAmountUsdCents:
      attempt.discountAmountUsdCents || order.discountAmountUsdCents || 0,
    pricingRegion: order.pricingRegion || "international",
    sourcePriceAmount: order.sourcePriceAmount ?? null,
    sourcePriceCurrency: order.sourcePriceCurrency || null,
    sourceExchangeRate: order.sourceExchangeRate ?? null,
    sourceExchangeRateSource: order.sourceExchangeRateSource || null,
    sourceRateRetrievedAt: order.sourceRateRetrievedAt || null,
    platformCommissionRate: order.platformCommissionRate ?? null,
    amount: Number(attempt.amount || 0),
    gatewayAmount: Number(attempt.amount || 0),
    currency: ["NOWPAYMENTS_CRYPTO", "USDT_BSC_DIRECT"].includes(String(attempt.method || "").toUpperCase())
      ? attempt.currency
      : "USD",
    gatewayCurrency: attempt.currency,
    provider: mapProvider(attempt.provider),
    paymentMethod: mapMethod(attempt.method),
    status: mapStatus(attempt.status),
    paymentStatus: mapPaymentStatus(attempt.status),
    paymentReference: attempt.paymentReference,
    hesabSessionId: attempt.providerPaymentId || null,
    hesabPaymentUrl: attempt.providerUrl || null,
    transactionId: transactionId || attempt.providerPaymentId || null,
    providerPaymentId: attempt.providerPaymentId || null,
    blockchainReference: attempt.blockchainReference || null,
    transactionSignature: attempt.transactionSignature || null,
    network: attempt.network || null,
    exchangeRate: attempt.exchangeRate || null,
    exchangeRateSource: attempt.exchangeRateSource || null,
    senderAccount: senderAccount || null,
    customerEmail: attempt.customerEmail || null,
    expiresAt: attempt.expiresAt || null,
    paidAt: attempt.paidAt || null,
    verifiedAt: attempt.verifiedAt || null,
    failedAt: attempt.failedAt || null,
    note: note || attempt.note || "",
    rawCreateSessionResponse: rawCreateSessionResponse || attempt.rawCreateSessionResponse || null,
    rawWebhookPayload: rawWebhookPayload || attempt.rawWebhookPayload || null,
    rawVerificationPayload: rawVerificationPayload || attempt.rawVerificationPayload || null,
  };

  const existing = attempt.legacyPaymentId
    ? await Payment.findById(attempt.legacyPaymentId).session(session)
    : await Payment.findOne({ paymentReference: attempt.paymentReference }).session(session);

  let paymentDoc;
  if (existing) {
    // Reconciliation must not erase the historical enrollment link before the
    // idempotent completion path decides whether that enrollment can change.
    payload.enrollmentId = existing.enrollmentId || payload.enrollmentId;
    payload.pricingRegion = existing.pricingRegion || payload.pricingRegion;
    payload.sourcePriceAmount =
      existing.sourcePriceAmount ?? payload.sourcePriceAmount;
    payload.sourcePriceCurrency =
      existing.sourcePriceCurrency || payload.sourcePriceCurrency;
    payload.sourceExchangeRate =
      existing.sourceExchangeRate ?? payload.sourceExchangeRate;
    payload.sourceExchangeRateSource =
      existing.sourceExchangeRateSource || payload.sourceExchangeRateSource;
    payload.sourceRateRetrievedAt =
      existing.sourceRateRetrievedAt || payload.sourceRateRetrievedAt;
    payload.platformCommissionRate =
      existing.platformCommissionRate ?? payload.platformCommissionRate;
    Object.assign(existing, payload);
    paymentDoc = await existing.save({ session });
  } else {
    paymentDoc = await Payment.create([{ ...payload }], session ? { session } : undefined).then((rows) => rows[0]);
  }

  attempt.legacyPaymentId = paymentDoc._id;
  await attempt.save({ session });
  return paymentDoc;
};
