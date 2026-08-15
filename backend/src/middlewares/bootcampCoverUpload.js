import multer from "multer";

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const bootcampCoverUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PNG, JPG, and WEBP bootcamp covers are allowed"));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 2, parts: 4 },
});

export default bootcampCoverUpload;
