import Joi from "joi";

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  MONGODB_URI: Joi.string().trim().required(),
  JWT_SECRET: Joi.string().trim().required(),
  CLIENT_ORIGIN: Joi.string().trim().required(),
  TRUST_PROXY: Joi.alternatives().try(
    Joi.boolean().truthy("true").falsy("false"),
    Joi.number().integer().min(0),
    Joi.string().trim().valid("loopback", "linklocal", "uniquelocal"),
  ).default(1),
  CLIENT_URL: Joi.string().trim().allow("").default(""),
  STUDENT_CLIENT_URL: Joi.string().trim().allow("").default(""),
  STUDENT_FRONTEND_URL: Joi.string().trim().allow("").default(""),
  COURSE_PUBLIC_ORIGIN: Joi.string().uri().allow("").default(""),
  API_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(15 * 60 * 1000),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(300),
  API_AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(3000),
  JSON_BODY_LIMIT: Joi.string().trim().default("1mb"),
  URL_ENCODED_LIMIT: Joi.string().trim().default("1mb"),
  URL_ENCODED_PARAMETER_LIMIT: Joi.number().integer().min(1).max(10000).default(100),
  HESABPAY_API_KEY: Joi.string().trim().allow("").default(""),
  HESABPAY_BASE_URL: Joi.string().uri().default("https://api.hesab.com"),
  HESABPAY_ALLOW_REDIRECT_CONFIRM: Joi.boolean().truthy("true").falsy("false").default(false),
  HESABPAY_DEV_FALLBACK_REDIRECT: Joi.boolean().truthy("true").falsy("false").default(false),
  HESABPAY_USD_TO_AFN_RATE: Joi.number().positive().default(70),
  EXCHANGE_RATE_PROVIDER: Joi.string().trim().valid("currencyfreaks", "legacy").default("currencyfreaks"),
  CURRENCYFREAKS_API_KEY: Joi.string().trim().allow("").default(""),
  CURRENCYFREAKS_BASE_URL: Joi.string().uri().default("https://api.currencyfreaks.com/v2.0"),
  CURRENCYFREAKS_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  CURRENCYFREAKS_CACHE_TTL_MS: Joi.number().integer().min(1000).default(300000),
  IRAN_MARKET_RATE_PROVIDER: Joi.string()
    .trim()
    .valid("currencyapi", "navasan")
    .default("currencyapi"),
  IRAN_MARKET_CACHE_TTL_MS: Joi.number().integer().min(3600000).default(86400000),
  CURRENCYAPI_API_KEY: Joi.string().trim().allow("").default(""),
  CURRENCYAPI_BASE_URL: Joi.string().uri().default("https://api.currencyapi.com/v3"),
  NAVASAN_API_KEY: Joi.string().trim().allow("").default(""),
  NAVASAN_BASE_URL: Joi.string().uri().default("https://api.navasan.tech"),
  NAVASAN_USD_FIELD: Joi.string().trim().default("usd_sell.value"),
  NAVASAN_RATE_UNIT: Joi.string().trim().valid("rial", "toman").default("toman"),
  IRAN_MARKET_MIN_USD_TO_TOMAN_RATE: Joi.number().positive().default(50000),
  HESABPAY_EXCHANGE_RATE_API_URL: Joi.string()
    .uri()
    .default("https://open.er-api.com/v6/latest/USD"),
  HESABPAY_EXCHANGE_RATE_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  HESABPAY_EXCHANGE_RATE_CACHE_TTL_MS: Joi.number().integer().min(1000).default(300000),
  HESABPAY_EXCHANGE_RATE_EMERGENCY_FALLBACK_RATE: Joi.number().positive().default(70),
  NOWPAYMENTS_API_KEY: Joi.string().trim().allow("").default(""),
  NOWPAYMENTS_IPN_SECRET: Joi.string().trim().allow("").default(""),
  NOWPAYMENTS_BASE_URL: Joi.string().uri().default("https://api.nowpayments.io"),
  NOWPAYMENTS_IPN_URL: Joi.string().uri().allow("").default(""),
  NOWPAYMENTS_PAY_CURRENCY: Joi.string().trim().lowercase().default("usdtbsc"),
  NOWPAYMENTS_TIMEOUT_MS: Joi.number().integer().min(5000).default(30000),
  BSC_RPC_URL: Joi.string().uri().allow("").default(""),
  BSCSCAN_API_KEY: Joi.string().trim().allow("").default(""),
  BSCSCAN_API_BASE_URL: Joi.string().uri().default("https://api.etherscan.io/v2/api"),
  BSCSCAN_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  BSC_RECIPIENT_ADDRESS: Joi.string().trim().allow("").default(""),
  BSC_USDT_CONTRACT_ADDRESS: Joi.string().trim().allow("").default(""),
  BSC_PAYMENT_EXPIRY_MINUTES: Joi.number().integer().min(1).default(60),
  BSC_CONFIRMATIONS_REQUIRED: Joi.number().integer().min(1).default(1),
  BSC_CHAIN_ID: Joi.number().integer().min(1).default(56),
  BSC_EXPLORER_BASE_URL: Joi.string().uri().default("https://bscscan.com"),
  APP_NAME: Joi.string().trim().default("EduTech"),
  APP_TIMEZONE: Joi.string().trim().default("Asia/Kabul"),
  MEET_LINK_VISIBLE_BEFORE_MINUTES: Joi.number().integer().min(0).default(0),
  MEET_LINK_DISABLE_AFTER_START_MINUTES: Joi.number().integer().min(0).default(10),
  SMTP_HOST: Joi.string().trim().allow("").default(""),
  SMTP_PORT: Joi.number().integer().min(1).max(65535).default(465),
  SMTP_SECURE: Joi.boolean().truthy("true").falsy("false").default(true),
  SMTP_USER: Joi.string().trim().allow("").default(""),
  SMTP_PASS: Joi.string().allow("").default(""),
  SMTP_FROM_EMAIL: Joi.string().trim().allow("").default(""),
  RESEND_API_KEY: Joi.string().trim().allow("").default(""),
  RESEND_FROM_EMAIL: Joi.string().trim().allow("").default(""),
  RESEND_WEBHOOK_SECRET: Joi.string().trim().allow("").default(""),
  RESEND_WEBHOOK_SIGNING_SECRET: Joi.string().trim().allow("").default(""),
  GOOGLE_CLIENT_ID: Joi.string().trim().allow("").default(""),
  GOOGLE_CLIENT_SECRET: Joi.string().trim().allow("").default(""),
  GOOGLE_REDIRECT_URI: Joi.string().trim().allow("").default(""),
  GOOGLE_TEACHER_REDIRECT_URI: Joi.string().trim().allow("").default(""),
  GOOGLE_ADMIN_REDIRECT_URI: Joi.string().trim().allow("").default(""),
  GOOGLE_STUDENT_REDIRECT_URI: Joi.string().trim().allow("").default(""),
  GOOGLE_OAUTH_RESULT_REDIRECTS: Joi.string().trim().allow("").default(""),
  GOOGLE_OAUTH_RESULT_REDIRECT: Joi.string().trim().allow("").default(""),
  GOOGLE_OAUTH_RESULT_REDIRECT_BASE: Joi.string().trim().allow("").default(""),
  GOOGLE_TOKEN_ENCRYPTION_KEY: Joi.string().trim().allow("").default(""),
  WEB_PUSH_VAPID_PUBLIC_KEY: Joi.string().trim().allow("").default(""),
  WEB_PUSH_VAPID_PRIVATE_KEY: Joi.string().trim().allow("").default(""),
  WEB_PUSH_CONTACT: Joi.string().trim().allow("").default(""),
  BACKEND_PUBLIC_URL: Joi.string().trim().allow("").default(""),
  TELEGRAM_BOT_TOKEN: Joi.string().trim().allow("").default(""),
  TELEGRAM_PUBLIC_CHANNEL_ID: Joi.string().trim().allow("").default(""),
  TELEGRAM_PUBLIC_CHANNEL_USERNAME: Joi.string().trim().allow("").default(""),
  TELEGRAM_SUPPORT_CHAT_ID: Joi.string().trim().allow("").default(""),
  AI_PROVIDER: Joi.string().trim().valid("ollama").default("ollama"),
  OLLAMA_BASE_URL: Joi.string().trim().uri().allow("").default("http://127.0.0.1:11434"),
  OLLAMA_CHAT_MODEL: Joi.string().trim().allow("").default("gemma3:4b"),
  FRONTEND_URL: Joi.string().trim().allow("").default(""),
  META_GRAPH_VERSION: Joi.string().trim().allow("").default("v25.0"),
}).unknown(true);

export const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    throw new Error(
      `Environment validation failed: ${error.details.map((item) => item.message).join("; ")}`,
    );
  }

  const extraErrors = [];
  const isProduction = value.NODE_ENV === "production";
  const normalizedOrigins = String(value.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && String(value.JWT_SECRET || "").length < 32) {
    extraErrors.push("JWT_SECRET must be at least 32 characters in production");
  }

  if (!normalizedOrigins.length) {
    extraErrors.push("CLIENT_ORIGIN must include at least one allowed origin");
  }

  if (normalizedOrigins.some((origin) => origin === "*")) {
    extraErrors.push("CLIENT_ORIGIN cannot contain '*'");
  }

  if (isProduction) {
    if (normalizedOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
      extraErrors.push("CLIENT_ORIGIN cannot include localhost/127.0.0.1 in production");
    }

    if (normalizedOrigins.some((origin) => !/^https:\/\//i.test(origin))) {
      extraErrors.push("CLIENT_ORIGIN must use https:// origins in production");
    }

    if (!String(value.COURSE_PUBLIC_ORIGIN || "").trim()) {
      extraErrors.push("COURSE_PUBLIC_ORIGIN is required in production");
    } else if (!/^https:\/\//i.test(String(value.COURSE_PUBLIC_ORIGIN || "").trim())) {
      extraErrors.push("COURSE_PUBLIC_ORIGIN must use https:// in production");
    }

    if (
      value.IRAN_MARKET_RATE_PROVIDER === "currencyapi" &&
      !String(value.CURRENCYAPI_API_KEY || "").trim()
    ) {
      extraErrors.push(
        "CURRENCYAPI_API_KEY is required in production for Iran market pricing",
      );
    }

    if (
      value.IRAN_MARKET_RATE_PROVIDER === "navasan" &&
      !String(value.NAVASAN_API_KEY || "").trim()
    ) {
      extraErrors.push(
        "NAVASAN_API_KEY is required in production for Iran free-market pricing",
      );
    }
  }

  const hasAnySmtpConfig = [
    value.SMTP_HOST,
    value.SMTP_USER,
    value.SMTP_PASS,
    value.SMTP_FROM_EMAIL,
  ].some((entry) => String(entry || "").trim());

  if (hasAnySmtpConfig) {
    if (!String(value.SMTP_HOST || "").trim()) {
      extraErrors.push("SMTP_HOST is required when SMTP email is enabled");
    }
    if (!String(value.SMTP_USER || "").trim()) {
      extraErrors.push("SMTP_USER is required when SMTP email is enabled");
    }
    if (!String(value.SMTP_PASS || "").trim()) {
      extraErrors.push("SMTP_PASS is required when SMTP email is enabled");
    }
    if (!String(value.SMTP_FROM_EMAIL || "").trim()) {
      extraErrors.push("SMTP_FROM_EMAIL is required when SMTP email is enabled");
    }
  }

  if (String(value.NOWPAYMENTS_API_KEY || "").trim()) {
    if (!String(value.NOWPAYMENTS_IPN_SECRET || "").trim()) {
      extraErrors.push("NOWPAYMENTS_IPN_SECRET is required when NOWPAYMENTS_API_KEY is set");
    }
    if (!String(value.NOWPAYMENTS_IPN_URL || "").trim()) {
      extraErrors.push("NOWPAYMENTS_IPN_URL is required when NOWPAYMENTS_API_KEY is set");
    }
  }

  const hasAnyBscConfig = [
    value.BSC_RPC_URL,
    value.BSC_RECIPIENT_ADDRESS,
    value.BSC_USDT_CONTRACT_ADDRESS,
  ].some((entry) => String(entry || "").trim());

  if (hasAnyBscConfig) {
    if (!String(value.BSC_RPC_URL || "").trim()) {
      extraErrors.push("BSC_RPC_URL is required when BSC payments are enabled");
    }
    if (!String(value.BSC_RECIPIENT_ADDRESS || "").trim()) {
      extraErrors.push("BSC_RECIPIENT_ADDRESS is required when BSC payments are enabled");
    }
    if (!String(value.BSC_USDT_CONTRACT_ADDRESS || "").trim()) {
      extraErrors.push("BSC_USDT_CONTRACT_ADDRESS is required when BSC payments are enabled");
    }
  }

  const hasAnyWebPushConfig = [
    value.WEB_PUSH_VAPID_PUBLIC_KEY,
    value.WEB_PUSH_VAPID_PRIVATE_KEY,
    value.WEB_PUSH_CONTACT,
  ].some((entry) => String(entry || "").trim());

  if (hasAnyWebPushConfig) {
    if (!String(value.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim()) {
      extraErrors.push("WEB_PUSH_VAPID_PUBLIC_KEY is required when web push is enabled");
    }
    if (!String(value.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim()) {
      extraErrors.push("WEB_PUSH_VAPID_PRIVATE_KEY is required when web push is enabled");
    }
    if (!String(value.WEB_PUSH_CONTACT || "").trim()) {
      extraErrors.push("WEB_PUSH_CONTACT is required when web push is enabled");
    }
  }

  if (extraErrors.length) {
    throw new Error(`Environment validation failed: ${extraErrors.join("; ")}`);
  }

  Object.assign(process.env, value);
  return value;
};
