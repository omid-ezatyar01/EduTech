import webPush from "web-push";
import PushSubscription from "../models/PushSubscription.js";
import User from "../models/User.js";

const getPublicSiteOrigin = () => {
  const explicit = String(process.env.COURSE_PUBLIC_ORIGIN || process.env.PUBLIC_SITE_ORIGIN || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const firstClientOrigin = String(process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .find((origin) => /^https?:\/\//i.test(origin) && !/te\.edutech\.study/i.test(origin));

  return firstClientOrigin || "https://edutech.study";
};

export const getWebPushPublicKey = () => String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();

const getWebPushPrivateKey = () => String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();

export const isWebPushConfigured = () =>
  Boolean(getWebPushPublicKey() && getWebPushPrivateKey());

const configureWebPush = () => {
  if (!isWebPushConfigured()) return false;

  webPush.setVapidDetails(
    String(process.env.WEB_PUSH_CONTACT || "mailto:info@edutech.study").trim(),
    getWebPushPublicKey(),
    getWebPushPrivateKey(),
  );

  return true;
};

const buildCourseUrl = (course = {}) => {
  const identifier = String(course?.slug || course?._id || "").trim();
  const origin = getPublicSiteOrigin();
  return identifier ? `${origin}/course/${encodeURIComponent(identifier)}` : `${origin}/live-courses`;
};

const buildTeachersUrl = () => {
  return `${getPublicSiteOrigin()}/teachers`;
};

const buildStudentCoursesUrl = () => {
  return `${getPublicSiteOrigin()}/my-courses`;
};

const buildStudentCertificatesUrl = () => {
  return `${getPublicSiteOrigin()}/student/certificates`;
};

export const notifyTeacherFollowers = async ({
  followerIds = [], teacherId, type, title, body = "", url = "/videos",
} = {}) => {
  if (!followerIds.length) return { sent: 0, failed: 0 };
  if (!configureWebPush()) return { skipped: true, reason: "web_push_not_configured" };

  const recipients = await PushSubscription.find({
    role: "student",
    app: "student",
    userId: { $in: followerIds },
  }).lean();
  if (!recipients.length) return { sent: 0, failed: 0 };

  const destination = /^https?:\/\//i.test(String(url || ""))
    ? String(url)
    : `${getPublicSiteOrigin()}${String(url || "/videos").startsWith("/") ? url : `/${url}`}`;
  const payload = {
    type, title, body,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: destination,
    teacherId: String(teacherId || ""),
  };

  let sent = 0;
  let failed = 0;
  for (let index = 0; index < recipients.length; index += 50) {
    const results = await Promise.all(recipients.slice(index, index + 50).map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }
  return { sent, failed };
};

const getTeacherSiteOrigin = () => {
  const explicit = String(
    process.env.TEACHER_CLIENT_URL ||
    process.env.TEACHER_FRONTEND_URL ||
    "",
  ).trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const origins = String(process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => /^https?:\/\//i.test(origin));

  const teacherOrigin =
    origins.find((origin) => /te\./i.test(origin) || /teacher/i.test(origin)) ||
    origins[0];

  return teacherOrigin || "http://localhost:5174";
};

const buildTeacherIncomeUrl = () => `${getTeacherSiteOrigin()}/teacher/income`;

const getCourseTeacherId = (course = {}) => {
  const candidates = [course.teacher, course.teacherId, course.createdBy];
  for (const candidate of candidates) {
    const value = candidate?._id || candidate;
    if (value) return value;
  }
  return null;
};

const isCoursePubliclyVisible = async (course = {}) => {
  if (!course || String(course.status || "") !== "published" || course.isPublished !== true) {
    return false;
  }

  const teacherId = getCourseTeacherId(course);
  if (!teacherId) return false;

  const teacher = await User.exists({
    _id: teacherId,
    role: "teacher",
    status: "active",
    "teacherApplication.status": "approved",
  });

  return Boolean(teacher);
};

const pruneSubscription = async (subscriptionId) => {
  if (!subscriptionId) return;
  await PushSubscription.deleteOne({ _id: subscriptionId }).catch(() => {});
};

const sendToSubscription = async (row, payload) => {
  const subscription = {
    endpoint: row.endpoint,
    keys: row.keys,
  };

  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await pruneSubscription(row._id);
    }
    return { ok: false, statusCode: error?.statusCode || 0 };
  }
};

const normalizeAudienceRoles = (audience = "all") => {
  if (audience === "students") return ["student"];
  if (audience === "teachers") return ["teacher"];
  return ["student", "teacher"];
};

export const notifyPublishedCourse = async (course = {}, options = {}) => {
  const audienceRoles = normalizeAudienceRoles(options?.audience || "all");
  if (!(await isCoursePubliclyVisible(course))) {
    return { skipped: true, reason: "course_not_publicly_visible" };
  }

  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const rows = await PushSubscription.find({ role: { $in: audienceRoles } })
    .populate("userId", "role status notifications")
    .lean();

  const recipients = rows.filter((row) => {
    const user = row.userId;
    if (!user || !audienceRoles.includes(user.role)) return false;
    if (user.status !== "active") return false;
    return user.notifications?.course !== false;
  });

  if (!recipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "course_published",
    title: "New course on EduTech",
    body: `New course added: ${course.title || "A new course"}`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: buildCourseUrl(course),
    courseId: String(course._id || ""),
    courseSlug: String(course.slug || ""),
  };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < recipients.length; index += 50) {
    const batch = recipients.slice(index, index + 50);
    const results = await Promise.all(batch.map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};

export const notifyApprovedTeacherApplication = async (teacher = {}, options = {}) => {
  const audienceRoles = normalizeAudienceRoles(options?.audience || "all");
  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const rows = await PushSubscription.find({ role: { $in: audienceRoles } })
    .populate("userId", "role status notifications")
    .lean();

  const recipients = rows.filter((row) => {
    const user = row.userId;
    if (!user || !audienceRoles.includes(user.role)) return false;
    if (user.status !== "active") return false;
    return user.notifications?.important !== false;
  });

  if (!recipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "teacher_added",
    title: "New teacher on EduTech",
    body: `${teacher.name || "A new teacher"} joined EduTech.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: buildTeachersUrl(),
    teacherId: String(teacher._id || ""),
    teacherName: String(teacher.name || ""),
  };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < recipients.length; index += 50) {
    const batch = recipients.slice(index, index + 50);
    const results = await Promise.all(batch.map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};

const notifyAdmins = async (payload) => {
  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const recipients = await PushSubscription.find({
    role: "admin",
    app: "admin",
  }).lean();

  if (!recipients.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < recipients.length; index += 50) {
    const batch = recipients.slice(index, index + 50);
    const results = await Promise.all(
      batch.map((row) => sendToSubscription(row, payload)),
    );
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};

export const notifyAdminCourseReview = async (course = {}, teacher = {}) =>
  notifyAdmins({
    type: "course_review",
    title: "New course awaiting review",
    body: `${teacher.name || "A teacher"} submitted “${course.title || "a course"}” for review.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: "/courses?status=pending",
    courseId: String(course._id || ""),
  });

export const notifyAdminCourseEndReview = async (course = {}, teacher = {}) =>
  notifyAdmins({
    type: "course_end_review",
    title: "Course end request awaiting review",
    body: `${teacher.name || "A teacher"} requested to end “${course.title || "a course"}”.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: "/courses?endRequestStatus=pending",
    courseId: String(course._id || ""),
  });

export const notifyAdminTeacherApplicationReview = async (teacher = {}) =>
  notifyAdmins({
    type: "teacher_application_review",
    title: "Teacher application awaiting review",
    body: `${teacher.name || "A teacher"} submitted a teacher application for review.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: "/teachers",
    teacherId: String(teacher._id || ""),
  });

export const notifyTeacherBankTransferProof = async ({
  teacherId,
  teacherName = "",
  studentName = "",
  courseTitle = "",
  paymentReference = "",
} = {}) => {
  if (!teacherId) {
    return { skipped: true, reason: "teacher_not_provided" };
  }

  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const recipients = await PushSubscription.find({
    role: "teacher",
    app: "teacher",
    userId: teacherId,
  })
    .populate("userId", "status notifications name")
    .lean();

  const eligibleRecipients = recipients.filter((row) => {
    const user = row.userId;
    if (!user || user.status !== "active") return false;
    return user.notifications?.payments !== false;
  });

  if (!eligibleRecipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "teacher_bank_transfer_proof",
    title: "New bank transfer proof",
    body: `${studentName || "A student"} sent a bank payment proof for ${courseTitle || "your course"}.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: buildTeacherIncomeUrl(),
    teacherId: String(teacherId || ""),
    teacherName: String(teacherName || ""),
    paymentReference: String(paymentReference || ""),
  };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < eligibleRecipients.length; index += 50) {
    const batch = eligibleRecipients.slice(index, index + 50);
    const results = await Promise.all(batch.map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};

export const notifyStudentBankTransferApproved = async ({
  studentId,
  courseTitle = "",
  teacherName = "",
} = {}) => {
  if (!studentId) {
    return { skipped: true, reason: "student_not_provided" };
  }

  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const recipients = await PushSubscription.find({
    role: "student",
    app: "student",
    userId: studentId,
  })
    .populate("userId", "status notifications")
    .lean();

  const eligibleRecipients = recipients.filter((row) => {
    const user = row.userId;
    if (!user || user.status !== "active") return false;
    return user.notifications?.payments !== false;
  });

  if (!eligibleRecipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "student_bank_transfer_approved",
    title: "Payment approved",
    body: `${teacherName || "Your teacher"} approved your bank payment for ${courseTitle || "the course"}.`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: buildStudentCoursesUrl(),
    studentId: String(studentId || ""),
    courseTitle: String(courseTitle || ""),
  };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < eligibleRecipients.length; index += 50) {
    const batch = eligibleRecipients.slice(index, index + 50);
    const results = await Promise.all(batch.map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};

export const notifyStudentCertificateIssued = async ({
  studentId,
  courseTitle = "",
  certificateId = "",
} = {}) => {
  if (!studentId) {
    return { skipped: true, reason: "student_not_provided" };
  }

  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const recipients = await PushSubscription.find({
    role: "student",
    app: "student",
    userId: studentId,
  })
    .populate("userId", "status notifications")
    .lean();

  const eligibleRecipients = recipients.filter((row) => {
    const user = row.userId;
    if (!user || user.status !== "active") return false;
    return user.notifications?.course !== false;
  });

  if (!eligibleRecipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "student_certificate_issued",
    title: "Certificate ready",
    body: `Your certificate for ${courseTitle || "the course"} is ready${certificateId ? `: ${certificateId}` : "."}`,
    icon: "/icons/web-app-manifest-192x192.png",
    badge: "/icons/favicon-96x96.png",
    url: buildStudentCertificatesUrl(),
    studentId: String(studentId || ""),
    courseTitle: String(courseTitle || ""),
    certificateId: String(certificateId || ""),
  };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < eligibleRecipients.length; index += 50) {
    const batch = eligibleRecipients.slice(index, index + 50);
    const results = await Promise.all(batch.map((row) => sendToSubscription(row, payload)));
    sent += results.filter((result) => result.ok).length;
    failed += results.filter((result) => !result.ok).length;
  }

  return { sent, failed };
};
