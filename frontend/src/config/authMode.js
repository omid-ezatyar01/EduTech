const enabledValues = new Set(["1", "true", "yes", "on"]);

export const isGoogleOnlyStudentAuth = (value) =>
  enabledValues.has(String(value ?? "true").trim().toLowerCase());

export const GOOGLE_ONLY_STUDENT_AUTH = isGoogleOnlyStudentAuth(
  import.meta.env?.VITE_GOOGLE_ONLY_AUTH,
);
