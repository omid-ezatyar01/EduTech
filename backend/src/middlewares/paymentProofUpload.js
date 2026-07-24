import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const paymentProofUpload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024,
    files: 1,
    fields: 5,
    fieldSize: 8 * 1024,
    parts: 7,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only JPG, PNG, or WEBP proof images are allowed"));
      return;
    }
    cb(null, true);
  },
});

export default paymentProofUpload;
