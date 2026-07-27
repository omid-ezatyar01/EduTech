import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { useLocation, useNavigate } from "react-router";
import { getLocalizedRequestErrorMessage } from "../../services/http.js";
import {
  getPaymentAttemptStatus,
  normalizeEvmTransactionHash,
  verifyDirectCryptoPayment,
} from "../../services/paymentGateway.js";

const glassCardClass =
  "rounded-[20px] border border-white/70 bg-white/80 shadow-[0_14px_34px_rgba(15,23,42,0.06)] backdrop-blur-xl";

const readStoredLanguage = () => {
  const saved = localStorage.getItem("edutech-language");
  return saved === "en" ? "en" : "fa";
};

const readStoredDarkMode = () => localStorage.getItem("edutech-payment-dark") === "true";
const BINANCE_BEP20_USDT_FEE_EXAMPLE = "0.01";

const trimTrailingZeros = (value) =>
  String(value || "0")
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .trim();

const getTxHashValidationMessage = (value, language = "fa") => {
  const rawValue = String(value || "");
  if (!rawValue.trim()) return "";

  try {
    normalizeEvmTransactionHash(rawValue);
    return "";
  } catch (error) {
    const message = String(error?.message || "").trim();
    if (!message) {
      return language === "fa"
        ? "هش تراکنش معتبر نیست. لطفاً TXID واقعی را دوباره بررسی کنید."
        : "The transaction hash is invalid. Please check the real TXID again.";
    }

    if (language === "fa") {
      if (message.includes("Binance internal ID")) {
        return "این مقدار شبیه شناسه داخلی Binance است، نه TXID واقعی بلاکچین. از جزئیات برداشت یا BscScan هش واقعی که با 0x شروع می‌شود را کپی کنید.";
      }
      if (message.includes("valid BSC transaction hash")) {
        return "هش واردشده کامل یا معتبر نیست. TXID شبکه BSC باید با 0x شروع شود و دقیقاً 64 کاراکتر هگز بعد از آن داشته باشد.";
      }
    }

    return message;
  }
};

const getDirectCryptoVerifyErrorMessage = (error, language = "fa") => {
  const isFa = language === "fa";
  const code = String(error?.data?.code || "").trim().toUpperCase();
  const expectedAmount = String(error?.data?.expectedAmount || "").trim();
  const expectedCurrency = String(error?.data?.expectedCurrency || "USDT").trim();
  const actualReceivedAmount = String(error?.data?.actualReceivedAmount || "").trim();
  const expectedRecipientAddress = String(error?.data?.expectedRecipientAddress || "").trim();
  const expectedTokenAddress = String(error?.data?.expectedTokenAddress || "").trim();
  const expiresAt = error?.data?.expiresAt ? new Date(error.data.expiresAt) : null;
  const expiresLabel = expiresAt && !Number.isNaN(expiresAt.getTime())
    ? expiresAt.toLocaleString(isFa ? "fa-AF" : "en-US")
    : "";

  if (code === "TX_NOT_FOUND") {
    return isFa
      ? "این TXID در شبکه BSC پیدا نشد. لطفاً هش واقعی تراکنش را از BscScan یا جزئیات برداشت دوباره کپی کنید."
      : "This TXID was not found on BSC. Copy the real transaction hash again from BscScan or the withdrawal details.";
  }

  if (code === "WRONG_NETWORK") {
    return isFa
      ? "تراکنش روی شبکه درست نیست. این پرداخت فقط باید روی BSC (BEP20) انجام شود."
      : "The transaction is on the wrong network. This payment must be sent only on BSC (BEP20).";
  }

  if (code === "WRONG_RECIPIENT") {
    return isFa
      ? `آدرس گیرنده با کیف پول رسمی پرداخت مطابقت ندارد.${expectedRecipientAddress ? ` آدرس درست: ${expectedRecipientAddress}` : ""}`
      : `The recipient address does not match the official payment wallet.${expectedRecipientAddress ? ` Expected wallet: ${expectedRecipientAddress}` : ""}`;
  }

  if (code === "WRONG_TOKEN_CONTRACT") {
    return isFa
      ? `توکن ارسالی USDT شبکه BSC نیست.${expectedTokenAddress ? ` قرارداد درست: ${expectedTokenAddress}` : ""}`
      : `The transferred token is not the BSC USDT token.${expectedTokenAddress ? ` Expected contract: ${expectedTokenAddress}` : ""}`;
  }

  if (code === "INCORRECT_AMOUNT") {
    return isFa
      ? `این پرداخت به خاطر کم‌رسیدن مبلغ تایید نشد.${actualReceivedAmount ? ` کیف پول مقصد ${actualReceivedAmount} ${expectedCurrency} دریافت کرده` : ""}${expectedAmount ? `، اما باید حداقل ${expectedAmount} ${expectedCurrency} دریافت می‌کرد.` : ""} اگر از Binance یا صرافی مشابه پرداخت می‌کنید، کارمزد شبکه را هم حساب کنید تا مبلغ نهایی کمتر نرسد.`
      : `This payment was not confirmed because the received amount was too low.${actualReceivedAmount ? ` The destination wallet received ${actualReceivedAmount} ${expectedCurrency}` : ""}${expectedAmount ? `, but it needed to receive at least ${expectedAmount} ${expectedCurrency}.` : ""} If you pay from Binance or a similar exchange, include the network fee so the final received amount is not lower than required.`;
  }

  if (code === "TX_HASH_ALREADY_USED") {
    return isFa
      ? "این TXID قبلاً برای یک درخواست دیگر استفاده شده است."
      : "This TXID has already been used for another payment request.";
  }

  if (code === "PAYMENT_REQUEST_ALREADY_LOCKED") {
    return isFa
      ? "برای این درخواست پرداخت، یک هش تراکنش دیگر ثبت شده است. اگر خودتان آن را ثبت نکرده‌اید، یک درخواست پرداخت جدید بسازید."
      : "A different transaction hash is already attached to this payment request. If it was not submitted by you, create a new payment request.";
  }

  if (code === "INSUFFICIENT_CONFIRMATIONS") {
    return isFa
      ? "تراکنش هنوز در حال تایید شدن است. چند دقیقه بعد دوباره بررسی کنید."
      : "The transaction is still confirming. Please check again in a few minutes.";
  }

  if (code === "PAYMENT_VERIFICATION_COOLDOWN") {
    const retryAfterSeconds = Number(error?.data?.retryAfterSeconds || 0);
    const cooldownAfterAttempts = Number(error?.data?.cooldownAfterAttempts || 5);
    return isFa
      ? `بعد از ${cooldownAfterAttempts} تلاش ناموفق، باید کمی صبر کنید و دوباره تلاش کنید.${retryAfterSeconds > 0 ? ` حدود ${retryAfterSeconds} ثانیه دیگر.` : ""}`
      : `After ${cooldownAfterAttempts} failed attempts, please wait before trying again.${retryAfterSeconds > 0 ? ` Try again in about ${retryAfterSeconds} seconds.` : ""}`;
  }

  if (code === "PAYMENT_VERIFICATION_ATTEMPTS_EXCEEDED") {
    return isFa
      ? "تعداد تلاش‌های ناموفق برای این درخواست پرداخت بیش از حد مجاز شده است. لطفاً یک درخواست پرداخت جدید بسازید."
      : "Too many failed verification attempts were made for this payment request. Please create a new payment request.";
  }

  if (code === "PAYMENT_REQUEST_EXPIRED" || code === "TX_MINED_AFTER_PAYMENT_EXPIRY") {
    return isFa
      ? `این درخواست پرداخت منقضی شده است.${expiresLabel ? ` زمان انقضا: ${expiresLabel}` : ""} یک درخواست جدید بسازید.`
      : `This payment request has expired.${expiresLabel ? ` Expired at: ${expiresLabel}` : ""} Please create a new payment request.`;
  }

  if (code === "TX_OLDER_THAN_PAYMENT_REQUEST") {
    return isFa
      ? "این تراکنش قدیمی‌تر از این درخواست پرداخت است و برای این سشن قابل استفاده نیست."
      : "This transaction is older than this payment request and cannot be used for this session.";
  }

  if (code === "TX_FAILED") {
    return isFa
      ? "تراکنش روی بلاکچین ناموفق بوده است."
      : "The blockchain transaction failed.";
  }

  return getLocalizedRequestErrorMessage(
    error,
    language,
    "تایید تراکنش انجام نشد. هش تراکنش و شبکه را دوباره بررسی کنید.",
    "Unable to verify the transaction. Please re-check the hash and network.",
  );
};

const statusLabelMap = {
  SUCCEEDED: { fa: "تایید شده", en: "Confirmed" },
  PENDING: { fa: "در انتظار پرداخت", en: "Pending payment" },
  FAILED: { fa: "ناموفق", en: "Failed" },
  EXPIRED: { fa: "منقضی شده", en: "Expired" },
  MANUAL_REVIEW: { fa: "نیازمند بررسی", en: "Manual review" },
  DUPLICATE_PAYMENT: { fa: "پرداخت تکراری", en: "Duplicate payment" },
};

const CopyButton = ({ onClick, copied, children, compact = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 font-black text-slate-700 transition hover:border-primary-300 hover:text-primary-700 ${
      compact ? "h-11 px-4 text-xs" : "h-12 px-4 text-sm"
    }`}
  >
    <Copy size={compact ? 14 : 16} />
    <span>{copied ? children.copied : children.default}</span>
  </button>
);

const DataFieldCard = ({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
  copyLabel,
  copiedLabel,
  darkMode,
}) => (
  <div
    className={`rounded-[18px] border p-3.5 ${
      darkMode ? "border-slate-800 bg-slate-900/55" : "border-[#EAEAEA] bg-slate-50/80"
    }`}
  >
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className={`text-xs font-black ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
        {label}
      </label>
      <CopyButton compact copied={copiedKey === copyKey} onClick={() => onCopy(copyKey, value)}>
        {{
          default: copyLabel,
          copied: copiedLabel,
        }}
      </CopyButton>
    </div>
    <div
      dir="ltr"
      className={`rounded-[14px] border px-3.5 py-3 font-mono text-sm font-bold leading-6 sm:text-[15px] ${
        darkMode
          ? "border-slate-700 bg-slate-950 text-slate-100"
          : "border-white bg-white text-slate-900"
      } break-all shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}
    >
      {value || "-"}
    </div>
  </div>
);

const MiniInfoCard = ({ label, value, icon, tone = "slate", align = "rtl" }) => {
  const toneMap = {
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="rounded-[20px] border border-[#EAEAEA] bg-white/85 p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p
            dir={align === "ltr" ? "ltr" : "rtl"}
            className="mt-2.5 break-all text-sm font-bold text-slate-900"
          >
            {value || "-"}
          </p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[16px] ${toneMap[tone] || toneMap.slate}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const GuideStepItem = ({ index, text, darkMode, active = false }) => (
  <div className="flex items-start gap-3">
    <span
      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
        active
          ? darkMode
            ? "bg-primary-500/20 text-primary-200"
            : "bg-primary-100 text-primary-700"
          : darkMode
            ? "bg-slate-800 text-slate-300"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {index}
    </span>
    <p className={`text-xs font-semibold leading-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
      {text}
    </p>
  </div>
);

const GuideNote = ({ title, body, darkMode, tone = "amber" }) => {
  const toneMap = {
    amber: darkMode
      ? "border-amber-800 bg-amber-950/20 text-amber-200"
      : "border-amber-200 bg-amber-50 text-amber-800",
    emerald: darkMode
      ? "border-emerald-800 bg-emerald-950/20 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: darkMode
      ? "border-blue-800 bg-blue-950/20 text-blue-100"
      : "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-[16px] border px-3.5 py-3 ${toneMap[tone] || toneMap.amber}`}>
      <p className="text-xs font-black">{title}</p>
      <p className="mt-1 text-[11px] font-semibold leading-6">{body}</p>
    </div>
  );
};

const StatusStep = ({ title, caption, active, completed, darkMode, icon }) => (
  <div
    className={`flex min-w-0 flex-col items-center rounded-[18px] px-2 py-3 text-center sm:px-1 sm:py-0 ${
      darkMode ? "bg-slate-950/35 sm:bg-transparent" : "bg-white/70 sm:bg-transparent"
    }`}
  >
    <div
      className={`grid h-11 w-11 place-items-center rounded-full border transition ${
        completed
          ? darkMode
            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
          : active
            ? darkMode
              ? "border-primary-500/40 bg-primary-500/20 text-primary-200"
              : "border-primary-200 bg-primary-50 text-primary-700"
            : darkMode
              ? "border-slate-700 bg-slate-900/70 text-slate-400"
              : "border-slate-200 bg-white text-slate-400"
      }`}
    >
      {icon}
    </div>
    <p
      className={`mt-2 text-[11px] font-black sm:text-xs ${
        completed
          ? darkMode
            ? "text-emerald-200"
            : "text-emerald-700"
          : active
            ? darkMode
              ? "text-primary-200"
              : "text-primary-700"
            : darkMode
              ? "text-slate-400"
              : "text-slate-500"
      }`}
    >
      {title}
    </p>
    <p
      className={`mt-1 hidden text-[10px] font-semibold leading-4 sm:block sm:text-[11px] sm:leading-5 ${
        completed
          ? darkMode
            ? "text-emerald-300"
            : "text-emerald-600"
          : active
            ? darkMode
              ? "text-primary-300"
              : "text-primary-600"
            : darkMode
              ? "text-slate-500"
              : "text-slate-400"
      }`}
    >
      {caption}
    </p>
  </div>
);

const resolveQrPayload = (payment) => {
  const provider = String(payment?.provider || "").toUpperCase();
  const method = String(payment?.method || "").toUpperCase();

  if (provider === "BSC_DIRECT" || method === "USDT_BSC_DIRECT") {
    return (
      payment?.recipientAddress ||
      payment?.providerUrl ||
      payment?.rawCreateSessionResponse?.qrPayload ||
      ""
    );
  }

  return (
    payment?.rawCreateSessionResponse?.qrPayload ||
    payment?.providerUrl ||
    payment?.recipientAddress ||
    ""
  );
};

export default function NowPaymentsPage({ language: appLanguage }) {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentAttemptId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("attemptId") || params.get("paymentAttemptId") || "";
  }, [location.search]);

  const language =
    appLanguage === "fa" || appLanguage === "en"
      ? appLanguage
      : readStoredLanguage();
  const [darkMode] = useState(() => readStoredDarkMode());
  const [payment, setPayment] = useState(null);
  const [qr, setQr] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [didSendPayment, setDidSendPayment] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const isFa = language === "fa";
  const networkLabel = useMemo(() => {
    const rawNetwork = String(payment?.network || "").trim().toUpperCase();
    if (!rawNetwork) return isFa ? "مشخص نشده" : "Not specified";
    if (rawNetwork === "BNB_CHAIN") return "BSC (BEP20)";
    return rawNetwork;
  }, [isFa, payment?.network]);

  const currencyLabel = String(payment?.currency || "").trim() || "CRYPTO";
  const displayCurrencyLabel =
    String(currencyLabel).toUpperCase() === "USDT"
      ? "USDT"
      : currencyLabel;
  const isDirectBscFlow =
    String(payment?.provider || "").toUpperCase() === "BSC_DIRECT" ||
    String(payment?.method || "").toUpperCase() === "USDT_BSC_DIRECT";
  const displayAmountValue = useMemo(() => {
    if (isDirectBscFlow && String(displayCurrencyLabel).toUpperCase() === "USDT") {
      const baseAmountUsdCents = Number(payment?.baseAmountUsdCents || 0);
      if (Number.isFinite(baseAmountUsdCents) && baseAmountUsdCents > 0) {
        return trimTrailingZeros((baseAmountUsdCents / 100).toFixed(6));
      }
    }

    return trimTrailingZeros(String(payment?.amount || "").trim());
  }, [displayCurrencyLabel, isDirectBscFlow, payment?.amount, payment?.baseAmountUsdCents]);
  const amountLabel = `${displayAmountValue || "-"} ${displayCurrencyLabel}`.trim();
  const binanceSendExampleLabel = useMemo(() => {
    if (String(displayCurrencyLabel).toUpperCase() !== "USDT") return "";
    const rawAmount = String(displayAmountValue || "").trim();
    if (!rawAmount) return "";

    try {
      const total = trimTrailingZeros((Number(rawAmount) + Number(BINANCE_BEP20_USDT_FEE_EXAMPLE)).toFixed(6));
      return `${total} USDT`;
    } catch {
      return "";
    }
  }, [displayAmountValue, displayCurrencyLabel]);
  const statusKey = String(payment?.status || "PENDING").toUpperCase();
  const isExpiredPayment = statusKey === "EXPIRED";
  const statusLabel = isFa
    ? statusLabelMap[statusKey]?.fa || statusKey
    : statusLabelMap[statusKey]?.en || statusKey;
  const txHashValidationMessage = useMemo(
    () => getTxHashValidationMessage(txHash, language),
    [language, txHash],
  );
  const txHashHexLength = useMemo(() => {
    const normalized = String(txHash || "").trim();
    return normalized.startsWith("0x") ? normalized.slice(2).length : normalized.length;
  }, [txHash]);

  useEffect(() => {
    localStorage.setItem("edutech-payment-dark", darkMode ? "true" : "false");
  }, [darkMode]);

  useEffect(() => {
    if (!paymentAttemptId) {
      navigate("/student/courses", { replace: true });
      return;
    }

    let mounted = true;
    const resetTimer = window.setTimeout(() => {
      setTxHash("");
      setDidSendPayment(false);
    }, 0);

    const load = async () => {
      try {
        const data = await getPaymentAttemptStatus(paymentAttemptId);
        if (!mounted) return;
        const nextPayment = data?.payment || {};
        setPayment(nextPayment);
        setError("");

        const qrPayload = resolveQrPayload(nextPayment);

        if (qrPayload) {
          const nextQr = await QRCode.toDataURL(qrPayload, { margin: 1, width: 440 });
          if (mounted) setQr(nextQr);
        }
      } catch (requestError) {
        if (!mounted) return;
        setError(
          getLocalizedRequestErrorMessage(
            requestError,
            language,
            "بارگذاری اطلاعات پرداخت انجام نشد.",
            "Unable to load payment details.",
          ),
        );
      }
    };

    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      mounted = false;
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
    };
  }, [language, navigate, paymentAttemptId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (statusKey !== "SUCCEEDED") return;
    const timer = window.setTimeout(() => {
      navigate(
        `/payment/success?paymentAttemptId=${encodeURIComponent(paymentAttemptId)}`,
        { replace: true },
      );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [navigate, paymentAttemptId, statusKey]);

  useEffect(() => {
    if (!copiedKey) return undefined;
    const timer = window.setTimeout(() => setCopiedKey(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const copyValue = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedKey(key);
    } catch {
      setError(isFa ? "کپی کردن انجام نشد." : "Copy failed.");
    }
  };

  const handleDownloadQr = async () => {
    if (!qr || typeof document === "undefined") return;

    try {
      const qrImage = new Image();
      qrImage.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
        qrImage.src = qr;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1120;
      const context = canvas.getContext("2d");
      if (!context) return;

      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#fcfbff");
      gradient.addColorStop(0.55, "#f8f5ff");
      gradient.addColorStop(1, "#f3f7ff");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "#ffffff";
      context.strokeStyle = "#dbeafe";
      context.lineWidth = 4;
      const cardX = 70;
      const cardY = 70;
      const cardWidth = canvas.width - 140;
      const cardHeight = canvas.height - 140;
      const cardRadius = 36;

      context.beginPath();
      context.moveTo(cardX + cardRadius, cardY);
      context.lineTo(cardX + cardWidth - cardRadius, cardY);
      context.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardRadius);
      context.lineTo(cardX + cardWidth, cardY + cardHeight - cardRadius);
      context.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - cardRadius, cardY + cardHeight);
      context.lineTo(cardX + cardRadius, cardY + cardHeight);
      context.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - cardRadius);
      context.lineTo(cardX, cardY + cardRadius);
      context.quadraticCurveTo(cardX, cardY, cardX + cardRadius, cardY);
      context.closePath();
      context.fill();
      context.stroke();

      context.textAlign = "center";
      context.fillStyle = "#2563eb";
      context.font = "700 34px Arial, sans-serif";
      context.fillText("EduTech Online Academy", canvas.width / 2, 165);

      context.fillStyle = "#475569";
      context.font = "600 28px Arial, sans-serif";
      context.fillText("آکادمی آنلاین ایجوتک", canvas.width / 2, 215);

      context.fillStyle = "#64748b";
      context.font = "600 24px Arial, sans-serif";
      context.fillText(
        isFa ? "اسکن و پرداخت امن شهریه کورس" : "Scan for secure course payment",
        canvas.width / 2,
        270,
      );

      const qrBoxSize = 420;
      const qrBoxX = (canvas.width - qrBoxSize) / 2;
      const qrBoxY = 340;
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#bfdbfe";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(qrBoxX + 28, qrBoxY);
      context.lineTo(qrBoxX + qrBoxSize - 28, qrBoxY);
      context.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY, qrBoxX + qrBoxSize, qrBoxY + 28);
      context.lineTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize - 28);
      context.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize, qrBoxX + qrBoxSize - 28, qrBoxY + qrBoxSize);
      context.lineTo(qrBoxX + 28, qrBoxY + qrBoxSize);
      context.quadraticCurveTo(qrBoxX, qrBoxY + qrBoxSize, qrBoxX, qrBoxY + qrBoxSize - 28);
      context.lineTo(qrBoxX, qrBoxY + 28);
      context.quadraticCurveTo(qrBoxX, qrBoxY, qrBoxX + 28, qrBoxY);
      context.closePath();
      context.fill();
      context.stroke();

      context.drawImage(qrImage, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60);

      context.fillStyle = "#0f172a";
      context.font = "700 28px Arial, sans-serif";
      context.fillText(amountLabel, canvas.width / 2, 840);

      context.fillStyle = "#64748b";
      context.font = "600 22px Arial, sans-serif";
      context.fillText(
        isFa ? "برای پرداخت از کیف پول خود این کد را اسکن کنید." : "Scan this code with your wallet to pay.",
        canvas.width / 2,
        890,
      );

      context.fillStyle = "#94a3b8";
      context.font = "600 18px Arial, sans-serif";
      context.fillText(payment?.paymentReference || paymentAttemptId || "", canvas.width / 2, 950);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `edutech-payment-${paymentAttemptId || "qr"}.png`;
      link.click();
    } catch {
      setError(isFa ? "دانلود QR انجام نشد." : "QR download failed.");
    }
  };

  const handleVerify = async () => {
    if (!paymentAttemptId || !txHash.trim() || isVerifying || isExpiredPayment) return;
    if (txHashValidationMessage) {
      setError(txHashValidationMessage);
      setStatusFeedback(txHashValidationMessage);
      return;
    }

    try {
      setIsVerifying(true);
      setDidSendPayment(true);
      const data = await verifyDirectCryptoPayment({
        paymentAttemptId,
        txHash: txHash.trim(),
      });
      if (data?.payment) setPayment(data.payment);
      setError("");
      setStatusFeedback(
        isFa
          ? "هش تراکنش ارسال شد و نتیجه بررسی به‌روزرسانی شد."
          : "Transaction hash submitted and the verification result was updated.",
      );
    } catch (requestError) {
      const localizedMessage = getDirectCryptoVerifyErrorMessage(requestError, language);
      setError(localizedMessage);
      setStatusFeedback(
        localizedMessage,
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const helperText =
    error ||
    (isDirectBscFlow
      ? isFa
        ? "برای نهایی‌شدن ثبت‌نام کورس، مبلغ را به کیف پول رسمی EduTech روی شبکه BSC بفرستید و سپس هش تراکنش را ثبت کنید."
        : "To complete your course enrollment, send the amount to EduTech's official BSC wallet and then submit the transaction hash."
      : isFa
        ? "پرداخت را در درگاه کامل کنید. وضعیت این صفحه به‌صورت خودکار به‌روزرسانی می‌شود."
        : "Complete the hosted payment. This page updates automatically.");
  const guideSteps = isDirectBscFlow
    ? [
        isFa ? "مبلغ را با دقت از همین صفحه بررسی کنید." : "Check the amount carefully on this page.",
        isFa ? "آدرس رسمی EduTech را کپی یا QR را اسکن کنید." : "Copy EduTech's official wallet or scan the QR code.",
        isFa ? "پرداخت را فقط روی شبکه BSC (BEP20) انجام دهید." : "Send the payment only on BSC (BEP20).",
        isFa ? "بعد از پرداخت، TXID واقعی را از کیف پول یا BscScan کپی کنید." : "After payment, copy the real TXID from your wallet or BscScan.",
        isFa ? "TXID را ثبت کنید تا پرداخت شما تایید شود." : "Submit the TXID so your payment can be confirmed.",
        isFa ? "بعد از ثبت هش، وضعیت ثبت‌نام و فعال‌شدن دسترسی کورس را از همین صفحه بررسی کنید." : "After submitting the hash, check the enrollment status and course activation on this page.",
      ]
    : [
        isFa ? "اول مبلغ و اطلاعات سفارش را بررسی کنید." : "First review the amount and order details.",
        isFa ? "سپس درگاه پرداخت را باز کرده و پرداخت را کامل انجام دهید." : "Then open the payment gateway and complete the payment.",
        isFa ? "بعد از پرداخت، وضعیت این صفحه به‌روزرسانی می‌شود." : "After payment, this page status will update.",
        isFa ? "برای پیگیری نهایی‌شدن ثبت‌نام، همین صفحه را دوباره بررسی کنید." : "Return to this page to follow the final enrollment status.",
      ];
  const paymentStatusSteps = [
    {
      key: "send",
      title: isFa ? "ارسال پرداخت" : "Sent payment",
      caption: isFa ? "مبلغ از کیف پول ارسال می‌شود" : "Amount is sent from wallet",
      active: isDirectBscFlow && !didSendPayment && statusKey !== "SUCCEEDED",
      completed: didSendPayment || statusKey === "SUCCEEDED",
      icon:
        didSendPayment || statusKey === "SUCCEEDED" ? <CheckCircle2 size={18} /> : <Wallet size={18} />,
    },
    {
      key: "hash",
      title: isFa ? "ثبت هش" : "Submit hash",
      caption: isFa ? "TXID واقعی وارد می‌شود" : "Real TXID is entered",
      active: isDirectBscFlow && didSendPayment && !txHash.trim() && statusKey !== "SUCCEEDED",
      completed: Boolean(txHash.trim()) || statusKey === "SUCCEEDED",
      icon:
        Boolean(txHash.trim()) || statusKey === "SUCCEEDED" ? <CheckCircle2 size={18} /> : <Copy size={17} />,
    },
    {
      key: "review",
      title: isFa ? "بررسی" : "Review",
      caption: isFa ? "سیستم تراکنش را بررسی می‌کند" : "System checks the transaction",
      active:
        Boolean(txHash.trim()) &&
        (statusKey === "PENDING" || statusKey === "MANUAL_REVIEW"),
      completed: statusKey === "SUCCEEDED",
      icon: statusKey === "SUCCEEDED" ? <CheckCircle2 size={18} /> : <Clock3 size={17} />,
    },
    {
      key: "done",
      title: isFa ? "تایید شده" : "Confirmed",
      caption: isFa ? "دسترسی کورس فعال می‌شود" : "Course access becomes active",
      active: statusKey === "SUCCEEDED",
      completed: statusKey === "SUCCEEDED",
      icon: <ShieldCheck size={18} />,
    },
  ];
  const createdAtMs = payment?.createdAt ? new Date(payment.createdAt).getTime() : 0;
  const expiresAtMs = payment?.expiresAt ? new Date(payment.expiresAt).getTime() : 0;
  const totalDurationMs =
    Number.isFinite(expiresAtMs - createdAtMs) && expiresAtMs - createdAtMs > 0
      ? expiresAtMs - createdAtMs
      : 60 * 60 * 1000;
  const remainingMs =
    expiresAtMs && nowMs ? Math.max(0, expiresAtMs - nowMs) : 0;
  const expiresIn = useMemo(() => {
    if (!payment?.expiresAt) return "";
    if (!nowMs) return "";
    if (remainingMs <= 0) return "";
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [nowMs, payment?.expiresAt, remainingMs]);
  const progress = Math.max(0, Math.min(1, remainingMs / totalDurationMs));

  const pageClass = darkMode
    ? "bg-[linear-gradient(180deg,#020617_0%,#0F172A_100%)] text-slate-100"
    : "bg-[#FAFBFD] text-slate-900";

  const panelBorderClass = darkMode
    ? "border-slate-800 bg-slate-950/72"
    : "border-white/80 bg-white/80";

  const inputClass = darkMode
    ? "border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500"
    : "border-[#EAEAEA] bg-white/90 text-slate-950 placeholder:text-slate-400";
  const expiredPaymentMessage = isFa
    ? "این درخواست پرداخت منقضی شده است. بعد از منقضی‌شدن دیگر نمی‌توانید TXID را ثبت یا بررسی کنید."
    : "This payment request has expired. Once expired, the TXID can no longer be submitted or verified.";

  return (
    <section className={`relative min-h-screen overflow-hidden px-1.5 py-2 sm:px-4 sm:py-4 lg:px-5 ${pageClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.14),transparent_28%),radial-gradient(circle_at_bottom,rgba(37,99,235,0.08),transparent_35%)]" />

      <div className="relative mx-auto max-w-[1120px]" dir={isFa ? "rtl" : "ltr"}>
        <div className={`${glassCardClass} ${panelBorderClass} overflow-hidden`}>
          <div className={`border-b px-3 py-3 sm:px-4 lg:px-5 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] bg-[linear-gradient(135deg,#60A5FA_0%,#2563EB_100%)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
                  <Wallet size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className={`text-base font-black sm:text-lg ${darkMode ? "text-white" : "text-slate-950"}`}>
                      {isFa ? "پرداخت شهریه کورس" : "Course Payment"}
                    </h1>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black ${
                        darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {isFa ? "پرداخت امن" : "Secure Payment"}
                    </span>
                  </div>
                  <p className={`mt-1 text-[11px] font-semibold sm:text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {helperText}
                  </p>
                </div>
              </div>

              <div />
            </div>
          </div>

          <div className="p-2.5 sm:p-4 lg:p-5">
            <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]" dir="ltr">
              <div className={`order-2 ${glassCardClass} ${panelBorderClass} flex h-full min-h-0 flex-col p-4 lg:order-1`} dir={isFa ? "rtl" : "ltr"}>
                <div className="text-center xl:text-center">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className={`text-lg font-black ${darkMode ? "text-white" : "text-slate-950"}`}>
                      {isFa ? "اسکن کد QR" : "Scan QR Code"}
                    </h2>
                  </div>
                  <p className={`mx-auto mt-2 max-w-[220px] text-[11px] font-semibold leading-5 sm:text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {isFa
                      ? "برای پرداخت شهریه و فعال‌شدن دسترسی کورس، کد را با کیف پول خود اسکن کنید."
                      : "Scan this code with your wallet to pay the course fee and activate access."}
                  </p>
                </div>

                <div className="mt-4 flex justify-center" dir="ltr">
                  <div className={`w-full max-w-[180px] rounded-2xl border p-2 shadow-[0_12px_28px_rgba(15,23,42,0.07)] ${
                    darkMode ? "border-slate-700 bg-slate-900" : "border-[#EAEAEA] bg-white"
                  }`}>
                    {qr ? (
                      <img
                        src={qr}
                        alt="Payment QR"
                        className="h-full w-full rounded-[20px]"
                      />
                    ) : (
                      <div className={`flex aspect-square items-center justify-center rounded-[20px] ${
                        darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-400"
                      }`}>
                        <Loader2 size={28} className="animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    disabled={!qr}
                    className={`inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-black transition ${
                      darkMode
                        ? "border-slate-700 bg-slate-900/70 text-slate-100"
                        : "border-primary-100 bg-primary-50 text-primary-700"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <QrCode size={15} />
                    <span>{isFa ? "دانلود QR" : "Download QR"}</span>
                  </button>
                </div>

                <details className={`mt-4 rounded-2xl border px-3.5 py-3 ${
                  darkMode ? "border-slate-800" : "border-slate-100"
                }`}>
                  <summary className={`cursor-pointer text-sm font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                    {isFa ? "راهنمای کوتاه پرداخت" : "Quick payment guide"}
                  </summary>
                  <div className="mt-4 space-y-3">
                    {guideSteps.slice(0, isDirectBscFlow ? 5 : 3).map((step, index) => (
                      <GuideStepItem
                        key={`${index}-${step}`}
                        index={index + 1}
                        text={step}
                        darkMode={darkMode}
                        active={
                          isDirectBscFlow
                            ? index === 0 || (didSendPayment && index === 3) || (Boolean(txHash.trim()) && index === 4)
                            : index === 1
                        }
                      />
                    ))}
                  </div>
                  {isDirectBscFlow ? (
                    <div className="mt-4 space-y-3">
                      <GuideNote
                        darkMode={darkMode}
                        tone="amber"
                        title={isFa ? "راهنمای مهم" : "Important"}
                        body={
                          isFa
                            ? "فقط TXID واقعی همین پرداخت را وارد کنید. تراکنش قدیمی، تراکنش منقضی‌شده یا تراکنشی که برای کورس دیگری استفاده شده باشد تایید نمی‌شود."
                            : "Enter only the real TXID for this payment. Old, expired, or reused transactions from another course will not be accepted."
                        }
                      />
                    </div>
                  ) : null}
                </details>

                <div className="mt-4">
                  <div className={`rounded-2xl border p-3.5 ${
                    darkMode ? "border-slate-800 bg-slate-900/60" : "border-[#EAEAEA] bg-white/70"
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                          {isFa ? "زمان باقی‌مانده" : "Payment countdown"}
                        </p>
                      </div>
                      <p className={`text-lg font-black ${darkMode ? "text-white" : "text-slate-950"}`} dir="ltr">{expiresIn || "00:00"}</p>
                    </div>
                    <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 space-y-4 lg:order-2" dir={isFa ? "rtl" : "ltr"}>
              <div className={`${glassCardClass} ${panelBorderClass} flex flex-col p-4 sm:p-5 lg:p-6`}>
                <div className={`rounded-[20px] border p-4 ${
                  darkMode ? "border-slate-800 bg-slate-900/55" : "border-[#EAEAEA] bg-slate-50/70"
                }`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-[linear-gradient(135deg,#DBEAFE_0%,#EFF6FF_100%)] text-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.12)]">
                        <Wallet size={18} />
                      </div>
                      <div>
                        <h2 className={`text-lg font-black ${darkMode ? "text-white" : "text-slate-950"}`}>
                          {isFa ? "خلاصه مبلغ پرداخت" : "Payment Amount Summary"}
                        </h2>
                        <p className={`mt-1 text-xs font-semibold leading-6 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {isFa
                            ? "مبلغ و شبکه را دقیقاً مطابق اطلاعات زیر انتخاب کنید."
                            : "Use the exact amount and network shown below."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-5">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        {isFa ? "اگر با Trust Wallet پرداخت می‌کنید" : "If you pay with Trust Wallet"}
                      </p>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className={`text-3xl font-black tracking-tight ${darkMode ? "text-white" : "text-slate-950"}`} dir="ltr">
                            {amountLabel}
                          </p>
                        </div>
                        <CopyButton
                          compact
                          copied={copiedKey === "amount"}
                          onClick={() => copyValue("amount", displayAmountValue || "")}
                        >
                          {{
                            default: isFa ? "کپی" : "Copy",
                            copied: isFa ? "کپی شد" : "Copied",
                          }}
                        </CopyButton>
                      </div>
                    </div>

                    {binanceSendExampleLabel ? (
                      <div className="min-w-0 border-t border-slate-200/70 pt-4 dark:border-slate-800/70">
                        <p className={`text-[11px] font-black ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {isFa ? "اگر با Binance پرداخت می‌کنید" : "If you pay with Binance"}
                        </p>
                          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className={`text-2xl font-black ${darkMode ? "text-white" : "text-slate-950"}`} dir="ltr">
                                {binanceSendExampleLabel}
                              </p>
                            </div>
                          <CopyButton
                            compact
                            copied={copiedKey === "binance-send-amount"}
                            onClick={() => copyValue("binance-send-amount", binanceSendExampleLabel.replace(/\s*USDT$/i, ""))}
                          >
                            {{
                              default: isFa ? "کپی" : "Copy",
                              copied: isFa ? "کپی شد" : "Copied",
                            }}
                          </CopyButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniInfoCard
                    label={isFa ? "کد سفارش" : "Order code"}
                    value={payment?.paymentReference || paymentAttemptId}
                    align="ltr"
                    tone="blue"
                    icon={<ShieldCheck size={20} />}
                  />
                  <MiniInfoCard
                    label={isFa ? "شبکه پرداخت" : "Payment network"}
                    value={networkLabel}
                    align="ltr"
                    tone="emerald"
                    icon={<Wallet size={20} />}
                  />
                </div>

                <div className="mt-6 grid gap-3 lg:grid-cols-1">
                  <DataFieldCard
                    label={isFa ? "کیف پول رسمی EduTech" : "EduTech official wallet"}
                    value={payment?.recipientAddress || ""}
                    copyKey="address"
                    copiedKey={copiedKey}
                    onCopy={copyValue}
                    copyLabel={isFa ? "کپی آدرس" : "Copy wallet"}
                    copiedLabel={isFa ? "کپی شد" : "Copied"}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            
            <div className={`${glassCardClass} ${panelBorderClass} p-3.5 sm:p-4 lg:p-5`}>
              {isExpiredPayment ? (
                <div
                  className={`mb-4 rounded-[22px] border-2 px-4 py-4 text-sm font-black leading-7 shadow-[0_18px_40px_rgba(244,63,94,0.12)] ${
                    darkMode
                      ? "border-rose-500/70 bg-rose-950/55 text-rose-100"
                      : "border-rose-300 bg-rose-50 text-rose-800"
                  }`}
                >
                  {expiredPaymentMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className={`text-lg font-black ${darkMode ? "text-white" : "text-slate-950"}`}>
                    {isFa ? "ثبت و بررسی پرداخت" : "Submit Payment"}
                  </h2>
                </div>
              </div>

              {isDirectBscFlow ? (
                <div
                  className={`mt-4 rounded-[18px] border p-3.5 ${
                    darkMode ? "border-blue-900/70 bg-blue-950/20" : "border-blue-100 bg-blue-50/60"
                  }`}
                >
                  <div className="mb-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={`text-[11px] font-black tracking-[0.18em] ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                          {isFa ? "وضعیت پرداخت" : "PAYMENT STATUS"}
                        </p>
                      </div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black ${
                        darkMode ? "bg-slate-900/70 text-slate-200" : "bg-white text-slate-700"
                      }`}>
                        <ShieldCheck size={13} />
                        {statusLabel}
                      </div>
                    </div>
                    <div className={`mt-4 rounded-[18px] border p-3 sm:p-4 ${
                      darkMode ? "border-slate-800 bg-slate-900/50" : "border-white bg-white/80"
                    }`}>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
                        {paymentStatusSteps.map((step) => (
                          <StatusStep
                            key={step.key}
                            title={step.title}
                            caption={step.caption}
                            active={step.active}
                            completed={step.completed}
                            darkMode={darkMode}
                            icon={step.icon}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 ${
                      didSendPayment
                        ? darkMode
                          ? "border-emerald-700 bg-emerald-950/30"
                          : "border-emerald-300 bg-emerald-50"
                        : darkMode
                          ? "border-slate-700 bg-slate-900/70"
                          : "border-slate-200 bg-white"
                    }`}>
                      <input
                        type="checkbox"
                        checked={didSendPayment}
                        onChange={(event) => setDidSendPayment(event.target.checked)}
                        disabled={isExpiredPayment}
                        className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className={`text-sm font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                        {isFa ? "مبلغ را ارسال کرده‌ام" : "I have sent the payment"}
                      </span>
                    </label>
                  </div>

                  {!didSendPayment ? (
                    <div
                      className={`mb-3 rounded-[16px] border px-3.5 py-3 text-xs font-semibold leading-6 ${
                        darkMode
                          ? "border-amber-800 bg-amber-950/20 text-amber-200"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isFa
                        ? "وقتی مبلغ را ارسال کردید، گزینه «بله، پرداخت کردم» را بزنید. بعد از آن می‌توانید TXID را وارد و پرداخت را همین‌جا تایید کنید."
                        : "Once you send the money, choose “Yes, I paid”. Then you can enter the TXID and confirm the payment on this page."}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={darkMode ? "text-blue-300" : "text-blue-600"} />
                    <label className={`text-sm font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                      {isFa ? "هش تراکنش را وارد کنید" : "Enter transaction hash"}
                    </label>
                  </div>
                  <p className={`mt-1 text-[11px] font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {isFa
                      ? "بعد از پرداخت، هش واقعی تراکنش را از کیف پول یا BscScan کپی و اینجا وارد کنید."
                      : "After payment, copy the real blockchain transaction hash from your wallet or BscScan and paste it here."}
                  </p>
                  <p className={`mt-2 text-[11px] font-semibold leading-5 ${darkMode ? "text-amber-300" : "text-amber-700"}`}>
                    {isFa
                      ? "اگر از Binance پرداخت کرده‌اید، عدد داخلی برداشت کافی نیست. باید TXID یا TxHash واقعی که با 0x شروع می‌شود را از جزئیات برداشت یا BscScan کپی کنید."
                      : "If you paid from Binance, the internal withdrawal number is not enough. Copy the real TXID or TxHash that starts with 0x from the withdrawal details or BscScan."}
                  </p>
                  {statusFeedback ? (
                    <div
                      className={`mt-3 rounded-[16px] border px-3.5 py-3 text-xs font-semibold leading-6 ${
                        statusKey === "SUCCEEDED"
                          ? darkMode
                            ? "border-emerald-800 bg-emerald-950/30 text-emerald-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : error
                            ? darkMode
                              ? "border-rose-800 bg-rose-950/30 text-rose-100"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                            : darkMode
                              ? "border-slate-700 bg-slate-900/75 text-slate-100"
                              : "border-slate-200 bg-slate-50 text-slate-800"
                      }`}
                    >
                      {statusFeedback}
                    </div>
                  ) : null}
                  <input
                    type="text"
                    value={txHash}
                    onChange={(event) => {
                      setTxHash(event.target.value.replace(/\s+/g, ""));
                      if (statusFeedback) setStatusFeedback("");
                      if (error) setError("");
                    }}
                    disabled={isExpiredPayment}
                    dir="ltr"
                    placeholder={isFa ? "مثال: 0x..." : "Example: 0x..."}
                    className={`mt-3 h-12 w-full rounded-[16px] border px-4 text-sm font-semibold outline-none transition focus:border-blue-400 ${
                      inputClass
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  />

                  {didSendPayment && txHash.trim() ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className={`text-[11px] font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        {isFa
                          ? "طول هش بعد از 0x باید 64 کاراکتر باشد."
                          : "Hash length after 0x must be 64 characters."}
                      </p>
                      <p
                        className={`text-[11px] font-black ${
                          txHashHexLength === 64
                            ? darkMode
                              ? "text-emerald-300"
                              : "text-emerald-700"
                            : darkMode
                              ? "text-amber-300"
                              : "text-amber-700"
                        }`}
                        dir="ltr"
                      >
                        {txHashHexLength}/64
                      </p>
                    </div>
                  ) : null}

                  {didSendPayment && txHash.trim() && txHashValidationMessage ? (
                    <div
                      className={`mt-3 rounded-[16px] border px-3.5 py-3 text-xs font-semibold leading-6 ${
                        darkMode
                          ? "border-rose-900/60 bg-rose-950/30 text-rose-200"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {txHashValidationMessage}
                    </div>
                  ) : null}

                  {didSendPayment && !txHash.trim() ? (
                    <div
                      className={`mt-3 rounded-[16px] border px-3.5 py-3 text-xs font-semibold leading-6 ${
                        darkMode
                          ? "border-sky-800 bg-sky-950/20 text-sky-200"
                          : "border-sky-200 bg-sky-50 text-sky-700"
                      }`}
                    >
                      {isFa
                        ? "الان TXID واقعی را از کیف پول یا BscScan کپی کنید و برای تایید ثبت‌نام وارد نمایید."
                        : "Now copy the real TXID from your wallet or BscScan and paste it here to confirm the enrollment."}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3">
                <div className="flex items-end">
                  {isDirectBscFlow ? (
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={
                        isVerifying ||
                        !didSendPayment ||
                        !txHash.trim() ||
                        Boolean(txHashValidationMessage) ||
                        isExpiredPayment
                      }
                      className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[16px] border border-primary-300 bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_52%,#0f766e_100%)] px-4 text-sm font-black text-white shadow-[0_16px_30px_rgba(37,99,235,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(37,99,235,0.28)] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isVerifying ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      <span>{isFa ? "ثبت تراکنش و بررسی" : "Submit and verify"}</span>
                    </button>
                  ) : (
                    <a
                      href={payment?.providerUrl || payment?.recipientAddress || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[16px] bg-[linear-gradient(135deg,#3B82F6_0%,#2563EB_100%)] px-4 text-xs font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition hover:scale-[1.01]"
                    >
                      <ExternalLink size={18} />
                      <span>{isFa ? "رفتن به صفحه پرداخت" : "Open payment page"}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
      </div>

    </section>
  );
}
