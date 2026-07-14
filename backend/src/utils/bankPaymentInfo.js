const normalizeLocaleDigits = (value = "") =>
  String(value || "").replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return char;
  });

const normalizeDigitsOnly = (value = "") =>
  normalizeLocaleDigits(value).replace(/[^\d]/g, "");

const normalizeTrimmed = (value = "") => String(value || "").trim();

const normalizeCountry = (value = "") => normalizeTrimmed(value).toUpperCase();

const normalizeCardNumber = (value = "") =>
  normalizeLocaleDigits(value).replace(/[\s-]+/g, "");

const normalizeIbanValue = (value = "") =>
  normalizeLocaleDigits(value).replace(/\s+/g, "").toUpperCase();

const normalizeSwiftCode = (value = "") =>
  normalizeTrimmed(normalizeLocaleDigits(value)).replace(/\s+/g, "").toUpperCase();

const inferBankPaymentCountry = (value = {}) => {
  const explicitCountry = normalizeCountry(value?.country || "");
  if (explicitCountry === "AF" || explicitCountry === "IR") return explicitCountry;

  const iban = normalizeIbanValue(value?.iban || "");
  const currency = normalizeCountry(value?.currency || "");
  const swiftCode = normalizeSwiftCode(value?.swiftCode || "");

  if (iban.startsWith("IR")) return "IR";
  if (currency === "IRR") return "IR";
  if (currency === "AFN") return "AF";
  if (swiftCode) return "AF";

  return "";
};

export const isValidIranianSheba = (value = "") => {
  const iban = normalizeIbanValue(value);
  if (!/^IR\d{24}$/.test(iban)) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const char of rearranged) {
    const expanded = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of expanded) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
};

export const normalizeBankPaymentInfo = (value = {}) => {
  const inferredCountry = inferBankPaymentCountry(value);
  const normalized = {
    country: inferredCountry,
    accountHolderName: normalizeTrimmed(value?.accountHolderName || ""),
    bankName: normalizeTrimmed(value?.bankName || ""),
    accountNumber: normalizeTrimmed(normalizeLocaleDigits(value?.accountNumber || "")).replace(/\s+/g, ""),
    cardNumber: normalizeCardNumber(value?.cardNumber || ""),
    iban: normalizeIbanValue(value?.iban || ""),
    swiftCode: normalizeSwiftCode(value?.swiftCode || ""),
    currency: normalizeCountry(value?.currency || ""),
    paymentNote: normalizeTrimmed(value?.paymentNote || value?.note || ""),
  };

  if (normalized.country === "AF") {
    normalized.iban = "";
  }

  if (!normalized.currency) {
    if (normalized.country === "AF") normalized.currency = "AFN";
    if (normalized.country === "IR") normalized.currency = "IRR";
  }

  return normalized;
};

const buildValidationError = (helpers, message) =>
  (helpers ? helpers.message(message) : { error: message });

export const validateAndNormalizeBankPaymentInfo = (value = {}, helpers = null) => {
  const normalized = normalizeBankPaymentInfo(value);
  const hasAnyValue = Object.values({
    country: normalized.country,
    accountHolderName: normalized.accountHolderName,
    bankName: normalized.bankName,
    accountNumber: normalized.accountNumber,
    cardNumber: normalized.cardNumber,
    iban: normalized.iban,
    swiftCode: normalized.swiftCode,
    paymentNote: normalized.paymentNote,
  }).some(Boolean);

  if (!hasAnyValue) return normalized;

  if (!["AF", "IR"].includes(normalized.country)) {
    return buildValidationError(helpers, "انتخاب کشور الزامی است.");
  }

  if (!normalized.accountHolderName) {
    return buildValidationError(helpers, "نام صاحب حساب الزامی است.");
  }

  if (!normalized.bankName) {
    return buildValidationError(helpers, "نام بانک الزامی است.");
  }

  if (normalized.country === "AF") {
    if (!normalized.accountNumber) {
      return buildValidationError(helpers, "شماره حساب برای بانک‌های افغانستان الزامی است.");
    }
    return normalized;
  }

  const hasIranPayoutIdentifier =
    Boolean(normalized.cardNumber) ||
    Boolean(normalized.iban) ||
    Boolean(normalized.accountNumber);

  if (!hasIranPayoutIdentifier) {
    return buildValidationError(helpers, "حداقل یکی از شماره کارت، شماره شبا یا شماره حساب را وارد کنید.");
  }

  if (normalized.cardNumber && !/^\d{16}$/.test(normalized.cardNumber)) {
    return buildValidationError(helpers, "شماره کارت ایران باید دقیقاً ۱۶ رقم باشد.");
  }

  if (normalized.iban) {
    if (!/^IR\d{24}$/.test(normalized.iban)) {
      return buildValidationError(helpers, "شماره شبا باید با IR شروع شود و شامل ۲۴ رقم باشد.");
    }
    if (!isValidIranianSheba(normalized.iban)) {
      return buildValidationError(helpers, "شماره شبا معتبر نیست.");
    }
  }

  return normalized;
};

export const hasUsableBankPaymentInfo = (value = {}) => {
  const normalized = normalizeBankPaymentInfo(value);

  if (normalized.country === "AF") {
    return Boolean(normalized.accountHolderName && normalized.bankName && normalized.accountNumber);
  }

  if (normalized.country === "IR") {
    return Boolean(
      normalized.accountHolderName &&
      normalized.bankName &&
      (normalized.cardNumber || normalized.accountNumber || normalized.iban),
    );
  }

  return Boolean(
    normalized.accountHolderName &&
    normalized.bankName &&
    (normalized.accountNumber || normalized.cardNumber || normalized.iban),
  );
};

export const getNormalizedBankPaymentDisplay = (value = {}) => {
  const normalized = normalizeBankPaymentInfo(value);
  return {
    ...normalized,
    note: normalized.paymentNote,
  };
};
