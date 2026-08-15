import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const heroDirectory = resolveUploadsPath("hero-media");

export const saveHeroMediaFromUpload = async (actorId, file) => {
  await fs.mkdir(heroDirectory, { recursive: true });
  const timestamp = Date.now();

  if (!String(file.mimetype).startsWith("image/")) {
    throw new Error("Only hero images are allowed");
  }

  const filename = `hero-${actorId}-${timestamp}.webp`;
  const optimized = await encodeWebpUnderLimit(file.buffer, {
      width: 1920,
      height: 1080,
    maxBytes: 1.2 * 1024 * 1024,
    initialQuality: 86,
    fit: "cover",
    withoutEnlargement: false,
  });
  await fs.writeFile(path.join(heroDirectory, filename), optimized);
  return { mediaType: "image", mediaUrl: `/uploads/hero-media/${filename}` };
};

export const removeHeroMediaIfLocal = async (mediaUrl) => {
  const normalized = String(mediaUrl || "");
  if (!normalized.startsWith("/uploads/hero-media/")) return;
  const filename = path.basename(normalized);
  if (!/^hero-[a-f0-9]+-\d+\.(?:webp|mp4|webm)$/i.test(filename)) return;
  await fs.unlink(path.join(heroDirectory, filename)).catch(() => {});
};
