import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const articleCoverDirectory = path.resolve(__dirname, "../../uploads/article-covers");

export const saveArticleCoverFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(articleCoverDirectory, { recursive: true });
  const filename = `article-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(articleCoverDirectory, filename);
  await sharp(fileBuffer)
    .rotate()
    .resize(1600, 900, { fit: "cover", position: "entropy" })
    .webp({ quality: 84, effort: 6 })
    .toFile(filepath);
  return `/uploads/article-covers/${filename}`;
};

export const removeArticleCoverIfLocal = async (coverPath) => {
  if (!coverPath || !String(coverPath).startsWith("/uploads/article-covers/")) return;
  const filepath = path.resolve(__dirname, `../../${String(coverPath).replace(/^\//, "")}`);
  await fs.unlink(filepath).catch(() => {});
};
