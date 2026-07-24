import multer from "multer";

const COURSE_THUMBNAIL_MAX_SIZE = 500 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error("Only PNG, JPG, and WEBP images are allowed"));
    return;
  }
  cb(null, true);
};

const courseThumbnailUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: COURSE_THUMBNAIL_MAX_SIZE,
    files: 1,
    fields: 80,
    fieldSize: 256 * 1024,
    parts: 82,
  },
});

export default courseThumbnailUpload;
