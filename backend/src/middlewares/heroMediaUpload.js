import multer from "multer";

const HERO_MEDIA_MAX_SIZE = 20 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const heroMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PNG, JPG, and WEBP hero images are allowed"));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: HERO_MEDIA_MAX_SIZE, files: 1, fields: 2, parts: 4 },
});

export default heroMediaUpload;
