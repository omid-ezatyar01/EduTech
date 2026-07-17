const EXCLUDED_ENROLLMENT_STATUSES = new Set(["cancelled", "canceled", "failed", "rejected", "refunded"]);

export function hasActiveEnrollmentAccess(row = {}) {
  const status = String(row?.enrollmentStatus || "").toLowerCase();
  if (EXCLUDED_ENROLLMENT_STATUSES.has(status)) return false;
  if (!["active", "completed"].includes(status)) return false;
  if (String(row?.accessStatus || "").toLowerCase() !== "allowed") return false;
  if (!row?.accessExpiresAt) return true;
  const expiresAt = new Date(row.accessExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt > new Date();
}

export function buildEnrolledCourseIdSet(rows = []) {
  const ids = new Set();
  rows.forEach((row) => {
    if (!hasActiveEnrollmentAccess(row)) return;

    const course = row?.courseId;
    const courseId =
      typeof course === "object"
        ? course?._id || course?.id
        : course;

    if (courseId) ids.add(String(courseId));
  });
  return ids;
}

