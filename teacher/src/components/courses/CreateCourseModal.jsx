import { Check, CheckCircle2, CircleHelp, Eye, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import CourseStartDatePicker from "./CourseStartDatePicker";
import CourseImageCropModal from "./CourseImageCropModal";
import CourseTypePicker from "./CourseTypePicker";
import CourseCategoryFields from "./CourseCategoryFields";
import CourseTimeZonePicker from "./CourseTimeZonePicker";
import CoursePricingFields from "./CoursePricingFields";
import CoursePolicyInfoModal from "./CoursePolicyInfoModal";
import { COURSE_POLICY_CONTENT } from "../../data/coursePolicyContent";
import {
  buildRegionalPricesPayload,
  createEmptyRegionalPrices,
  validateRegionalPricingForm,
} from "../../utils/coursePricingForm";
import { isAllowedCourseStartDate } from "../../utils/courseStartDate";
import { getParentCategories } from "../../utils/categoryTree";
import {
  addDaysToDateValue,
  getBrowserTimeZone,
  isValidTimeZone,
  zonedDateTimeToUtc,
} from "../../utils/timezone";
import usePersistentFormDraft, {
  clearTeacherFormDraft,
} from "../../hooks/usePersistentFormDraft";

const DAY_OPTIONS = [
  { key: "monday", enumKey: "MONDAY", labelFa: "دوشنبه", labelEn: "Monday" },
  { key: "tuesday", enumKey: "TUESDAY", labelFa: "سه‌شنبه", labelEn: "Tuesday" },
  { key: "wednesday", enumKey: "WEDNESDAY", labelFa: "چهارشنبه", labelEn: "Wednesday" },
  { key: "thursday", enumKey: "THURSDAY", labelFa: "پنجشنبه", labelEn: "Thursday" },
  { key: "friday", enumKey: "FRIDAY", labelFa: "جمعه", labelEn: "Friday" },
  { key: "saturday", enumKey: "SATURDAY", labelFa: "شنبه", labelEn: "Saturday" },
  { key: "sunday", enumKey: "SUNDAY", labelFa: "یکشنبه", labelEn: "Sunday" },
];

const DEFAULT_LANGUAGE_LABELS = {
  english: { labelFa: "English", labelEn: "English" },
  persian: { labelFa: "فارسی", labelEn: "Persian" },
  pashto: { labelFa: "پشتو", labelEn: "Pashto" },
  arabic: { labelFa: "عربی", labelEn: "Arabic" },
};

const buildCourseLanguageOptions = (teacherLanguages = []) => {
  const seen = new Set();
  return (Array.isArray(teacherLanguages) ? teacherLanguages : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => {
      const labels = DEFAULT_LANGUAGE_LABELS[value.toLowerCase()];
      return {
        value,
        labelFa: labels?.labelFa || value,
        labelEn: labels?.labelEn || value,
      };
    });
};

const toMinutes = (timeText = "") => {
  if (!/^\d{2}:\d{2}$/.test(timeText)) return 0;
  const [h, m] = timeText.split(":").map((v) => Number(v));
  return h * 60 + m;
};
const DESCRIPTION_MIN_CHARS = 120;
const DESCRIPTION_MAX_CHARS = 2000;
const THUMBNAIL_MAX_BYTES = 500 * 1024;
const THUMBNAIL_RAW_MAX_BYTES = 10 * 1024 * 1024;
const THUMBNAIL_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TITLE_MIN_CHARS = 5;
const TITLE_MAX_CHARS = 120;
const COURSE_WEEKS_MIN = 1;
const COURSE_WEEKS_MAX = 104;
const COURSE_SESSIONS_MIN = 8;
const COURSE_SESSIONS_MAX = 728;
const PRICE_MAX_USD = 10000;
const MAX_STUDENTS_MIN = 1;
const MAX_STUDENTS_MAX = 2000;
const MINIMUM_STUDENTS_TO_START_MIN = 1;
const LIST_ITEM_MIN_CHARS = 3;
const LIST_ITEM_MAX_CHARS = 180;
const LIST_MAX_ITEMS = 30;
const CREATE_FORM_STEPS = [
  { id: 1, titleFa: "اطلاعات اصلی", titleEn: "Basics" },
  { id: 2, titleFa: "یادگیری", titleEn: "Learning" },
  { id: 3, titleFa: "برنامه زنده", titleEn: "Schedule" },
  { id: 4, titleFa: "قیمت و گواهینامه", titleEn: "Pricing & certificate" },
  { id: 5, titleFa: "قوانین", titleEn: "Policies" },
  { id: 6, titleFa: "پیش‌نمایش", titleEn: "Preview" },
];
const LIST_ROW_BREAK_REGEX = /\r\n?|\n|\u2028|\u2029/g;
const normalizeTextareaRows = (raw = "") =>
  String(raw)
    .replace(LIST_ROW_BREAK_REGEX, "\n")
    .split("\n")
    .map((line) => line.trim());

const parseListLines = (raw = "") =>
  normalizeTextareaRows(raw)
    .map((line) => line.replace(/^[-*•●▪◦]\s*/u, "").trim())
    .filter(Boolean);

const parseVideoLinks = (raw = "") => {
  return normalizeTextareaRows(raw).filter(Boolean);
};
const getYouTubeVideoKey = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return id ? `youtube:${id}` : "";
    }
    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname.startsWith("/watch")) {
        const id = url.searchParams.get("v") || "";
        return id ? `youtube:${id}` : "";
      }
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/").filter(Boolean)[1] || "";
        return id ? `youtube:${id}` : "";
      }
    }
    return "";
  } catch {
    return "";
  }
};

const isYouTubeLink = (value = "") => Boolean(getYouTubeVideoKey(value));

const getPreviewVideoError = (links = [], language = "fa") => {
  if (!links.length) {
    return "";
  }
  if (links.length > 5) {
    return language === "fa"
      ? "حداکثر ۵ لینک ویدیوی یوتیوب اضافه کنید."
      : "Add up to 5 YouTube preview video links for the course.";
  }
  if (!links.every(isYouTubeLink)) {
    return language === "fa"
      ? "لینک‌های ویدیوی معرفی کورس باید فقط از YouTube یا youtu.be باشند."
      : "Course preview video links must be from YouTube or youtu.be.";
  }
  const videoKeys = links.map(getYouTubeVideoKey);
  if (new Set(videoKeys).size !== videoKeys.length) {
    return language === "fa"
      ? "لینک‌های تکراری مجاز نیستند. هر ویدیو باید متفاوت باشد."
      : "Duplicate video links are not allowed. Each video must be different.";
  }
  return "";
};

const validateListField = (items = []) => {
  if (!Array.isArray(items) || !items.length) return false;
  if (items.length > LIST_MAX_ITEMS) return false;
  return items.every(
    (item) =>
      String(item || "").trim().length >= LIST_ITEM_MIN_CHARS &&
      String(item || "").trim().length <= LIST_ITEM_MAX_CHARS,
  );
};

const getInvalidListField = (fields = []) =>
  fields.find(({ items }) => !validateListField(items)) || null;

const getInvalidListFieldError = (fields = [], language = "fa") => {
  const invalidField = getInvalidListField(fields);
  if (!invalidField) return "";
  return language === "fa"
    ? `${invalidField.labelFa} باید بین ۱ تا ${LIST_MAX_ITEMS} مورد داشته باشد و هر مورد بین ${LIST_ITEM_MIN_CHARS} تا ${LIST_ITEM_MAX_CHARS} کاراکتر باشد.`
    : `${invalidField.labelEn} must have 1-${LIST_MAX_ITEMS} items, and each item must be ${LIST_ITEM_MIN_CHARS}-${LIST_ITEM_MAX_CHARS} characters.`;
};

const clampPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const normalizeMinimumCoursePrice = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const roundCurrencyAmount = (value, decimalPlaces = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round(numeric * factor) / factor;
};

const isWholeDollarAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  return Number.isInteger(numeric);
};

const formatUsdtAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numeric);
};

const calculateTeacherPayout = (basePrice, totalDiscountPercentage, teacherDeductionPercentage) => {
  const normalizedBasePrice = Number.isFinite(Number(basePrice)) ? Math.max(0, Number(basePrice)) : 0;
  const normalizedTotalDiscount = clampPercentage(totalDiscountPercentage);
  const normalizedDeduction = clampPercentage(teacherDeductionPercentage);
  const studentFinalPrice = Math.max(
    0,
    roundCurrencyAmount(normalizedBasePrice - ((normalizedBasePrice * normalizedTotalDiscount) / 100)),
  );
  const platformDeductionAmount = roundCurrencyAmount((studentFinalPrice * normalizedDeduction) / 100);
  const teacherNetIncome = Math.max(0, roundCurrencyAmount(studentFinalPrice - platformDeductionAmount));

  return {
    studentFinalPrice,
    platformDeductionAmount,
    teacherNetIncome,
  };
};

const buildPricingPreview = ({
  basePrice,
  teacherDiscountPercentage,
  globalDiscountPercentage,
  teacherDeductionPercentage,
}) => {
  const normalizedBasePrice = Number.isFinite(Number(basePrice)) ? Math.max(0, Number(basePrice)) : 0;
  const normalizedTeacherDiscount = clampPercentage(teacherDiscountPercentage);
  const normalizedGlobalDiscount = clampPercentage(globalDiscountPercentage);
  const normalizedTeacherDeduction = clampPercentage(teacherDeductionPercentage);
  const totalDiscountPercentage = Math.max(
    0,
    Math.min(100, normalizedTeacherDiscount + normalizedGlobalDiscount),
  );
  const payout = calculateTeacherPayout(
    normalizedBasePrice,
    totalDiscountPercentage,
    normalizedTeacherDeduction,
  );

  return {
    normalizedBasePrice,
    normalizedTeacherDiscount,
    normalizedGlobalDiscount,
    normalizedTeacherDeduction,
    totalDiscountPercentage,
    studentFinalPrice: payout.studentFinalPrice,
    platformDeductionAmount: payout.platformDeductionAmount,
    teacherNetIncome: payout.teacherNetIncome,
  };
};

const isValidTimeText = (value = "") => /^\d{2}:\d{2}$/.test(String(value || ""));

export default function CreateCourseModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  language,
  isRTL,
  categories = [],
  pricingSettings = {},
  teacherLanguages = [],
  defaultTimeZone = "",
}) {
  const levels = useMemo(
    () => [
      { value: "beginner", labelFa: "ابتدایی", labelEn: "Beginner" },
      { value: "intermediate", labelFa: "متوسط", labelEn: "Intermediate" },
      { value: "advanced", labelFa: "پیشرفته", labelEn: "Advanced" },
    ],
    [],
  );

  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const firstCategory = parentCategories[0]?._id || "";
  const courseLanguageOptions = useMemo(
    () => buildCourseLanguageOptions(teacherLanguages),
    [teacherLanguages],
  );
  const firstCourseLanguage = courseLanguageOptions[0]?.value || "";

  const getInitialForm = () => ({
    title: "",
    description: "",
    category: firstCategory,
    subcategory: "",
    level: "beginner",
    language: firstCourseLanguage,
    pricingType: "paid",
    priceMode: "single",
    regionalPrices: createEmptyRegionalPrices(),
    paymentPlan: "monthly",
    price: "",
    teacherDiscountPercentage: "0",
    courseType: "general",
    maxStudents: "30",
    minimumStudentsToStart: "1",
    durationWeeks: "8",
    totalSessions: "24",
    startDate: "",
    startTime: "18:00",
    endTime: "19:00",
    timezone: isValidTimeZone(defaultTimeZone)
      ? defaultTimeZone
      : getBrowserTimeZone(),
    selectedDays: ["monday", "wednesday", "friday"],
    targetAudienceText: "",
    whatYouWillLearnText: "",
    requirementsText: "",
    curriculumTopicsText: "",
    previewVideoUrlsText: "",
    certificateEnabled: true,
    certificateMinimumAttendance: "70",
    certificateMinimumPassingGrade: "60",
    refundPolicyAccepted: false,
    makeupClassPolicyAccepted: false,
    conductPolicyAccepted: false,
    intellectualPropertyAccepted: false,
    informationAccurate: false,
    contentPermission: false,
    teacherPoliciesAccepted: false,
    refundRulesAccepted: false,
    sessionCommitmentAccepted: false,
    thumbnailFile: null,
  });

  const [form, setForm] = useState(() => getInitialForm());
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingThumbnailFile, setPendingThumbnailFile] = useState(null);
  const [mobileStep, setMobileStep] = useState(1);
  const [submissionSucceeded, setSubmissionSucceeded] = useState(false);
  const [activePolicyKey, setActivePolicyKey] = useState("");
  const formScrollRef = useRef(null);
  usePersistentFormDraft({
    draftId: "course:create",
    value: form,
    setValue: setForm,
    enabled: open && !submissionSucceeded,
  });
  const selectedCategory = form.category || firstCategory;
  const selectedSubcategory = categories.some(
    (item) => String(item._id) === String(form.subcategory || ""),
  )
    ? String(form.subcategory || "")
    : "";
  const matchedCourseLanguage = courseLanguageOptions.find(
    (item) => item.value.toLowerCase() === String(form.language || "").trim().toLowerCase(),
  );
  const selectedCourseLanguage = matchedCourseLanguage?.value || courseLanguageOptions[0]?.value || "";
  const minTeacherCoursePrice = normalizeMinimumCoursePrice(
    pricingSettings?.minTeacherCoursePrice,
  );
  const globalCourseDiscountPercentage = Number(pricingSettings?.globalCourseDiscountPercentage ?? 0);
  const teacherDeductionPercentage = Number(pricingSettings?.teacherDeductionPercentage ?? 0);
  const pricingPreview = buildPricingPreview({
    basePrice: form.price,
    teacherDiscountPercentage: form.teacherDiscountPercentage,
    globalDiscountPercentage: globalCourseDiscountPercentage,
    teacherDeductionPercentage,
  });
  const regionalPricingErrors =
    form.pricingType !== "free" && form.priceMode === "regional"
      ? validateRegionalPricingForm(form.regionalPrices, {
          minimumPriceUsd: minTeacherCoursePrice,
          language,
        })
      : {};
  const isCoursePriceValid = pricingPreview.normalizedBasePrice >= minTeacherCoursePrice;
  const isFinalStep = mobileStep === CREATE_FORM_STEPS.length;
  const teachingDayCount = Array.isArray(form.selectedDays)
    ? new Set(form.selectedDays).size
    : 0;
  const totalSessionCount = Number(form.totalSessions || 0);
  const sessionWeekCount =
    teachingDayCount > 0 && Number.isInteger(totalSessionCount)
      ? Math.ceil(totalSessionCount / teachingDayCount)
      : 0;
  const listFieldConfigs = [
    { key: "targetAudienceText", items: parseListLines(form.targetAudienceText), labelFa: "مخاطبین هدف", labelEn: "Target audience" },
    { key: "whatYouWillLearnText", items: parseListLines(form.whatYouWillLearnText), labelFa: "آنچه شاگرد یاد می‌گیرد", labelEn: "What students will learn" },
    { key: "requirementsText", items: parseListLines(form.requirementsText), labelFa: "پیش‌نیازها", labelEn: "Requirements" },
    { key: "curriculumTopicsText", items: parseListLines(form.curriculumTopicsText), labelFa: "موضوعات درسی", labelEn: "Curriculum topics" },
  ];
  const invalidListField = getInvalidListField(listFieldConfigs);
  const stepContainerClass = (stepId) =>
    mobileStep === stepId ? "contents" : "hidden";
  const thumbnailPreviewUrl = useMemo(() => {
    if (typeof URL === "undefined" || !form.thumbnailFile) return "";
    return URL.createObjectURL(form.thumbnailFile);
  }, [form.thumbnailFile]);

  useEffect(() => {
    if (!thumbnailPreviewUrl || typeof URL === "undefined") return undefined;
    return () => URL.revokeObjectURL(thumbnailPreviewUrl);
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileStep, open]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      setMobileStep(1);
      setSubmissionSucceeded(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const policyConfirmations = [
    {
      key: "refundPolicyAccepted",
      fa: "قوانین لغو و بازپرداخت EduTech را مطالعه کرده و می‌پذیرم.",
      en: "I have read and accept EduTech’s cancellation and refund rules.",
    },
    {
      key: "makeupClassPolicyAccepted",
      fa: "جلسه از دست‌رفته را دوباره زمان‌بندی و شاگردان را آگاه می‌کنم.",
      en: "I will reschedule missed sessions and notify students.",
    },
    {
      key: "conductPolicyAccepted",
      fa: "قوانین رفتاری، حریم خصوصی و عدم اشتراک لینک خصوصی صنف را می‌پذیرم.",
      en: "I accept conduct, privacy, and private meeting-link rules.",
    },
    {
      key: "intellectualPropertyAccepted",
      fa: "برای تصاویر و محتوای این کورس حق استفاده دارم.",
      en: "I have permission to use all images and course content.",
    },
  ];
  const finalConfirmations = [
    { key: "informationAccurate", fa: "تمام معلومات کورس دقیق است.", en: "All course information is accurate." },
    { key: "contentPermission", fa: "اجازه استفاده از محتوای بارگذاری‌شده را دارم.", en: "I may use the uploaded content." },
    { key: "teacherPoliciesAccepted", fa: "قوانین استاد و کورس EduTech را می‌پذیرم.", en: "I accept EduTech teacher and course policies." },
    { key: "refundRulesAccepted", fa: "قوانین بازپرداخت و لغو را درک کرده‌ام.", en: "I understand refund and cancellation rules." },
    { key: "sessionCommitmentAccepted", fa: "تعداد جلسات اعلام‌شده را برگزار می‌کنم.", en: "I will deliver the stated number of sessions." },
  ];

  const handleThumbnailInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (!THUMBNAIL_MIME_TYPES.has(file.type)) {
      const message =
        language === "fa"
          ? "فقط تصویر PNG، JPG یا WEBP مجاز است."
          : "Only PNG, JPG, or WEBP images are allowed.";
      setFieldErrors({ thumbnailFile: message });
      setFormError(message);
      return;
    }
    if (file.size > THUMBNAIL_RAW_MAX_BYTES) {
      const message =
        language === "fa"
          ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد؛ تصویر نهایی خودکار به کمتر از ۵۰۰ کیلوبایت فشرده می‌شود."
          : "The source image must be under 10 MB; the final image is automatically compressed below 500 KB.";
      setFieldErrors({ thumbnailFile: message });
      setFormError(message);
      return;
    }
    setPendingThumbnailFile(file);
  };

  const handleApplyThumbnailCrop = (file) => {
    if (file?.size > THUMBNAIL_MAX_BYTES) {
      const message =
        language === "fa"
          ? "حجم تصویر کورس بعد از آماده‌سازی باید حداکثر ۵۰۰ کیلوبایت باشد."
          : "The prepared course image must be 500 KB or smaller.";
      setFieldErrors({ thumbnailFile: message });
      setFormError(message);
      setPendingThumbnailFile(null);
      return;
    }
    setForm((prev) => ({ ...prev, thumbnailFile: file }));
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next.thumbnailFile;
      return next;
    });
    setFormError("");
    setPendingThumbnailFile(null);
  };

  const toggleDay = (dayKey) => {
    setForm((prev) => {
      const exists = prev.selectedDays.includes(dayKey);
      if (exists) {
        return {
          ...prev,
          selectedDays: prev.selectedDays.filter((row) => row !== dayKey),
        };
      }

      return {
        ...prev,
        selectedDays: [...prev.selectedDays, dayKey],
      };
    });
  };

  const getStepValidationError = (step) => {
    if (step === 1) {
      const titleLength = String(form.title || "").trim().length;
      const descriptionLength = String(form.description || "").trim().length;
      const previewVideoUrls = parseVideoLinks(form.previewVideoUrlsText);

      if (titleLength < TITLE_MIN_CHARS || titleLength > TITLE_MAX_CHARS) {
        return language === "fa"
          ? `عنوان کورس باید بین ${TITLE_MIN_CHARS} تا ${TITLE_MAX_CHARS} کاراکتر باشد.`
          : `Course title must be between ${TITLE_MIN_CHARS} and ${TITLE_MAX_CHARS} characters.`;
      }
      if (!/\p{L}/u.test(String(form.title || ""))) {
        return language === "fa"
          ? "عنوان کورس باید شامل حروف باشد و نمی‌تواند فقط عدد یا علامت باشد."
          : "Course title must contain letters; it cannot be only numbers or symbols.";
      }
      if (descriptionLength < DESCRIPTION_MIN_CHARS || descriptionLength > DESCRIPTION_MAX_CHARS) {
        return language === "fa"
          ? `توضیحات کامل باید بین ${DESCRIPTION_MIN_CHARS} تا ${DESCRIPTION_MAX_CHARS} کاراکتر باشد.`
          : `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`;
      }
      const previewVideoError = getPreviewVideoError(previewVideoUrls, language);
      if (previewVideoError) return previewVideoError;
      const thumbnail = form.thumbnailFile || null;
      if (!thumbnail) {
        return language === "fa"
          ? "تصویر کورس الزامی است."
          : "Course image is required.";
      }
      if (thumbnail && thumbnail.size > THUMBNAIL_MAX_BYTES) {
        return language === "fa"
          ? "حجم تصویر کورس باید حداکثر ۵۰۰ کیلوبایت باشد."
          : "Course image must be 500 KB or smaller.";
      }
      return "";
    }

    if (step === 2) {
      const listError = getInvalidListFieldError(listFieldConfigs, language);
      if (listError) return listError;
      return "";
    }

    if (step === 3) {
      const durationWeeks = sessionWeekCount;
      const totalSessions = Number(form.totalSessions || 0);
      const startDateValue = new Date(`${form.startDate}T00:00:00`);
      const startTime = String(form.startTime || "");
      const endTime = String(form.endTime || "");

      if (!selectedCategory) {
        return language === "fa" ? "لطفاً دسته‌بندی کورس را انتخاب کنید." : "Please select a course category.";
      }
      if (!selectedCourseLanguage) {
        return language === "fa"
          ? "زبان کورس باید از زبان‌های تدریس پروفایل شما انتخاب شود."
          : "Course language must be selected from your profile teaching languages.";
      }
      if (!Number.isInteger(durationWeeks) || durationWeeks < COURSE_WEEKS_MIN || durationWeeks > COURSE_WEEKS_MAX) {
        return language === "fa"
          ? `مدت کورس به هفته باید بین ${COURSE_WEEKS_MIN} تا ${COURSE_WEEKS_MAX} باشد.`
          : `Course duration in weeks must be between ${COURSE_WEEKS_MIN} and ${COURSE_WEEKS_MAX}.`;
      }
      if (!Number.isInteger(totalSessions) || totalSessions < COURSE_SESSIONS_MIN || totalSessions > COURSE_SESSIONS_MAX) {
        return language === "fa"
          ? `تعداد جلسات باید بین ${COURSE_SESSIONS_MIN} تا ${COURSE_SESSIONS_MAX} باشد.`
          : `Total sessions must be between ${COURSE_SESSIONS_MIN} and ${COURSE_SESSIONS_MAX}.`;
      }
      if (!form.startDate || Number.isNaN(startDateValue.getTime())) {
        return language === "fa" ? "تاریخ شروع کورس معتبر نیست." : "Course start date is invalid.";
      }
      if (!isAllowedCourseStartDate(form.startDate, form.timezone)) {
        return language === "fa"
          ? "تاریخ شروع کورس فقط می‌تواند روز اول یا پانزدهم ماه باشد."
          : "Course start date can only be the 1st or 15th of a month.";
      }
      if (!isValidTimeText(startTime) || !isValidTimeText(endTime)) {
        return language === "fa" ? "زمان شروع/پایان معتبر نیست." : "Start/end time is invalid.";
      }
      const startMinutes = toMinutes(startTime);
      const endMinutes = toMinutes(endTime);
      if (endMinutes <= startMinutes) {
        return language === "fa"
          ? "زمان پایان باید بعد از زمان شروع باشد."
          : "End time must be after start time.";
      }
      if (!Array.isArray(form.selectedDays) || new Set(form.selectedDays).size < 2) {
        return language === "fa"
          ? "حداقل دو روز تدریس در هفته انتخاب کنید."
          : "Select at least two teaching days per week.";
      }
      return "";
    }

    if (step === 4) {
      const maxStudents = Number(form.maxStudents || 0);
      const minimumStudentsToStart = Number(form.minimumStudentsToStart || 0);
      const price = Number(form.price || 0);
      const teacherDiscountPercentage = Number(form.teacherDiscountPercentage || 0);
      const minimumAttendance = Number(form.certificateMinimumAttendance);
      const minimumPassingGrade = Number(form.certificateMinimumPassingGrade);
      if (form.pricingType !== "free" && form.priceMode !== "regional" && (
        price < minTeacherCoursePrice ||
        price > PRICE_MAX_USD ||
        !isWholeDollarAmount(price)
      )) {
        return language === "fa"
          ? `برای کورس پولی، قیمت باید حداقل ${minTeacherCoursePrice} دالر، حداکثر ${PRICE_MAX_USD} دالر و فقط به‌صورت عدد صحیح باشد.`
          : `For a paid course, price must be at least ${minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`;
      }
      if (
        form.pricingType !== "free" &&
        form.priceMode !== "regional" &&
        (!Number.isFinite(teacherDiscountPercentage) ||
          teacherDiscountPercentage < 0 ||
          teacherDiscountPercentage > 100)
      ) {
        return language === "fa"
          ? "درصد تخفیف مدرس باید بین ۰ تا ۱۰۰ باشد."
          : "Teacher discount percentage must be between 0 and 100.";
      }
      if (
        form.pricingType !== "free" &&
        form.priceMode === "regional" &&
        Object.keys(regionalPricingErrors).length
      ) {
        return Object.values(regionalPricingErrors)[0];
      }
      if (
        form.pricingType !== "free" &&
        (!Number.isFinite(minimumAttendance) ||
          minimumAttendance < 0 ||
          minimumAttendance > 100)
      ) {
        return language === "fa"
          ? "حداقل حضور باید بین ۰ تا ۱۰۰ درصد باشد."
          : "Minimum attendance must be between 0 and 100 percent.";
      }
      if (
        form.pricingType !== "free" &&
        (!Number.isFinite(minimumPassingGrade) ||
          minimumPassingGrade < 0 ||
          minimumPassingGrade > 100)
      ) {
        return language === "fa"
          ? "حداقل نمره قبولی باید بین ۰ تا ۱۰۰ درصد باشد."
          : "Minimum passing grade must be between 0 and 100 percent.";
      }
      if (!Number.isInteger(maxStudents) || maxStudents < MAX_STUDENTS_MIN || maxStudents > MAX_STUDENTS_MAX) {
        return language === "fa"
          ? `حداکثر شاگرد باید بین ${MAX_STUDENTS_MIN} تا ${MAX_STUDENTS_MAX} باشد.`
          : `Max students must be between ${MAX_STUDENTS_MIN} and ${MAX_STUDENTS_MAX}.`;
      }
      if (
        !Number.isInteger(minimumStudentsToStart) ||
        minimumStudentsToStart < MINIMUM_STUDENTS_TO_START_MIN ||
        minimumStudentsToStart > maxStudents
      ) {
        return language === "fa"
          ? "حداقل شاگرد برای شروع باید حداقل ۱ نفر و کمتر یا مساوی ظرفیت کورس باشد."
          : "Minimum students to start must be at least 1 and cannot exceed course capacity.";
      }
    }

    if (step === 5) {
      const accepted = [
        form.refundPolicyAccepted,
        form.makeupClassPolicyAccepted,
        form.conductPolicyAccepted,
        form.intellectualPropertyAccepted,
        form.informationAccurate,
        form.contentPermission,
        form.teacherPoliciesAccepted,
        form.refundRulesAccepted,
        form.sessionCommitmentAccepted,
      ].every(Boolean);
      if (!accepted) {
        return language === "fa"
          ? "برای ادامه، قوانین و تأییدهای نهایی کورس را مطالعه و قبول کنید."
          : "Review and accept every course policy and final confirmation before continuing.";
      }
    }

    return "";
  };

  const getValidationField = (step) => {
    if (step === 1) {
      const title = String(form.title || "").trim();
      const description = String(form.description || "").trim();
      if (
        title.length < TITLE_MIN_CHARS ||
        title.length > TITLE_MAX_CHARS ||
        !/\p{L}/u.test(title)
      ) return "title";
      if (
        description.length < DESCRIPTION_MIN_CHARS ||
        description.length > DESCRIPTION_MAX_CHARS
      ) return "description";
      if (getPreviewVideoError(parseVideoLinks(form.previewVideoUrlsText), language)) {
        return "previewVideoUrlsText";
      }
      return "thumbnailFile";
    }
    if (step === 2) {
      if (invalidListField?.key) return invalidListField.key;
      return "curriculumTopicsText";
    }
    if (step === 3) {
      if (!selectedCategory) return "category";
      if (!selectedCourseLanguage) return "language";
      if (
        !Number.isInteger(totalSessionCount) ||
        totalSessionCount < COURSE_SESSIONS_MIN ||
        totalSessionCount > COURSE_SESSIONS_MAX
      ) return "totalSessions";
      if (
        !form.startDate ||
        !isAllowedCourseStartDate(form.startDate, form.timezone)
      ) return "startDate";
      if (
        !isValidTimeText(form.startTime) ||
        !isValidTimeText(form.endTime) ||
        toMinutes(form.endTime) <= toMinutes(form.startTime)
      ) return "classTime";
      if (!Array.isArray(form.selectedDays) || new Set(form.selectedDays).size < 2) {
        return "selectedDays";
      }
      return "schedule";
    }
    if (step === 4) {
      const maxStudents = Number(form.maxStudents || 0);
      const minimumStudentsToStart = Number(form.minimumStudentsToStart || 0);
      if (form.pricingType !== "free" && form.priceMode !== "regional") {
        const price = Number(form.price || 0);
        if (
          price < minTeacherCoursePrice ||
          price > PRICE_MAX_USD ||
          !isWholeDollarAmount(price)
        ) return "price";
        const discount = Number(form.teacherDiscountPercentage || 0);
        if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
          return "teacherDiscountPercentage";
        }
        const minimumAttendance = Number(form.certificateMinimumAttendance);
        if (
          !Number.isFinite(minimumAttendance) ||
          minimumAttendance < 0 ||
          minimumAttendance > 100
        ) return "certificateMinimumAttendance";
        const minimumPassingGrade = Number(form.certificateMinimumPassingGrade);
        if (
          !Number.isFinite(minimumPassingGrade) ||
          minimumPassingGrade < 0 ||
          minimumPassingGrade > 100
        ) return "certificateMinimumPassingGrade";
      }
      if (
        !Number.isInteger(maxStudents) ||
        maxStudents < MAX_STUDENTS_MIN ||
        maxStudents > MAX_STUDENTS_MAX
      ) return "maxStudents";
      if (
        !Number.isInteger(minimumStudentsToStart) ||
        minimumStudentsToStart < MINIMUM_STUDENTS_TO_START_MIN ||
        minimumStudentsToStart > maxStudents
      ) return "minimumStudentsToStart";
      return "pricing";
    }
    if (step === 5) return "agreements";
    return "form";
  };

  const validateStep = (step) => {
    const message = getStepValidationError(step);
    setFieldErrors(
      message
        ? step === 4 && form.priceMode === "regional" && Object.keys(regionalPricingErrors).length
          ? regionalPricingErrors
          : { [getValidationField(step)]: message }
        : {},
    );
    return message;
  };

  const isFieldCurrentlyInvalid = (field) => {
    if (!fieldErrors[field]) return false;
    const value = String(form[field] || "").trim();

    switch (field) {
      case "title":
        return (
          value.length < TITLE_MIN_CHARS ||
          value.length > TITLE_MAX_CHARS ||
          !/\p{L}/u.test(value)
        );
      case "description":
        return value.length < DESCRIPTION_MIN_CHARS || value.length > DESCRIPTION_MAX_CHARS;
      case "previewVideoUrlsText":
        return Boolean(
          getPreviewVideoError(parseVideoLinks(form.previewVideoUrlsText), language),
        );
      case "thumbnailFile":
        return !form.thumbnailFile || form.thumbnailFile.size > THUMBNAIL_MAX_BYTES;
      case "targetAudienceText":
      case "whatYouWillLearnText":
      case "requirementsText":
      case "curriculumTopicsText":
        return !validateListField(parseListLines(form[field]));
      case "certificateMinimumAttendance": {
        if (form.pricingType === "free") return false;
        const percentage = Number(form.certificateMinimumAttendance);
        return !Number.isFinite(percentage) || percentage < 0 || percentage > 100;
      }
      case "certificateMinimumPassingGrade": {
        if (form.pricingType === "free") return false;
        const percentage = Number(form.certificateMinimumPassingGrade);
        return !Number.isFinite(percentage) || percentage < 0 || percentage > 100;
      }
      case "category":
        return !selectedCategory;
      case "language":
        return !selectedCourseLanguage;
      case "totalSessions": {
        const sessions = Number(form.totalSessions || 0);
        return (
          !Number.isInteger(sessions) ||
          sessions < COURSE_SESSIONS_MIN ||
          sessions > COURSE_SESSIONS_MAX
        );
      }
      case "startDate": {
        const date = new Date(`${form.startDate}T00:00:00`);
        return (
          !form.startDate ||
          Number.isNaN(date.getTime()) ||
          !isAllowedCourseStartDate(form.startDate, form.timezone)
        );
      }
      case "classTime":
        return (
          !isValidTimeText(form.startTime) ||
          !isValidTimeText(form.endTime) ||
          toMinutes(form.endTime) <= toMinutes(form.startTime)
        );
      case "selectedDays":
        return !Array.isArray(form.selectedDays) || new Set(form.selectedDays).size < 2;
      case "price": {
        if (form.pricingType === "free") return false;
        const price = Number(form.price || 0);
        return (
          price < minTeacherCoursePrice ||
          price > PRICE_MAX_USD ||
          !isWholeDollarAmount(price)
        );
      }
      case "teacherDiscountPercentage": {
        if (form.pricingType === "free") return false;
        const discount = Number(form.teacherDiscountPercentage);
        return !Number.isFinite(discount) || discount < 0 || discount > 100;
      }
      case "maxStudents": {
        const maximum = Number(form.maxStudents || 0);
        return (
          !Number.isInteger(maximum) ||
          maximum < MAX_STUDENTS_MIN ||
          maximum > MAX_STUDENTS_MAX
        );
      }
      case "minimumStudentsToStart": {
        const minimum = Number(form.minimumStudentsToStart || 0);
        const maximum = Number(form.maxStudents || 0);
        return (
          !Number.isInteger(minimum) ||
          minimum < MINIMUM_STUDENTS_TO_START_MIN ||
          minimum > maximum
        );
      }
      case "agreements":
        return ![
          form.refundPolicyAccepted,
          form.makeupClassPolicyAccepted,
          form.conductPolicyAccepted,
          form.intellectualPropertyAccepted,
          form.informationAccurate,
          form.contentPermission,
          form.teacherPoliciesAccepted,
          form.refundRulesAccepted,
          form.sessionCommitmentAccepted,
        ].every(Boolean);
      default:
        return true;
    }
  };

  const visibleFieldError = (field) =>
    isFieldCurrentlyInvalid(field) ? fieldErrors[field] : "";

  const fieldClass = (field, baseClass) =>
    `${baseClass} ${
      visibleFieldError(field)
        ? "border-rose-500 bg-rose-50/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
        : ""
    }`;

  const renderFieldError = (field) =>
    visibleFieldError(field) ? (
      <p className="mt-1.5 text-xs font-bold leading-5 text-rose-600" role="alert">
        {visibleFieldError(field)}
      </p>
    ) : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    // An implicit form submission (such as Enter on a mobile keyboard)
    // advances one validated step and must never skip the final preview.
    if (!isFinalStep) {
      const validationError = validateStep(mobileStep);
      if (validationError) {
        setFormError(validationError);
        return;
      }
      setMobileStep((previous) =>
        Math.min(CREATE_FORM_STEPS.length, previous + 1),
      );
      return;
    }

    for (let step = 1; step <= 5; step += 1) {
      const validationError = validateStep(step);
      if (validationError) {
        setMobileStep(step);
        setFormError(validationError);
        return;
      }
    }
    const { pricingType, priceMode, regionalPrices, ...rest } = form;
    // Old locally saved drafts may still contain the removed tags field.
    delete rest.tagsText;
    const isFree = pricingType === "free";
    const price = Number(form.price || 0);
    const teacherDiscountPercentage = Number(form.teacherDiscountPercentage || 0);
    const normalizedTeacherDiscountPercentage = clampPercentage(
      Number.isFinite(teacherDiscountPercentage) ? teacherDiscountPercentage : 0,
    );
    const descriptionLength = String(form.description || "").trim().length;
    const titleLength = String(form.title || "").trim().length;
    const thumbnail = form.thumbnailFile || null;
    const targetAudience = listFieldConfigs[0].items;
    const whatYouWillLearn = listFieldConfigs[1].items;
    const requirements = listFieldConfigs[2].items;
    const curriculumTopics = listFieldConfigs[3].items;
    const previewVideoUrls = parseVideoLinks(form.previewVideoUrlsText);
    const listFieldError = getInvalidListFieldError(listFieldConfigs, language);
    const startDateValue = new Date(`${form.startDate}T00:00:00`);
    const startTime = form.startTime;
    const endTime = form.endTime;
    const durationWeeks = sessionWeekCount;
    const totalSessions = Number(form.totalSessions || 0);

    if (!selectedCourseLanguage) {
      setFormError(
        language === "fa"
          ? "زبان کورس باید از زبان‌های تدریس پروفایل شما انتخاب شود."
          : "Course language must be selected from your profile teaching languages.",
      );
      return;
    }

    if (titleLength < TITLE_MIN_CHARS || titleLength > TITLE_MAX_CHARS) {
      setFormError(
        language === "fa"
          ? `عنوان کورس باید بین ${TITLE_MIN_CHARS} تا ${TITLE_MAX_CHARS} کاراکتر باشد.`
          : `Course title must be between ${TITLE_MIN_CHARS} and ${TITLE_MAX_CHARS} characters.`,
      );
      return;
    }
    if (!/\p{L}/u.test(String(form.title || ""))) {
      setFormError(
        language === "fa"
          ? "عنوان کورس باید شامل حروف باشد و نمی‌تواند فقط عدد یا علامت باشد."
          : "Course title must contain letters; it cannot be only numbers or symbols.",
      );
      return;
    }

    if (
      !isFree &&
      priceMode !== "regional" &&
      (
        price < minTeacherCoursePrice ||
        price > PRICE_MAX_USD ||
        !isWholeDollarAmount(price)
      )
    ) {
      setFormError(
        language === "fa"
          ? `برای کورس پولی، قیمت باید حداقل ${minTeacherCoursePrice} دالر، حداکثر ${PRICE_MAX_USD} دالر و فقط به‌صورت عدد صحیح باشد.`
          : `For a paid course, price must be at least ${minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`,
      );
      return;
    }

    const normalizedRegionalPrices =
      priceMode === "regional" ? buildRegionalPricesPayload(regionalPrices) : null;
    const submitRegionalErrors =
      !isFree && priceMode === "regional"
        ? validateRegionalPricingForm(regionalPrices, {
            minimumPriceUsd: minTeacherCoursePrice,
            language,
          })
        : {};
    if (Object.keys(submitRegionalErrors).length) {
      setFieldErrors(submitRegionalErrors);
      setFormError(Object.values(submitRegionalErrors)[0]);
      return;
    }
    const internationalPrice = normalizedRegionalPrices?.international;
    const internationalRegularPrice = Number(internationalPrice?.regularPrice || 0);
    const internationalDiscountedPrice = Number(internationalPrice?.discountedPrice || 0);
    const internationalDiscountPercentage =
      internationalRegularPrice > 0 &&
      internationalDiscountedPrice > 0 &&
      internationalDiscountedPrice < internationalRegularPrice
        ? ((internationalRegularPrice - internationalDiscountedPrice) / internationalRegularPrice) * 100
        : 0;

    if (!isFree && (normalizedTeacherDiscountPercentage < 0 || normalizedTeacherDiscountPercentage > 100)) {
      setFormError(
        language === "fa"
          ? "درصد تخفیف مدرس باید بین ۰ تا ۱۰۰ باشد."
          : "Teacher discount percentage must be between 0 and 100.",
      );
      return;
    }

    if (!Array.isArray(form.selectedDays) || new Set(form.selectedDays).size < 2) {
      setFormError(
        language === "fa"
          ? "حداقل دو روز تدریس در هفته انتخاب کنید."
          : "Select at least two teaching days per week.",
      );
      return;
    }

    if (!Number.isInteger(totalSessions) || totalSessions < COURSE_SESSIONS_MIN || totalSessions > COURSE_SESSIONS_MAX) {
      setFormError(
        language === "fa"
          ? `تعداد جلسات باید بین ${COURSE_SESSIONS_MIN} تا ${COURSE_SESSIONS_MAX} باشد.`
          : `Total sessions must be between ${COURSE_SESSIONS_MIN} and ${COURSE_SESSIONS_MAX}.`,
      );
      return;
    }

    if (!Number.isInteger(durationWeeks) || durationWeeks < COURSE_WEEKS_MIN || durationWeeks > COURSE_WEEKS_MAX) {
      setFormError(
        language === "fa"
          ? `مدت کورس به هفته باید بین ${COURSE_WEEKS_MIN} تا ${COURSE_WEEKS_MAX} باشد.`
          : `Course duration in weeks must be between ${COURSE_WEEKS_MIN} and ${COURSE_WEEKS_MAX}.`,
      );
      return;
    }

    if (!form.startDate || Number.isNaN(startDateValue.getTime())) {
      setFormError(
        language === "fa"
          ? "تاریخ شروع کورس معتبر نیست."
          : "Course start date is invalid.",
      );
      return;
    }

    if (!isAllowedCourseStartDate(form.startDate, form.timezone)) {
      setFormError(
        language === "fa"
          ? "تاریخ شروع کورس فقط می‌تواند روز اول یا پانزدهم ماه باشد."
          : "Course start date can only be the 1st or 15th of a month.",
      );
      return;
    }

    if (listFieldError) {
      setFormError(listFieldError);
      return;
    }

    const previewVideoError = getPreviewVideoError(previewVideoUrls, language);
    if (previewVideoError) {
      setFormError(previewVideoError);
      return;
    }

    if (!thumbnail) {
      setFormError(
        language === "fa"
          ? "تصویر کورس الزامی است."
          : "Course image is required.",
      );
      return;
    }

    if (thumbnail && thumbnail.size > THUMBNAIL_MAX_BYTES) {
      setFormError(
        language === "fa"
          ? "حجم تصویر کورس باید حداکثر ۵۰۰ کیلوبایت باشد."
          : "Course image must be 500 KB or smaller.",
      );
      return;
    }

    if (descriptionLength < DESCRIPTION_MIN_CHARS || descriptionLength > DESCRIPTION_MAX_CHARS) {
      setFormError(
        language === "fa"
          ? `توضیحات کامل باید بین ${DESCRIPTION_MIN_CHARS} تا ${DESCRIPTION_MAX_CHARS} کاراکتر باشد.`
          : `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`,
      );
      return;
    }

    const maxStudents = Number(form.maxStudents || 0);
    const minimumStudentsToStart = Number(form.minimumStudentsToStart || 0);
    if (!Number.isInteger(maxStudents) || maxStudents < MAX_STUDENTS_MIN || maxStudents > MAX_STUDENTS_MAX) {
      setFormError(
        language === "fa"
          ? `حداکثر شاگرد باید بین ${MAX_STUDENTS_MIN} تا ${MAX_STUDENTS_MAX} باشد.`
          : `Max students must be between ${MAX_STUDENTS_MIN} and ${MAX_STUDENTS_MAX}.`,
      );
      return;
    }
    if (
      !Number.isInteger(minimumStudentsToStart) ||
      minimumStudentsToStart < MINIMUM_STUDENTS_TO_START_MIN ||
      minimumStudentsToStart > maxStudents
    ) {
      setFormError(
        language === "fa"
          ? "حداقل شاگرد برای شروع باید حداقل ۱ نفر و کمتر یا مساوی ظرفیت کورس باشد."
          : "Minimum students to start must be at least 1 and cannot exceed course capacity.",
      );
      return;
    }

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (endMinutes <= startMinutes) {
      setFormError(
        language === "fa"
          ? "زمان پایان باید بعد از زمان شروع باشد."
          : "End time must be after start time.",
      );
      return;
    }

    const schedule = form.selectedDays.map((dayKey) => ({
      day: dayKey,
      startTime,
      endTime,
    }));

    const startDateTime = zonedDateTimeToUtc(
      form.startDate,
      startTime,
      form.timezone,
    );
    if (!startDateTime) {
      setFormError(
        language === "fa"
          ? "تاریخ و زمان شروع کورس معتبر نیست."
          : "Course start date/time is invalid.",
      );
      return;
    }

    const computedEndDate = zonedDateTimeToUtc(
      addDaysToDateValue(form.startDate, durationWeeks * 7 - 1),
      endTime,
      form.timezone,
    );
    if (!computedEndDate) {
      setFormError(
        language === "fa"
          ? "تاریخ و زمان پایان کورس معتبر نیست."
          : "Course end date/time is invalid.",
      );
      return;
    }

    try {
      await onSubmit({
      ...rest,
      category: selectedCategory,
      subcategory: selectedSubcategory || null,
      language: selectedCourseLanguage,
      pricingType: isFree ? "single" : priceMode,
      prices: priceMode === "regional" && !isFree ? normalizedRegionalPrices : undefined,
      price: isFree ? 0 : priceMode === "regional" ? internationalRegularPrice : price,
      teacherDiscountPercentage:
        isFree
          ? 0
          : priceMode === "regional"
            ? internationalDiscountPercentage
            : normalizedTeacherDiscountPercentage,
      maxStudents,
      minimumStudentsToStart,
      durationWeeks,
      totalSessions,
      isFree,
      currency: "USD",
      meetingType: "google_meet",
      meetingLink: "",
      startDate: startDateTime.toISOString(),
      endDate: computedEndDate.toISOString(),
      thumbnailFile: thumbnail,
      schedule,
      targetAudience,
      whatYouWillLearn,
      requirements,
      curriculumTopics,
      previewVideoUrls,
      timezone: form.timezone,
      certificate: {
        enabled: !isFree,
        minimumAttendance: isFree
          ? 0
          : Number(form.certificateMinimumAttendance || 0),
        minimumPassingGrade: isFree
          ? 0
          : Number(form.certificateMinimumPassingGrade || 0),
        assignmentsRequired: false,
        finalProjectRequired: false,
        fullPaymentRequired: !isFree,
      },
      coursePolicies: {
        refundPolicyAccepted: Boolean(form.refundPolicyAccepted),
        attendancePolicy: "",
        makeupClassPolicyAccepted: Boolean(form.makeupClassPolicyAccepted),
        conductPolicyAccepted: Boolean(form.conductPolicyAccepted),
        intellectualPropertyAccepted: Boolean(form.intellectualPropertyAccepted),
      },
      agreements: {
        informationAccurate: Boolean(form.informationAccurate),
        contentPermission: Boolean(form.contentPermission),
        teacherPoliciesAccepted: Boolean(form.teacherPoliciesAccepted),
        refundRulesAccepted: Boolean(form.refundRulesAccepted),
        sessionCommitmentAccepted: Boolean(form.sessionCommitmentAccepted),
      },
      });
      clearTeacherFormDraft("course:create");
      setForm(getInitialForm());
      setFieldErrors({});
      setMobileStep(1);
      setSubmissionSucceeded(true);
    } catch (error) {
      setFormError(
        error?.message ||
          (language === "fa"
            ? "ذخیره کورس ناموفق بود. دوباره تلاش کنید."
            : "Could not save the course. Please try again."),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0F172A]/55 p-0 sm:items-center sm:p-4">
      <div
        className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[95vh] sm:rounded-2xl"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] px-4 py-3 sm:px-5 sm:py-4">
          <h3 className="min-w-0 text-start text-lg font-black text-[#0F172A]">{language === "fa" ? "ایجاد کورس جدید" : "Create New Course"}</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {submissionSucceeded ? (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 text-center sm:px-10"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={42} strokeWidth={2.4} />
            </div>
            <h4 className="mt-6 text-2xl font-black text-slate-950">
              {language === "fa" ? "کورس با موفقیت ایجاد شد" : "Course created successfully"}
            </h4>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-600">
              {language === "fa"
                ? "اطلاعات کورس شما ذخیره شد و برای بررسی مدیر ارسال گردید. می‌توانید اکنون با خیال راحت به فهرست کورس‌ها برگردید."
                : "Your course was saved and sent for admin review. You can now return to your course list."}
            </p>
            <div className="mt-7 w-full max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold leading-6 text-emerald-800">
              {language === "fa"
                ? "پس از تأیید مدیر، وضعیت کورس در همین صفحه به‌روزرسانی می‌شود."
                : "After admin approval, the course status will update on this page."}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 h-12 w-full max-w-sm rounded-xl bg-[#0B4FD8] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#083fae]"
            >
              {language === "fa" ? "برگشت به کورس‌های من" : "Back to my courses"}
            </button>
          </div>
        ) : (
        <form
          ref={formScrollRef}
          noValidate
          onSubmit={handleSubmit}
          className="edutech-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-gutter:stable] sm:px-5 sm:py-4"
          dir="ltr"
        >
          <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3" dir={isRTL ? "rtl" : "ltr"}>
            <div>
              <p className="text-xs font-bold text-slate-500">
                {language === "fa"
                  ? `مرحله ${mobileStep} از ${CREATE_FORM_STEPS.length}`
                  : `Step ${mobileStep} of ${CREATE_FORM_STEPS.length}`}
              </p>
              <p className="mt-1 text-sm font-black text-slate-800">
                {language === "fa"
                  ? CREATE_FORM_STEPS[mobileStep - 1]?.titleFa
                  : CREATE_FORM_STEPS[mobileStep - 1]?.titleEn}
              </p>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {CREATE_FORM_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id > mobileStep) {
                      for (
                        let stepToValidate = mobileStep;
                        stepToValidate < step.id;
                        stepToValidate += 1
                      ) {
                        const validationError = validateStep(stepToValidate);
                        if (validationError) {
                          setMobileStep(stepToValidate);
                          setFormError(validationError);
                          return;
                        }
                      }
                    }
                    setFormError("");
                    setMobileStep(step.id);
                  }}
                  className={`flex min-w-[42px] flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-black transition sm:min-w-[96px] ${
                    mobileStep === step.id
                      ? "bg-[#0B4FD8] text-white"
                      : step.id < mobileStep
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-white text-slate-500"
                  }`}
                  aria-current={mobileStep === step.id ? "step" : undefined}
                >
                  {step.id < mobileStep ? <Check size={13} /> : <span>{step.id}</span>}
                  <span className="hidden sm:inline">{language === "fa" ? step.titleFa : step.titleEn}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 text-start sm:grid-cols-2 sm:gap-4" dir={isRTL ? "rtl" : "ltr"}>
          {formError && !Object.keys(fieldErrors).length ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 sm:col-span-2">
              {formError}
            </div>
          ) : null}
          <div className={stepContainerClass(1)}>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "عنوان کورس" : "Course title"}
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={language === "fa" ? "عنوان کورس" : "Course title"}
              className={fieldClass(
                "title",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none",
              )}
              minLength={TITLE_MIN_CHARS}
              required
            />
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {language === "fa"
                ? `${String(form.title || "").trim().length} / ${TITLE_MAX_CHARS} کاراکتر (حداقل ${TITLE_MIN_CHARS})`
                : `${String(form.title || "").trim().length} / ${TITLE_MAX_CHARS} chars (min ${TITLE_MIN_CHARS})`}
            </p>
            {renderFieldError("title")}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "توضیحات کامل" : "Detailed description"}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={language === "fa" ? "توضیحات کامل" : "Detailed description"}
              className={fieldClass(
                "description",
                "min-h-[90px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm font-semibold",
              )}
              minLength={DESCRIPTION_MIN_CHARS}
              maxLength={DESCRIPTION_MAX_CHARS}
              required
            />
          </div>
          <p className="-mt-1 text-xs font-semibold text-slate-500 sm:col-span-2">
            {language === "fa"
              ? `${String(form.description || "").trim().length} / ${DESCRIPTION_MAX_CHARS} کاراکتر (حداقل ${DESCRIPTION_MIN_CHARS})`
              : `${String(form.description || "").trim().length} / ${DESCRIPTION_MAX_CHARS} chars (min ${DESCRIPTION_MIN_CHARS})`}
          </p>
          <div className="-mt-3 sm:col-span-2">{renderFieldError("description")}</div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "تصویر کورس *" : "Course image *"}
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleThumbnailInputChange}
              className={fieldClass(
                "thumbnailFile",
                "block w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-bold",
              )}
            />
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {language === "fa"
                ? "اندازه پیشنهادی: ۱۲۰۰ × ۶۷۵ پیکسل (نسبت ۱۶:۹) | PNG, JPG, WEBP | حداکثر ۵۰۰KB"
                : "Recommended size: 1200 × 675 px (16:9) | PNG, JPG, WEBP | Max 500 KB"}
              {form.thumbnailFile ? ` | ${form.thumbnailFile.name}` : ""}
            </p>
            {renderFieldError("thumbnailFile")}
            {thumbnailPreviewUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-50">
                <img
                  src={thumbnailPreviewUrl}
                  alt={language === "fa" ? "پیش‌نمایش تصویر کورس" : "Course image preview"}
                  className="aspect-video w-full bg-slate-50 object-contain"
                />
              </div>
            ) : null}
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label className="block text-sm font-black text-slate-900">
                  {language === "fa" ? "ویدیوهای معرفی کورس در یوتیوب" : "Course Preview YouTube Videos"}
                </label>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                  {language === "fa"
                    ? "اختیاری است. اگر خواستید، تا ۵ لینک یوتیوب متفاوت را هرکدام در یک خط بنویسید تا شاگردان قبل از خرید ببینند."
                    : "Optional. Add up to 5 different YouTube links, one per line, so students can preview before buying."}
                </p>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
                {language === "fa" ? "اختیاری" : "Optional"}
              </span>
            </div>
            <textarea
              value={form.previewVideoUrlsText}
              onChange={(e) => setForm({ ...form, previewVideoUrlsText: e.target.value })}
              placeholder={
                "https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\nhttps://www.youtube.com/shorts/..."
              }
              className={fieldClass(
                "previewVideoUrlsText",
                "mt-3 min-h-[112px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary-300",
              )}
              dir="ltr"
            />
            <p className="mt-2 text-[11px] font-bold text-slate-500">
              {language === "fa"
                ? `${parseVideoLinks(form.previewVideoUrlsText).length} لینک اضافه شده`
                : `${parseVideoLinks(form.previewVideoUrlsText).length} links added`}
            </p>
            {renderFieldError("previewVideoUrlsText")}
          </div>
          </div>

          <div className={stepContainerClass(2)}>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "مخاطبین هدف" : "Target audience"}
            </label>
            <textarea
              value={form.targetAudienceText}
              onChange={(e) => setForm({ ...form, targetAudienceText: e.target.value })}
              placeholder={
                language === "fa"
                  ? "این کورس برای چه کسانی مناسب است؟ (هر مورد در یک خط)"
                  : "Who is this course for? (one item per line)"
              }
              className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                visibleFieldError("targetAudienceText")
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
            {renderFieldError("targetAudienceText")}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "آنچه شاگرد یاد می‌گیرد" : "What students will learn"}
            </label>
            <textarea
              value={form.whatYouWillLearnText}
              onChange={(e) => setForm({ ...form, whatYouWillLearnText: e.target.value })}
              placeholder={
                language === "fa"
                  ? "آنچه در این کورس یاد می‌گیرید (هر مورد در یک خط)"
                  : "What students will learn (one item per line)"
              }
              className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                visibleFieldError("whatYouWillLearnText")
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
            {renderFieldError("whatYouWillLearnText")}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "پیش‌نیازها" : "Requirements"}
            </label>
            <textarea
              value={form.requirementsText}
              onChange={(e) => setForm({ ...form, requirementsText: e.target.value })}
              placeholder={
                language === "fa"
                  ? "پیش‌نیازها (هر مورد در یک خط)"
                  : "Requirements (one item per line)"
              }
              className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                visibleFieldError("requirementsText")
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
            {renderFieldError("requirementsText")}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "موضوعات درسی" : "Curriculum topics"}
            </label>
            <textarea
              value={form.curriculumTopicsText}
              onChange={(e) => setForm({ ...form, curriculumTopicsText: e.target.value })}
              placeholder={
                language === "fa"
                  ? "موضوعات درسی (هر مورد در یک خط)"
                  : "Curriculum topics (one item per line)"
              }
              className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                visibleFieldError("curriculumTopicsText")
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
            {renderFieldError("curriculumTopicsText")}
          </div>
          </div>

          <div className={stepContainerClass(3)}>
          <CourseCategoryFields
            categories={categories}
            categoryId={selectedCategory}
            subcategoryId={selectedSubcategory}
            language={language}
            onChange={({ category, subcategory }) =>
              setForm((previous) => ({
                ...previous,
                category,
                subcategory,
              }))
            }
          />
          <div className="-mt-3 sm:col-span-2">{renderFieldError("category")}</div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "سطح کورس" : "Course level"}
            </label>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
            >
              {levels.map((level) => (
                <option key={level.value} value={level.value}>
                  {language === "fa" ? level.labelFa : level.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "زبان کورس" : "Course language"}
            </label>
            <select
              value={selectedCourseLanguage}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold ${
                visibleFieldError("language") ? "border-rose-500 bg-rose-50/60" : "border-[#E2E8F0]"
              } ${
                courseLanguageOptions.length ? "bg-[#F8FAFC]" : "bg-slate-100 text-slate-500"
              }`}
              required
              disabled={!courseLanguageOptions.length}
            >
              {courseLanguageOptions.length ? null : (
                <option value="">
                  {language === "fa" ? "اول زبان‌های تدریس را در پروفایل انتخاب کنید" : "Select teaching languages in your profile first"}
                </option>
              )}
              {courseLanguageOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {language === "fa" ? item.labelFa : item.labelEn}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {language === "fa"
                ? "فقط زبان‌هایی که در پروفایل استاد انتخاب شده‌اند قابل استفاده است."
                : "Only languages selected in your teacher profile can be used."}
            </p>
            {renderFieldError("language")}
          </div>

          <CourseTypePicker
            value={form.courseType}
            onChange={(courseType) => setForm({ ...form, courseType })}
            language={language}
          />

          <CourseTimeZonePicker
            value={form.timezone}
            onChange={(timezone) => setForm({ ...form, timezone })}
            language={language}
          />

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "تعداد مجموعی جلسات" : "Total course sessions"}
            </label>
            <input
              type="number"
              min={COURSE_SESSIONS_MIN}
              max={COURSE_SESSIONS_MAX}
              step="1"
              value={form.totalSessions}
              onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
              placeholder={language === "fa" ? "حداقل ۸ جلسه" : "At least 8 sessions"}
              className={fieldClass(
                "totalSessions",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold",
              )}
              required
            />
            {renderFieldError("totalSessions")}
          </div>

          <CourseStartDatePicker
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
              language={language}
              timeZone={form.timezone}
            />
          <div className="-mt-3 sm:col-span-2">{renderFieldError("startDate")}</div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "زمان شروع درس" : "Lesson start time"}
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className={fieldClass(
                "classTime",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold",
              )}
              required
            />
            {renderFieldError("classTime")}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "زمان ختم درس" : "Lesson end time"}
            </label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className={fieldClass(
                "classTime",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold",
              )}
              required
            />
          </div>

          <div className={`rounded-xl border p-3 sm:col-span-2 ${
            visibleFieldError("selectedDays")
              ? "border-rose-500 bg-rose-50/60"
              : "border-[#E2E8F0] bg-[#F8FAFC]"
          }`}>
            <p className="text-xs font-bold text-slate-600">
              {language === "fa" ? "روزهای تدریس" : "Teaching days"}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {DAY_OPTIONS.map((day) => (
                <label key={day.key} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.selectedDays.includes(day.key)}
                    onChange={() => toggleDay(day.key)}
                    className="h-4 w-4"
                  />
                  <span>{language === "fa" ? day.labelFa : day.labelEn}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
              <div>
                <p className="text-xs font-black text-blue-900">
                  {language === "fa"
                    ? "تعداد مجموعی جلسات"
                    : "Course schedule"}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-blue-700">
                  {language === "fa"
                    ? `${totalSessionCount || 0} جلسه در حدود ${sessionWeekCount || 0} هفته، با ${teachingDayCount} روز در هفته`
                    : `${totalSessionCount || 0} sessions across about ${sessionWeekCount || 0} weeks, ${teachingDayCount} days per week`}
                </p>
              </div>
              <span className="inline-flex min-w-12 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-lg font-black text-white">
                {totalSessionCount || 0}
              </span>
            </div>
            {renderFieldError("selectedDays")}
          </div>
          </div>

          <div className={stepContainerClass(4)}>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "نوع کورس" : "Course type"}
            </label>
            <select
              value={form.pricingType}
              onChange={(e) =>
                setForm({
                  ...form,
                  pricingType: e.target.value,
                  priceMode: e.target.value === "free" ? "single" : form.priceMode,
                  regionalPrices:
                    e.target.value === "free"
                      ? createEmptyRegionalPrices()
                      : form.regionalPrices,
                  price: e.target.value === "free" ? "0" : form.price,
                  teacherDiscountPercentage:
                    e.target.value === "free" ? "0" : form.teacherDiscountPercentage,
                  certificateEnabled: e.target.value !== "free",
                })
              }
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
            >
              <option value="paid">{language === "fa" ? "پولی" : "Paid"}</option>
              <option value="free">{language === "fa" ? "رایگان" : "Free"}</option>
            </select>
          </div>

          {form.pricingType !== "free" ? (
            <CoursePricingFields
              priceMode={form.priceMode}
              regionalPrices={form.regionalPrices}
              onPriceModeChange={(priceMode) =>
                setForm((current) => ({ ...current, priceMode }))
              }
              onRegionalPricesChange={(regionalPrices) =>
                setForm((current) => ({ ...current, regionalPrices }))
              }
              errors={regionalPricingErrors}
              language={language}
              minimumPriceUsd={minTeacherCoursePrice}
            />
          ) : null}

          <section className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-black text-slate-900">
                  {language === "fa" ? "گواهینامه کورس" : "Course certificate"}
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {language === "fa"
                    ? "گواهینامه مستقیماً به نوع کورس وابسته است."
                    : "Certificate availability is directly tied to the course pricing type."}
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.pricingType !== "free"}
                disabled
                readOnly
                className="h-5 w-5 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <p className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${
              form.pricingType === "free"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}>
              {form.pricingType === "free"
                ? language === "fa"
                  ? "کورس رایگان شامل گواهینامه نمی‌شود. برای فعال‌کردن آن، نوع کورس را در همین مرحله به پولی تغییر دهید."
                  : "Free courses do not include certificates. Change the course to paid in this step to enable it."
                : language === "fa"
                  ? "این کورس پولی است و پس از برآورده‌شدن شرایط زیر گواهینامه صادر می‌شود."
                  : "This paid course includes a certificate after the requirements below are met."}
            </p>
            {form.pricingType !== "free" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">
                  {language === "fa" ? "حداقل حضور (%)" : "Minimum attendance (%)"}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.certificateMinimumAttendance}
                    onChange={(event) => setForm({ ...form, certificateMinimumAttendance: event.target.value })}
                    className={fieldClass(
                      "certificateMinimumAttendance",
                      "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3",
                    )}
                  />
                  {renderFieldError("certificateMinimumAttendance")}
                </label>
                <label className="text-xs font-bold text-slate-600">
                  {language === "fa" ? "حداقل نمره قبولی (%)" : "Minimum passing grade (%)"}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.certificateMinimumPassingGrade}
                    onChange={(event) => setForm({ ...form, certificateMinimumPassingGrade: event.target.value })}
                    className={fieldClass(
                      "certificateMinimumPassingGrade",
                      "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3",
                    )}
                  />
                  {renderFieldError("certificateMinimumPassingGrade")}
                </label>
              </div>
            ) : null}
          </section>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "روش پرداخت کورس" : "Course payment plan"}
            </label>
            <select
              value={form.paymentPlan}
              onChange={(event) =>
                setForm({ ...form, paymentPlan: event.target.value })
              }
              disabled={form.pricingType === "free"}
              className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold ${
                visibleFieldError("price") ? "border-rose-500 bg-rose-50/60" : "border-[#E2E8F0]"
              } ${
                form.pricingType === "free"
                  ? "bg-slate-100 text-slate-400"
                  : "bg-[#F8FAFC]"
              }`}
            >
              <option value="monthly">
                {language === "fa" ? "پرداخت ماهانه" : "Monthly payment"}
              </option>
              <option value="whole_period">
                {language === "fa"
                  ? "یک‌بار برای تمام دوره"
                  : "One payment for the whole period"}
              </option>
            </select>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
              {form.pricingType === "free"
                ? language === "fa"
                  ? "کورس رایگان نیاز به پرداخت ندارد."
                  : "Free courses do not require payment."
                : form.paymentPlan === "monthly"
                  ? language === "fa"
                    ? "شاگرد هر ماه همین مبلغ را می‌پردازد تا دسترسی ماه بعد تمدید شود."
                    : "Students pay this amount each month to renew access."
                  : language === "fa"
                    ? "شاگرد این مبلغ را یک‌بار می‌پردازد و تا پایان کورس دسترسی دارد."
                    : "Students pay once and keep access through the course end."}
            </p>
          </div>

          {form.priceMode !== "regional" ? <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "قیمت (دالر)" : "Price (USD)"}
            </label>
            <input
              type="text"
              inputMode="numeric"
              min={form.pricingType === "free" ? 0 : minTeacherCoursePrice}
              max={PRICE_MAX_USD}
              value={form.price}
              onChange={(e) =>
                setForm({
                  ...form,
                  price: e.target.value.replace(/[^\d]/g, ""),
                })
              }
              placeholder={language === "fa" ? "قیمت (دالر)" : "Price (USD)"}
              className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                form.pricingType === "free"
                  ? "bg-slate-100 text-slate-400"
                  : "bg-[#F8FAFC]"
              }`}
              required={form.pricingType !== "free"}
              disabled={form.pricingType === "free"}
            />
            {renderFieldError("price")}
            <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              {form.pricingType === "free" ? (
                <p className="text-[11px] font-semibold text-emerald-700">
                  {language === "fa"
                    ? "این کورس رایگان است و شاگردان بدون پرداخت ثبت‌نام می‌کنند."
                    : "This course is free and students can enroll without payment."}
                </p>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-slate-600">
                    {language === "fa"
                      ? `قانون سیستم: قیمت کورس باید حداقل ${minTeacherCoursePrice} دالر باشد و فقط عدد صحیح وارد شود.`
                      : `Rule: course price must be at least ${minTeacherCoursePrice} USD and use whole numbers only.`}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${isCoursePriceValid ? "text-emerald-700" : "text-rose-700"}`}>
                    {language === "fa"
                      ? `قیمت وارد شده: ${formatUsdtAmount(pricingPreview.normalizedBasePrice)} دالر`
                      : `Entered course price: ${formatUsdtAmount(pricingPreview.normalizedBasePrice)} USD`}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    {language === "fa"
                      ? `دریافتی شما بعد از تخفیف‌ها و کسر سهم سایت: ${formatUsdtAmount(pricingPreview.teacherNetIncome)} دالر`
                      : `You receive after discounts and platform deduction: ${formatUsdtAmount(pricingPreview.teacherNetIncome)} USD`}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">
                    {language === "fa"
                      ? `سهم سایت: ${pricingPreview.normalizedTeacherDeduction}% (${formatUsdtAmount(pricingPreview.platformDeductionAmount)} دالر)`
                      : `Platform deduction: ${pricingPreview.normalizedTeacherDeduction}% (${formatUsdtAmount(pricingPreview.platformDeductionAmount)} USD)`}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-indigo-700">
                    {language === "fa"
                      ? `قیمت نهایی برای شاگرد: ${formatUsdtAmount(pricingPreview.studentFinalPrice)} دالر (تخفیف مدرس ${pricingPreview.normalizedTeacherDiscount}% + تخفیف مدیر ${pricingPreview.normalizedGlobalDiscount}%)`
                      : `Final student price: ${formatUsdtAmount(pricingPreview.studentFinalPrice)} USD (teacher ${pricingPreview.normalizedTeacherDiscount}% + admin ${pricingPreview.normalizedGlobalDiscount}% discount)`}
                  </p>
                </>
              )}
            </div>
          </div> : null}

          {form.priceMode !== "regional" ? <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "درصد تخفیف مدرس (%)" : "Teacher discount percentage (%)"}
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              max={100}
              value={form.teacherDiscountPercentage}
              onChange={(e) => setForm({ ...form, teacherDiscountPercentage: e.target.value })}
              placeholder={language === "fa" ? "اختیاری - مثال: 10" : "Optional - e.g. 10"}
              className={`h-11 w-full rounded-xl border px-3 text-sm font-semibold ${
                visibleFieldError("teacherDiscountPercentage")
                  ? "border-rose-500 bg-rose-50/60"
                  : "border-[#E2E8F0]"
              } ${
                form.pricingType === "free"
                  ? "bg-slate-100 text-slate-400"
                  : "bg-[#F8FAFC]"
              }`}
              disabled={form.pricingType === "free"}
            />
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {language === "fa"
                ? "بین ۰ تا ۱۰۰. مثال: اگر ۱۰ وارد کنید، ۱۰٪ از قیمت کورس کم می‌شود."
                : "Between 0 and 100. Example: 10 means a 10% teacher discount."}
            </p>
            {renderFieldError("teacherDiscountPercentage")}
          </div> : null}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "حداکثر شاگرد" : "Max students"}
            </label>
            <input
              type="number"
              min={MAX_STUDENTS_MIN}
              max={MAX_STUDENTS_MAX}
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              placeholder={language === "fa" ? "حداکثر شاگرد" : "Max students"}
              className={fieldClass(
                "maxStudents",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold",
              )}
              required
            />
            {renderFieldError("maxStudents")}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "حداقل شاگرد برای شروع" : "Minimum students to start"}
            </label>
            <input
              type="number"
              min={MINIMUM_STUDENTS_TO_START_MIN}
              max={Number(form.maxStudents || MAX_STUDENTS_MAX)}
              step="1"
              value={form.minimumStudentsToStart}
              onChange={(e) => setForm({ ...form, minimumStudentsToStart: e.target.value })}
              className={fieldClass(
                "minimumStudentsToStart",
                "h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold",
              )}
              placeholder={language === "fa" ? "مثلاً 10 نفر" : "For example 10 students"}
              required
            />
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {language === "fa"
                ? "تا رسیدن به این تعداد، کورس خودکار شروع نمی‌شود؛ اما شما همچنان می‌توانید خودتان صنف را شروع کنید."
                : "Until this number is reached, the course should not be considered ready automatically, but you can still start the class manually."}
            </p>
            {renderFieldError("minimumStudentsToStart")}
          </div>
          </div>

          <div className={stepContainerClass(5)}>
            <section className={`sm:col-span-2 rounded-2xl border p-4 sm:p-5 ${
              visibleFieldError("agreements")
                ? "border-rose-500 bg-rose-50/50"
                : "border-slate-200 bg-slate-50"
            }`}>
              <h4 className="text-base font-black text-slate-950">
                {language === "fa" ? "قوانین کورس" : "Course policies"}
              </h4>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
                {language === "fa"
                  ? "این قوانین از شاگرد، استاد و کیفیت کورس محافظت می‌کند."
                  : "These policies protect students, teachers, and course quality."}
              </p>
              <div className="mt-4 space-y-3">
                {policyConfirmations.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(form[item.key])}
                        onChange={(event) => setForm((previous) => ({ ...previous, [item.key]: event.target.checked }))}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="text-sm font-bold leading-6 text-slate-700">
                        {language === "fa" ? item.fa : item.en}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActivePolicyKey(item.key)}
                      aria-label={
                        language === "fa"
                          ? `توضیح ${item.fa}`
                          : `Learn more about ${item.en}`
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700 transition hover:bg-primary-100"
                    >
                      <CircleHelp size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <section className="sm:col-span-2 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 sm:p-5">
              <h4 className="text-base font-black text-slate-950">
                {language === "fa" ? "تأییدهای نهایی استاد" : "Final teacher confirmations"}
              </h4>
              <div className="mt-4 space-y-3">
                {finalConfirmations.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start gap-2 rounded-xl border border-primary-100 bg-white/80 p-3"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(form[item.key])}
                        onChange={(event) => setForm((previous) => ({ ...previous, [item.key]: event.target.checked }))}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="text-sm font-bold leading-6 text-slate-700">
                        {language === "fa" ? item.fa : item.en}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActivePolicyKey(item.key)}
                      aria-label={
                        language === "fa"
                          ? `توضیح ${item.fa}`
                          : `Learn more about ${item.en}`
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700 transition hover:bg-primary-100"
                    >
                      <CircleHelp size={18} />
                    </button>
                  </div>
                ))}
              </div>
              {renderFieldError("agreements")}
            </section>
          </div>

          <div className={stepContainerClass(6)}>
            <section className="sm:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {thumbnailPreviewUrl ? (
                <img src={thumbnailPreviewUrl} alt="" className="aspect-video max-h-72 w-full bg-slate-50 object-contain" />
              ) : (
                <div className="grid aspect-video max-h-52 place-items-center bg-slate-50 text-sm font-bold text-slate-400">
                  {language === "fa" ? "تصویر کورس را دوباره انتخاب کنید" : "Select the course image again"}
                </div>
              )}
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-primary-700">
                  <Eye size={16} />
                  {language === "fa" ? "پیش‌نمایش قبل از ارسال" : "Preview before submission"}
                </div>
                <h4 className="mt-3 text-2xl font-black text-slate-950">{form.title || "—"}</h4>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [language === "fa" ? "زبان" : "Language", selectedCourseLanguage || "—"],
                    [language === "fa" ? "جلسات" : "Sessions", totalSessionCount || "—"],
                    [language === "fa" ? "زمان" : "Time", `${form.startTime} – ${form.endTime}`],
                    [language === "fa" ? "منطقه زمانی" : "Timezone", form.timezone],
                    [language === "fa" ? "شروع" : "Start", form.startDate || "—"],
                    [language === "fa" ? "ظرفیت" : "Capacity", form.maxStudents],
                    [language === "fa" ? "روش پرداخت" : "Payment", form.pricingType === "free" ? (language === "fa" ? "رایگان" : "Free") : form.paymentPlan],
                    [
                      language === "fa" ? "قیمت" : "Price",
                      form.pricingType === "free"
                        ? "0 USD"
                        : form.priceMode === "regional"
                          ? language === "fa"
                            ? "قیمت منطقه‌ای (قیمت بین‌المللی به‌عنوان جایگزین)"
                            : "Regional pricing (International fallback)"
                          : `${form.price || "—"} USD`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-black text-slate-500">{label}</p>
                      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <p className="text-xs font-black text-slate-500">{language === "fa" ? "توضیحات کامل" : "Full description"}</p>
                  <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-7 text-slate-700">{form.description}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 z-10 mt-2 flex gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                if (isSubmitting) return;
                if (mobileStep === 1) {
                  onClose();
                  return;
                }
                setMobileStep((prev) => Math.max(1, prev - 1));
              }}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl border border-[#E2E8F0] bg-white text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mobileStep === 1
                ? (language === "fa" ? "لغو" : "Cancel")
                : (language === "fa" ? "مرحله قبل" : "Previous")}
            </button>
            {isFinalStep ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{isSubmitting ? (language === "fa" ? "در حال ایجاد..." : "Creating") : (language === "fa" ? "ایجاد کورس" : "Create Course")}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isSubmitting) return;
                  const nextStepError = validateStep(mobileStep);
                  if (nextStepError) {
                    setFormError(nextStepError);
                    return;
                  }
                  setFormError("");
                  setMobileStep((prev) => Math.min(CREATE_FORM_STEPS.length, prev + 1));
                }}
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-xl bg-[#0B4FD8] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {language === "fa" ? "مرحله بعد" : "Next"}
              </button>
            )}
          </div>

          </div>
        </form>
        )}
      </div>
      <CoursePolicyInfoModal
        policy={COURSE_POLICY_CONTENT[activePolicyKey]}
        language={language}
        isRTL={isRTL}
        onClose={() => setActivePolicyKey("")}
      />
      <CourseImageCropModal
        open={Boolean(pendingThumbnailFile)}
        file={pendingThumbnailFile}
        language={language}
        onClose={() => setPendingThumbnailFile(null)}
        onApply={handleApplyThumbnailCrop}
      />
    </div>
  );
}
