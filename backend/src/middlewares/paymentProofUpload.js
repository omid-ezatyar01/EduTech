import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDirectory = path.resolve(process.cwd(), "uploads", "payment-proofs");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeExt = extension || ".bin";
    cb(null, `payment-proof-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const paymentProofUpload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024,
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
