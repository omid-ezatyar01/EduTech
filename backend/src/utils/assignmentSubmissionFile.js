import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const submissionDir = resolveUploadsPath("assignment-submissions");

const sanitizeFilename = (value = "") =>
  String(value || "submission")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

export const saveAssignmentSubmissionFileFromBuffer = async (studentId, assignmentId, file) => {
  await fs.mkdir(submissionDir, { recursive: true });
  const isImage = String(file?.mimetype || "").toLowerCase().startsWith("image/");
  const storedBuffer = isImage
    ? await encodeWebpUnderLimit(file.buffer, {
        width: 1600,
        height: 1600,
        maxBytes: 700 * 1024,
        initialQuality: 82,
        fit: "inside",
        position: "centre",
        withoutEnlargement: true,
      })
    : file.buffer;
  const originalName = isImage
    ? `${String(file.originalname || "assignment-image").replace(/\.[^.]+$/, "")}.webp`
    : file.originalname;
  const filename = `submission-${studentId}-${assignmentId}-${Date.now()}-${sanitizeFilename(originalName)}`;
  const filepath = path.join(submissionDir, filename);
  await fs.writeFile(filepath, storedBuffer);
  return `/uploads/assignment-submissions/${filename}`;
};

export const assignmentSubmissionFileHasValidSignature = (file) => {
  const buffer = file?.buffer;
  const mime = String(file?.mimetype || "").toLowerCase();
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  const startsWith = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const ascii = (start, end) => buffer.subarray(start, end).toString("ascii");

  if (mime === "application/pdf") return ascii(0, 5) === "%PDF-";
  if (mime === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (mime === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (mime === "application/msword") return startsWith(0xd0, 0xcf, 0x11, 0xe0);
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return startsWith(0x50, 0x4b, 0x03, 0x04);
  }
  if (mime === "audio/wav") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  if (mime === "audio/mpeg") {
    return ascii(0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  if (mime === "video/mp4") return ascii(4, 8) === "ftyp";
  if (mime === "video/webm") return startsWith(0x1a, 0x45, 0xdf, 0xa3);
  if (mime === "text/plain") {
    return !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
  }
  return false;
};

export const removeAssignmentSubmissionFileIfLocal = async (filePath) => {
  if (!filePath || !String(filePath).startsWith("/uploads/assignment-submissions/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${String(filePath).replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};
