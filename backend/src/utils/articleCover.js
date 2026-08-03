import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const articleCoverDirectory = resolveUploadsPath("article-covers");

export const saveArticleCoverFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(articleCoverDirectory, { recursive: true });
  const filename = `article-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(articleCoverDirectory, filename);
  const optimizedBuffer = await encodeWebpUnderLimit(fileBuffer, {
    width: 1600,
    height: 900,
    maxBytes: 300 * 1024,
    initialQuality: 82,
  });
  await fs.writeFile(filepath, optimizedBuffer);
  return `/uploads/article-covers/${filename}`;
};

export const removeArticleCoverIfLocal = async (coverPath) => {
  if (!coverPath || !String(coverPath).startsWith("/uploads/article-covers/")) return;
  const filepath = path.join(articleCoverDirectory, path.basename(String(coverPath)));
  await fs.unlink(filepath).catch(() => {});
};
