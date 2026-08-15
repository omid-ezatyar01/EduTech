import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const coverDirectory = resolveUploadsPath("bootcamp-covers");

export const saveBootcampCoverFromBuffer = async (actorId, buffer) => {
  await fs.mkdir(coverDirectory, { recursive: true });
  const filename = `bootcamp-${actorId}-${Date.now()}.webp`;
  const optimized = await encodeWebpUnderLimit(buffer, {
    width: 1600,
    height: 900,
    maxBytes: 900 * 1024,
    initialQuality: 84,
    fit: "cover",
    withoutEnlargement: false,
  });
  await fs.writeFile(path.join(coverDirectory, filename), optimized);
  return `/uploads/bootcamp-covers/${filename}`;
};

export const removeBootcampCoverIfLocal = async (coverPath) => {
  const normalized = String(coverPath || "");
  if (!normalized.startsWith("/uploads/bootcamp-covers/")) return;
  const filename = path.basename(normalized);
  if (!/^bootcamp-[a-f0-9]+-\d+\.webp$/i.test(filename)) return;
  await fs.unlink(path.join(coverDirectory, filename)).catch(() => {});
};
