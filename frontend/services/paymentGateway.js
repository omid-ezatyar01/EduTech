import { getApiBase, isConstrainedConnection } from "./http";

const REQUEST_TIMEOUT_MS = 12_000;
let paymentHistoryCache = null;
let paymentHistoryRequest = null;
let paymentHistoryRequestKey = "";
let paymentHistoryEpoch = 0;
const EVM_TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const cloneData = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const getStudentToken = () => localStorage.getItem("edutech_token");

export const invalidateStudentPaymentHistoryCache = () => {
  paymentHistoryEpoch += 1;
  paymentHistoryCache = null;
  paymentHistoryRequest = null;
  paymentHistoryRequestKey = "";
};

const makeHttpError = (fallback, response, data) => {
  const error = new Error(data?.message || fallback);
  error.status = response?.status;
  error.data = data;
  error.isUnauthorized =
    response?.status === 401 ||
    response?.status === 403 ||
    /not[_\s-]?authorized|unauthorized|not[_\s-]?authenticated/i.test(String(data?.message || ""));
  return error;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const normalizeEvmTransactionHash = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    throw new Error("Please enter the blockchain transaction hash.");
  }

  const embeddedHash = rawValue.match(/0x[a-fA-F0-9]{64}/)?.[0];
  const normalizedHash = embeddedHash || rawValue;

  if (EVM_TX_HASH_PATTERN.test(normalizedHash)) {
    return normalizedHash;
  }

  if (/^\d+$/.test(rawValue)) {
    throw new Error(
      "This looks like a Binance internal ID, not a blockchain TX hash. Open the withdrawal details or BscScan and copy the real hash that starts with 0x.",
    );
  }

  throw new Error(
    "Please enter a valid BSC transaction hash that starts with 0x. You can also paste a BscScan link and the hash will be extracted automatically.",
  );
};

export const createCheckout = async ({
  courseId,
  paymentMethod,
  pricingRegion = "international",
  couponCode = "",
}) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  let response;
  try {
    response = await fetchWithTimeout(`${getApiBase()}/payments/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        courseId,
        paymentMethod,
        pricingRegion,
        couponCode: String(couponCode || "").trim().toUpperCase(),
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Payment request timed out. Please try again.", { cause: error });
    }
    throw new Error("Failed to reach payment server", { cause: error });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to create payment session", response, data);
  }

  const paymentUrl =
    data.paymentUrl ||
    data.payment_url ||
    data?.payment?.url ||
    data?.payment?.paymentUrl;

  invalidateStudentPaymentHistoryCache();
  if (!paymentUrl && !["NOWPAYMENTS", "BSC_DIRECT"].includes(String(data?.provider || "").toUpperCase())) {
    throw new Error("Payment URL not received from server");
  }

  return { ...data, paymentUrl };
};

export const validateCheckoutCoupon = async ({
  courseId,
  code,
  pricingRegion = "international",
}) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");
  const response = await fetchWithTimeout(
    `${getApiBase()}/payments/coupons/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        courseId,
        code: String(code || "").trim().toUpperCase(),
        pricingRegion,
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to validate coupon", response, data);
  }
  return data.coupon;
};

export const createHesabPaySession = async (courseId) => {
  return createCheckout({ courseId, paymentMethod: "HESABPAY_HOSTED" });
};

export const getCourseBankPaymentDetails = async (
  courseId,
  pricingRegion = "international",
  couponCode = "",
) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const response = await fetchWithTimeout(
    `${getApiBase()}/payments/course-bank-details/${encodeURIComponent(courseId)}?pricingRegion=${encodeURIComponent(pricingRegion)}&couponCode=${encodeURIComponent(String(couponCode || "").trim().toUpperCase())}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to load bank payment details", response, data);
  }

  return data;
};

export const submitBankTransferPayment = async ({
  courseId,
  countryCode,
  paymentProof,
  senderAccount = "",
  note = "",
  couponCode = "",
}) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const formData = new FormData();
  formData.append("courseId", String(courseId || ""));
  formData.append("countryCode", String(countryCode || "").trim().toUpperCase());
  formData.append("senderAccount", String(senderAccount || ""));
  formData.append("note", String(note || ""));
  formData.append("couponCode", String(couponCode || "").trim().toUpperCase());
  if (paymentProof instanceof File) {
    formData.append("paymentProof", paymentProof);
  }

  const response = await fetchWithTimeout(`${getApiBase()}/payments/bank-transfer/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to submit bank transfer payment", response, data);
  }

  invalidateStudentPaymentHistoryCache();
  return data;
};

export const getUsdExchangeQuote = async ({ amountUsd, currencyTo = "AFN" } = {}) => {
  const url = new URL(`${getApiBase()}/exchange/quote`);
  if (Number.isFinite(Number(amountUsd)) && Number(amountUsd) >= 0) {
    url.searchParams.set("amount", String(Number(amountUsd)));
  }
  url.searchParams.set("to", String(currencyTo || "AFN").trim().toUpperCase());

  const response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to fetch exchange quote", response, data);
  }

  return data;
};

export const getUsdExchangeRates = async () => {
  const response = await fetchWithTimeout(`${getApiBase()}/exchange/rates`, {
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to fetch exchange rates", response, data);
  }

  return data;
};

export const getUsdToAfnQuote = async (amountUsd) => {
  return getUsdExchangeQuote({ amountUsd, currencyTo: "AFN" });
};

export const getStudentPaymentStatus = async (reference) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  let response;
  try {
    response = await fetchWithTimeout(`${getApiBase()}/student/payments/status/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Payment status request timed out", { cause: error });
    }
    throw new Error("Failed to reach payment server", { cause: error });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to fetch payment status", response, data);
  }
  if (["paid", "succeeded", "failed", "expired", "refunded"].includes(
    String(data?.payment?.status || "").toLowerCase(),
  )) {
    invalidateStudentPaymentHistoryCache();
  }
  return data.payment;
};

export const getPaymentAttemptStatus = async (paymentAttemptId) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const response = await fetchWithTimeout(`${getApiBase()}/payments/${encodeURIComponent(paymentAttemptId)}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to fetch payment status", response, data);
  }
  if (["succeeded", "failed", "expired", "refunded"].includes(
    String(data?.status || data?.payment?.status || "").toLowerCase(),
  )) {
    invalidateStudentPaymentHistoryCache();
  }
  return data;
};

export const verifyDirectCryptoPayment = async ({ paymentAttemptId, txHash }) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");
  const normalizedTxHash = normalizeEvmTransactionHash(txHash);

  const response = await fetchWithTimeout(
    `${getApiBase()}/payments/${encodeURIComponent(paymentAttemptId)}/verify-direct-crypto`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify({ txHash: normalizedTxHash }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to verify payment", response, data);
  }
  invalidateStudentPaymentHistoryCache();
  return data;
};

export const confirmStudentPaymentRedirect = async (paymentReturn = {}) => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const payload =
    paymentReturn && typeof paymentReturn === "object" ? paymentReturn : { reference: paymentReturn };
  const reference = String(
    payload.reference ||
      payload.paymentReference ||
      payload.paymentRef ||
      payload.ref ||
      "",
  ).trim();
  const endpoint = reference
    ? `${getApiBase()}/student/payments/confirm-redirect/${encodeURIComponent(reference)}`
    : `${getApiBase()}/student/payments/confirm-redirect`;

  let response;
  try {
    response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Payment confirmation request timed out", { cause: error });
    }
    throw new Error("Failed to reach payment server", { cause: error });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw makeHttpError("Unable to confirm payment", response, data);
  }
  invalidateStudentPaymentHistoryCache();
  return data;
};

export const getStudentPaymentHistory = async () => {
  const token = getStudentToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const cacheKey = `payments:${token}`;
  const ttlMs = isConstrainedConnection() ? 3 * 60 * 1000 : 45 * 1000;
  if (paymentHistoryCache?.key === cacheKey && paymentHistoryCache.expiresAt > Date.now()) {
    return cloneData(paymentHistoryCache.data);
  }
  if (paymentHistoryRequest && paymentHistoryRequestKey === cacheKey) {
    return cloneData(await paymentHistoryRequest);
  }

  const extractPayments = (data = {}) => {
    if (Array.isArray(data?.payments)) return data.payments;
    if (Array.isArray(data?.data?.payments)) return data.data.payments;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const doRequest = async (path) => {
    let response;
    try {
      response = await fetchWithTimeout(`${getApiBase()}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Payment history request timed out", { cause: error });
      }
      throw new Error("Failed to reach payment server", { cause: error });
    }
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const requestEpoch = paymentHistoryEpoch;
  paymentHistoryRequestKey = cacheKey;
  const request = (async () => {
    const primary = await doRequest("/student/payments");
    if (primary.response.ok) {
      return extractPayments(primary.data);
    }
    if (primary.response.status !== 404) {
      throw makeHttpError("Unable to fetch payment history", primary.response, primary.data);
    }
    const fallback = await doRequest("/student/payments/history");
    if (!fallback.response.ok || fallback.data?.success !== true) {
      throw makeHttpError("Unable to fetch payment history", fallback.response, fallback.data);
    }
    return extractPayments(fallback.data);
  })();
  paymentHistoryRequest = request;

  try {
    const data = await request;
    if (requestEpoch === paymentHistoryEpoch) {
      paymentHistoryCache = { key: cacheKey, data, expiresAt: Date.now() + ttlMs };
    }
    return cloneData(data);
  } finally {
    if (paymentHistoryRequest === request) {
      paymentHistoryRequest = null;
      paymentHistoryRequestKey = "";
    }
  }
};
