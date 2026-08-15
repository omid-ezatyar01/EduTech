import fs from "fs/promises";
import path from "path";
import { resolveUploadsPath } from "../config/uploadStorage.js";
import { encodeWebpUnderLimit } from "./imageCompression.js";

const coverDirectory = resolveUploadsPath("learning-package-covers");

export const encodeLearningPackageCover = (fileBuffer) => encodeWebpUnderLimit(fileBuffer, {
  width: 1600,
  height: 900,
  maxBytes: 400 * 1024,
  initialQuality: 84,
  fit: "cover",
  position: "entropy",
});

export const saveLearningPackageCoverFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(coverDirectory, { recursive: true });
  const filename = `package-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(coverDirectory, filename);
  const optimizedBuffer = await encodeLearningPackageCover(fileBuffer);
  await fs.writeFile(filepath, optimizedBuffer);
  return `/uploads/learning-package-covers/${filename}`;
};

export const removeLearningPackageCoverIfLocal = async (coverPath) => {
  if (!String(coverPath || "").startsWith("/uploads/learning-package-covers/")) return;
  const filepath = path.join(coverDirectory, path.basename(String(coverPath)));
  await fs.unlink(filepath).catch(() => {});
};
