export const SUPPORT_SPECIALIZATIONS = [
  "general",
  "contact",
  "technical",
  "payments",
  "courses",
  "teacher_support",
  "certificates",
  "team_lead",
];

export const SPECIALIZATION_CATEGORIES = {
  general: [],
  contact: [
    "account",
    "consultation",
    "registration",
    "feedback",
    "complaint",
    "other",
  ],
  technical: ["technical"],
  payments: ["payment"],
  courses: ["course"],
  teacher_support: ["teaching"],
  certificates: ["certificate"],
  team_lead: [],
};

export const normalizeSupportSpecialization = (value) =>
  SUPPORT_SPECIALIZATIONS.includes(value) ? value : "general";
