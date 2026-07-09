import { Webhook } from "standardwebhooks";
import OtpVerification from "../models/OtpVerification.js";
import User from "../models/User.js";

const EVENT_STATUS_MAP = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
  "email.complained": "complained",
};

const TERMINAL_FAILURE_STATUSES = ["bounced", "failed", "suppressed", "complained"];

const getHeader = (headers = {}, key = "") => {
  const lowerKey = key.toLowerCase();
  return headers[key] || headers[lowerKey] || "";
};

const verifyWebhookPayload = (req) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SIGNING_SECRET || "";
  const payload = req.body;
  if (!secret) {
    return JSON.parse(Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload || "{}"));
  }

  const wh = new Webhook(secret);
  return wh.verify(payload, {
    "webhook-id": getHeader(req.headers, "webhook-id"),
    "webhook-timestamp": getHeader(req.headers, "webhook-timestamp"),
    "webhook-signature": getHeader(req.headers, "webhook-signature"),
  });
};

const getResendEmailId = (event = {}) =>
  String(
    event?.data?.email_id ||
      event?.data?.emailId ||
      event?.data?.id ||
      event?.email_id ||
      event?.emailId ||
      "",
  ).trim();

const getFailureReason = (event = {}) =>
  String(
    event?.data?.reason ||
      event?.data?.bounce?.message ||
      event?.data?.failed?.message ||
      event?.data?.error ||
      event?.data?.message ||
      event?.reason ||
      "",
  ).trim();

export const handleResendWebhook = async (req, res) => {
  let event;

  try {
    event = verifyWebhookPayload(req);
  } catch {
    return res.status(400).json({ message: "Invalid Resend webhook signature" });
  }

  const eventType = String(event?.type || "").trim();
  const nextStatus = EVENT_STATUS_MAP[eventType];
  if (!nextStatus) {
    return res.json({ received: true, ignored: true });
  }

  const resendEmailId = getResendEmailId(event);
  if (!resendEmailId) {
    return res.json({ received: true, ignored: true, reason: "missing_resend_email_id" });
  }

  const otpRecord = await OtpVerification.findOne({ resendEmailId }).sort({ createdAt: -1 });
  if (!otpRecord) {
    return res.json({ received: true, ignored: true, reason: "otp_record_not_found" });
  }

  otpRecord.emailStatus = nextStatus;
  otpRecord.emailStatusReason = getFailureReason(event);
  otpRecord.emailStatusUpdatedAt = new Date();
  otpRecord.rawWebhookEvent = event;

  if (TERMINAL_FAILURE_STATUSES.includes(nextStatus)) {
    otpRecord.isUsable = false;
  }

  await otpRecord.save();

  if (nextStatus === "suppressed") {
    await User.updateOne(
      { email: otpRecord.email },
      {
        $set: {
          emailBlocked: true,
          emailBlockReason: "suppressed",
          emailBlockedAt: new Date(),
        },
      },
    );
  }

  return res.json({ received: true });
};
