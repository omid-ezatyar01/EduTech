import crypto from "crypto";
import HesabWebhookReceipt from "../models/HesabWebhookReceipt.js";

const DEFAULT_CLAIM_LEASE_MS = 60_000;

const stableJsonValue = (value) => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJsonValue(value[key])]),
    );
  }
  return value;
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const hashHesabWebhookPayload = (payload) =>
  sha256(JSON.stringify(stableJsonValue(payload)));

const hashWebhookCredential = ({ signature, timestamp }) =>
  sha256(JSON.stringify([String(signature), String(timestamp)]));

const getClaimLeaseMs = () => {
  const configured = Number(process.env.HESABPAY_WEBHOOK_CLAIM_LEASE_MS);
  return Number.isFinite(configured) && configured >= 5_000
    ? configured
    : DEFAULT_CLAIM_LEASE_MS;
};

const classifyReceipt = (receipt, payloadHash, now) => {
  if (!receipt) return { state: "MISSING" };
  if (receipt.payloadHash !== payloadHash) {
    return { state: "PAYLOAD_MISMATCH", receipt };
  }
  if (receipt.status === "PROCESSED") {
    return { state: "PROCESSED", receipt };
  }
  const leaseExpiresAt = receipt.leaseExpiresAt
    ? new Date(receipt.leaseExpiresAt).getTime()
    : Number.NaN;
  if (
    receipt.status === "PROCESSING" &&
    Number.isFinite(leaseExpiresAt) &&
    leaseExpiresAt > now.getTime()
  ) {
    return { state: "IN_PROGRESS", receipt };
  }
  return { state: "RECLAIMABLE", receipt };
};

export const claimHesabWebhookDelivery = async ({ signature, timestamp, payload }) => {
  const now = new Date();
  const credentialHash = hashWebhookCredential({ signature, timestamp });
  const payloadHash = hashHesabWebhookPayload(payload);
  const claimToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + getClaimLeaseMs());

  let receipt;
  try {
    receipt = await HesabWebhookReceipt.findOneAndUpdate(
      { credentialHash },
      {
        $setOnInsert: {
          credentialHash,
          payloadHash,
          webhookTimestamp: String(timestamp),
          status: "PROCESSING",
          claimToken,
          leaseExpiresAt,
          attemptCount: 1,
          firstSeenAt: now,
        },
        $set: { lastSeenAt: now },
        $inc: { deliveryCount: 1 },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: false },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    receipt = await HesabWebhookReceipt.findOne({ credentialHash });
  }

  if (receipt?.claimToken === claimToken) {
    return { state: "CLAIMED", receipt, claimToken };
  }

  const classified = classifyReceipt(receipt, payloadHash, now);
  if (classified.state !== "RECLAIMABLE") return classified;

  const reclaimed = await HesabWebhookReceipt.findOneAndUpdate(
    {
      _id: receipt._id,
      payloadHash,
      $or: [
        { status: "FAILED" },
        { status: "PROCESSING", leaseExpiresAt: { $lte: now } },
        { status: "PROCESSING", leaseExpiresAt: null },
      ],
    },
    {
      $set: {
        status: "PROCESSING",
        claimToken,
        leaseExpiresAt,
        lastSeenAt: now,
        failedAt: null,
      },
      $inc: { attemptCount: 1 },
    },
    { returnDocument: "after" },
  );

  if (reclaimed?.claimToken === claimToken) {
    return { state: "CLAIMED", receipt: reclaimed, claimToken };
  }

  const latest = await HesabWebhookReceipt.findOne({ credentialHash });
  return classifyReceipt(latest, payloadHash, now);
};

export const completeHesabWebhookDelivery = async ({
  receiptId,
  claimToken,
  paymentAttemptId = null,
}) => {
  const processedAt = new Date();
  const result = await HesabWebhookReceipt.updateOne(
    { _id: receiptId, status: "PROCESSING", claimToken },
    {
      $set: {
        status: "PROCESSED",
        processedAt,
        lastSeenAt: processedAt,
        paymentAttemptId,
      },
      $unset: { claimToken: 1, leaseExpiresAt: 1, failedAt: 1 },
    },
  );
  if (!result?.modifiedCount) {
    throw new Error("Unable to durably finalize HesabPay webhook receipt");
  }
};

export const failHesabWebhookDelivery = async ({ receiptId, claimToken }) => {
  if (!receiptId || !claimToken) return;
  const failedAt = new Date();
  await HesabWebhookReceipt.updateOne(
    { _id: receiptId, status: "PROCESSING", claimToken },
    {
      $set: { status: "FAILED", failedAt, lastSeenAt: failedAt },
      $unset: { claimToken: 1, leaseExpiresAt: 1 },
    },
  );
};
