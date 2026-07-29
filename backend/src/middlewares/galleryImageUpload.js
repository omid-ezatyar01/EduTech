import multer from "multer";

const GALLERY_IMAGE_MAX_SIZE = 12 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const galleryImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PNG, JPG, and WEBP images are allowed"));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: GALLERY_IMAGE_MAX_SIZE,
    files: 1,
    fields: 2,
    fieldSize: 8 * 1024,
    parts: 4,
  },
});

export default galleryImageUpload;
