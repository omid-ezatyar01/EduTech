import axios from "axios";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Course from "../models/Course.js";
import User from "../models/User.js";
import TelegramPost from "../models/TelegramPost.js";
import TelegramSettings from "../models/TelegramSettings.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRootDir = path.resolve(__dirname, "../../");

const normalizeSegment = (value = "") =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const trimTrailingSlashes = (value = "") => String(value || "").replace(/\/+$/, "");
const compactText = (value = "", maxLength = 280) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

const normalizeReadableText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const PHONE_DIGIT_PATTERN = /\d/g;

const joinMessageLines = (lines = []) =>
  lines
    .map((line) => String(line || ""))
    .filter((line, index, rows) => !(line === "" && rows[index - 1] === ""))
    .join("\n");

const resolveFrontendUrl = () => {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.COURSE_PUBLIC_ORIGIN,
    process.env.CLIENT_URL,
    process.env.STUDENT_FRONTEND_URL,
  ];
  return trimTrailingSlashes(candidates.find((value) => String(value || "").trim()) || "");
};

const resolveFrontendOrigin = () => {
  const frontendUrl = resolveFrontendUrl();
  if (!frontendUrl) return "";

  try {
    return new URL(frontendUrl).origin;
  } catch {
    return trimTrailingSlashes(frontendUrl);
  }
};

const resolveBackendPublicOrigin = () => {
  const candidates = [
    process.env.BACKEND_PUBLIC_URL,
  ];

  const raw = trimTrailingSlashes(candidates.find((value) => String(value || "").trim()) || "");
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
};

const resolvePublicAssetUrl = (value = "") => {
  const asset = String(value || "").trim();
  if (!asset) return "";
  if (/^https?:\/\//i.test(asset)) return asset;

  const origin = resolveBackendPublicOrigin() || trimTrailingSlashes(process.env.COURSE_PUBLIC_ORIGIN || "") || resolveFrontendOrigin();
  if (!origin) return "";

  return `${origin}${asset.startsWith("/") ? asset : `/${asset}`}`;
};

const resolveLocalAssetPath = (value = "") => {
  const asset = String(value || "").trim();
  if (!asset.startsWith("/")) return "";
  if (!(asset.startsWith("/uploads/") || asset.startsWith("/public/"))) return "";

  return path.resolve(backendRootDir, `.${asset}`);
};

const fileExists = async (targetPath = "") => {
  if (!targetPath) return false;
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const buildCoursePath = (course = {}) => {
  const slug = String(course?.slug || "").trim();
  if (slug) return `/course/${encodeURIComponent(slug)}`;

  const id = String(course?._id || course?.id || "").trim();
  if (!id) return "/live-courses";

  const title = normalizeSegment(course?.title || "course");
  return `/course/${title ? `${title}-${id}` : id}`;
};

const buildTeacherPath = (teacher = {}) => {
  const id = String(teacher?._id || teacher?.id || "").trim();
  if (!id) return "/teachers";

  const name = normalizeSegment(teacher?.name || teacher?.username || "teacher");
  return `/teacher/${name ? `${name}-${id}` : id}`;
};

const buildEventPath = (event = {}) => {
  const slug = String(event?.slug || "").trim();
  if (slug) return `/events/${encodeURIComponent(slug)}`;

  const id = String(event?._id || event?.id || "").trim();
  if (!id) return "/events";

  const title = normalizeSegment(event?.title || "event");
  return `/events/${title ? `${title}-${id}` : id}`;
};

const getTelegramErrorMessage = (error) =>
  error?.response?.data?.description ||
  error?.response?.data?.message ||
  error?.message ||
  "Telegram request failed";

const resolvePriceLabel = (course = {}) => {
  const price = Number(course?.price || 0);
  const currency = String(course?.currency || "USDT").trim() || "USDT";
  if (Boolean(course?.isFree) || price <= 0) return "Free";
  return `${price} ${currency}`;
};

const formatCourseStartDateLabel = (value) => {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const resolveCourseSessionsPerWeek = (course = {}) => {
  const rows = Array.isArray(course?.schedule) ? course.schedule : [];
  const uniqueDays = new Set(
    rows
      .map((row) => String(row?.day || "").trim().toLowerCase())
      .filter(Boolean),
  );
  return uniqueDays.size || 0;
};

const resolveCourseLearningTime = (course = {}) => {
  const rows = Array.isArray(course?.schedule) ? course.schedule : [];
  if (!rows.length) return "TBA";

  const timeLabels = Array.from(
    new Set(
      rows
        .map((row) => {
          const startTime = String(row?.startTime || "").trim();
          const endTime = String(row?.endTime || "").trim();
          if (!startTime || !endTime) return "";
          return `${startTime} - ${endTime}`;
        })
        .filter(Boolean),
    ),
  );

  if (!timeLabels.length) return "TBA";
  if (timeLabels.length === 1) return timeLabels[0];
  return timeLabels.join(" | ");
};

const resolveTeacherSubject = (teacher = {}) => {
  const application = teacher?.teacherApplication || {};
  const expertiseAreas = Array.isArray(application?.expertiseAreas)
    ? application.expertiseAreas.filter(Boolean)
    : [];

  return (
    String(application?.professionalTitle || "").trim() ||
    String(teacher?.subject || "").trim() ||
    String(expertiseAreas[0] || "").trim() ||
    "Teacher"
  );
};

const resolveCourseDescription = (course = {}) =>
  compactText(
    normalizeReadableText(
      course?.description ||
        course?.shortDescription ||
        `Join ${course?.title || "this course"} on EduTech Online Academy and start learning with expert guidance.`,
    ),
    850,
  );

const resolveTeacherDescription = (teacher = {}) => {
  const application = teacher?.teacherApplication || {};
  return compactText(
    normalizeReadableText(
      teacher?.bio ||
        application?.professionalTitle ||
        (Array.isArray(application?.expertiseAreas) && application.expertiseAreas.length
          ? application.expertiseAreas.join(", ")
          : "") ||
        `Explore ${teacher?.name || "this teacher"} on EduTech Online Academy.`,
    ),
    850,
  );
};

const resolveCourseTeacherName = async (course = {}) => {
  const embeddedTeacherName =
    course?.teacher?.name ||
    course?.teacherId?.name ||
    course?.teacherName ||
    course?.teacher;
  if (typeof embeddedTeacherName === "string" && embeddedTeacherName.trim()) {
    return embeddedTeacherName.trim();
  }

  const teacherId =
    (typeof course?.teacher === "object" ? course?.teacher?._id || course?.teacher?.id : course?.teacher) ||
    (typeof course?.teacherId === "object"
      ? course?.teacherId?._id || course?.teacherId?.id
      : course?.teacherId) ||
    "";

  if (!teacherId || !mongoose.isValidObjectId(String(teacherId))) {
    return "Teacher";
  }

  const teacher = await User.findById(teacherId).select("name").lean();
  return String(teacher?.name || "Teacher").trim();
};

const resolveTeacherPostEntity = async (teacher = {}) => {
  const teacherId = String(teacher?._id || teacher?.id || "").trim();
  if (!teacherId || !mongoose.isValidObjectId(teacherId)) return teacher;

  const hasEnoughData =
    Boolean(String(teacher?.name || "").trim()) &&
    Boolean(
      String(teacher?.bio || "").trim() ||
      String(teacher?.avatar || "").trim() ||
      String(teacher?.teacherApplication?.professionalTitle || "").trim() ||
      (Array.isArray(teacher?.teacherApplication?.expertiseAreas) &&
        teacher.teacherApplication.expertiseAreas.length),
    );

  if (hasEnoughData) {
    return teacher;
  }

  const fullTeacher = await User.findById(teacherId)
    .select(
      "name username subject avatar bio teacherApplication.professionalTitle teacherApplication.expertiseAreas",
    )
    .lean();
  return fullTeacher || teacher;
};

const mapSettingsResponse = (settings) => ({
  publicChannelId: String(process.env.TELEGRAM_PUBLIC_CHANNEL_ID || settings?.publicChannelId || "").trim(),
  publicChannelUsername: String(
    process.env.TELEGRAM_PUBLIC_CHANNEL_USERNAME || settings?.publicChannelUsername || "",
  ).trim(),
  autoPostCourses: Boolean(settings?.autoPostCourses),
  autoPostTeachers: Boolean(settings?.autoPostTeachers),
  autoPostEvents: Boolean(settings?.autoPostEvents),
  createdAt: settings?.createdAt || null,
  updatedAt: settings?.updatedAt || null,
});

const getEffectiveSettings = async () => {
  const settings = await TelegramSettings.getSingleton();
  return {
    settings,
    data: mapSettingsResponse(settings),
  };
};

const resolveSupportChatId = async () => {
  const envChatId = String(process.env.TELEGRAM_SUPPORT_CHAT_ID || "").trim();
  if (envChatId) return envChatId;

  const { data } = await getEffectiveSettings();
  return String(data.publicChannelId || "").trim();
};

const sendTelegramMessage = async ({ channelId, text, buttonText, buttonUrl }) => {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!channelId) {
    throw new Error("Telegram public channel ID is not configured");
  }

  const response = await axios.post(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    chat_id: channelId,
    text,
    parse_mode: "HTML",
    reply_markup: buttonText && buttonUrl
      ? {
          inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
        }
      : undefined,
    disable_web_page_preview: false,
  });

  return Number(response?.data?.result?.message_id || 0);
};

const sendTelegramPhotoMessage = async ({
  channelId,
  photo,
  caption,
  buttonText,
  buttonUrl,
}) => {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!channelId) {
    throw new Error("Telegram public channel ID is not configured");
  }
  if (!photo) {
    throw new Error("Telegram photo URL is not configured");
  }
  const localAssetPath = resolveLocalAssetPath(photo);
  let response;

  if (await fileExists(localAssetPath)) {
    const originalBuffer = await fs.readFile(localAssetPath);
    const jpegBuffer = await sharp(originalBuffer)
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const formData = new FormData();
    formData.append("chat_id", channelId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    if (buttonText && buttonUrl) {
      formData.append(
        "reply_markup",
        JSON.stringify({
          inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
        }),
      );
    }
    formData.append(
      "photo",
      new Blob([jpegBuffer], { type: "image/jpeg" }),
      "telegram-post.jpg",
    );

    response = await axios.post(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, formData, {
      timeout: 20000,
    });
  } else {
    response = await axios.post(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
      chat_id: channelId,
      photo,
      caption,
      parse_mode: "HTML",
      reply_markup: buttonText && buttonUrl
        ? {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          }
        : undefined,
    }, {
      timeout: 15000,
    });
  }

  return Number(response?.data?.result?.message_id || 0);
};

const deleteTelegramMessage = async ({ channelId, telegramMessageId }) => {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!channelId) {
    throw new Error("Telegram public channel ID is not configured");
  }
  if (!Number.isFinite(Number(telegramMessageId)) || Number(telegramMessageId) <= 0) {
    throw new Error("Telegram message ID is invalid");
  }

  await axios.post(`${TELEGRAM_API_BASE}/bot${token}/deleteMessage`, {
    chat_id: channelId,
    message_id: Number(telegramMessageId),
  });
};

const persistPostResult = async ({
  type,
  refId,
  channelId,
  status,
  telegramMessageId = null,
  error = "",
}) =>
  TelegramPost.findOneAndUpdate(
    { type, refId },
    {
      $set: {
        channelId: String(channelId || "").trim(),
        status,
        telegramMessageId: Number.isFinite(Number(telegramMessageId))
          ? Number(telegramMessageId)
          : null,
        error: String(error || "").trim(),
      },
      $setOnInsert: {
        type,
        refId,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

const announceEntity = async ({
  type,
  refId,
  isEnabled,
  formatter,
}) => {
  if (!refId || !mongoose.isValidObjectId(String(refId))) {
    console.log(`Telegram posting skipped for ${type}: invalid reference ID`);
    return { skipped: true, reason: "Invalid reference ID" };
  }

  if (!isEnabled) {
    console.log(`Telegram posting skipped for ${type}: auto-posting disabled`);
    return { skipped: true, reason: "Auto-posting disabled" };
  }

  const existing = await TelegramPost.findOne({ type, refId }).lean();
  if (existing?.status === "posted" || existing?.status === "removed") {
    console.log(`Telegram posting skipped for ${type}: already posted`);
    return { skipped: true, reason: "Already posted", post: existing };
  }

  const { data: settings } = await getEffectiveSettings();
  const channelId = String(settings.publicChannelId || "").trim();

  try {
    console.log(`Telegram posting started for ${type}`);
    const message = await formatter();
    let telegramMessageId = null;

    if (message.imageUrl) {
      try {
        if (resolveLocalAssetPath(message.imageUrl)) {
          console.log(`Telegram photo post selected with local image ${resolveLocalAssetPath(message.imageUrl)}`);
        } else {
          console.log(`Telegram photo post selected with image URL ${message.imageUrl}`);
        }
        telegramMessageId = await sendTelegramPhotoMessage({
          channelId,
          photo: message.imageUrl,
          caption: message.text,
          buttonText: message.buttonText,
          buttonUrl: message.buttonUrl,
        });
      } catch (photoError) {
        console.warn(`Telegram photo post failed, falling back to text: ${getTelegramErrorMessage(photoError)}`);
      }
    }

    if (!telegramMessageId) {
      telegramMessageId = await sendTelegramMessage({
        channelId,
        text: message.text,
        buttonText: message.buttonText,
        buttonUrl: message.buttonUrl,
      });
    }

    const post = await persistPostResult({
      type,
      refId,
      channelId,
      status: "posted",
      telegramMessageId,
      error: "",
    });

    console.log(`Telegram posting success for ${type} with message ID ${telegramMessageId}`);

    return { skipped: false, post };
  } catch (error) {
    const message = getTelegramErrorMessage(error);
    const post = await persistPostResult({
      type,
      refId,
      channelId,
      status: "failed",
      telegramMessageId: null,
      error: message,
    });
    console.log(`Telegram posting failed for ${type} with error ${message}`);
    throw Object.assign(new Error(message), { post });
  }
};

export const getTelegramSettings = async () => {
  const { data } = await getEffectiveSettings();
  return data;
};

export const updateTelegramSettings = async (payload = {}) => {
  const settings = await TelegramSettings.findOneAndUpdate(
    { singletonKey: "telegram" },
    {
      $set: {
        autoPostCourses: Boolean(payload.autoPostCourses),
        autoPostTeachers: Boolean(payload.autoPostTeachers),
        autoPostEvents: Boolean(payload.autoPostEvents),
      },
      $setOnInsert: {
        singletonKey: "telegram",
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );

  return mapSettingsResponse(settings);
};

export const getRecentTelegramPosts = async ({ limit = 50 } = {}) => {
  const rows = await TelegramPost.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .lean();

  return rows.map((row) => ({
    id: row._id,
    type: row.type,
    status: row.status,
    error: row.error || "",
    createdAt: row.createdAt,
    telegramMessageId: row.telegramMessageId || null,
    channelId: row.channelId || "",
    refId: row.refId,
  }));
};

export const sendTelegramContactNotification = async ({
  id,
  name,
  contact,
  subject,
  message,
  createdAt,
}) => {
  const channelId = await resolveSupportChatId();
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token || !channelId) {
    return {
      skipped: true,
      reason: !token
        ? "TELEGRAM_BOT_TOKEN is not configured"
        : "TELEGRAM_SUPPORT_CHAT_ID is not configured",
    };
  }

  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Just now";

  const safeName = escapeHtml(name || "Unknown");
  const safeContact = escapeHtml(contact || "-");
  const safeSubject = escapeHtml(subject || "-");
  const safeMessage = escapeHtml(compactText(message || "", 3200));
  const normalizedContact = String(contact || "").trim();
  const contactDigits = (normalizedContact.match(PHONE_DIGIT_PATTERN) || []).join("");
  const hasPhoneContact = contactDigits.length >= 8;
  const actionButtons = [];

  if (hasPhoneContact) {
    actionButtons.push({
      text: "Open WhatsApp",
      url: `https://wa.me/${contactDigits}`,
    });
  }

  const text = joinMessageLines([
    "📩 <b>New Contact Message</b>",
    "━━━━━━━━━━━━━━",
    "",
    "👤 <b>Sender</b>",
    `• <b>Name:</b> ${safeName}`,
    `• <b>Contact:</b> ${safeContact}`,
    `• <b>Time:</b> ${escapeHtml(createdLabel)}`,
    id ? `<b>ID:</b> <code>${escapeHtml(String(id))}</code>` : "",
    "",
    "📝 <b>Subject</b>",
    safeSubject,
    "",
    "💬 <b>Message</b>",
    safeMessage,
    "",
    "━━━━━━━━━━━━━━",
    "Reply directly to the user using the contact above.",
  ]);

  const payload = {
    chat_id: channelId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: actionButtons.length
      ? {
          inline_keyboard: [actionButtons],
        }
      : undefined,
  };

  const response = await axios.post(
    `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
    payload,
  );
  const telegramMessageId = Number(response?.data?.result?.message_id || 0);

  return {
    skipped: false,
    channelId,
    telegramMessageId,
  };
};

export const removeTelegramPostByTypeAndRef = async (type, refId, options = {}) => {
  const preserveHistory = Boolean(options.preserveHistory);
  if (!refId || !mongoose.isValidObjectId(String(refId))) {
    return { skipped: true, reason: "Invalid reference ID" };
  }

  const post = await TelegramPost.findOne({ type, refId });
  if (!post) {
    return { skipped: true, reason: "Post record not found" };
  }

  if (!post.telegramMessageId || !String(post.channelId || "").trim()) {
    if (preserveHistory) {
      post.status = "removed";
      post.error = "";
      post.telegramMessageId = null;
      post.channelId = "";
      await post.save();
      return { skipped: false, removed: true, preserved: true, reason: "Post history preserved without Telegram delete" };
    }

    await post.deleteOne();
    return { skipped: false, removed: true, reason: "Post record cleaned without Telegram delete" };
  }

  try {
    await deleteTelegramMessage({
      channelId: post.channelId,
      telegramMessageId: post.telegramMessageId,
    });
    if (preserveHistory) {
      post.status = "removed";
      post.error = "";
      post.telegramMessageId = null;
      post.channelId = "";
      await post.save();
      return { skipped: false, removed: true, preserved: true };
    }

    await post.deleteOne();
    return { skipped: false, removed: true };
  } catch (error) {
    post.status = "failed";
    post.error = getTelegramErrorMessage(error);
    await post.save();
    throw error;
  }
};

export const sendTelegramTestPost = async () => {
  const settings = await getTelegramSettings();
  const frontendUrl = resolveFrontendUrl() || "https://edutech.study";
  const channelName = settings.publicChannelUsername
    ? `@${String(settings.publicChannelUsername).replace(/^@+/, "")}`
    : settings.publicChannelId || "your Telegram channel";

  const telegramMessageId = await sendTelegramMessage({
    channelId: settings.publicChannelId,
    text: [
      "📢 <b>EduTech Telegram Test Post</b>",
      "",
      `Your bot is connected and can post to <b>${escapeHtml(channelName)}</b>.`,
      "",
      "You can now enable automatic announcements for new courses, approved teachers, and future events.",
    ].join("\n"),
    buttonText: "Open EduTech",
    buttonUrl: frontendUrl,
  });

  return {
    success: true,
    telegramMessageId,
    channelId: settings.publicChannelId,
  };
};

export const postNewCourse = async (course = {}) => {
  const settings = await getTelegramSettings();
  const frontendUrl = resolveFrontendUrl() || "https://edutech.study";

  return announceEntity({
    type: "course",
    refId: course?._id || course?.id,
    isEnabled: settings.autoPostCourses,
    formatter: async () => {
      const teacherName = await resolveCourseTeacherName(course);
      const courseTitle = String(course?.title || "Course").trim();
      const courseUrl = `${frontendUrl}${buildCoursePath(course)}`;
      const sessionsPerWeek = resolveCourseSessionsPerWeek(course);
      return {
        text: joinMessageLines([
          "🎓 <b>New Course at EduTech Online Academy</b>",
          "",
          `📚 <b>Course:</b> ${escapeHtml(courseTitle)}`,
          `👨‍🏫 <b>Teacher:</b> ${escapeHtml(teacherName)}`,
          `💰 <b>Price:</b> ${escapeHtml(resolvePriceLabel(course))}`,
          `🗓 <b>Start Date:</b> ${escapeHtml(formatCourseStartDateLabel(course?.startDate))}`,
          `⏰ <b>Learning Time:</b> ${escapeHtml(resolveCourseLearningTime(course))}`,
          `📅 <b>Sessions / Week:</b> ${escapeHtml(sessionsPerWeek > 0 ? String(sessionsPerWeek) : "TBA")}`,
          "",
          `📝 <b>About:</b> ${escapeHtml(resolveCourseDescription(course))}`,
        ]),
        buttonText: "View Course",
        buttonUrl: courseUrl,
        imageUrl: course?.thumbnail || "",
      };
    },
  });
};

export const postNewTeacher = async (teacher = {}) => {
  const settings = await getTelegramSettings();
  const frontendUrl = resolveFrontendUrl() || "https://edutech.study";

  return announceEntity({
    type: "teacher",
    refId: teacher?._id || teacher?.id,
    isEnabled: settings.autoPostTeachers,
    formatter: async () => {
      const fullTeacher = await resolveTeacherPostEntity(teacher);
      const teacherUrl = `${frontendUrl}${buildTeacherPath(fullTeacher)}`;
      return {
        text: joinMessageLines([
          "👨‍🏫 <b>New Teacher at EduTech Online Academy</b>",
          "",
          `👤 <b>Name:</b> ${escapeHtml(fullTeacher?.name || "Teacher")}`,
          `📘 <b>Specialty:</b> ${escapeHtml(resolveTeacherSubject(fullTeacher))}`,
          "",
          `📝 <b>About:</b> ${escapeHtml(resolveTeacherDescription(fullTeacher))}`,
        ]),
        buttonText: "View Teacher",
        buttonUrl: teacherUrl,
        imageUrl: fullTeacher?.avatar || "",
      };
    },
  });
};

export const postNewEvent = async (event = {}) => {
  const settings = await getTelegramSettings();
  const frontendUrl = resolveFrontendUrl() || "https://edutech.study";

  return announceEntity({
    type: "event",
    refId: event?._id || event?.id,
    isEnabled: settings.autoPostEvents,
    formatter: async () => {
      const dateLabel = String(event?.date || event?.startDate || event?.startsAt || "TBA").trim();
      const locationLabel = String(event?.location || event?.venue || "").trim() || "Online";
      const eventUrl = `${frontendUrl}${buildEventPath(event)}`;
      return {
        text: joinMessageLines([
          "📢 <b>New Event at EduTech Online Academy</b>",
          "",
          `🏷 <b>Title:</b> ${escapeHtml(event?.title || "Event")}`,
          `🗓 <b>Date:</b> ${escapeHtml(dateLabel)}`,
          `📍 <b>Location:</b> ${escapeHtml(locationLabel)}`,
        ]),
        buttonText: "View Event",
        buttonUrl: eventUrl,
      };
    },
  });
};

export const triggerTelegramCourseAnnouncement = (course) => {
  postNewCourse(course).catch((error) => {
    console.warn(`Telegram course announcement failed: ${error.message}`);
  });
};

export const syncTelegramCourseAnnouncement = async (course = {}) => {
  const refId = course?._id || course?.id;
  if (!refId || !mongoose.isValidObjectId(String(refId))) {
    return { skipped: true, reason: "Invalid reference ID" };
  }

  const settings = await getTelegramSettings();
  const existing = await TelegramPost.findOne({ type: "course", refId }).lean();

  if (!existing && !settings.autoPostCourses) {
    return { skipped: true, reason: "Auto-posting disabled and no existing Telegram post found" };
  }

  if (existing) {
    await removeTelegramPostByTypeAndRef("course", refId);
  }

  return postNewCourse(course);
};

export const triggerTelegramTeacherAnnouncement = (teacher) => {
  postNewTeacher(teacher).catch((error) => {
    console.warn(`Telegram teacher announcement failed: ${error.message}`);
  });
};

export const triggerTelegramEventAnnouncement = (event) => {
  postNewEvent(event).catch((error) => {
    console.warn(`Telegram event announcement failed: ${error.message}`);
  });
};

export const triggerTelegramPostRemoval = (type, refId, options = {}) => {
  removeTelegramPostByTypeAndRef(type, refId, options).catch((error) => {
    console.warn(`Telegram ${type} post removal failed: ${error.message}`);
  });
};

export const hydrateCourseForTelegram = async (courseId) => {
  if (!courseId || !mongoose.isValidObjectId(String(courseId))) return null;

  return Course.findById(courseId)
    .populate("teacher", "name username")
    .populate("teacherId", "name username")
    .lean();
};
