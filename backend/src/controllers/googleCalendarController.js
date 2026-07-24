import asyncHandler from "../middlewares/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import GoogleAccount from "../models/GoogleAccount.js";
import {
  createGoogleAuthUrl,
  handleOAuthCallback,
} from "../services/googleCalendar.service.js";
import { syncFutureSessionsForStudent } from "../services/studentCalendarSync.service.js";

const normalizeOrigin = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

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

const resolveRoleRedirect = (role) => {
  const roleKey = String(role || "").trim().toLowerCase();
  const mapped = parseRoleRedirectMap();
  if (roleKey && mapped[roleKey]) return mapped[roleKey];

  const roleSpecific = roleKey === "student"
    ? process.env.GOOGLE_STUDENT_OAUTH_RESULT_REDIRECT
    : roleKey === "teacher"
      ? process.env.GOOGLE_TEACHER_OAUTH_RESULT_REDIRECT
      : roleKey === "admin"
        ? process.env.GOOGLE_ADMIN_OAUTH_RESULT_REDIRECT
        : "";
  if (String(roleSpecific || "").trim()) return String(roleSpecific).trim();

  if (roleKey === "student") {
    const studentBase = normalizeOrigin(
      process.env.STUDENT_CLIENT_URL ||
      process.env.STUDENT_FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "",
    );
    if (studentBase) return `${studentBase}/student/schedule`;
  }

  const direct = String(process.env.GOOGLE_OAUTH_RESULT_REDIRECT || "").trim();
  if (direct) return direct;

  const base = normalizeOrigin(process.env.GOOGLE_OAUTH_RESULT_REDIRECT_BASE || "");
  if (!base) return "";
  if (roleKey === "teacher") return `${base}/teacher`;
  if (roleKey === "admin") return `${base}/admin`;
  if (roleKey === "student") return `${base}/student/schedule`;
  return base;
};

const buildCallbackRedirect = ({ type, role, message }) => {
  const base = resolveRoleRedirect(role);
  if (!base) return "";

  const url = new URL(base);
  url.searchParams.set("googleOAuth", type);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
};

export const getGoogleOAuthUrl = asyncHandler(async (req, res) => {
  const url = createGoogleAuthUrl({
    userId: req.user._id,
    role: req.user.role,
  });

  return res.json(
    new ApiResponse({
      message: "Google OAuth URL generated successfully",
      data: { url },
    }),
  );
});

export const getGoogleAccountStatus = asyncHandler(async (req, res) => {
  const account = await GoogleAccount.findOne({ userId: req.user._id }).select(
    "googleEmail reconnectRequired lastError updatedAt createdAt",
  );

  return res.json(
    new ApiResponse({
      message: "Google account status fetched successfully",
      data: {
        connected: Boolean(account) && account?.reconnectRequired !== true,
        googleEmail: account?.googleEmail || "",
        reconnectRequired: Boolean(account?.reconnectRequired),
        error: account?.lastError || "",
        connectedAt: account?.createdAt || null,
        updatedAt: account?.updatedAt || null,
      },
    }),
  );
});

export const handleGoogleOAuthCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  try {
    const linked = await handleOAuthCallback(code, state);
    if (linked.role === "student") {
      setImmediate(() => {
        syncFutureSessionsForStudent(linked.userId).catch((error) => {
          console.warn(`Student calendar backfill failed: ${error.message}`);
        });
      });
    }
    const successRedirect = buildCallbackRedirect({
      type: "success",
      role: linked.role,
      message: "Google account connected successfully",
    });

    if (successRedirect) {
      return res.redirect(successRedirect);
    }

    return res.json(
      new ApiResponse({
        message: "Google account connected successfully",
        data: {
          connected: true,
          googleEmail: linked.googleEmail,
        },
      }),
    );
  } catch (error) {
    const failedRedirect = buildCallbackRedirect({
      type: "error",
      role: "",
      message: error.message || "Google OAuth failed",
    });
    if (failedRedirect) {
      return res.redirect(failedRedirect);
    }

    throw error;
  }
});
