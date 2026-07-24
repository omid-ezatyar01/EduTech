const FALLBACK_LABELS = {
  coming_soon: { fa: "به‌زودی", en: "Coming soon" },
  registration_open: { fa: "ثبت‌نام باز است", en: "Registration open" },
  almost_full: { fa: "ظرفیت رو به تکمیل است", en: "Almost full" },
  full: { fa: "ظرفیت تکمیل شده است", en: "Course full" },
  waitlist_available: { fa: "لیست انتظار فعال است", en: "Waitlist available" },
  registration_closed: { fa: "ثبت‌نام بسته شده است", en: "Registration closed" },
  starting_soon: { fa: "کورس به‌زودی آغاز می‌شود", en: "Starting soon" },
  in_progress: { fa: "در حال برگزاری", en: "In progress" },
  completed: { fa: "کورس تکمیل شده است", en: "Course completed" },
  postponed: { fa: "تاریخ شروع در حال نهایی‌شدن است", en: "Start date being finalized" },
  canceled: { fa: "کورس لغو شده است", en: "Course cancelled" },
  paused: { fa: "کورس موقتاً متوقف شده است", en: "Course paused" },
  payment_required: { fa: "پرداخت شما تکمیل نشده است", en: "Payment required" },
  access_blocked: { fa: "دسترسی شما موقتاً غیرفعال است", en: "Access temporarily blocked" },
  live_session: { fa: "جلسه اکنون زنده است", en: "Session live now" },
};

export const getPublicStateKey = (course = {}) => {
  if (course?.publicState?.key) return String(course.publicState.key);
  if (course?.classCancelledAt || course?.status === "cancelled") return "canceled";
  if (course?.classEndedAt || course?.lifecycleStatus === "completed") return "completed";
  if (course?.classStartedAt || course?.lifecycleStatus === "in_progress") return "in_progress";
  return "registration_open";
};

export const getPublicStateLabel = (course = {}, language = "fa") => {
  const key = getPublicStateKey(course);
  const localized = course?.publicState?.label;
  if (typeof localized === "string") return localized;
  return (
    localized?.[language === "fa" ? "fa" : "en"] ||
    FALLBACK_LABELS[key]?.[language === "fa" ? "fa" : "en"] ||
    ""
  );
};

export const getPublicStateMessage = (course = {}, language = "fa") => {
  const localized = course?.publicState?.message;
  if (typeof localized === "string") return localized;
  return localized?.[language === "fa" ? "fa" : "en"] || "";
};

export const getPublicStateTone = (course = {}) => {
  const key = getPublicStateKey(course);
  if (["registration_open", "in_progress", "live_session"].includes(key)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["almost_full", "starting_soon", "postponed", "payment_required"].includes(key)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (["canceled", "paused", "full", "registration_closed", "access_blocked"].includes(key)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-blue-200 bg-blue-50 text-blue-800";
};

export const canEnrollFromPublicState = (course = {}) =>
  ["registration_open", "almost_full", "starting_soon", "postponed", "in_progress"].includes(
    getPublicStateKey(course),
  );

export const getPublicActionLabel = (course = {}, language = "fa", isEnrolled = false) => {
  const key = getPublicStateKey(course);
  if (isEnrolled) {
    if (key === "live_session") return language === "fa" ? "ورود به جلسه زنده" : "Join live session";
    if (key === "completed") return language === "fa" ? "مشاهده محتوا و گواهینامه" : "View content and certificate";
    if (key === "payment_required") return language === "fa" ? "تکمیل پرداخت" : "Complete payment";
    if (key === "access_blocked") return language === "fa" ? "تماس با پشتیبانی" : "Contact support";
    if (key === "in_progress") return language === "fa" ? "ورود به کورس" : "Open course";
    return language === "fa" ? "مشاهده کورس" : "View course";
  }
  if (key === "in_progress") return language === "fa" ? "ثبت‌نام و پیوستن" : "Enroll and join";
  if (key === "waitlist_available") return language === "fa" ? "پیوستن به لیست انتظار" : "Join waitlist";
  return language === "fa" ? "ثبت‌نام در کورس" : "Enroll in course";
};
