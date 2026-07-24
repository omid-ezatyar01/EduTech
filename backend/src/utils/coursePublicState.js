const LABELS = {
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

const MESSAGES = {
  coming_soon: {
    fa: "زمان بازشدن ثبت‌نام به‌زودی اعلام می‌شود.",
    en: "Registration opening details will be announced soon.",
  },
  registration_open: {
    fa: "می‌توانید اکنون در این کورس ثبت‌نام کنید.",
    en: "You can enroll in this course now.",
  },
  full: {
    fa: "تمام جای‌های این کورس تکمیل شده است.",
    en: "All seats in this course have been filled.",
  },
  registration_closed: {
    fa: "این کورس در حال حاضر ثبت‌نام جدید نمی‌پذیرد.",
    en: "This course is not accepting new enrollments.",
  },
  postponed: {
    fa: "تاریخ شروع پس از تکمیل ثبت‌نام‌ها نهایی می‌شود.",
    en: "The start date will be finalized after enrollment is completed.",
  },
};

const resolveUserState = (enrollment = null) => {
  if (!enrollment) return "not_enrolled";
  const enrollmentStatus = String(enrollment.enrollmentStatus || "").toLowerCase();
  const accessStatus = String(enrollment.accessStatus || "").toLowerCase();
  const paymentStatus = String(
    enrollment.paymentStatus ||
      enrollment.paymentId?.paymentStatus ||
      enrollment.paymentId?.status ||
      "",
  ).toLowerCase();

  if (paymentStatus === "refunded") return "refunded";
  if (enrollmentStatus === "completed") return "completed";
  if (enrollmentStatus === "pending" || paymentStatus === "pending") {
    return "payment_pending";
  }
  if (accessStatus === "blocked") return "payment_overdue";
  if (enrollmentStatus === "active" && accessStatus === "allowed") {
    return "enrolled_active";
  }
  return "access_blocked";
};

const actionFor = (key, { isEnrolled = false, courseId = "" } = {}) => {
  const workspaceUrl = courseId ? `/student/course/${courseId}` : "/student/courses";
  if (key === "payment_required") {
    return { key: "complete_payment", url: workspaceUrl };
  }
  if (key === "access_blocked") {
    return { key: "contact_support", url: "/contact" };
  }
  if (key === "live_session") {
    return { key: "join_live_session", url: "/student/live" };
  }
  if (key === "canceled") {
    return isEnrolled ? { key: "refund_status", url: "/student/payments" } : null;
  }
  if (key === "paused") {
    return isEnrolled ? { key: "view_update", url: workspaceUrl } : null;
  }
  if (key === "completed") {
    return isEnrolled
      ? { key: "view_course_content", url: workspaceUrl }
      : { key: "view_details", url: "" };
  }
  if (key === "in_progress") {
    return isEnrolled
      ? { key: "open_course", url: workspaceUrl }
      : { key: "enroll", url: "" };
  }
  if (key === "waitlist_available") return { key: "join_waitlist", url: "" };
  if (["registration_open", "almost_full", "starting_soon", "postponed"].includes(key)) {
    return isEnrolled
      ? { key: "view_enrollment", url: workspaceUrl }
      : { key: "enroll", url: "" };
  }
  return { key: "view_details", url: "" };
};

export const getCoursePublicState = ({
  course = {},
  enrollment = null,
  currentSession = null,
  currentDate = new Date(),
} = {}) => {
  const now = new Date(currentDate);
  const courseId = String(course?._id || course?.id || "");
  const userState = resolveUserState(enrollment);
  const isEnrolled = userState !== "not_enrolled";
  const lifecycle = String(course.lifecycleStatus || "");
  const publicationStatus = String(course.status || "");
  const startAt = course.startDate ? new Date(course.startDate) : null;
  const maxStudents = Math.max(0, Number(course.maxStudents || 0));
  const enrolledStudents = Math.max(0, Number(course.enrolledStudentsCount || 0));
  const remainingSeats = maxStudents > 0
    ? Math.max(0, maxStudents - enrolledStudents)
    : null;

  let key = "registration_open";
  if (
    course.classCancelledAt ||
    publicationStatus === "cancelled" ||
    lifecycle === "canceled"
  ) {
    key = "canceled";
  } else if (lifecycle === "paused") {
    key = "paused";
  } else if (["payment_pending", "payment_overdue"].includes(userState)) {
    key = "payment_required";
  } else if (userState === "access_blocked") {
    key = "access_blocked";
  } else if (
    userState === "enrolled_active" &&
    String(currentSession?.status || "") === "live"
  ) {
    key = "live_session";
  } else if (course.classEndedAt || lifecycle === "completed") {
    key = "completed";
  } else if (
    !course.classStartedAt &&
    (course.lastAutoRescheduledAt || lifecycle === "minimum_not_reached")
  ) {
    key = "postponed";
  } else if (course.classStartedAt || lifecycle === "in_progress" || lifecycle === "awaiting_completion") {
    key = "in_progress";
  } else if (
    startAt &&
    Number.isFinite(startAt.getTime()) &&
    startAt > now &&
    startAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000
  ) {
    key = "starting_soon";
  } else if (remainingSeats !== null && remainingSeats <= 0) {
    key = course.waitlistEnabled ? "waitlist_available" : "full";
  } else if (
    lifecycle === "enrollment_closed" ||
    publicationStatus !== "published" ||
    course.isPublished !== true
  ) {
    key = lifecycle === "approved" ? "coming_soon" : "registration_closed";
  } else if (
    remainingSeats !== null &&
    maxStudents > 0 &&
    enrolledStudents / maxStudents >= 0.8
  ) {
    key = "almost_full";
  }

  const baseMessage = MESSAGES[key] || null;
  const message =
    key === "almost_full" && remainingSeats !== null
      ? {
          fa: `فقط ${remainingSeats.toLocaleString("fa-AF")} جای باقی مانده است.`,
          en: `Only ${remainingSeats.toLocaleString("en-US")} seats remaining.`,
        }
      : baseMessage;

  return {
    key,
    label: LABELS[key] || LABELS.registration_open,
    message,
    remainingSeats,
    enrolledStudents,
    maxStudents,
    userState: { key: userState },
    primaryAction: actionFor(key, { isEnrolled, courseId }),
  };
};

export default getCoursePublicState;
