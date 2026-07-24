import multer from "multer";

const ARTICLE_COVER_MAX_SIZE = 300 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const articleCoverUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PNG, JPG, and WEBP images are allowed"));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: ARTICLE_COVER_MAX_SIZE,
    files: 1,
    fields: 2,
    fieldSize: 8 * 1024,
    parts: 4,
  },
});

export default articleCoverUpload;
