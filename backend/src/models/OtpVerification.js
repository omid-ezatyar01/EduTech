import mongoose from "mongoose";

export const OTP_EMAIL_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "suppressed",
  "complained",
];

const otpVerificationSchema = new mongoose.Schema(
  {
    purpose: {
      type: String,
      enum: ["registration", "password_reset"],
      default: "registration",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    resendEmailId: {
      type: String,
      trim: true,
      default: "",
    },
    emailStatus: {
      type: String,
      enum: OTP_EMAIL_STATUSES,
      default: "pending",
      index: true,
    },
    emailStatusReason: {
      type: String,
      trim: true,
      default: "",
    },
    emailStatusUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    isUsable: {
      type: Boolean,
      default: true,
      index: true,
    },
    verifyAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    resetTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    requestIp: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    lastRequestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    rawWebhookEvent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

otpVerificationSchema.index({ email: 1, purpose: 1, createdAt: -1 });
otpVerificationSchema.index({ resendEmailId: 1 }, { sparse: true });
otpVerificationSchema.index({ isUsable: 1, otpExpiresAt: 1, emailStatus: 1 });

const OtpVerification = mongoose.model("OtpVerification", otpVerificationSchema);

export default OtpVerification;
