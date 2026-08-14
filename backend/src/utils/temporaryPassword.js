import { randomBytes } from "node:crypto";

const TEMPORARY_PASSWORD_BYTES = 18;

export const generateTemporaryPassword = () =>
  randomBytes(TEMPORARY_PASSWORD_BYTES).toString("base64url");
