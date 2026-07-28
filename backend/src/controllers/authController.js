import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { google } from "googleapis";
import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import AdminNotification from "../models/AdminNotification.js";
import { EmailSendError, sendOtpEmail } from "../utils/Email.js";
import { generateOtp, hashOtp, getOtpExpiryDate } from "../utils/otp.js";
import { blockTeacherIfContractExpired } from "../utils/teacherContract.js";
import {
  extractBankPaymentSubmission,
  getNormalizedBankPaymentDisplay,
  hasUsableBankPaymentInfo,
  validateAndNormalizeBankPaymentInfo,
} from "../utils/bankPaymentInfo.js";
import { notifyAdminTeacherApplicationReview } from "../services/webPush.service.js";
import { encodeWebpUnderLimit } from "../utils/imageCompression.js";
import { normalizeYouTubeUrl } from "../utils/youtubeUrl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarDirectory = path.resolve(__dirname, "../../uploads/avatars");
const teacherCvDirectory = path.resolve(__dirname, "../../uploads/teacher-cv");
const teacherCertificatesDirectory = path.resolve(
  __dirname,
  "../../uploads/teacher-certificates",
);
const AVATAR_UPLOAD_MAX_BYTES = 500 * 1024;
const TEACHER_CV_MAX_BYTES = 2 * 1024 * 1024;
const TEACHER_CERTIFICATE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const TEACHER_CERTIFICATES_TOTAL_MAX_BYTES = 5 * 1024 * 1024;
const hasPdfSignature = (file) =>
  Buffer.isBuffer(file?.buffer) &&
  file.buffer.length >= 5 &&
  file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";

const generateToken = (id, role, tokenVersion = 0) => {
  return jwt.sign({ id, role, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const USERNAME_MAX_LENGTH = 20;
const GOOGLE_STUDENT_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
const GOOGLE_STUDENT_STATE_TTL = "10m";
const GOOGLE_STUDENT_EXCHANGE_TTL = "5m";
const STUDENT_GOOGLE_REDIRECT_ENV = "GOOGLE_STUDENT_REDIRECT_URI";
const OTP_TERMINAL_FAILURE_STATUSES = ["bounced", "failed", "suppressed", "complained"];
const OTP_NON_USABLE_STATUSES = [...OTP_TERMINAL_FAILURE_STATUSES];
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_EMAIL_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_IP_REQUESTS_PER_WINDOW = 20;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 120 * 1000;
const OTP_DELIVERY_ERROR_MESSAGE =
  "We could not send OTP to this email. Please check your email address or use another email.";

class OAuthHttpError extends Error {
  constructor(message, status = 400, code = "OAUTH_ERROR") {
    super(message);
    this.name = "OAuthHttpError";
    this.status = status;
    this.code = code;
  }
}

const getHexChunk = (value, size = 8) => {
  const hex = String(value || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
  return hex.slice(-size).padStart(size, "0");
};

const makeStudentId = (userId, attempt = 0) => {
  const year = new Date().getFullYear();
  const baseChunk = getHexChunk(userId, 8);
  if (attempt === 0) return `EDU-${year}-${baseChunk}`;
  return `EDU-${year}-${baseChunk}-${attempt}`;
};

const generateUniqueStudentId = async (userId) => {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = makeStudentId(userId, attempt);
    const exists = await User.exists({
      studentId: candidate,
      _id: { $ne: userId },
    });
    if (!exists) return candidate;
  }
  throw new Error("Unable to generate unique student ID");
};

const ensureStudentIdForUser = async (user) => {
  if (!user || user.role !== "student") return false;
  if (typeof user.studentId === "string" && user.studentId.trim()) return false;

  user.studentId = await generateUniqueStudentId(user._id);
  return true;
};

const normalizeText = (value) => {
  if (typeof value !== "string") return value;
  return value.trim();
};

const normalizeLocaleDigits = (value = "") =>
  String(value || "").replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return char;
  });

const matchPasswordInput = async (user, password = "") => {
  const rawPassword = String(password ?? "");
  if (await user.matchPassword(rawPassword)) return true;

  const normalizedPassword = normalizeLocaleDigits(rawPassword);
  if (normalizedPassword !== rawPassword && await user.matchPassword(normalizedPassword)) {
    return true;
  }

  const trimmedPassword = normalizedPassword.trim();
  if (trimmedPassword !== normalizedPassword && await user.matchPassword(trimmedPassword)) {
    return true;
  }

  return false;
};

const normalizeAsciiSegment = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, ".");

const buildUsernameBase = (firstName, lastName) => {
  const first = normalizeAsciiSegment(firstName);
  const last = normalizeAsciiSegment(lastName);
  const joined = [first, last].filter(Boolean).join(".");
  const collapsed = joined
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");

  let base = collapsed || "student";
  if (!/^[a-z]/.test(base)) {
    base = `u.${base}`.replace(/\.{2,}/g, ".");
  }

  return base.slice(0, USERNAME_MAX_LENGTH).replace(/[._-]+$/g, "") || "student";
};

const buildUsernameWithSuffix = (base, suffix) => {
  if (!suffix) return base;
  const safeSuffix = String(suffix).replace(/[^0-9]/g, "");
  if (!safeSuffix) return base;
  const maxBaseLength = Math.max(1, USERNAME_MAX_LENGTH - (safeSuffix.length + 1));
  const trimmedBase = base.slice(0, maxBaseLength).replace(/[._-]+$/g, "") || "student";
  return `${trimmedBase}.${safeSuffix}`;
};

const generateUniqueUsername = async (firstName, lastName, excludeUserId = null) => {
  const base = buildUsernameBase(firstName, lastName);
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildUsernameWithSuffix(base, attempt === 0 ? "" : String(attempt));
    const query = { username: candidate };
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const exists = await User.exists(query);
    if (!exists) return candidate;
  }

  const tail = String(Date.now()).slice(-6);
  return buildUsernameWithSuffix(base, tail);
};

const getNameInitial = (user) => {
  const candidate = `${user?.name || ""}`.trim();
  if (!candidate) return "S";
  return candidate[0].toUpperCase();
};

const buildAvatarUrl = (req, avatar) => {
  if (!avatar) return "";
  if (/^https?:\/\//i.test(avatar) || avatar.startsWith("data:image/")) {
    return avatar;
  }
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${avatar.startsWith("/") ? avatar : `/${avatar}`}`;
};

const publicUserPayload = (req, user, includeToken = false) => {
  const approvedBankInfo = getNormalizedBankPaymentDisplay(user.bankPaymentInfo || {});
  const storedBankReviewStatus = String(user.bankPaymentReview?.status || "not_submitted");
  const pendingBankInfo = getNormalizedBankPaymentDisplay(
    user.bankPaymentReview?.pendingInfo || {},
  );
  const hasLegacyApprovedBankInfo = Object.values(approvedBankInfo).some((value) =>
    String(value || "").trim(),
  );
  const effectiveBankReviewStatus =
    ["pending", "rejected"].includes(storedBankReviewStatus) &&
    !hasUsableBankPaymentInfo(pendingBankInfo)
      ? "not_submitted"
      : storedBankReviewStatus === "not_submitted" && hasLegacyApprovedBankInfo
        ? "approved"
        : storedBankReviewStatus;
  const payload = {
    _id: user._id,
    name: user.name,
    firstNameFa: user.firstNameFa,
    lastNameFa: user.lastNameFa,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isEmailVerified: user.isEmailVerified,
    avatar: buildAvatarUrl(req, user.avatar),
    avatarInitial: getNameInitial(user),
    studentId: user.studentId || "",
    username: user.username || "",
    birthDate: user.birthDate || "",
    gender: user.gender || "",
    country: user.country || "",
    city: user.city || "",
    address: user.address || "",
    postalCode: user.postalCode || "",
    gradeLevel: user.gradeLevel || "",
    schoolName: user.schoolName || "",
    preferredLanguage: user.preferredLanguage || "",
    timezone: user.timezone || "",
    parentName: user.parentName || "",
    parentPhone: user.parentPhone || "",
    emergencyContactName: user.emergencyContactName || "",
    emergencyContactPhone: user.emergencyContactPhone || "",
    bio: user.bio || "",
    socialLinks: {
      linkedin: user.socialLinks?.linkedin || "",
      youtube: user.socialLinks?.youtube || "",
      instagram: user.socialLinks?.instagram || "",
      facebook: user.socialLinks?.facebook || "",
      whatsapp: user.socialLinks?.whatsapp || "",
      twitter: user.socialLinks?.twitter || "",
      github: user.socialLinks?.github || "",
    },
    bankPaymentInfo: approvedBankInfo,
    bankPaymentReview: {
      status: effectiveBankReviewStatus,
      pendingInfo: pendingBankInfo,
      submittedAt: user.bankPaymentReview?.submittedAt || null,
      reviewedAt: user.bankPaymentReview?.reviewedAt || null,
      reviewedBy: user.bankPaymentReview?.reviewedBy || null,
      reviewNote: user.bankPaymentReview?.reviewNote || "",
    },
    teacherApplication: {
      status: user.teacherApplication?.status || "draft",
      submittedAt: user.teacherApplication?.submittedAt || null,
      reviewedAt: user.teacherApplication?.reviewedAt || null,
      reviewedBy: user.teacherApplication?.reviewedBy || null,
      reviewNote: user.teacherApplication?.reviewNote || "",
      professionalTitle: user.teacherApplication?.professionalTitle || "",
      yearsExperience: Number(user.teacherApplication?.yearsExperience || 0),
      education: user.teacherApplication?.education || "",
      expertiseAreas: Array.isArray(user.teacherApplication?.expertiseAreas)
        ? user.teacherApplication.expertiseAreas
        : [],
      teachingLevels: Array.isArray(user.teacherApplication?.teachingLevels)
        ? user.teacherApplication.teachingLevels
        : [],
      certifications: Array.isArray(user.teacherApplication?.certifications)
        ? user.teacherApplication.certifications
        : [],
      languages: Array.isArray(user.teacherApplication?.languages)
        ? user.teacherApplication.languages
        : [],
      skillRatings: Array.isArray(user.teacherApplication?.skillRatings)
        ? user.teacherApplication.skillRatings.map((item) => ({
            name: String(item?.name || "").trim(),
            percentage: Number(item?.percentage || 0),
          }))
        : [],
      portfolioUrl: user.teacherApplication?.portfolioUrl || "",
      cvUrl: user.teacherApplication?.cvUrl || "",
      certificatesFileUrl: user.teacherApplication?.certificatesFileUrl || "",
      introVideoUrl: user.teacherApplication?.introVideoUrl || "",
      courseIntroVideoUrls: Array.isArray(user.teacherApplication?.courseIntroVideoUrls)
        ? user.teacherApplication.courseIntroVideoUrls.filter(Boolean)
        : [],
      nationalId: user.teacherApplication?.nationalId || "",
      availableHoursPerWeek: Number(user.teacherApplication?.availableHoursPerWeek || 0),
      expectedMonthlySalaryAfn: Number(user.teacherApplication?.expectedMonthlySalaryAfn || 0),
      motivation: user.teacherApplication?.motivation || "",
    },
    notifications: {
      course: user.notifications?.course ?? true,
      assignments: user.notifications?.assignments ?? true,
      payments: user.notifications?.payments ?? true,
      news: user.notifications?.news ?? false,
      important: user.notifications?.important ?? true,
    },
  };

  if (includeToken) {
    payload.token = generateToken(user._id, user.role, user.tokenVersion);
  }
  return payload;
};

const registerSchema = Joi.object({
  name: Joi.string().trim().required(),
  lastName: Joi.string().trim().required(),
  email: Joi.string().email().trim().lowercase().required(),
  phone: Joi.string().trim().required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().required(),
});

const strongPasswordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[a-z]/, "lowercase letter")
  .pattern(/[A-Z]/, "uppercase letter")
  .pattern(/[0-9]/, "number")
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.name":
      "Password must include an uppercase letter, a lowercase letter, and a number",
  });

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: strongPasswordSchema,
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "New password and confirmation do not match",
    "any.required": "Confirm password is required",
  }),
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});

const passwordResetVerifySchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required().messages({
    "string.pattern.base": "OTP must be a 6 digit code",
    "any.required": "OTP is required",
  }),
});

const passwordResetSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  resetToken: Joi.string().pattern(/^[a-f0-9]{64}$/i).required(),
  newPassword: strongPasswordSchema,
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "New password and confirmation do not match",
    "any.required": "Confirm password is required",
  }),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.pattern.base": "OTP must be a 6 digit code",
      "any.required": "OTP is required",
    }),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(3).max(120),
  firstNameFa: Joi.string().trim().max(120).allow(""),
  lastNameFa: Joi.string().trim().max(120).allow(""),
  email: Joi.string().email().trim().lowercase(),
  phone: Joi.string().trim().min(8).max(20).allow(""),
  birthDate: Joi.string().trim().max(30).allow(""),
  gender: Joi.string().trim().max(30).allow(""),
  country: Joi.string().trim().max(120).allow(""),
  city: Joi.string().trim().max(120).allow(""),
  address: Joi.string().trim().max(300).allow(""),
  postalCode: Joi.string().trim().max(40).allow(""),
  gradeLevel: Joi.string().trim().max(80).allow(""),
  schoolName: Joi.string().trim().max(160).allow(""),
  preferredLanguage: Joi.string().trim().max(60).allow(""),
  timezone: Joi.string().trim().max(80).allow(""),
  parentName: Joi.string().trim().max(120).allow(""),
  parentPhone: Joi.string().trim().max(20).allow(""),
  emergencyContactName: Joi.string().trim().max(120).allow(""),
  emergencyContactPhone: Joi.string().trim().max(20).allow(""),
  bio: Joi.string().trim().max(1200).allow(""),
  socialLinks: Joi.object({
    linkedin: Joi.string().trim().max(250).allow(""),
    youtube: Joi.string().trim().max(250).allow(""),
    instagram: Joi.string().trim().max(250).allow(""),
    facebook: Joi.string().trim().max(250).allow(""),
    whatsapp: Joi.string().trim().max(250).allow(""),
    twitter: Joi.string().trim().max(250).allow(""),
    github: Joi.string().trim().max(250).allow(""),
  }),
  bankPaymentInfo: Joi.object({
    country: Joi.string().trim().uppercase().valid("AF", "IR").allow(""),
    accountHolderName: Joi.string().trim().max(160).allow(""),
    bankName: Joi.string().trim().max(160).allow(""),
    accountNumber: Joi.string().trim().max(80).allow(""),
    cardNumber: Joi.string().trim().max(80).allow(""),
    iban: Joi.string().trim().max(80).allow(""),
    swiftCode: Joi.string().trim().max(20).allow(""),
    currency: Joi.string().trim().uppercase().max(3).allow(""),
    paymentNote: Joi.string().trim().max(1000).allow(""),
    note: Joi.string().trim().max(1000).allow(""),
  }).custom((value, helpers) => validateAndNormalizeBankPaymentInfo(value, helpers)),
  bankCountry: Joi.string().trim().uppercase().valid("AF", "IR").allow(""),
  bankAccountHolderName: Joi.string().trim().max(160).allow(""),
  bankBankName: Joi.string().trim().max(160).allow(""),
  bankAccountNumber: Joi.string().trim().max(80).allow(""),
  bankCardNumber: Joi.string().trim().max(80).allow(""),
  bankIban: Joi.string().trim().max(80).allow(""),
  bankSwiftCode: Joi.string().trim().max(20).allow(""),
  bankCurrency: Joi.string().trim().uppercase().max(3).allow(""),
  bankPaymentNote: Joi.string().trim().max(1000).allow(""),
  bankNote: Joi.string().trim().max(1000).allow(""),
  teacherApplication: Joi.object({
    professionalTitle: Joi.string().trim().min(3).max(120).allow(""),
    yearsExperience: Joi.number().min(0).max(80),
    education: Joi.string().trim().max(120).allow(""),
    expertiseAreas: Joi.array().items(Joi.string().trim().min(2).max(100)).max(30),
    teachingLevels: Joi.array().items(Joi.string().trim().max(60)).max(20),
    certifications: Joi.array().items(Joi.string().trim().max(300)).max(5),
    languages: Joi.array().items(Joi.string().trim().max(60)).max(20),
    skillRatings: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().min(2).max(80).required(),
          percentage: Joi.number().min(0).max(100).required(),
        }),
      )
      .max(30),
    portfolioUrl: Joi.string().trim().max(250).allow(""),
    cvUrl: Joi.string().trim().max(300).allow(""),
    certificatesFileUrl: Joi.string().trim().max(300).allow(""),
    introVideoUrl: Joi.string()
      .trim()
      .max(250)
      .allow("")
      .custom((value, helpers) => {
        if (!value) return "";
        return (
          normalizeYouTubeUrl(value) ||
          helpers.message("Intro video must be a YouTube link")
        );
      }),
    courseIntroVideoUrls: Joi.array()
      .items(
        Joi.string()
          .trim()
          .max(250)
          .custom((value, helpers) =>
            normalizeYouTubeUrl(value) ||
            helpers.message("Course introduction video must be a YouTube link"),
          ),
      )
      .max(8),
    nationalId: Joi.string().trim().max(80).allow(""),
    availableHoursPerWeek: Joi.number().min(0).max(168),
    expectedMonthlySalaryAfn: Joi.number().min(0),
    motivation: Joi.string().trim().min(30).max(1500).allow(""),
  }),
  teacherApplicationAction: Joi.string().valid("save_draft", "submit_for_review").allow(""),
  notifications: Joi.object({
    course: Joi.boolean(),
    assignments: Joi.boolean(),
    payments: Joi.boolean(),
    news: Joi.boolean(),
    important: Joi.boolean(),
  }),
  removeAvatar: Joi.boolean(),
})
  .unknown(false)
  .min(1);

const otpStatusSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});

const resendOtpSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});

const normalizeRequestIp = (req) =>
  String(
    Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"] || req.ip || "",
  )
    .split(",")[0]
    .trim();

const deliveryStatusPayload = (otpRecord = null, extra = {}) => ({
  email: otpRecord?.recipientEmail || otpRecord?.email || extra.email || "",
  emailStatus: otpRecord?.emailStatus || extra.emailStatus || "pending",
  emailStatusReason: otpRecord?.emailStatusReason || extra.emailStatusReason || "",
  resendEmailId: otpRecord?.resendEmailId || "",
  otpExpiresAt: otpRecord?.otpExpiresAt || null,
  emailStatusUpdatedAt: otpRecord?.emailStatusUpdatedAt || null,
  isUsable: Boolean(otpRecord?.isUsable),
  canVerify:
    Boolean(otpRecord?.isUsable) &&
    !OTP_NON_USABLE_STATUSES.includes(String(otpRecord?.emailStatus || "")) &&
    (!otpRecord?.otpExpiresAt || otpRecord.otpExpiresAt > new Date()),
});

const buildOtpPurposeFilter = (purpose) =>
  purpose === "registration"
    ? {
        $or: [
          { purpose: "registration" },
          { purpose: { $exists: false } },
        ],
      }
    : { purpose };

const findLatestOtpForEmail = (email, purpose = "registration") =>
  OtpVerification.findOne({
    email,
    ...buildOtpPurposeFilter(purpose),
  }).sort({ createdAt: -1 });

const findLatestUsableOtpForEmail = (email, purpose = "registration") =>
  OtpVerification.findOne({
    email,
    ...buildOtpPurposeFilter(purpose),
    isUsable: true,
    otpExpiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

const markUserEmailBlocked = async (email, reason = "suppressed") => {
  await User.updateOne(
    { email },
    {
      $set: {
        emailBlocked: true,
        emailBlockReason: reason,
        emailBlockedAt: new Date(),
      },
    },
  );
};

const clearUserEmailBlock = (user) => {
  if (!user) return;
  user.emailBlocked = false;
  user.emailBlockReason = "";
  user.emailBlockedAt = null;
};

const enforceOtpRequestLimits = async ({
  email,
  ip,
  isResend = false,
  purpose = "registration",
}) => {
  const since = new Date(Date.now() - OTP_EMAIL_WINDOW_MS);
  const [emailCount, ipCount, latestOtp] = await Promise.all([
    OtpVerification.countDocuments({ email, createdAt: { $gte: since } }),
    ip
      ? OtpVerification.countDocuments({ requestIp: ip, createdAt: { $gte: since } })
      : Promise.resolve(0),
    findLatestOtpForEmail(email, purpose),
  ]);

  if (emailCount >= OTP_MAX_EMAIL_REQUESTS_PER_WINDOW) {
    const error = new Error("Too many OTP requests for this email. Please try again later.");
    error.status = 429;
    throw error;
  }

  if (ip && ipCount >= OTP_MAX_IP_REQUESTS_PER_WINDOW) {
    const error = new Error("Too many OTP requests from this network. Please try again later.");
    error.status = 429;
    throw error;
  }

  if (isResend && latestOtp?.lastRequestedAt) {
    const elapsed = Date.now() - new Date(latestOtp.lastRequestedAt).getTime();
    const cooldownMs =
      purpose === "password_reset"
        ? PASSWORD_RESET_RESEND_COOLDOWN_MS
        : OTP_RESEND_COOLDOWN_MS;
    if (Number.isFinite(elapsed) && elapsed < cooldownMs) {
      const error = new Error("Please wait before requesting another OTP.");
      error.status = 429;
      throw error;
    }
  }
};

const createAndSendOtp = async ({
  user,
  req,
  forceNew = true,
  purpose = "registration",
}) => {
  if (!forceNew) {
    const currentOtp = await findLatestUsableOtpForEmail(user.email, purpose);
    if (
      currentOtp &&
      ["pending", "sent", "delivered"].includes(currentOtp.emailStatus) &&
      currentOtp.otpExpiresAt > new Date()
    ) {
      return currentOtp;
    }
  }

  if (user.emailBlocked && user.emailBlockReason === "suppressed") {
    const error = new Error(OTP_DELIVERY_ERROR_MESSAGE);
    error.status = 400;
    error.code = "OTP_EMAIL_SUPPRESSED";
    error.emailStatus = "suppressed";
    throw error;
  }

  const ip = normalizeRequestIp(req);
  await enforceOtpRequestLimits({
    email: user.email,
    ip,
    isResend: forceNew,
    purpose,
  });

  await OtpVerification.updateMany(
    {
      email: user.email,
      ...buildOtpPurposeFilter(purpose),
      isUsable: true,
    },
    { $set: { isUsable: false, emailStatusUpdatedAt: new Date() } },
  );

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = getOtpExpiryDate();
  const otpRecord = await OtpVerification.create({
    purpose,
    userId: user._id,
    email: user.email,
    recipientEmail: user.email,
    otpHash,
    otpExpiresAt,
    emailStatus: "pending",
    emailStatusUpdatedAt: new Date(),
    isUsable: true,
    requestIp: ip,
    lastRequestedAt: new Date(),
  });

  if (purpose === "registration") {
    user.emailOtpHash = otpHash;
    user.emailOtpExpiresAt = otpExpiresAt;
    user.emailOtpAttempts = 0;
  }
  clearUserEmailBlock(user);
  await user.save();

  try {
    const sendResult = await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
      purpose,
    });
    otpRecord.resendEmailId = sendResult?.id || sendResult?.data?.id || "";
    otpRecord.emailStatus = "sent";
    otpRecord.emailStatusReason = "";
    otpRecord.emailStatusUpdatedAt = new Date();
    await otpRecord.save();
    return otpRecord;
  } catch (error) {
    const status = error instanceof EmailSendError ? error.status : "failed";
    otpRecord.emailStatus = status || "failed";
    otpRecord.emailStatusReason = error?.reason || error?.message || "Failed to send OTP email";
    otpRecord.emailStatusUpdatedAt = new Date();
    otpRecord.isUsable = false;
    await otpRecord.save();

    if (otpRecord.emailStatus === "suppressed") {
      await markUserEmailBlocked(user.email, "suppressed");
    }

    const responseError = new Error(
      OTP_TERMINAL_FAILURE_STATUSES.includes(otpRecord.emailStatus)
        ? OTP_DELIVERY_ERROR_MESSAGE
        : error?.message || "Failed to send OTP email",
    );
    responseError.status = 400;
    responseError.code = error?.code || "OTP_EMAIL_SEND_FAILED";
    responseError.emailStatus = otpRecord.emailStatus;
    responseError.emailStatusReason = otpRecord.emailStatusReason;
    throw responseError;
  }
};

const sendOtpErrorResponse = (res, error) => {
  const statusCode = error?.status || 500;
  return res.status(statusCode).json({
    code: error?.code || "OTP_EMAIL_SEND_FAILED",
    message: error?.message || "Failed to send OTP email",
    emailStatus: error?.emailStatus || "failed",
    emailStatusReason: error?.emailStatusReason || error?.message || "",
  });
};

const removeOldAvatarIfLocal = async (avatarPath) => {
  if (!avatarPath || !avatarPath.startsWith("/uploads/avatars/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${avatarPath.replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};

const saveAvatarFromBuffer = async (userId, fileBuffer) => {
  await fs.mkdir(avatarDirectory, { recursive: true });
  const filename = `avatar-${userId}-${Date.now()}.webp`;
  const filepath = path.join(avatarDirectory, filename);

  const optimizedBuffer = await encodeWebpUnderLimit(fileBuffer, {
    width: 512,
    height: 512,
    maxBytes: 350 * 1024,
    initialQuality: 80,
    fit: "inside",
    position: "centre",
    withoutEnlargement: true,
  });
  await fs.writeFile(filepath, optimizedBuffer);

  return `/uploads/avatars/${filename}`;
};

const saveTeacherCvFromBuffer = async (userId, fileBuffer) => {
  await fs.mkdir(teacherCvDirectory, { recursive: true });
  const filename = `teacher-cv-${userId}-${Date.now()}.pdf`;
  const filepath = path.join(teacherCvDirectory, filename);
  await fs.writeFile(filepath, fileBuffer);
  return `/uploads/teacher-cv/${filename}`;
};

const removeOldTeacherCvIfLocal = async (cvPath) => {
  if (!cvPath || !cvPath.startsWith("/uploads/teacher-cv/")) return;
  const oldFilePath = path.resolve(
    __dirname,
    `../../${String(cvPath).replace(/^\//, "")}`,
  );
  await fs.unlink(oldFilePath).catch(() => {});
};

const saveTeacherCertificateFromBuffer = async (userId, fileBuffer, index = 0) => {
  await fs.mkdir(teacherCertificatesDirectory, { recursive: true });
  const filename = `teacher-certificate-${userId}-${Date.now()}-${index}.pdf`;
  const filepath = path.join(teacherCertificatesDirectory, filename);
  await fs.writeFile(filepath, fileBuffer);
  return `/uploads/teacher-certificates/${filename}`;
};

const removeOldTeacherCertificateIfLocal = async (certificatePath) => {
  if (!certificatePath || !certificatePath.startsWith("/uploads/teacher-certificates/")) return;
  const oldFilePath = path.resolve(
    __dirname,
    `../../${String(certificatePath).replace(/^\//, "")}`,
  );
  await fs.unlink(oldFilePath).catch(() => {});
};

const parsePossiblyJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeOrigin = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const getFirstClientOrigin = () => {
  const raw = String(process.env.CLIENT_ORIGIN || "").trim();
  if (!raw) return "";
  const first = raw
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .find(Boolean);
  return first || "";
};

const parseRoleRedirectMap = () => {
  const raw = String(process.env.GOOGLE_OAUTH_RESULT_REDIRECTS || "").trim();
  if (!raw) return {};

  return raw.split(/[;,]/).reduce((acc, chunk) => {
    const entry = String(chunk || "").trim();
    if (!entry) return acc;

    const separatorIndex = entry.indexOf("=");
    if (separatorIndex < 1) return acc;

    const key = entry.slice(0, separatorIndex).trim().toLowerCase();
    const value = normalizeOrigin(entry.slice(separatorIndex + 1));
    if (!key || !value) return acc;

    acc[key] = value;
    return acc;
  }, {});
};

const getRedirectFromRoleMap = ({ role, mode }) => {
  const redirects = parseRoleRedirectMap();
  const roleKey = String(role || "").trim().toLowerCase();
  const modeKey = normalizeGoogleMode(mode);
  if (!roleKey) return "";

  const modeSpecificKey = `${roleKey}_${modeKey}`;
  return redirects[modeSpecificKey] || redirects[roleKey] || "";
};

const normalizeGoogleMode = (mode = "") => {
  const value = String(mode || "").trim().toLowerCase();
  if (value === "register" || value === "signup") return "register";
  return "login";
};

const getGoogleErrorPayload = (error) => {
  const responseData = error?.response?.data;
  const rootError = String(responseData?.error || "").trim();
  const message = String(responseData?.error_description || error?.message || "").trim();
  const combined = `${rootError} ${message}`.toLowerCase();

  return {
    rootError,
    message,
    combined,
  };
};

const isRedirectUriMismatchError = (error) => {
  const payload = getGoogleErrorPayload(error);
  return payload.combined.includes("redirect_uri_mismatch");
};

const normalizeGoogleProfile = (profile = {}) => {
  return {
    id: String(profile?.id || "").trim(),
    name: String(profile?.name || "").trim(),
    email: String(profile?.email || "")
      .trim()
      .toLowerCase(),
    picture: String(profile?.picture || "").trim(),
    givenName: String(profile?.given_name || "").trim(),
    familyName: String(profile?.family_name || "").trim(),
  };
};

const getGoogleStudentOAuthEnv = () => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.GOOGLE_STUDENT_REDIRECT_URI || "").trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new OAuthHttpError(
      `Missing Google OAuth configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ${STUDENT_GOOGLE_REDIRECT_ENV} are required`,
      500,
      "GOOGLE_OAUTH_ENV_MISSING",
    );
  }

  return { clientId, clientSecret, redirectUri };
};

const buildGoogleStudentOAuthClient = () => {
  const { clientId, clientSecret, redirectUri } = getGoogleStudentOAuthEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const signGoogleStudentState = ({ mode }) => {
  if (!process.env.JWT_SECRET) {
    throw new OAuthHttpError("JWT secret is missing", 500, "JWT_SECRET_MISSING");
  }
  return jwt.sign(
    {
      provider: "google-student-auth",
      mode: normalizeGoogleMode(mode),
    },
    process.env.JWT_SECRET,
    { expiresIn: GOOGLE_STUDENT_STATE_TTL },
  );
};

const verifyGoogleStudentState = (state) => {
  if (!process.env.JWT_SECRET) {
    throw new OAuthHttpError("JWT secret is missing", 500, "JWT_SECRET_MISSING");
  }

  let decoded;
  try {
    decoded = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    throw new OAuthHttpError("Invalid or expired OAuth state.", 400, "INVALID_OAUTH_STATE");
  }

  if (decoded?.provider !== "google-student-auth") {
    throw new OAuthHttpError("Invalid OAuth state.", 400, "INVALID_OAUTH_STATE");
  }
  return {
    mode: normalizeGoogleMode(decoded?.mode),
  };
};

const signGoogleStudentExchangeToken = ({ userId, mode }) => {
  if (!process.env.JWT_SECRET) {
    throw new OAuthHttpError("JWT secret is missing", 500, "JWT_SECRET_MISSING");
  }
  return jwt.sign(
    {
      provider: "google-student-exchange",
      userId: String(userId),
      mode: normalizeGoogleMode(mode),
    },
    process.env.JWT_SECRET,
    { expiresIn: GOOGLE_STUDENT_EXCHANGE_TTL },
  );
};

const verifyGoogleStudentExchangeToken = (exchangeToken) => {
  if (!process.env.JWT_SECRET) {
    throw new OAuthHttpError("JWT secret is missing", 500, "JWT_SECRET_MISSING");
  }

  let decoded;
  try {
    decoded = jwt.verify(exchangeToken, process.env.JWT_SECRET);
  } catch {
    throw new OAuthHttpError("Invalid exchange token", 400, "INVALID_EXCHANGE_TOKEN");
  }

  if (decoded?.provider !== "google-student-exchange" || !decoded?.userId) {
    throw new OAuthHttpError("Invalid exchange token", 400, "INVALID_EXCHANGE_TOKEN");
  }
  return {
    userId: String(decoded.userId),
    mode: normalizeGoogleMode(decoded?.mode),
  };
};

const buildGoogleStudentResultRedirect = ({
  type,
  mode,
  exchangeToken = "",
  message = "",
}) => {
  const mapped = getRedirectFromRoleMap({ role: "student", mode });
  const base = normalizeOrigin(process.env.GOOGLE_OAUTH_RESULT_REDIRECT_BASE || "");
  const origin = getFirstClientOrigin();
  const fallbackPath = normalizeGoogleMode(mode) === "register" ? "/register" : "/login";
  const target =
    mapped ||
    (base ? `${base}${fallbackPath}` : "") ||
    (origin ? `${origin}${fallbackPath}` : "");
  if (!target) return "";

  const url = new URL(target);
  url.searchParams.set("googleAuth", type);
  if (exchangeToken) url.searchParams.set("exchange", exchangeToken);
  if (mode) url.searchParams.set("mode", normalizeGoogleMode(mode));
  if (message) url.searchParams.set("message", message);
  return url.toString();
};

const createStudentFromGoogleProfile = async ({ profile, email, googleId }) => {
  const givenName = normalizeText(profile?.givenName || "");
  const familyName = normalizeText(profile?.familyName || "");
  const localName = normalizeText(profile?.name || "");
  const firstName = givenName || localName.split(" ")[0] || "Student";
  const lastName = familyName || localName.split(" ").slice(1).join(" ") || "User";
  const fullName = `${firstName} ${lastName}`.trim();

  const username = await generateUniqueUsername(firstName, lastName);
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const avatar = String(profile?.picture || "").trim();

  const user = new User({
    name: fullName || "Student User",
    email,
    phone: "google-oauth",
    password: randomPassword,
    role: "student",
    status: "active",
    isEmailVerified: true,
    googleId: googleId || "",
    username,
    firstNameFa: firstName,
    lastNameFa: lastName,
    avatar: /^https?:\/\//i.test(avatar) ? avatar : "",
  });

  await ensureStudentIdForUser(user);
  await user.save();
  return user;
};

const findExistingUserByGoogleIdentity = async ({ googleId, email }) => {
  const conditions = [];
  if (googleId) conditions.push({ googleId });
  if (email) conditions.push({ email });
  if (!conditions.length) return null;
  return User.findOne({ $or: conditions });
};

const resolveStudentFromGoogleIdentity = async ({ googleId, email }) => {
  const user = await findExistingUserByGoogleIdentity({ googleId, email });
  if (!user) return null;

  if (user.role !== "student") {
    throw new OAuthHttpError(
      "This Google account email is already used by another role.",
      409,
      "EMAIL_USED_BY_ANOTHER_ROLE",
    );
  }

  if (user.status === "blocked") {
    throw new OAuthHttpError("Your account has been blocked.", 403, "ACCOUNT_BLOCKED");
  }

  return user;
};

const syncStudentProfileFromGoogle = async ({ user, profile, googleId }) => {
  let didMutate = false;

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    if (user.status !== "blocked") {
      user.status = "active";
    }
    didMutate = true;
  } else if (user.status === "pending_verification") {
    user.status = "active";
    didMutate = true;
  }

  if (googleId && user.googleId !== googleId) {
    user.googleId = googleId;
    didMutate = true;
  }

  if (!user.username) {
    user.username = await generateUniqueUsername(user.firstNameFa, user.lastNameFa, user._id);
    didMutate = true;
  }

  if (!user.avatar && /^https?:\/\//i.test(String(profile?.picture || "").trim())) {
    user.avatar = String(profile.picture).trim();
    didMutate = true;
  }

  const didSetStudentId = await ensureStudentIdForUser(user);
  if (didSetStudentId) didMutate = true;

  if (didMutate) await user.save();
  return user;
};

export const getStudentGoogleAuthUrl = async (req, res) => {
  try {
    const mode = normalizeGoogleMode(req.query?.mode);
    const { redirectUri } = getGoogleStudentOAuthEnv();
    const oauthClient = buildGoogleStudentOAuthClient();
    const state = signGoogleStudentState({ mode });

    console.info(`[student-google-oauth] generate auth url mode=${mode} redirect_uri=${redirectUri}`);

    const url = oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: GOOGLE_STUDENT_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    return res.json({
      message: "Google OAuth URL generated successfully",
      data: { url },
    });
  } catch (error) {
    const status = error instanceof OAuthHttpError ? error.status : 500;
    return res.status(status).json({
      code: error?.code || "GOOGLE_AUTH_URL_ERROR",
      message: error?.message || "Unable to generate Google OAuth URL",
    });
  }
};

export const handleStudentGoogleOAuthCallback = async (req, res) => {
  const modeFromQuery = normalizeGoogleMode(req.query?.mode);

  try {
    const code = String(req.query?.code || "").trim();
    const state = String(req.query?.state || "").trim();
    if (!code) {
      throw new OAuthHttpError("Missing Google authorization code.", 400, "GOOGLE_CODE_MISSING");
    }
    if (!state) {
      throw new OAuthHttpError("Missing OAuth state.", 400, "GOOGLE_STATE_MISSING");
    }

    const { mode } = verifyGoogleStudentState(state);
    const { redirectUri } = getGoogleStudentOAuthEnv();
    const oauthClient = buildGoogleStudentOAuthClient();
    console.info(
      `[student-google-oauth] exchange code mode=${mode} redirect_uri=${redirectUri}`,
    );

    const tokenResponse = await oauthClient.getToken({
      code,
      redirect_uri: redirectUri,
    });
    const tokens = tokenResponse?.tokens || {};
    if (!tokens.access_token) {
      throw new OAuthHttpError(
        "Invalid Google response: access token not received.",
        502,
        "GOOGLE_ACCESS_TOKEN_MISSING",
      );
    }

    oauthClient.setCredentials({
      access_token: tokens.access_token,
    });

    const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
    const profileResponse = await oauth2.userinfo.get();
    const profile = normalizeGoogleProfile(profileResponse?.data || {});
    const email = profile.email;
    const googleId = profile.id;

    if (!email) {
      throw new OAuthHttpError(
        "Invalid Google response: user email is missing.",
        502,
        "GOOGLE_EMAIL_MISSING",
      );
    }
    if (!googleId) {
      throw new OAuthHttpError(
        "Invalid Google response: user ID is missing.",
        502,
        "GOOGLE_PROFILE_ID_MISSING",
      );
    }

    let user = await resolveStudentFromGoogleIdentity({ googleId, email });

    if (!user) {
      if (mode === "login") {
        throw new OAuthHttpError(
          "No student account found for this Google email. Please register first.",
          404,
          "STUDENT_NOT_FOUND",
        );
      }
      user = await createStudentFromGoogleProfile({ profile, email, googleId });
    } else {
      user = await syncStudentProfileFromGoogle({ user, profile, googleId });
    }

    const exchangeToken = signGoogleStudentExchangeToken({ userId: user._id, mode });
    const successRedirect = buildGoogleStudentResultRedirect({
      type: "success",
      mode,
      exchangeToken,
    });

    if (successRedirect) {
      return res.redirect(successRedirect);
    }

    return res.json({
      message: "Google authentication completed",
      data: {
        googleAuth: "success",
        exchange: exchangeToken,
        mode,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
        },
      },
    });
  } catch (error) {
    let handledError = error;
    if (error?.code === 11000) {
      const duplicatedField = Object.keys(error?.keyPattern || {})[0] || "";
      if (duplicatedField === "email") {
        handledError = new OAuthHttpError(
          "This email is already in use by another account.",
          409,
          "EMAIL_ALREADY_IN_USE",
        );
      } else if (duplicatedField === "googleId") {
        handledError = new OAuthHttpError(
          "This Google account is already linked to another user.",
          409,
          "GOOGLE_ACCOUNT_ALREADY_LINKED",
        );
      }
    }

    if (!(error instanceof OAuthHttpError) && isRedirectUriMismatchError(error)) {
      handledError = new OAuthHttpError(
        "OAuth redirect URI mismatch. Verify GOOGLE_STUDENT_REDIRECT_URI in backend and Google Console.",
        400,
        "GOOGLE_REDIRECT_URI_MISMATCH",
      );
    }

    if (!(handledError instanceof OAuthHttpError)) {
      const googlePayload = getGoogleErrorPayload(handledError);
      if (googlePayload.rootError || googlePayload.message) {
        handledError = new OAuthHttpError(
          `Google OAuth failed: ${googlePayload.message || googlePayload.rootError}`,
          400,
          "GOOGLE_OAUTH_INVALID_RESPONSE",
        );
      } else {
        handledError = new OAuthHttpError(
          handledError?.message || "Google OAuth failed",
          400,
          handledError?.code || "GOOGLE_OAUTH_FAILED",
        );
      }
    }

    const failedRedirect = buildGoogleStudentResultRedirect({
      type: "error",
      mode: modeFromQuery,
      message: handledError.message || "Google OAuth failed",
    });
    if (failedRedirect) {
      return res.redirect(failedRedirect);
    }

    return res.status(handledError.status || 400).json({
      code: handledError.code || "GOOGLE_OAUTH_FAILED",
      message: handledError.message || "Google OAuth failed",
    });
  }
};

export const exchangeStudentGoogleAuth = async (req, res) => {
  try {
    const exchangeToken = String(req.body?.exchangeToken || "").trim();
    if (!exchangeToken) {
      return res.status(400).json({ message: "exchangeToken is required" });
    }

    const { userId } = verifyGoogleStudentExchangeToken(exchangeToken);
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "student") {
      return res.status(403).json({
        message: "This account is not allowed to login from student portal",
      });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const didSetStudentId = await ensureStudentIdForUser(user);
    if (didSetStudentId) await user.save();

    return res.json(publicUserPayload(req, user, true));
  } catch (error) {
    const status = error instanceof OAuthHttpError ? error.status : 400;
    return res.status(status).json({
      code: error?.code || "INVALID_EXCHANGE_TOKEN",
      message: error.message || "Invalid exchange token",
    });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, lastName, email, phone, password } = value;
    const userExists = await User.findOne({ email });
    const firstName = normalizeText(name);
    const familyName = normalizeText(lastName);
    const fullName = `${firstName} ${familyName}`.trim();
    const normalizedUsername = await generateUniqueUsername(
      firstName,
      familyName,
      userExists?._id || null,
    );

    if (userExists?.status === "blocked") {
      return res.status(403).json({
        code: "ACCOUNT_BLOCKED",
        message: "Your account has been blocked",
      });
    }

    if (userExists && userExists.role !== "student") {
      return res.status(400).json({
        code: "EMAIL_ALREADY_REGISTERED",
        message: "User already exists",
      });
    }

    if (userExists && userExists.isEmailVerified && userExists.status === "active") {
      return res.status(400).json({
        code: "EMAIL_ALREADY_REGISTERED",
        message: "User already exists",
      });
    }

    let user;
    if (userExists) {
      userExists.name = fullName;
      userExists.firstNameFa = firstName;
      userExists.lastNameFa = familyName;
      userExists.username = normalizedUsername;
      userExists.phone = phone;
      userExists.password = password;
      userExists.role = "student";
      userExists.status = "pending_verification";
      userExists.isEmailVerified = false;
      await ensureStudentIdForUser(userExists);
      user = await userExists.save();
    } else {
      user = new User({
        name: fullName,
        email,
        username: normalizedUsername,
        firstNameFa: firstName,
        lastNameFa: familyName,
        phone,
        password,
        role: "student",
        status: "pending_verification",
        isEmailVerified: false,
      });
      await ensureStudentIdForUser(user);
      await user.save();
    }

    const otpRecord = await createAndSendOtp({ user, req, forceNew: false });

    return res.status(201).json({
      message: "Registration started. OTP sent to your email.",
      email: user.email,
      ...deliveryStatusPayload(otpRecord),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicatedField = Object.keys(error?.keyPattern || {})[0] || "";
      if (duplicatedField === "email") {
        return res.status(400).json({
          code: "EMAIL_ALREADY_REGISTERED",
          message: "User already exists",
        });
      }
      return res.status(400).json({
        code: "DUPLICATE_KEY",
        message: "Duplicate record",
      });
    }
    if (error?.code?.startsWith("OTP_") || error?.emailStatus) {
      return sendOtpErrorResponse(res, error);
    }
    return res.status(error?.status || 500).json({ message: error.message });
  }
};

export const verifyRegisterOtp = async (req, res) => {
  try {
    const { error, value } = verifyOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, otp } = value;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }
    const latestOtpRecord = await findLatestOtpForEmail(email);
    const otpRecord =
      latestOtpRecord?.isUsable && latestOtpRecord?.otpExpiresAt > new Date()
        ? latestOtpRecord
        : null;
    if (!otpRecord && (!user.emailOtpHash || !user.emailOtpExpiresAt)) {
      return res.status(400).json({ message: "OTP not found. Please register again." });
    }
    if (latestOtpRecord && OTP_NON_USABLE_STATUSES.includes(latestOtpRecord.emailStatus)) {
      return res.status(400).json({
        code: "OTP_EMAIL_NOT_DELIVERABLE",
        message: OTP_DELIVERY_ERROR_MESSAGE,
        ...deliveryStatusPayload(latestOtpRecord),
      });
    }

    const expiresAt = otpRecord?.otpExpiresAt || user.emailOtpExpiresAt;
    if (expiresAt < new Date()) {
      if (otpRecord) {
        otpRecord.isUsable = false;
        await otpRecord.save();
      }
      return res.status(400).json({ message: "OTP expired. Please register again." });
    }
    const attempts = otpRecord?.verifyAttempts ?? user.emailOtpAttempts ?? 0;
    if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ message: "Too many wrong attempts. Please register again." });
    }

    const incomingOtpHash = hashOtp(otp);
    const expectedOtpHash = otpRecord?.otpHash || user.emailOtpHash;
    if (incomingOtpHash !== expectedOtpHash) {
      if (otpRecord) {
        otpRecord.verifyAttempts += 1;
        if (otpRecord.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
          otpRecord.isUsable = false;
        }
        await otpRecord.save();
      }
      user.emailOtpAttempts = Number(user.emailOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    user.isEmailVerified = true;
    user.status = "active";
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpAttempts = 0;
    clearUserEmailBlock(user);
    await ensureStudentIdForUser(user);
    await user.save();
    if (otpRecord) {
      otpRecord.isUsable = false;
      await otpRecord.save();
    }

    return res.json({
      message: "Email verified successfully",
      ...publicUserPayload(req, user, true),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRegisterOtpStatus = async (req, res) => {
  try {
    const { error, value } = otpStatusSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const otpRecord = await findLatestOtpForEmail(value.email);
    if (!otpRecord) {
      return res.status(404).json({
        message: "OTP status not found.",
        email: value.email,
        emailStatus: "failed",
        canVerify: false,
      });
    }

    return res.json({
      message: "OTP email status fetched successfully",
      ...deliveryStatusPayload(otpRecord, { email: value.email }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resendRegisterOtp = async (req, res) => {
  try {
    const { error, value } = resendOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findOne({ email: value.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account has been blocked" });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const otpRecord = await createAndSendOtp({ user, req, forceNew: true });
    return res.json({
      message: "OTP sent successfully.",
      ...deliveryStatusPayload(otpRecord),
    });
  } catch (error) {
    if (error?.code?.startsWith("OTP_") || error?.emailStatus || error?.status === 429) {
      return sendOtpErrorResponse(res, error);
    }
    return res.status(500).json({ message: error.message });
  }
};

export const requestTeacherPasswordReset = async (req, res) => {
  const resetRole = req.passwordResetRole === "admin" ? "admin" : "teacher";
  const roleLabel = resetRole === "admin" ? "admin" : "teacher";
  const successResponse = {
    message: `A password reset code has been sent to the ${roleLabel} email.`,
    expiresInSeconds: 600,
    resendAfterSeconds: 120,
  };

  try {
    const { error, value } = passwordResetRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findOne({
      email: value.email,
      role: resetRole,
      status: { $ne: "blocked" },
    });

    if (!user) {
      return res.status(404).json({
        code: `${resetRole.toUpperCase()}_EMAIL_NOT_FOUND`,
        message: `This email is not registered as ${resetRole === "admin" ? "an" : "a"} ${roleLabel} account.`,
      });
    }

    await createAndSendOtp({
      user,
      req,
      forceNew: true,
      purpose: "password_reset",
    });

    return res.json(successResponse);
  } catch (error) {
    if (error?.status === 429) {
      return res.status(429).json({
        message: error.message || "Too many reset requests. Please try again later.",
      });
    }

    console.warn(`${roleLabel} password reset OTP error: ${error.message}`);
    return res.status(400).json({
      message: `Unable to send a reset code to this ${roleLabel} email.`,
    });
  }
};

export const verifyTeacherPasswordResetOtp = async (req, res) => {
  const resetRole = req.passwordResetRole === "admin" ? "admin" : "teacher";
  try {
    const { error, value } = passwordResetVerifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findOne({
      email: value.email,
      role: resetRole,
      status: { $ne: "blocked" },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    const otpRecord = await findLatestOtpForEmail(
      value.email,
      "password_reset",
    );
    if (
      !otpRecord ||
      !otpRecord.isUsable ||
      otpRecord.otpExpiresAt <= new Date() ||
      OTP_NON_USABLE_STATUSES.includes(otpRecord.emailStatus)
    ) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    if (otpRecord.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many incorrect codes. Request a new code.",
      });
    }

    const incomingOtpHash = hashOtp(value.otp);
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const verifiedRecord = await OtpVerification.findOneAndUpdate(
      {
        _id: otpRecord._id,
        purpose: "password_reset",
        otpHash: incomingOtpHash,
        isUsable: true,
        verifyAttempts: { $lt: OTP_MAX_VERIFY_ATTEMPTS },
        otpExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          isUsable: false,
          verifiedAt: new Date(),
          resetTokenHash,
          resetTokenExpiresAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!verifiedRecord) {
      const attemptedRecord = await OtpVerification.findOneAndUpdate(
        {
          _id: otpRecord._id,
          isUsable: true,
          verifyAttempts: { $lt: OTP_MAX_VERIFY_ATTEMPTS },
        },
        { $inc: { verifyAttempts: 1 } },
        { returnDocument: "after" },
      );

      if (
        attemptedRecord &&
        attemptedRecord.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS
      ) {
        attemptedRecord.isUsable = false;
        await attemptedRecord.save();
      }

      return res.status(
        attemptedRecord?.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS ? 429 : 400,
      ).json({
        message:
          attemptedRecord?.verifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS
            ? "Too many incorrect codes. Request a new code."
            : "Invalid or expired verification code",
      });
    }

    return res.json({
      message: "Verification code accepted",
      resetToken,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resetTeacherPassword = async (req, res) => {
  const resetRole = req.passwordResetRole === "admin" ? "admin" : "teacher";
  try {
    const { error, value } = passwordResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(value.resetToken)
      .digest("hex");

    const resetRecord = await OtpVerification.findOne({
      email: value.email,
      purpose: "password_reset",
      resetTokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
      usedAt: null,
    }).select("+resetTokenHash");

    if (!resetRecord) {
      return res.status(400).json({
        message: "This password reset session is invalid or expired",
      });
    }

    const user = await User.findOne({
      _id: resetRecord.userId,
      email: value.email,
      role: resetRole,
      status: { $ne: "blocked" },
    });
    if (!user) {
      return res.status(400).json({
        message: "This password reset session is invalid or expired",
      });
    }

    if (await matchPasswordInput(user, value.newPassword)) {
      return res.status(400).json({
        message: "New password must be different from your current password",
      });
    }

    const consumedRecord = await OtpVerification.findOneAndUpdate(
      {
        _id: resetRecord._id,
        resetTokenHash,
        resetTokenExpiresAt: { $gt: new Date() },
        usedAt: null,
      },
      {
        $set: {
          usedAt: new Date(),
          resetTokenHash: "",
          resetTokenExpiresAt: null,
          isUsable: false,
        },
      },
      { returnDocument: "after" },
    ).select("+resetTokenHash");

    if (!consumedRecord) {
      return res.status(400).json({
        message: "This password reset session is invalid or expired",
      });
    }

    user.password = value.newPassword;
    user.passwordChangedAt = new Date();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    await OtpVerification.updateMany(
      {
        email: user.email,
        purpose: "password_reset",
        _id: { $ne: consumedRecord._id },
      },
      {
        $set: {
          isUsable: false,
          resetTokenHash: "",
          resetTokenExpiresAt: null,
        },
      },
    );

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password } = value;
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    const didExpireContract = await blockTeacherIfContractExpired(user);
    if (didExpireContract) {
      return res.status(403).json({
        message: "Your teacher account contract has expired and the account was blocked",
      });
    }
    if (user.role === "student" && !user.isEmailVerified) {
      return res.status(403).json({ message: "Please verify your email before login" });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account has been blocked" });
    }
    if (user.role === "student" && user.status !== "active") {
      return res.status(403).json({ message: "Please verify your email before login" });
    }

    const isPasswordCorrect = await matchPasswordInput(user, password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (req.allowedLoginRole && user.role !== req.allowedLoginRole) {
      return res.status(403).json({
        message: `This account is not allowed to login from ${req.allowedLoginRole} portal`,
      });
    }

    const didSetStudentId = await ensureStudentIdForUser(user);
    if (didSetStudentId) await user.save();

    return res.json(publicUserPayload(req, user, true));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const storedBankReviewStatus = String(user.bankPaymentReview?.status || "not_submitted");
    if (
      user.role === "teacher" &&
      !bankPaymentSubmission.submitted &&
      ["pending", "rejected"].includes(storedBankReviewStatus) &&
      !hasUsableBankPaymentInfo(user.bankPaymentReview?.pendingInfo || {})
    ) {
      user.bankPaymentReview = {
        status: "not_submitted",
        pendingInfo: {},
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
      };
    }

    const didSetStudentId = await ensureStudentIdForUser(user);
    if (didSetStudentId) await user.save();

    return res.json(publicUserPayload(req, user, false));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isCurrentPasswordCorrect = await matchPasswordInput(user, currentPassword);
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    return res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "username")) {
      return res.status(400).json({ message: "Username cannot be changed" });
    }

    const bankPaymentSubmission = extractBankPaymentSubmission(req.body);
    const rawBody = {
      ...req.body,
      socialLinks: parsePossiblyJson(req.body.socialLinks),
      ...(bankPaymentSubmission.submitted
        ? { bankPaymentInfo: bankPaymentSubmission.value }
        : {}),
      teacherApplication: parsePossiblyJson(req.body.teacherApplication),
      notifications: parsePossiblyJson(req.body.notifications),
      removeAvatar:
        req.body.removeAvatar === true ||
        req.body.removeAvatar === "true" ||
        req.body.removeAvatar === 1 ||
        req.body.removeAvatar === "1",
    };

    const { error, value } = updateProfileSchema.validate(rawBody, {
      abortEarly: true,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const shouldNotifyTeacherApplicationReview =
      user.role === "teacher" &&
      value.teacherApplicationAction === "submit_for_review" &&
      user.teacherApplication?.status !== "submitted";
    const shouldNotifyBankPaymentReview =
      user.role === "teacher" &&
      bankPaymentSubmission.submitted;

    if (value.email && value.email !== user.email) {
      const emailExists = await User.findOne({ email: value.email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: "Another user already uses this email" });
      }
    }

    const scalarFields = [
      "name",
      "firstNameFa",
      "lastNameFa",
      "email",
      "phone",
      "birthDate",
      "gender",
      "country",
      "city",
      "address",
      "postalCode",
      "gradeLevel",
      "schoolName",
      "preferredLanguage",
      "timezone",
      "parentName",
      "parentPhone",
      "emergencyContactName",
      "emergencyContactPhone",
      "bio",
    ];

    for (const field of scalarFields) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        user[field] = normalizeText(value[field]);
      }
    }

    if (value.socialLinks) {
      user.socialLinks = {
        linkedin: normalizeText(value.socialLinks.linkedin || ""),
        youtube: normalizeText(value.socialLinks.youtube || ""),
        instagram: normalizeText(value.socialLinks.instagram || ""),
        facebook: normalizeText(value.socialLinks.facebook || ""),
        whatsapp: normalizeText(value.socialLinks.whatsapp || ""),
        twitter: normalizeText(value.socialLinks.twitter || ""),
        github: normalizeText(value.socialLinks.github || ""),
      };
    }

    if (Object.prototype.hasOwnProperty.call(value, "bankPaymentInfo")) {
      if (user.role !== "teacher") {
        return res.status(403).json({
          message: "Bank payment details are only available for teacher accounts",
        });
      }
      const pendingInfo = validateAndNormalizeBankPaymentInfo(value.bankPaymentInfo);
      if (!hasUsableBankPaymentInfo(pendingInfo)) {
        return res.status(400).json({
          message: "Complete valid bank/card details before submitting them for review",
        });
      }
      user.bankPaymentReview = {
        ...(user.bankPaymentReview?.toObject?.() || user.bankPaymentReview || {}),
        status: "pending",
        pendingInfo,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
      };
    }

    if (value.teacherApplication || value.teacherApplicationAction) {
      if (user.role !== "teacher") {
        return res.status(403).json({
          message: "Teacher application fields are only available for teacher accounts",
        });
      }

      const existingApplication = user.teacherApplication || {};
      const incoming = value.teacherApplication || {};

      const normalizeStringArray = (rows = []) =>
        (Array.isArray(rows) ? rows : [])
          .map((item) => normalizeText(item || ""))
          .filter(Boolean);
      const normalizeSkillRatings = (rows = []) =>
        (Array.isArray(rows) ? rows : [])
          .map((item) => ({
            name: normalizeText(item?.name || ""),
            percentage: Number(item?.percentage ?? 0),
          }))
          .filter((item) => item.name && Number.isFinite(item.percentage))
          .map((item) => ({
            name: item.name,
            percentage: Math.max(0, Math.min(100, Math.round(item.percentage))),
          }));

      user.teacherApplication = {
        ...existingApplication,
        professionalTitle: normalizeText(incoming.professionalTitle ?? existingApplication.professionalTitle ?? ""),
        yearsExperience:
          incoming.yearsExperience ?? existingApplication.yearsExperience ?? 0,
        education: normalizeText(incoming.education ?? existingApplication.education ?? ""),
        expertiseAreas: normalizeStringArray(
          incoming.expertiseAreas ?? existingApplication.expertiseAreas ?? [],
        ),
        teachingLevels: normalizeStringArray(
          incoming.teachingLevels ?? existingApplication.teachingLevels ?? [],
        ),
        certifications: normalizeStringArray(
          incoming.certifications ?? existingApplication.certifications ?? [],
        ),
        languages: normalizeStringArray(
          incoming.languages ?? existingApplication.languages ?? [],
        ),
        skillRatings: normalizeSkillRatings(
          incoming.skillRatings ?? existingApplication.skillRatings ?? [],
        ),
        portfolioUrl: normalizeText(incoming.portfolioUrl ?? existingApplication.portfolioUrl ?? ""),
        cvUrl: normalizeText(incoming.cvUrl ?? existingApplication.cvUrl ?? ""),
        certificatesFileUrl: normalizeText(
          incoming.certificatesFileUrl ?? existingApplication.certificatesFileUrl ?? "",
        ),
        introVideoUrl: normalizeText(incoming.introVideoUrl ?? existingApplication.introVideoUrl ?? ""),
        courseIntroVideoUrls: normalizeStringArray(
          incoming.courseIntroVideoUrls ?? existingApplication.courseIntroVideoUrls ?? [],
        ),
        nationalId: normalizeText(incoming.nationalId ?? existingApplication.nationalId ?? ""),
        availableHoursPerWeek:
          incoming.availableHoursPerWeek ?? existingApplication.availableHoursPerWeek ?? 0,
        expectedMonthlySalaryAfn:
          incoming.expectedMonthlySalaryAfn ??
          existingApplication.expectedMonthlySalaryAfn ??
          0,
        motivation: normalizeText(incoming.motivation ?? existingApplication.motivation ?? ""),
      };

      if (value.teacherApplicationAction === "submit_for_review") {
        user.teacherApplication.status = "submitted";
        user.teacherApplication.submittedAt = new Date();
        user.teacherApplication.reviewedAt = null;
        user.teacherApplication.reviewedBy = null;
        user.teacherApplication.reviewNote = "";
      } else if (value.teacherApplicationAction === "save_draft") {
        if (user.teacherApplication.status !== "approved") {
          user.teacherApplication.status = "draft";
        }
      }
    }

    if (value.notifications) {
      user.notifications = {
        ...user.notifications,
        ...value.notifications,
      };
    }

    const avatarFile = req.files?.avatar?.[0] || null;
    const cvFile = req.files?.cvFile?.[0] || null;
    const certificateFiles = Array.isArray(req.files?.certificateFiles)
      ? req.files.certificateFiles
      : [];

    if (avatarFile && avatarFile.size > AVATAR_UPLOAD_MAX_BYTES) {
      return res.status(400).json({ message: "Avatar image must be 500KB or smaller" });
    }
    if ((cvFile || certificateFiles.length) && user.role !== "teacher") {
      return res.status(400).json({ message: "CV and certificate uploads are only available to teachers" });
    }
    if (cvFile && (cvFile.size > TEACHER_CV_MAX_BYTES || !hasPdfSignature(cvFile))) {
      return res.status(400).json({ message: "CV must be a valid PDF no larger than 2MB" });
    }
    if (
      certificateFiles.some(
        (file) => file.size > TEACHER_CERTIFICATE_MAX_BYTES || !hasPdfSignature(file),
      )
    ) {
      return res.status(400).json({
        message: "Each certificate must be a valid PDF no larger than 1.5MB",
      });
    }
    if (
      certificateFiles.reduce((total, file) => total + Number(file.size || 0), 0) >
      TEACHER_CERTIFICATES_TOTAL_MAX_BYTES
    ) {
      return res.status(400).json({ message: "Certificate uploads must not exceed 5MB in total" });
    }

    if (value.removeAvatar) {
      await removeOldAvatarIfLocal(user.avatar);
      user.avatar = "";
    }

    if (avatarFile) {
      const previousAvatar = user.avatar;
      const newAvatar = await saveAvatarFromBuffer(user._id, avatarFile.buffer);
      user.avatar = newAvatar;
      await removeOldAvatarIfLocal(previousAvatar);
    }

    if (cvFile && user.role === "teacher") {
      const previousCvUrl = user.teacherApplication?.cvUrl || "";
      const nextCvUrl = await saveTeacherCvFromBuffer(user._id, cvFile.buffer);
      user.teacherApplication = {
        ...(user.teacherApplication || {}),
        cvUrl: nextCvUrl,
      };
      await removeOldTeacherCvIfLocal(previousCvUrl);
    }

    if (certificateFiles.length && user.role === "teacher") {
      if (certificateFiles.length > 5) {
        return res.status(400).json({ message: "A maximum of 5 certificate PDFs is allowed" });
      }

      const previousCertificatePaths = Array.isArray(user.teacherApplication?.certifications)
        ? user.teacherApplication.certifications
        : [];
      const previousCertificateLegacyPath = user.teacherApplication?.certificatesFileUrl || "";

      const nextCertificateUrls = [];
      for (let index = 0; index < certificateFiles.length; index += 1) {
        const file = certificateFiles[index];
        const savedUrl = await saveTeacherCertificateFromBuffer(user._id, file.buffer, index);
        nextCertificateUrls.push(savedUrl);
      }

      user.teacherApplication = {
        ...(user.teacherApplication || {}),
        certifications: nextCertificateUrls,
        certificatesFileUrl: nextCertificateUrls[0] || "",
      };

      for (const previousPath of previousCertificatePaths) {
        await removeOldTeacherCertificateIfLocal(previousPath);
      }
      await removeOldTeacherCertificateIfLocal(previousCertificateLegacyPath);
    }

    await user.save();

    if (shouldNotifyTeacherApplicationReview) {
      try {
        await AdminNotification.findOneAndUpdate(
          { dedupeKey: `teacher_application_review:${user._id}` },
          {
            $set: {
              type: "teacher_application_review",
              title: "Teacher application awaiting review",
              message: `${user.name || "A teacher"} submitted a teacher application for admin review.`,
              submittedBy: user._id,
              readBy: [],
            },
            $setOnInsert: {
              dedupeKey: `teacher_application_review:${user._id}`,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
        );
      } catch (notificationError) {
        console.warn(
          `Failed to create teacher application review notification: ${notificationError.message}`,
        );
      }

      notifyAdminTeacherApplicationReview(user).catch((notificationError) => {
        console.warn(
          `Failed to send teacher application review push notification: ${notificationError.message}`,
        );
      });
    }

    if (shouldNotifyBankPaymentReview) {
      try {
        await AdminNotification.findOneAndUpdate(
          { dedupeKey: `teacher_bank_payment_review:${user._id}` },
          {
            $set: {
              type: "teacher_bank_payment_review",
              title: "Teacher payment details awaiting review",
              message: `${user.name || "A teacher"} submitted bank/card details for admin review.`,
              submittedBy: user._id,
              readBy: [],
              hiddenBy: [],
            },
            $setOnInsert: {
              dedupeKey: `teacher_bank_payment_review:${user._id}`,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
        );
      } catch (notificationError) {
        console.warn(
          `Failed to create teacher bank review notification: ${notificationError.message}`,
        );
      }
    }

    return res.json({
      message: "Profile updated successfully",
      user: publicUserPayload(req, user, false),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
