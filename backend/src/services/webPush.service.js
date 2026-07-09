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

export const notifyPublishedCourse = async (course = {}) => {
  if (!(await isCoursePubliclyVisible(course))) {
    return { skipped: true, reason: "course_not_publicly_visible" };
  }

  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const rows = await PushSubscription.find({ role: { $in: ["student", "teacher"] } })
    .populate("userId", "role status notifications")
    .lean();

  const recipients = rows.filter((row) => {
    const user = row.userId;
    if (!user || !["student", "teacher"].includes(user.role)) return false;
    if (user.status !== "active") return false;
    return user.notifications?.course !== false;
  });

  if (!recipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "course_published",
    title: "New course on EduTech",
    body: `New course added: ${course.title || "A new course"}`,
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
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

export const notifyApprovedTeacherApplication = async (teacher = {}) => {
  if (!configureWebPush()) {
    return { skipped: true, reason: "web_push_not_configured" };
  }

  const rows = await PushSubscription.find({ role: { $in: ["student", "teacher"] } })
    .populate("userId", "role status notifications")
    .lean();

  const recipients = rows.filter((row) => {
    const user = row.userId;
    if (!user || !["student", "teacher"].includes(user.role)) return false;
    if (user.status !== "active") return false;
    return user.notifications?.important !== false;
  });

  if (!recipients.length) return { sent: 0, failed: 0 };

  const payload = {
    type: "teacher_added",
    title: "New teacher on EduTech",
    body: `${teacher.name || "A new teacher"} joined EduTech.`,
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
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
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
    url: "/courses?status=pending",
    courseId: String(course._id || ""),
  });

export const notifyAdminTeacherApplicationReview = async (teacher = {}) =>
  notifyAdmins({
    type: "teacher_application_review",
    title: "Teacher application awaiting review",
    body: `${teacher.name || "A teacher"} submitted a teacher application for review.`,
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
    url: "/teachers",
    teacherId: String(teacher._id || ""),
  });
