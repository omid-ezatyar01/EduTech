export const normalizeCertificateId = (rawValue = "") =>
  String(rawValue || "").trim().toUpperCase();

export const buildCertificateId = (enrollmentId, issuedAt) => {
  const parsedDate = issuedAt ? new Date(issuedAt) : null;
  const year =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getUTCFullYear()
      : new Date().getUTCFullYear();
  const suffix = String(enrollmentId || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .slice(-8)
    .toUpperCase()
    .padStart(8, "0");

  return `ED-${year}-${suffix}`;
};

export const buildLegacyShortCertificateId = (enrollmentId, issuedAt) => {
  const parsedDate = issuedAt ? new Date(issuedAt) : null;
  const year =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getUTCFullYear()
      : new Date().getUTCFullYear();
  const suffix = String(enrollmentId || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .slice(-3)
    .toUpperCase()
    .padStart(3, "0");

  return `ED-${year}-${suffix}`;
};

// Accept both newer IDs (8+ chars) and older short IDs (3 chars).
export const CERTIFICATE_ID_PATTERN = /^ED-\d{4}-[A-Z0-9]{3,12}$/;
