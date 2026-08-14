const STORAGE_KEY = "edutech_pending_hosted_payments";
const MAX_STORED_ATTEMPTS = 8;
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

const asText = (value) => String(value ?? "").trim();

const getStorage = (storage) => {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readEntries = (storage, nowMs = Date.now()) => {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry) => {
      const storedAtMs = Number(entry?.storedAtMs || 0);
      return (
        asText(entry?.ownerKey) &&
        (asText(entry?.paymentAttemptId) || asText(entry?.paymentReference)) &&
        Number.isFinite(storedAtMs) &&
        nowMs - storedAtMs <= STORAGE_TTL_MS
      );
    });
  } catch {
    return [];
  }
};

const writeEntries = (entries, storage) => {
  const target = getStorage(storage);
  if (!target) return;

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_STORED_ATTEMPTS)));
  } catch {
    // Checkout must continue if browser storage is unavailable or full.
  }
};

export const getPaymentOwnerKey = (user = {}) => {
  const userId = asText(user?._id || user?.id || user?.userId);
  if (userId) return `id:${userId}`;

  const email = asText(user?.email).toLowerCase();
  return email ? `email:${email}` : "";
};

export const rememberHostedPaymentAttempt = ({
  checkout = {},
  courseId = "",
  user = {},
  storage,
  nowMs = Date.now(),
} = {}) => {
  const provider = asText(checkout?.provider).toUpperCase();
  const ownerKey = getPaymentOwnerKey(user);
  const paymentAttemptId = asText(checkout?.paymentAttemptId);
  const paymentReference = asText(checkout?.paymentReference);

  if (
    provider !== "HESABPAY" ||
    !ownerKey ||
    (!paymentAttemptId && !paymentReference)
  ) {
    return null;
  }

  const entry = {
    ownerKey,
    provider,
    paymentAttemptId,
    paymentReference,
    orderId: asText(checkout?.orderId),
    courseId: asText(courseId),
    storedAtMs: Number(nowMs),
  };
  const entries = readEntries(storage, nowMs).filter(
    (item) =>
      item.ownerKey !== ownerKey ||
      (asText(item.paymentAttemptId) !== paymentAttemptId &&
        (!paymentReference || asText(item.paymentReference) !== paymentReference)),
  );
  writeEntries([entry, ...entries], storage);
  return entry;
};

const getParam = (searchParams, ...keys) => {
  for (const key of keys) {
    const value = asText(searchParams?.get?.(key));
    if (value) return value;
  }
  return "";
};

export const resolveHostedPaymentReturn = ({
  searchParams,
  user = {},
  storage,
  nowMs = Date.now(),
} = {}) => {
  const queryAttemptId = getParam(searchParams, "paymentAttemptId", "attemptId");
  const queryReference = getParam(
    searchParams,
    "ref",
    "paymentRef",
    "paymentReference",
    "reference",
  );
  const orderId = getParam(searchParams, "orderId");

  if (queryAttemptId || queryReference) {
    return {
      paymentAttemptId: queryAttemptId,
      reference: queryReference,
      orderId,
      source: "query",
    };
  }

  const ownerKey = getPaymentOwnerKey(user);
  const ownedEntries = ownerKey
    ? readEntries(storage, nowMs).filter((entry) => entry.ownerKey === ownerKey)
    : [];
  const storedEntry = orderId
    ? ownedEntries.find((entry) => asText(entry.orderId) === orderId)
    : ownedEntries[0];

  return {
    paymentAttemptId: asText(storedEntry?.paymentAttemptId),
    reference: asText(storedEntry?.paymentReference),
    orderId,
    source: storedEntry ? "storage" : orderId ? "legacy-order" : "missing",
  };
};

export const forgetHostedPaymentAttempt = ({
  paymentAttemptId = "",
  reference = "",
  orderId = "",
  user = {},
  storage,
  nowMs = Date.now(),
} = {}) => {
  const ownerKey = getPaymentOwnerKey(user);
  if (!ownerKey) return;

  const normalizedAttemptId = asText(paymentAttemptId);
  const normalizedReference = asText(reference);
  const normalizedOrderId = asText(orderId);
  const entries = readEntries(storage, nowMs).filter((entry) => {
    if (entry.ownerKey !== ownerKey) return true;
    if (normalizedAttemptId && asText(entry.paymentAttemptId) === normalizedAttemptId) return false;
    if (normalizedReference && asText(entry.paymentReference) === normalizedReference) return false;
    if (normalizedOrderId && asText(entry.orderId) === normalizedOrderId) return false;
    return true;
  });
  writeEntries(entries, storage);
};

export const buildHostedPaymentStatusPath = (payment = {}) => {
  const paymentAttemptId = asText(payment?.paymentAttemptId?._id || payment?.paymentAttemptId);
  if (paymentAttemptId) {
    return `/payment/success?paymentAttemptId=${encodeURIComponent(paymentAttemptId)}`;
  }

  const reference = asText(payment?.paymentReference || payment?.reference);
  if (reference) return `/payment/success?ref=${encodeURIComponent(reference)}`;

  const orderId = asText(payment?.orderId?._id || payment?.orderId);
  return orderId ? `/payment/success?orderId=${encodeURIComponent(orderId)}` : "";
};

export const hostedPaymentStorageKey = STORAGE_KEY;
