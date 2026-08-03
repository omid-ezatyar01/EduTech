import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const galleryDirectory = resolveUploadsPath("gallery");

export const saveGalleryImageFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(galleryDirectory, { recursive: true });
  const filename = `gallery-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(galleryDirectory, filename);
  const optimizedBuffer = await encodeWebpUnderLimit(fileBuffer, {
    width: 1920,
    height: 1440,
    maxBytes: 650 * 1024,
    initialQuality: 84,
    fit: "inside",
    withoutEnlargement: true,
  });
  await fs.writeFile(filepath, optimizedBuffer);
  return `/uploads/gallery/${filename}`;
};

export const removeGalleryImageIfLocal = async (imagePath) => {
  const normalizedPath = String(imagePath || "");
  if (!normalizedPath.startsWith("/uploads/gallery/")) return;
  const filename = path.basename(normalizedPath);
  if (!/^gallery-[a-f0-9]+-\d+\.webp$/i.test(filename)) return;
  const filepath = path.join(galleryDirectory, filename);
  await fs.unlink(filepath).catch(() => {});
};
