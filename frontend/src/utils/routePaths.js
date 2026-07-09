const OBJECT_ID_PATTERN = /([a-f0-9]{24})$/i;

function normalizeSegment(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function extractRouteIdentifier(value = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "";

  const matchedId = normalizedValue.match(OBJECT_ID_PATTERN)?.[1];
  return matchedId || normalizedValue;
}

export function buildTeacherPath(teacher = {}) {
  const id = String(teacher?._id || teacher?.id || "").trim();
  if (!id) return "/teachers";

  const name = normalizeSegment(teacher?.name || teacher?.username || "teacher");
  return `/teacher/${name ? `${name}-${id}` : id}`;
}

export function buildCoursePath(course = {}) {
  const slug = String(course?.slug || "").trim();
  if (slug) {
    return `/course/${encodeURIComponent(slug)}`;
  }

  const id = String(course?._id || course?.id || "").trim();
  if (!id) return "/live-courses";

  const title = normalizeSegment(course?.title || "course");
  return `/course/${title ? `${title}-${id}` : id}`;
}
