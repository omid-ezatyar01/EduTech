export const trimCryptoAmountTrailingZeros = (value) =>
  String(value || "0")
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .trim();

export const resolveCryptoPaymentAmount = (payment = {}) =>
  trimCryptoAmountTrailingZeros(String(payment?.amount || "").trim());
