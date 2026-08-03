import fs from "fs/promises";
import path from "path";
import { encodeWebpUnderLimit } from "./imageCompression.js";
import CourseThumbnailAsset from "../models/CourseThumbnailAsset.js";
import { resolveUploadsPath } from "../config/uploadStorage.js";

const courseImageDirectory = resolveUploadsPath("course-thumbnails");

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

  try {
    // Keep the optimized image in MongoDB as the durable copy. Runtime upload
    // directories are commonly replaced during deployments, so the API can
    // still serve this image if its local cache file disappears.
    await CourseThumbnailAsset.updateOne(
      { filename },
      {
        $set: {
          contentType: "image/webp",
          data: optimizedBuffer,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    await fs.unlink(filepath).catch(() => {});
    throw error;
  }

  return `/uploads/course-thumbnails/${filename}`;
};

export const removeOldCourseThumbnailIfLocal = async (thumbnailPath) => {
  if (!thumbnailPath || !thumbnailPath.startsWith("/uploads/course-thumbnails/")) return;
  const filename = path.basename(String(thumbnailPath).split(/[?#]/, 1)[0]);
  const oldFilePath = path.join(courseImageDirectory, filename);
  await Promise.all([
    fs.unlink(oldFilePath).catch(() => {}),
    CourseThumbnailAsset.deleteOne({ filename }).catch(() => {}),
  ]);
};

export const backfillCourseThumbnailAssets = async (thumbnailPaths = []) => {
  let persistedCount = 0;

  for (const thumbnailPath of new Set(thumbnailPaths)) {
    const normalizedPath = String(thumbnailPath || "").split(/[?#]/, 1)[0];
    if (!normalizedPath.startsWith("/uploads/course-thumbnails/")) continue;

    const filename = path.basename(normalizedPath);
    if (!/^course-[\w.-]+\.webp$/i.test(filename)) continue;
    if (await CourseThumbnailAsset.exists({ filename })) continue;

    const data = await fs.readFile(path.join(courseImageDirectory, filename)).catch(() => null);
    if (!data) continue;

    await CourseThumbnailAsset.updateOne(
      { filename },
      {
        $setOnInsert: {
          contentType: "image/webp",
          data,
        },
      },
      { upsert: true },
    );
    persistedCount += 1;
  }

  return persistedCount;
};
