const toUnixSecond = (value) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : Number.NaN;
};

const PENALIZED_VERIFICATION_CODES = new Set([
  "TX_FAILED",
  "WRONG_NETWORK",
  "WRONG_TOKEN_CONTRACT",
  "WRONG_RECIPIENT",
  "INCORRECT_AMOUNT",
]);

export const getDirectCryptoTransactionTimeError = ({
  blockTimestamp,
  attemptCreatedAt,
  attemptExpiresAt,
} = {}) => {
  const minedSecond = toUnixSecond(blockTimestamp);
  const createdSecond = toUnixSecond(attemptCreatedAt);
  const expiresSecond = toUnixSecond(attemptExpiresAt);

  // EVM block timestamps have one-second precision, while Mongo dates include
  // milliseconds. Comparing the raw millisecond values can reject a payment
  // mined during the same second in which the checkout was created.
  if (Number.isFinite(minedSecond) && Number.isFinite(createdSecond) && minedSecond < createdSecond) {
    return "TX_OLDER_THAN_PAYMENT_REQUEST";
  }

  if (Number.isFinite(minedSecond) && Number.isFinite(expiresSecond) && minedSecond > expiresSecond) {
    return "TX_MINED_AFTER_PAYMENT_EXPIRY";
  }

  return "";
};

export const shouldPenalizeDirectCryptoVerificationFailure = (code = "") =>
  PENALIZED_VERIFICATION_CODES.has(String(code || "").trim().toUpperCase());
