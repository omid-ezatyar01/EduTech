const CHECKOUT_KEY = "edutech_checkout_items";
const PAYMENT_HISTORY_KEY = "edutech_payment_history";

const LIVE_COURSE_PRICES = [80, 24, 27, 30, 33, 36, 38, 40];
const HOME_COURSE_PRICES = [80, 24, 27, 30];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function formatUsd(amount, language = "fa", currency = "USD") {
  const normalizedAmount = Number(amount || 0);
  const fractionDigits = Number.isInteger(normalizedAmount) ? 0 : 2;
  const localeHint = language === "fa" ? "fa" : "en";
  void localeHint;
  const amountLabel = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(normalizedAmount);
  void currency;
  return `${amountLabel} ${language === "fa" ? "دالر" : "USD"}`;
}

export function getCoursePrice(source = "live", index = 0) {
  const list = source === "home" ? HOME_COURSE_PRICES : LIVE_COURSE_PRICES;
  return list[index] ?? 25;
}

export function getCheckoutItems() {
  return readJson(CHECKOUT_KEY, []);
}

export function getPaymentHistory() {
  return readJson(PAYMENT_HISTORY_KEY, []);
}

function getNowLabels(language = "fa") {
  const locale = language === "fa" ? "fa-IR" : "en-US";
  const now = new Date();

  return {
    date: new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(now),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
  };
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

export function addCourseToCheckout({
  course,
  courseIndex = 0,
  source = "live",
  language = "fa",
}) {
  const current = getCheckoutItems();
  const title = course?.title || "Course";

  const exists = current.find(
    (item) =>
      item.courseTitle === title &&
      item.courseIndex === courseIndex &&
      item.source === source &&
      item.status === "pending",
  );

  if (exists) return exists;

  const amountNumber = getCoursePrice(source, courseIndex);
  const amount = formatUsd(amountNumber, language);
  const { date, time } = getNowLabels(language);

  const checkoutItem = {
    id: randomId("checkout"),
    courseTitle: title,
    description: language === "fa" ? "خرید کورس" : "Course Purchase",
    courseIndex,
    source,
    amount,
    amountNumber,
    date,
    time,
    status: "pending",
    statusLabel: language === "fa" ? "در انتظار" : "Pending",
    invoice: randomId("INV"),
    method: language === "fa" ? "انتخاب نشده" : "Not selected",
  };

  writeJson(CHECKOUT_KEY, [checkoutItem, ...current]);
  return checkoutItem;
}

export function completeCheckoutPayment({
  checkoutId,
  method = "Card",
  language = "fa",
}) {
  const checkout = getCheckoutItems();
  const target = checkout.find((item) => item.id === checkoutId);

  if (!target) return null;

  const remaining = checkout.filter((item) => item.id !== checkoutId);
  writeJson(CHECKOUT_KEY, remaining);

  const { date, time } = getNowLabels(language);
  const paymentRecord = {
    id: randomId("payment"),
    date,
    time,
    description: language === "fa" ? "خرید کورس" : "Course Purchase",
    service: target.courseTitle,
    amount: target.amount,
    amountNumber: target.amountNumber,
    method,
    status: "success",
    statusLabel: language === "fa" ? "موفق" : "Success",
    invoice: randomId("INV"),
  };

  const history = getPaymentHistory();
  writeJson(PAYMENT_HISTORY_KEY, [paymentRecord, ...history]);
  return paymentRecord;
}
