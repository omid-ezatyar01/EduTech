const parsePossiblyJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
};

const normalizeNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  if (value.trim() === "") return value;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const normalizeCoursePayload = (req, _res, next) => {
  if (!req.body || typeof req.body !== "object") {
    next();
    return;
  }

  const jsonFields = [
    "schedule",
    "requirements",
    "whatYouWillLearn",
    "targetAudience",
    "curriculumTopics",
    "previewVideoUrls",
    "tags",
    "certificate",
    "coursePolicies",
    "agreements",
    "prices",
  ];
  const booleanFields = ["isFree"];
  const numberFields = [
    "price",
    "discountPrice",
    "teacherDiscountPercentage",
    "maxStudents",
    "minimumStudentsToStart",
    "durationWeeks",
  ];

  jsonFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      req.body[field] = parsePossiblyJson(req.body[field]);
    }
  });

  booleanFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      req.body[field] = normalizeBoolean(req.body[field]);
    }
  });

  numberFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      req.body[field] = normalizeNumber(req.body[field]);
    }
  });

  next();
};

export default normalizeCoursePayload;
