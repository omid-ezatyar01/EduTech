import multer from "multer";

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

const storage = multer.memoryStorage();

const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === "avatar") {
    if (!imageMimeTypes.has(file.mimetype)) {
      cb(new Error("Only PNG, JPG, and WEBP images are allowed for avatar"));
      return;
    }
    cb(null, true);
    return;
  }

  if (file.fieldname === "cvFile") {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF is allowed for CV file"));
      return;
    }
    cb(null, true);
    return;
  }

  if (file.fieldname === "certificateFiles") {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF is allowed for certificate file"));
      return;
    }
    cb(null, true);
    return;
  }

  cb(new Error("Unsupported file field"));
};

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: AVATAR_MAX_SIZE,
  },
});

export default avatarUpload;
