import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const courseResourceDirectory = path.resolve(__dirname, "../../uploads/course-resources");

const sanitizeFilename = (value = "") =>
  String(value || "resource.pdf")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

export const saveCourseResourcePdfFromBuffer = async (teacherId, courseId, file) => {
  await fs.mkdir(courseResourceDirectory, { recursive: true });
  const filename = `resource-${teacherId}-${courseId}-${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const filepath = path.join(courseResourceDirectory, filename);
  await fs.writeFile(filepath, file.buffer);
  return `/uploads/course-resources/${filename}`;
};

export const moveUploadedCourseResourcePdf = async (teacherId, courseId, file) => {
  await fs.mkdir(courseResourceDirectory, { recursive: true });
  const filename = `resource-${teacherId}-${courseId}-${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const filepath = path.join(courseResourceDirectory, filename);
  await fs.rename(file.path, filepath);
  return `/uploads/course-resources/${filename}`;
};

export const uploadedFileHasPdfSignature = async (file) => {
  const filePath = String(file?.path || "").trim();
  if (!filePath) return false;
  const handle = await fs.open(filePath, "r");
  try {
    const signature = Buffer.alloc(5);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    return bytesRead === signature.length && signature.toString("ascii") === "%PDF-";
  } finally {
    await handle.close();
  }
};

export const removeCourseResourcePdfIfLocal = async (filePath) => {
  if (!filePath || !String(filePath).startsWith("/uploads/course-resources/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${String(filePath).replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};

export const removeUploadedTempCourseResourceFile = async (file) => {
  const tempPath = String(file?.path || "").trim();
  if (!tempPath) return;
  await fs.unlink(tempPath).catch(() => {});
};
