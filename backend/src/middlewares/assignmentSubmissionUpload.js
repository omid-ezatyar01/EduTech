import multer from "multer";

export const ASSIGNMENT_SUBMISSION_MAX_SIZE = 1 * 1024 * 1024;

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

const fileFilter = (_req, file, cb) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  if (!allowedMimeTypes.has(mime)) {
    cb(new Error("Unsupported file type for assignment submission"));
    return;
  }
  cb(null, true);
};

const assignmentSubmissionUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: ASSIGNMENT_SUBMISSION_MAX_SIZE,
    files: 1,
    fields: 4,
    fieldSize: 32 * 1024,
    parts: 6,
  },
});

export default assignmentSubmissionUpload;
