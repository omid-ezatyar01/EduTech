import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://api.edutech.study").replace(/\/+$/, "");
const VERIFY_ENDPOINT = (import.meta.env.VITE_VERIFY_ENDPOINT || "/api/v1/certificates/verify").replace(/\/+$/, "");

const buildCandidateUrls = (baseUrl, endpoint, code) => {
  const encodedCode = encodeURIComponent(code);
  const safeBase = String(baseUrl || "").replace(/\/+$/, "");
  const safeEndpoint = String(endpoint || "").replace(/\/+$/, "");

  const urls = [`${safeBase}${safeEndpoint}/${encodedCode}`];

  // Common deployment mismatch fallbacks:
  // 1) base already includes /api/v1 but endpoint also includes /api/v1
  if (safeBase.endsWith("/api/v1") && safeEndpoint.startsWith("/api/v1")) {
    urls.push(`${safeBase}${safeEndpoint.replace(/^\/api\/v1/, "")}/${encodedCode}`);
  }
  // 2) base already includes /api but endpoint starts with /api
  if (safeBase.endsWith("/api") && safeEndpoint.startsWith("/api/")) {
    urls.push(`${safeBase}${safeEndpoint.replace(/^\/api/, "")}/${encodedCode}`);
  }
  // 3) backend may be exposed without /v1 in reverse proxy
  if (safeEndpoint.includes("/api/v1/")) {
    urls.push(`${safeBase}${safeEndpoint.replace("/api/v1/", "/api/")}/${encodedCode}`);
  }

  return [...new Set(urls)];
};

export async function verifyCertificate(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    const error = new Error("Please enter a certificate ID.");
    error.type = "invalid";
    throw error;
  }

  const candidateUrls = buildCandidateUrls(
    API_BASE_URL,
    VERIFY_ENDPOINT,
    normalizedCode,
  );

  let lastError = null;

  for (const url of candidateUrls) {
    try {
      const response = await axios.get(url, { timeout: 15000 });
      const payload = response?.data?.data || {};

      return {
        certificateId: payload.certificateId || normalizedCode,
        studentName: payload.studentName || "-",
        courseTitle: payload.courseTitle || "-",
        teacherName: payload.teacherName || "-",
        issuedAt: payload.issuedAt || null,
        status: payload.isValid === false ? "Invalid" : "Verified",
        certificateUrl: payload.certificateUrl || "",
      };
    } catch (err) {
      lastError = err;
      const statusCode = err?.response?.status;
      const apiMessage = err?.response?.data?.message || "";

      if (statusCode === 404 || statusCode === 400) {
        const friendlyInvalidMessage =
          statusCode === 400 &&
          /pattern|required|format|valid certificate id/i.test(apiMessage)
            ? "Please check the certificate ID format and try again."
            : "Certificate not found or invalid.";
        const error = new Error(friendlyInvalidMessage);
        error.type = "invalid";
        error.statusCode = statusCode;
        throw error;
      }
      // Try next candidate URL for network/proxy/route mismatch issues.
    }
  }

  const statusCode = lastError?.response?.status;
  const apiMessage = lastError?.response?.data?.message || "";
  const networkBlocked = !lastError?.response;
  const error = new Error(
    networkBlocked
      ? "We could not connect to the verification service. Please try again in a few minutes."
      : "Something went wrong. Please try again later.",
  );
  error.type = "server";
  error.statusCode = statusCode || 500;
  throw error;
}
