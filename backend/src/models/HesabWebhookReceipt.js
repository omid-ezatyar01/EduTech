import mongoose from "mongoose";

const hesabWebhookReceiptSchema = new mongoose.Schema(
  {
    credentialHash: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    payloadHash: {
      type: String,
      required: true,
      immutable: true,
    },
    webhookTimestamp: {
      type: String,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["PROCESSING", "PROCESSED", "FAILED"],
      default: "PROCESSING",
      index: true,
    },
    claimToken: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null, index: true },
    paymentAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentAttempt",
      default: null,
      index: true,
    },
    attemptCount: { type: Number, min: 1, default: 1 },
    deliveryCount: { type: Number, min: 0, default: 0 },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const HesabWebhookReceipt = mongoose.model(
  "HesabWebhookReceipt",
  hesabWebhookReceiptSchema,
);

export default HesabWebhookReceipt;
