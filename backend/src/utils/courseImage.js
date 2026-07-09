import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const courseImageDirectory = path.resolve(__dirname, "../../uploads/course-thumbnails");

export const saveCourseThumbnailFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(courseImageDirectory, { recursive: true });
  const filename = `course-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(courseImageDirectory, filename);

  await sharp(fileBuffer)
    .rotate()
    .resize(1200, 675, { fit: "cover", position: "entropy" })
    .webp({ quality: 82, effort: 6 })
    .toFile(filepath);

  return `/uploads/course-thumbnails/${filename}`;
};

export const removeOldCourseThumbnailIfLocal = async (thumbnailPath) => {
  if (!thumbnailPath || !thumbnailPath.startsWith("/uploads/course-thumbnails/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${thumbnailPath.replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};
