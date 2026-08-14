import axios from "axios";

const DEFAULT_TIMEOUT = 10_000;

const getBaseUrl = () => {
  return (process.env.HESABPAY_BASE_URL || "https://api-sandbox.hesab.com").replace(
    /\/+$/,
    "",
  );
};

const getApiKey = () => process.env.HESABPAY_API_KEY;

const getHeaders = () => ({
  Authorization: `API-KEY ${getApiKey()}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const hesabpayClient = axios.create({
  timeout: DEFAULT_TIMEOUT,
});

const sanitizeAxiosError = (error, fallbackMessage) => {
  if (error?.provider === "HESABPAY") {
    return error;
  }
  if (error.response) {
    const responseStatus = Number(error.response.status);
    return {
      provider: "HESABPAY",
      message: error.response.data?.message || fallbackMessage,
      status: error.response.status,
      data: error.response.data,
      definitiveFailure: responseStatus >= 400 && responseStatus < 500,
    };
  }

  if (error.request) {
    return {
      provider: "HESABPAY",
      message: "No response received from HesabPay",
      status: 503,
      data: null,
      definitiveFailure: false,
    };
  }

  return {
    provider: "HESABPAY",
    message: error.message || fallbackMessage,
    status: 500,
    data: null,
    definitiveFailure: false,
  };
};

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const tryParseJsonString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const HESAB_CHECKOUT_DOMAINS = ["hesab.com", "hesabpay.com"];

export const isValidHesabCheckoutUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const isHesabHostname = HESAB_CHECKOUT_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      isHesabHostname
    );
  } catch {
    return false;
  }
};

const normalizeProviderIdentifier = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(normalized)
    ? normalized
    : null;
};

const pickFirstProviderIdentifier = (...values) => {
  for (const value of values) {
    const normalized = normalizeProviderIdentifier(value);
    if (normalized) return normalized;
  }
  return null;
};

const makeProviderResponseError = (
  message,
  data = null,
  definitiveFailure = false,
) => ({
  provider: "HESABPAY",
  status: 502,
  message,
  data,
  definitiveFailure,
});

export const createPaymentSession = async ({
  email,
  userId,
  items,
  currency = "USD",
  amount,
  redirectSuccessUrl,
  redirectFailureUrl,
}) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw {
      provider: "HESABPAY",
      status: 500,
      message: "Missing HESABPAY_API_KEY configuration",
      definitiveFailure: true,
    };
  }

  try {
    const normalizedCurrency = String(currency || "USD").trim().toUpperCase();
    const sessionItems = (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      currency: item?.currency || normalizedCurrency,
    }));

    const response = await hesabpayClient.post(
      `${getBaseUrl()}/api/v1/payment/create-session`,
      {
        email,
        ...(userId ? { user_id: String(userId) } : {}),
        currency: normalizedCurrency,
        ...(Number.isFinite(Number(amount)) && Number(amount) > 0
          ? { amount: Number(amount) }
          : {}),
        items: sessionItems,
        redirect_success_url: redirectSuccessUrl,
        redirect_failure_url: redirectFailureUrl,
      },
      { headers: getHeaders() },
    );

    const rawIncoming = response.data;
    const parsedFromString = tryParseJsonString(rawIncoming);
    const raw =
      parsedFromString && typeof parsedFromString === "object"
        ? parsedFromString
        : rawIncoming && typeof rawIncoming === "object"
          ? rawIncoming
          : {};
    const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
    const nestedPayment =
      payload.payment && typeof payload.payment === "object"
        ? payload.payment
        : raw.payment && typeof raw.payment === "object"
          ? raw.payment
          : {};

    const paymentUrl = pickFirstString(
      payload.payment_url,
      raw.payment_url,
      payload.checkout_url,
      raw.checkout_url,
      payload.url,
      raw.url,
      payload.link,
      raw.link,
      nestedPayment.payment_url,
      nestedPayment.checkout_url,
      nestedPayment.url,
      nestedPayment.link,
    );

    const sessionId = pickFirstProviderIdentifier(
      payload.session_id,
      raw.session_id,
      payload.sessionId,
      raw.sessionId,
      nestedPayment.session_id,
      nestedPayment.sessionId,
    );
    const paymentId = pickFirstProviderIdentifier(
      payload.payment_id,
      raw.payment_id,
      nestedPayment.payment_id,
    );

    const statusCode =
      payload.status_code ??
      raw.status_code ??
      payload.code ??
      raw.code ??
      null;
    const success = payload.success === true || raw.success === true;

    if (!success || Number(statusCode) !== 10) {
      const explicitRejection =
        payload.success === false ||
        raw.success === false ||
        (
          statusCode !== null &&
          statusCode !== undefined &&
          Number(statusCode) !== 10
        );
      throw makeProviderResponseError(
        payload.message || raw.message || "HesabPay rejected the payment session request",
        raw,
        explicitRejection,
      );
    }
    if (!isValidHesabCheckoutUrl(paymentUrl)) {
      throw makeProviderResponseError(
        "HesabPay did not return a valid HTTPS checkout URL",
        raw,
      );
    }

    return {
      ...payload,
      rawResponse: raw,
      session_id: sessionId,
      payment_id: paymentId,
      payment_url: paymentUrl.trim(),
      expires_at: payload.expires_at || raw.expires_at || nestedPayment.expires_at || null,
      success: true,
      status_code: statusCode,
      message: payload.message || raw.message || "",
    };
  } catch (error) {
    throw sanitizeAxiosError(error, "Failed to create HesabPay payment session");
  }
};

export const verifyWebhookSignature = async (signature, timestamp) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw {
      status: 500,
      message: "Missing HESABPAY_API_KEY configuration",
    };
  }

  try {
    const response = await hesabpayClient.post(
      `${getBaseUrl()}/api/v1/hesab/webhooks/verify-signature`,
      { signature, timestamp },
      { headers: getHeaders() },
    );

    return response.data;
  } catch (error) {
    throw sanitizeAxiosError(
      error,
      "Failed to verify HesabPay webhook signature",
    );
  }
};
