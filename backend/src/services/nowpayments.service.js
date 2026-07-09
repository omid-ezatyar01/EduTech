import axios from "axios";
import crypto from "crypto";

const getNowPaymentsConfig = () => {
  const apiKey = String(process.env.NOWPAYMENTS_API_KEY || "").trim();
  const ipnSecret = String(process.env.NOWPAYMENTS_IPN_SECRET || "").trim();
  const baseUrl = String(process.env.NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io").trim().replace(/\/+$/, "");
  const ipnUrl = String(process.env.NOWPAYMENTS_IPN_URL || "").trim();
  const payCurrency = String(process.env.NOWPAYMENTS_PAY_CURRENCY || "usdtbsc").trim().toLowerCase();
  const timeoutMs = Number(process.env.NOWPAYMENTS_TIMEOUT_MS || 30000);

  if (!apiKey) throw new Error("NOWPayments API key is not configured");

  return {
    apiKey,
    ipnSecret,
    baseUrl,
    ipnUrl,
    payCurrency,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 5000 ? timeoutMs : 30000,
  };
};

const getClient = () => {
  const { apiKey, baseUrl, timeoutMs } = getNowPaymentsConfig();
  return axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryNowPaymentsRequest = (error) => {
  if (!error) return false;
  if (!error.response) return true;
  const status = Number(error.response.status || 0);
  return status >= 500 || status === 429;
};

const sortKeysRecursive = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeysRecursive(value[key]);
      return acc;
    }, {});
};

export const normalizeNowPaymentsCurrency = (payCurrency = "") => {
  const normalized = String(payCurrency || "").trim().toLowerCase();

  if (normalized === "trx") {
    return { currency: "TRX", network: "TRON" };
  }

  if (normalized.startsWith("usdt")) {
    if (normalized.includes("trc20") || normalized.includes("tron") || normalized.includes("trx")) {
      return { currency: "USDT", network: "TRON" };
    }
    if (normalized.includes("erc20") || normalized.includes("eth")) {
      return { currency: "USDT", network: "ETHEREUM" };
    }
    if (normalized.includes("bsc") || normalized.includes("bep20")) {
      return { currency: "USDT", network: "BNB_CHAIN" };
    }
    return { currency: "USDT", network: null };
  }

  return {
    currency: normalized.toUpperCase(),
    network: null,
  };
};

export const createNowPaymentsPayment = async ({
  priceAmount,
  payAmount = null,
  priceCurrency = "usd",
  orderId,
  orderDescription,
  ipnCallbackUrl = "",
}) => {
  const { payCurrency, ipnUrl } = getNowPaymentsConfig();
  const client = getClient();

  const payload = {
    price_amount: Number(priceAmount),
    price_currency: String(priceCurrency || "usd").trim().toLowerCase(),
    pay_currency: payCurrency,
    order_id: String(orderId),
    order_description: String(orderDescription || "").trim() || `Order ${orderId}`,
  };
  if (payAmount !== null && payAmount !== undefined && payAmount !== "") {
    payload.pay_amount = Number(payAmount);
  }

  if (ipnCallbackUrl || ipnUrl) payload.ipn_callback_url = ipnCallbackUrl || ipnUrl;

  let lastError = null;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      const response = await client.post("/v1/payment", payload);
      return response.data;
    } catch (error) {
      lastError = error;
      if (attemptNumber < 2 && shouldRetryNowPaymentsRequest(error)) {
        await sleep(500);
        continue;
      }
      break;
    }
  }

  const providerStatus = Number(lastError?.response?.status || 0) || 502;
  const providerData = lastError?.response?.data || null;
  const providerMessage =
    providerData?.message ||
    providerData?.error ||
    (lastError?.code === "ECONNABORTED" ? "NOWPayments request timed out" : "") ||
    (lastError?.code ? `NOWPayments request failed (${lastError.code})` : "") ||
    lastError?.message ||
    "NOWPayments request failed";

  const wrapped = new Error(providerMessage);
  wrapped.statusCode = providerStatus;
  wrapped.provider = "NOWPAYMENTS";
  wrapped.providerResponse = providerData;
  wrapped.providerCode = lastError?.code || null;
  throw wrapped;
};

export const verifyNowPaymentsIpnSignature = ({ signature, payload }) => {
  const { ipnSecret } = getNowPaymentsConfig();
  if (!ipnSecret) throw new Error("NOWPayments IPN secret is not configured");
  if (!signature) return false;

  const sortedPayload = sortKeysRecursive(payload);
  const payloadString = JSON.stringify(sortedPayload);
  const expectedSignature = crypto
    .createHmac("sha512", ipnSecret)
    .update(payloadString)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(signature).trim(), "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch {
    return false;
  }
};
