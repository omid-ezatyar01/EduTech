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

const labels = {
  en: {
    general: "General support",
    contact: "Contact support",
    technical: "Technical support",
    payments: "Payment support",
    courses: "Course support",
    teacher_support: "Teacher support",
    certificates: "Certificate support",
    team_lead: "Support team lead",
  },
  fa: {
    general: "پشتیبانی عمومی",
    contact: "پشتیبانی تماس و حساب",
    technical: "پشتیبانی تخنیکی",
    payments: "پشتیبانی پرداخت",
    courses: "پشتیبانی کورس",
    teacher_support: "پشتیبانی مدرس",
    certificates: "پشتیبانی سرتیفیکیت",
    team_lead: "سرپرست تیم پشتیبانی",
  },
};

export const supportSpecializationLabel = (value, language = "en") =>
  labels[language]?.[value] || labels.en[value] || labels.en.general;
