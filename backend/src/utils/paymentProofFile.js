import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const paymentProofDirectory = resolveUploadsPath("payment-proofs");

export const savePaymentProofFromBuffer = async (studentId, fileBuffer) => {
  const optimizedBuffer = await encodeWebpUnderLimit(fileBuffer, {
    width: 1600,
    height: 1600,
    maxBytes: 300 * 1024,
    initialQuality: 82,
    fit: "inside",
    position: "centre",
    withoutEnlargement: true,
  });
  await fs.mkdir(paymentProofDirectory, { recursive: true });
  const filename = `payment-proof-${studentId}-${Date.now()}.webp`;
  await fs.writeFile(path.join(paymentProofDirectory, filename), optimizedBuffer);
  return `/uploads/payment-proofs/${filename}`;
};

export const removePaymentProofIfLocal = async (proofPath) => {
  if (!String(proofPath || "").startsWith("/uploads/payment-proofs/")) return;
  const filepath = path.join(paymentProofDirectory, path.basename(String(proofPath)));
  await fs.unlink(filepath).catch(() => {});
};
