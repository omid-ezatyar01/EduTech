import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const COURSE_RESOURCE_MAX_SIZE = 100 * 1024 * 1024;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDirectory = path.resolve(__dirname, "../../uploads/tmp-course-resources");

fs.mkdirSync(tempDirectory, { recursive: true });

const sanitizeFilename = (value = "") =>
  String(value || "resource.pdf")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "resource.pdf";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDirectory);
  },
  filename: (_req, file, cb) => {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${sanitizeFilename(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    String(file.originalname || "").toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    cb(new Error("Only PDF files are allowed for course resources"));
    return;
  }

  cb(null, true);
};

const courseResourceUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: COURSE_RESOURCE_MAX_SIZE,
  },
});

export default courseResourceUpload;
