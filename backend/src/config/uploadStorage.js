import path from "path";
import { fileURLToPath } from "url";

const defaultUploadsDirectory = fileURLToPath(
  new URL("../../uploads/", import.meta.url),
);
const configuredUploadsDirectory = String(process.env.UPLOADS_DIR || "").trim();

// In production, set UPLOADS_DIR to an absolute path outside the Git checkout
// (for example /var/lib/edutech/uploads). The in-repository default keeps local
// development backwards compatible.
export const uploadsDirectory = configuredUploadsDirectory
  ? path.resolve(configuredUploadsDirectory)
  : defaultUploadsDirectory;

export const resolveUploadsPath = (...segments) =>
  path.join(uploadsDirectory, ...segments);
