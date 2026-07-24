import ApiError from "../utils/ApiError.js";

const isUploadValidationError = (err) => {
  const message = String(err?.message || "");

  if (err?.name === "MulterError") return true;
  if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) return false;

  return (
    /Only\s.+allowed/i.test(message) ||
    /Unsupported file/i.test(message) ||
    /Unsupported file field/i.test(message) ||
    /Unexpected field/i.test(message) ||
    /File too large/i.test(message) ||
    /LIMIT_FILE_SIZE/i.test(String(err?.code || ""))
  );
};

const errorHandler = (err, _req, res, _next) => {
  const statusCode =
    err instanceof ApiError
      ? err.statusCode
      : isUploadValidationError(err)
        ? 400
        : 500;
  const isFileSizeError =
    err?.name === "MulterError" && String(err?.code || "") === "LIMIT_FILE_SIZE";
  const message = isFileSizeError
    ? err?.field === "cover"
      ? "Article cover image size must be 300 KB or less"
      : err?.field === "proof"
        ? "Proof image size must be 300 KB or less"
        : err?.field === "thumbnailFile"
          ? "Course image size must be 500 KB or less"
        : "The selected file is too large"
    : err.message || "Internal server error";

  if (statusCode >= 500) {
    console.error("Server error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
