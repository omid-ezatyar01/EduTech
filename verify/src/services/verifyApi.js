import axios from "axios";

const env = import.meta.env || {};
const API_BASE_URL = String(
  env.VITE_API_URL || env.VITE_API_BASE_URL || "https://api.edutech.study",
).replace(/\/+$/, "");
const VERIFY_ENDPOINT = String(
  env.VITE_VERIFY_ENDPOINT || "/api/v1/certificates/verify",
).replace(/\/+$/, "");

export const CERTIFICATE_ID_PATTERN = /^ED-\d{4}-[A-Z0-9]{3,12}$/;

const createVerificationError = (message, type, statusCode = 0) => {
  const error = new Error(message);
  error.type = type;
  error.statusCode = statusCode;
  return error;
};

export const normalizeCertificateCode = (code) =>
  String(code || "").trim().toUpperCase();

export const buildVerifyUrl = (baseUrl, endpoint, code) => {
  const safeBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  let safeEndpoint = String(endpoint || "").trim().replace(/\/+$/, "");

  if (!safeBase) {
    throw new Error("Verification API base URL is not configured.");
  }
  if (!safeEndpoint.startsWith("/")) safeEndpoint = `/${safeEndpoint}`;

  if (safeBase.endsWith("/api/v1") && safeEndpoint.startsWith("/api/v1")) {
    safeEndpoint = safeEndpoint.slice("/api/v1".length);
  } else if (safeBase.endsWith("/api") && safeEndpoint.startsWith("/api/")) {
    safeEndpoint = safeEndpoint.slice("/api".length);
  }

  return `${safeBase}${safeEndpoint}/${encodeURIComponent(code)}`;
};

export const mapVerifiedCertificate = (payload, requestedCode) => {
  if (
    !payload ||
    payload.isValid !== true ||
    !CERTIFICATE_ID_PATTERN.test(normalizeCertificateCode(payload.certificateId))
  ) {
    throw createVerificationError(
      "The verification service returned an invalid response. Please try again later.",
      "server",
      502,
    );
  }

  return {
    certificateId:
      normalizeCertificateCode(payload.certificateId) ||
      normalizeCertificateCode(requestedCode),
    studentName: String(payload.studentName || "").trim() || "-",
    courseTitle: String(payload.courseTitle || "").trim() || "-",
    teacherName: String(payload.teacherName || "").trim() || "-",
    issuedAt: payload.issuedAt || null,
    status: "Verified",
    certificateUrl: String(payload.certificateUrl || "").trim(),
  };
};

export async function verifyCertificate(code, { signal } = {}) {
  const normalizedCode = normalizeCertificateCode(code);
  if (!normalizedCode) {
    throw createVerificationError(
      "Please enter a certificate ID.",
      "invalid",
      400,
    );
  }
  if (!CERTIFICATE_ID_PATTERN.test(normalizedCode)) {
    throw createVerificationError(
      "Please check the certificate ID format and try again.",
      "invalid",
      400,
    );
  }

  const url = buildVerifyUrl(API_BASE_URL, VERIFY_ENDPOINT, normalizedCode);

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      signal,
    });
    return mapVerifiedCertificate(response?.data?.data, normalizedCode);
  } catch (error) {
    if (
      error?.type === "server" ||
      error?.type === "invalid" ||
      axios.isCancel(error) ||
      error?.code === "ERR_CANCELED"
    ) {
      throw error;
    }

    const statusCode = Number(error?.response?.status || 0);
    const apiMessage = String(error?.response?.data?.message || "");

    if (statusCode === 400 || statusCode === 404) {
      const message =
        statusCode === 400 &&
        /pattern|required|format|valid certificate id/i.test(apiMessage)
          ? "Please check the certificate ID format and try again."
          : "Certificate not found or invalid.";
      throw createVerificationError(message, "invalid", statusCode);
    }

    if (statusCode === 429) {
      throw createVerificationError(
        "Too many verification attempts. Please wait a moment and try again.",
        "server",
        statusCode,
      );
    }

    throw createVerificationError(
      !error?.response
        ? "We could not connect to the verification service. Please try again in a few minutes."
        : "Something went wrong. Please try again later.",
      "server",
      statusCode || 500,
    );
  }
}
