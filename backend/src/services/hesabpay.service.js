import axios from "axios";

const DEFAULT_TIMEOUT = 10_000;

const getBaseUrl = () => {
  return (process.env.HESABPAY_BASE_URL || "https://api.hesab.com").replace(
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
  if (error.response) {
    return {
      message: error.response.data?.message || fallbackMessage,
      status: error.response.status,
      data: error.response.data,
    };
  }

  if (error.request) {
    return {
      message: "No response received from HesabPay",
      status: 503,
      data: null,
    };
  }

  return {
    message: error.message || fallbackMessage,
    status: 500,
    data: null,
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

const looksLikeUrl = (value) => {
  return (
    typeof value === "string" &&
    /^https?:\/\/[^\s]+$/i.test(value.trim())
  );
};

const findUrlInText = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0].trim() : null;
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

const findStringByKeyMatch = (obj, keyRegex) => {
  if (!obj || typeof obj !== "object") return null;

  const stack = [obj];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "string" && keyRegex.test(key) && value.trim()) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return null;
};

const findFirstUrlInObject = (obj) => {
  if (!obj || typeof obj !== "object") return null;

  const stack = [obj];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const value of Object.values(current)) {
      if (looksLikeUrl(value)) return value.trim();
      if (typeof value === "string") {
        const maybeUrl = findUrlInText(value);
        if (maybeUrl) return maybeUrl;
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return null;
};

export const createPaymentSession = async ({
  email,
  items,
  currency = "USD",
  amount,
  redirectSuccessUrl,
  redirectFailureUrl,
}) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw {
      status: 500,
      message: "Missing HESABPAY_API_KEY configuration",
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

    const paymentUrlFromKnownKeys = pickFirstString(
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

    const paymentUrlByScan = findStringByKeyMatch(
      { payload, raw, nestedPayment },
      /(payment.*url|checkout.*url|redirect.*url|url|link)/i,
    );

    const paymentUrl = pickFirstString(
      paymentUrlFromKnownKeys,
      paymentUrlByScan,
      findFirstUrlInObject({ payload, raw, nestedPayment }),
      findUrlInText(JSON.stringify(raw)),
      findUrlInText(typeof rawIncoming === "string" ? rawIncoming : ""),
      looksLikeUrl(rawIncoming) ? rawIncoming.trim() : null,
    );

    const sessionIdFromKnownKeys = pickFirstString(
      payload.session_id,
      raw.session_id,
      payload.sessionId,
      raw.sessionId,
      nestedPayment.session_id,
      nestedPayment.sessionId,
    );
    const sessionIdByScan = findStringByKeyMatch(
      { payload, raw, nestedPayment },
      /(session.*id|session|checkout.*id|payment.*id|id)/i,
    );
    const sessionIdFromUrl =
      typeof paymentUrl === "string"
        ? paymentUrl.match(/\/pay\/([^/?#]+)/i)?.[1] || null
        : null;
    const sessionIdFromText = pickFirstString(
      findStringByKeyMatch(
        { payload, raw, nestedPayment },
        /(session.*id|session|checkout.*id|payment.*id|id|reference)/i,
      ),
      typeof rawIncoming === "string"
        ? rawIncoming.match(/\b(sess_[A-Za-z0-9_-]+)\b/i)?.[1] || null
        : null,
      JSON.stringify(raw).match(/\b(sess_[A-Za-z0-9_-]+)\b/i)?.[1] || null,
    );
    const sessionId = pickFirstString(
      sessionIdFromKnownKeys,
      sessionIdByScan,
      sessionIdFromText,
      sessionIdFromUrl,
    );

    const statusCode =
      payload.status_code ??
      raw.status_code ??
      payload.code ??
      raw.code ??
      null;
    const normalizedSuccess =
      typeof payload.success === "boolean"
        ? payload.success
        : typeof raw.success === "boolean"
          ? raw.success
          : statusCode !== null && statusCode !== undefined
            ? Number(statusCode) === 10
            : Boolean(paymentUrl);

    return {
      ...payload,
      rawResponse: raw,
      session_id: sessionId,
      payment_url: paymentUrl,
      expires_at: payload.expires_at || raw.expires_at || nestedPayment.expires_at || null,
      success: normalizedSuccess,
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
