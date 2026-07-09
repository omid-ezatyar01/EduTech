import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { validateEnv } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");
const mode = String(process.env.NODE_ENV || "development").trim() || "development";
const envPath = path.resolve(rootDir, ".env");
const modeEnvPath = path.resolve(rootDir, `.env.${mode}`);

dotenv.config({ path: envPath });
if (fs.existsSync(modeEnvPath)) {
  dotenv.config({ path: modeEnvPath, override: true });
}
validateEnv();
