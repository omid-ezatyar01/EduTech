import crypto from "crypto";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import GoogleAccount from "../models/GoogleAccount.js";
import ApiError from "../utils/ApiError.js";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

const STATE_TTL = "10m";

const normalizeRole = (role = "") => String(role || "").trim().toLowerCase();

const resolveOAuthRedirectUriByRole = (role = "") => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return (
      String(process.env.GOOGLE_REDIRECT_URI || "").trim() ||
      String(process.env.GOOGLE_TEACHER_REDIRECT_URI || "").trim() ||
      String(process.env.GOOGLE_ADMIN_REDIRECT_URI || "").trim()
    );
  }

  if (normalizedRole === "teacher") {
    return (
      String(process.env.GOOGLE_TEACHER_REDIRECT_URI || "").trim() ||
      String(process.env.GOOGLE_REDIRECT_URI || "").trim()
    );
  }

  if (normalizedRole === "admin") {
    return (
      String(process.env.GOOGLE_ADMIN_REDIRECT_URI || "").trim() ||
      String(process.env.GOOGLE_REDIRECT_URI || "").trim()
    );
  }

  if (normalizedRole === "student") {
    return (
      String(process.env.GOOGLE_STUDENT_CALENDAR_REDIRECT_URI || "").trim() ||
      String(process.env.GOOGLE_REDIRECT_URI || "").trim()
    );
  }

  return String(process.env.GOOGLE_REDIRECT_URI || "").trim();
};

const getOAuthEnv = (role = "") => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = resolveOAuthRedirectUriByRole(role);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new ApiError(
      500,
      "Google OAuth environment variables are missing. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and role redirect URI are required.",
    );
  }

  return { clientId, clientSecret, redirectUri };
};

const buildOAuthClient = (role = "") => {
  const { clientId, clientSecret, redirectUri } = getOAuthEnv(role);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const getEncryptionKey = () => {
  const seed = String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!seed) return null;

  if (/^[0-9a-fA-F]{64}$/.test(seed)) {
    return Buffer.from(seed, "hex");
  }

  return crypto.createHash("sha256").update(seed).digest();
};

const encryptRefreshToken = (plainToken = "") => {
  const token = String(plainToken || "");
  if (!token) return "";

  const key = getEncryptionKey();
  if (!key) return token;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

const decryptRefreshToken = (value = "") => {
  const encoded = String(value || "");
  if (!encoded) return "";
  if (!encoded.startsWith("enc:v1:")) return encoded;

  const key = getEncryptionKey();
  if (!key) {
    throw new ApiError(500, "Encrypted refresh token exists but encryption key is missing");
  }

  const parts = encoded.split(":");
  if (parts.length !== 5) {
    throw new ApiError(500, "Invalid encrypted refresh token format");
  }

  const iv = Buffer.from(parts[2], "base64");
  const authTag = Buffer.from(parts[3], "base64");
  const content = Buffer.from(parts[4], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  return decrypted.toString("utf8");
};

const signOAuthState = ({ userId, role }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT secret is missing");
  }

  return jwt.sign({ userId: String(userId), role, provider: "google-calendar" }, secret, {
    expiresIn: STATE_TTL,
  });
};

const verifyOAuthState = (state) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT secret is missing");
  }

  try {
    const decoded = jwt.verify(state, secret);
    if (!decoded?.userId || !["student", "teacher", "admin"].includes(decoded?.role)) {
      throw new ApiError(400, "Invalid OAuth state payload");
    }
    return decoded;
  } catch {
    throw new ApiError(400, "Invalid or expired Google OAuth state");
  }
};

export const createGoogleAuthUrl = ({ userId, role }) => {
  if (!userId || !role) {
    throw new ApiError(400, "User context is required for Google OAuth");
  }

  if (!["student", "teacher", "admin"].includes(role)) {
    throw new ApiError(403, "This account cannot connect Google Calendar");
  }

  const { redirectUri } = getOAuthEnv(role);
  const oauthClient = buildOAuthClient(role);
  const state = signOAuthState({ userId, role });

  console.info(
    `[google-calendar-oauth] generate auth url role=${role} redirect_uri=${redirectUri}`,
  );

  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return url;
};

export const handleOAuthCallback = async (code, state) => {
  if (!code) {
    throw new ApiError(400, "Google OAuth code is missing");
  }

  if (!state) {
    throw new ApiError(400, "Google OAuth state is missing");
  }

  const decoded = verifyOAuthState(state);
  const { redirectUri } = getOAuthEnv(decoded.role);
  const oauthClient = buildOAuthClient(decoded.role);
  console.info(
    `[google-calendar-oauth] exchange code role=${decoded.role} redirect_uri=${redirectUri}`,
  );

  let tokenResponse;
  try {
    tokenResponse = await oauthClient.getToken({
      code,
      redirect_uri: redirectUri,
    });
  } catch (error) {
    const payload = String(
      `${error?.response?.data?.error || ""} ${error?.response?.data?.error_description || ""} ${error?.message || ""}`,
    ).toLowerCase();
    if (payload.includes("redirect_uri_mismatch")) {
      throw new ApiError(
        400,
        "OAuth redirect URI mismatch. Check role-specific Google redirect URI configuration.",
      );
    }
    throw error;
  }
  const tokens = tokenResponse?.tokens || {};

  if (!tokens.access_token) {
    throw new ApiError(400, "Google did not return access token");
  }

  const existingAccount = await GoogleAccount.findOne({ userId: decoded.userId });
  const persistedRefreshToken = existingAccount
    ? decryptRefreshToken(existingAccount.refreshToken || "")
    : "";

  const refreshToken = tokens.refresh_token || persistedRefreshToken;
  if (!refreshToken) {
    throw new ApiError(
      400,
      "Google refresh token is missing. Reconnect with consent to grant offline access.",
    );
  }

  oauthClient.setCredentials({
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    expiry_date: tokens.expiry_date,
  });

  const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
  const profile = await oauth2.userinfo.get();
  const googleEmail = String(profile?.data?.email || "").trim().toLowerCase();

  if (!googleEmail) {
    throw new ApiError(400, "Unable to read Google account email");
  }

  const payload = {
    userId: decoded.userId,
    role: decoded.role,
    googleEmail,
    accessToken: tokens.access_token,
    refreshToken: encryptRefreshToken(refreshToken),
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: tokens.scope || GOOGLE_SCOPES.join(" "),
    tokenType: tokens.token_type || "Bearer",
    reconnectRequired: false,
    lastError: "",
  };

  const account = await GoogleAccount.findOneAndUpdate(
    { userId: decoded.userId },
    payload,
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );

  return {
    userId: account.userId,
    role: decoded.role,
    googleEmail: account.googleEmail,
    updatedAt: account.updatedAt,
  };
};

export const getOAuthClient = async (userId) => {
  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  const account = await GoogleAccount.findOne({ userId });
  if (!account) {
    throw new ApiError(400, "Google account is not connected for this user");
  }

  const refreshToken = decryptRefreshToken(account.refreshToken || "");
  if (!refreshToken) {
    throw new ApiError(400, "Stored Google refresh token is missing");
  }

  const oauthClient = buildOAuthClient(account.role || "");
  oauthClient.setCredentials({
    access_token: account.accessToken || undefined,
    refresh_token: refreshToken,
    expiry_date: account.expiryDate ? new Date(account.expiryDate).getTime() : undefined,
  });

  oauthClient.on("tokens", async (tokens) => {
    const updates = {};
    if (tokens.access_token) updates.accessToken = tokens.access_token;
    if (tokens.expiry_date) updates.expiryDate = new Date(tokens.expiry_date);
    if (tokens.scope) updates.scope = tokens.scope;
    if (tokens.token_type) updates.tokenType = tokens.token_type;
    if (tokens.refresh_token) {
      updates.refreshToken = encryptRefreshToken(tokens.refresh_token);
    }

    if (Object.keys(updates).length) {
      await GoogleAccount.updateOne({ _id: account._id }, { $set: updates });
    }
  });

  return oauthClient;
};

const extractMeetLink = (event = {}) => {
  if (event.hangoutLink) return event.hangoutLink;

  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints
    : [];

  const videoPoint = entryPoints.find((entry) => entry.entryPointType === "video");
  return videoPoint?.uri || "";
};

export const createCalendarEventWithMeet = async ({
  userId,
  calendarId = "primary",
  title,
  description,
  startTime,
  endTime,
  timezone,
}) => {
  const oauthClient = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });

  const requestId = crypto.randomUUID();

  const insertResponse = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: title,
      description: description || "",
      start: {
        dateTime: startTime,
        timeZone: timezone,
      },
      end: {
        dateTime: endTime,
        timeZone: timezone,
      },
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    },
  });

  const event = insertResponse?.data || {};
  const meetLink = extractMeetLink(event);

  if (!event.id) {
    throw new ApiError(502, "Google Calendar event creation failed");
  }

  return {
    eventId: event.id,
    calendarId,
    meetLink,
    event,
  };
};

const buildCalendarEventBody = ({
  title,
  description = "",
  meetingLink = "",
  startTime,
  endTime,
  timezone,
} = {}) => ({
  summary: title,
  description: [description, meetingLink ? `Join class: ${meetingLink}` : ""]
    .filter(Boolean)
    .join("\n\n"),
  location: meetingLink || "",
  start: {
    dateTime: startTime,
    timeZone: timezone,
  },
  end: {
    dateTime: endTime,
    timeZone: timezone,
  },
  reminders: {
    useDefault: false,
    overrides: [
      { method: "popup", minutes: 30 },
      { method: "popup", minutes: 10 },
    ],
  },
});

export const createCalendarEvent = async ({
  userId,
  calendarId = "primary",
  ...payload
} = {}) => {
  const oauthClient = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });
  const response = await calendar.events.insert({
    calendarId,
    requestBody: buildCalendarEventBody(payload),
  });
  if (!response?.data?.id) {
    throw new ApiError(502, "Google Calendar event creation failed");
  }
  return {
    eventId: response.data.id,
    calendarId,
    event: response.data,
  };
};

export const updateCalendarEvent = async ({
  userId,
  calendarId = "primary",
  eventId,
  ...payload
} = {}) => {
  if (!eventId) return { missing: true };
  const oauthClient = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });
  try {
    const response = await calendar.events.update({
      calendarId,
      eventId,
      requestBody: buildCalendarEventBody(payload),
    });
    return { eventId, calendarId, event: response?.data || {} };
  } catch (error) {
    if ([404, 410].includes(Number(error?.code || error?.response?.status))) {
      return { missing: true, eventId, calendarId };
    }
    throw error;
  }
};

export const deleteCalendarEvent = async ({
  userId,
  calendarId = "primary",
  eventId,
} = {}) => {
  if (!eventId) return { deleted: true, missing: true };
  const oauthClient = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });
  try {
    await calendar.events.delete({ calendarId, eventId });
    return { deleted: true };
  } catch (error) {
    if ([404, 410].includes(Number(error?.code || error?.response?.status))) {
      return { deleted: true, missing: true };
    }
    throw error;
  }
};
