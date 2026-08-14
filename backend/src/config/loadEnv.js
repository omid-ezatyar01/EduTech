import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { validateEnv } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");
const isNodeTestRunner = Boolean(process.env.NODE_TEST_CONTEXT);
if (isNodeTestRunner && !process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}
const mode = String(process.env.NODE_ENV || "development").trim() || "development";
const envPath = path.resolve(rootDir, ".env");
const modeEnvPath = path.resolve(rootDir, `.env.${mode}`);

dotenv.config({ path: envPath });
if (fs.existsSync(modeEnvPath)) {
  dotenv.config({ path: modeEnvPath, override: true });
}
if (mode === "test") {
  process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/edutech-test";
  process.env.JWT_SECRET ||= "test-only-environment-secret";
  process.env.CLIENT_ORIGIN ||= "http://localhost:5173";
}
validateEnv();
