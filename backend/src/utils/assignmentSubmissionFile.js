import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submissionDir = path.resolve(__dirname, "../../uploads/assignment-submissions");

const sanitizeFilename = (value = "") =>
  String(value || "submission")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

export const saveAssignmentSubmissionFileFromBuffer = async (studentId, assignmentId, file) => {
  await fs.mkdir(submissionDir, { recursive: true });
  const filename = `submission-${studentId}-${assignmentId}-${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const filepath = path.join(submissionDir, filename);
  await fs.writeFile(filepath, file.buffer);
  return `/uploads/assignment-submissions/${filename}`;
};

export const removeAssignmentSubmissionFileIfLocal = async (filePath) => {
  if (!filePath || !String(filePath).startsWith("/uploads/assignment-submissions/")) return;
  const oldFilePath = path.resolve(__dirname, `../../${String(filePath).replace(/^\//, "")}`);
  await fs.unlink(oldFilePath).catch(() => {});
};

