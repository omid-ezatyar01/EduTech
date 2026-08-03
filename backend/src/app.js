import "./config/loadEnv.js";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/index.js";
import errorHandler from "./middlewares/errorHandler.js";
import { handleResendWebhook } from "./controllers/resendWebhookController.js";
import {
  apiRateLimitKey,
  resolveApiRateLimitIdentity,
} from "./middlewares/apiRateLimitIdentity.js";
import CourseThumbnailAsset from "./models/CourseThumbnailAsset.js";
import { uploadsDirectory } from "./config/uploadStorage.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const normalizeOrigin = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const resolveTrustProxy = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 1;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (["loopback", "linklocal", "uniquelocal"].includes(raw)) return raw;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

app.disable("x-powered-by");
app.set("trust proxy", resolveTrustProxy(process.env.TRUST_PROXY));

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => normalizeOrigin(origin))
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from Postman, curl, server-to-server, etc.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(
  helmet({
    // Avatar files are served from /uploads and consumed by frontend apps
    // that may run on a different origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  compression({
    threshold: 1024,
  }),
);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const apiLimiter = rateLimit({
  windowMs: parsePositiveInt(
    process.env.API_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  ),
  limit: (req) =>
    resolveApiRateLimitIdentity(req).authenticated
      ? parsePositiveInt(
          process.env.API_AUTH_RATE_LIMIT_MAX,
          isProduction ? 3000 : 10000,
        )
      : parsePositiveInt(
          process.env.API_RATE_LIMIT_MAX,
          isProduction ? 300 : 5000,
        ),
  keyGenerator: apiRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  skip: (req) => {
    if (isProduction) return false;

    const origin = req.headers.origin || "";
    const host = req.headers.host || "";
    const ip = req.ip || "";
    const xff = Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"] || "";

    const isLocalOrigin =
      origin.includes("localhost") || origin.includes("127.0.0.1");
    const isLocalHost =
      host.includes("localhost") || host.includes("127.0.0.1");
    const isLocalIp =
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      ip.startsWith("127.") ||
      String(xff).includes("127.0.0.1") ||
      String(xff).includes("::1");

    return isLocalOrigin || isLocalHost || isLocalIp;
  },
});
app.use("/api/", apiLimiter);

const resendWebhookSecret = String(
  process.env.RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SIGNING_SECRET || "",
).trim();

if (resendWebhookSecret) {
  const resendWebhookRawBody = express.raw({ type: "application/json" });
  app.post("/api/webhooks/resend", resendWebhookRawBody, handleResendWebhook);
  app.post("/api/v1/webhooks/resend", resendWebhookRawBody, handleResendWebhook);
}

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.URL_ENCODED_LIMIT || "1mb",
  parameterLimit: Number(process.env.URL_ENCODED_PARAMETER_LIMIT || 100),
}));
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(
  "/uploads",
  express.static(uploadsDirectory, {
    etag: true,
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// Local files are a fast cache; MongoDB is the durable source for course
// thumbnails when a deployment replaces the runtime upload directory.
app.get("/uploads/course-thumbnails/:filename", async (req, res, next) => {
  try {
    const filename = String(req.params.filename || "").trim();
    if (!/^course-[\w.-]+\.webp$/i.test(filename)) return next();

    const asset = await CourseThumbnailAsset.findOne({ filename }).lean();
    if (!asset?.data) return next();

    const body = Buffer.isBuffer(asset.data)
      ? asset.data
      : Buffer.from(asset.data.buffer || asset.data);
    res.setHeader("Content-Type", asset.contentType || "image/webp");
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.send(body);
  } catch (error) {
    return next(error);
  }
});

app.use(
  "/public",
  express.static(publicDir, {
    etag: true,
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// API responses are machine endpoints, not searchable web pages. Keep them
// crawlable so search engines can discover and honor this indexing directive.
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "EduTech API is running",
    docs: "/api/v1",
  });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    message: "EduTech API is healthy",
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api/v1", apiRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
