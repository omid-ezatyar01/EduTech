import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { encodeWebpUnderLimit } from "./imageCompression.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const articleCoverDirectory = path.resolve(__dirname, "../../uploads/article-covers");

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
  const filepath = path.resolve(__dirname, `../../${String(coverPath).replace(/^\//, "")}`);
  await fs.unlink(filepath).catch(() => {});
};
