import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { encodeWebpUnderLimit } from "./imageCompression.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const courseImageDirectory = path.resolve(__dirname, "../../uploads/course-thumbnails");

export const saveCourseThumbnailFromBuffer = async (actorId, fileBuffer) => {
  await fs.mkdir(courseImageDirectory, { recursive: true });
  const filename = `course-${actorId}-${Date.now()}.webp`;
  const filepath = path.join(courseImageDirectory, filename);

  const optimizedBuffer = await encodeWebpUnderLimit(fileBuffer, {
    width: 1200,
    height: 675,
    maxBytes: 500 * 1024,
    initialQuality: 82,
  });
  await fs.writeFile(filepath, optimizedBuffer);

  return `/uploads/course-thumbnails/${filename}`;
};

export const removeOldCourseThumbnailIfLocal = async (thumbnailPath) => {
  if (!thumbnailPath || !thumbnailPath.startsWith("/uploads/course-thumbnails/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${thumbnailPath.replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};
