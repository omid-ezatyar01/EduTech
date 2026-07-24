import { Check, CheckCircle2, Eye, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "../../../services/http";
import CourseStartDatePicker from "./CourseStartDatePicker";
import CourseImageCropModal from "./CourseImageCropModal";
import CourseTypePicker from "./CourseTypePicker";
import CourseCategoryFields from "./CourseCategoryFields";
import CourseTimeZonePicker from "./CourseTimeZonePicker";
import { isAllowedCourseStartDate } from "../../utils/courseStartDate";
import { getParentCategories } from "../../utils/categoryTree";
import {
  addDaysToDateValue,
  getBrowserTimeZone,
  isValidTimeZone,
  zonedDateTimeToUtc,
} from "../../utils/timezone";

const DAY_OPTIONS = [
  { key: "monday", labelFa: "دوشنبه", labelEn: "Monday" },
  { key: "tuesday", labelFa: "سه‌شنبه", labelEn: "Tuesday" },
  { key: "wednesday", labelFa: "چهارشنبه", labelEn: "Wednesday" },
  { key: "thursday", labelFa: "پنجشنبه", labelEn: "Thursday" },
  { key: "friday", labelFa: "جمعه", labelEn: "Friday" },
  { key: "saturday", labelFa: "شنبه", labelEn: "Saturday" },
  { key: "sunday", labelFa: "یکشنبه", labelEn: "Sunday" },
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
const LIST_ROW_BREAK_REGEX = /\r\n?|\n|\u2028|\u2029/g;
const EDIT_FORM_STEPS = [
  { id: 1, titleFa: "اطلاعات اصلی", titleEn: "Basics" },
  { id: 2, titleFa: "محتوای آموزشی", titleEn: "Learning content" },
  { id: 3, titleFa: "برنامه کورس", titleEn: "Schedule" },
  { id: 4, titleFa: "قیمت و گواهینامه", titleEn: "Pricing & certificate" },
  { id: 5, titleFa: "بررسی تغییرات", titleEn: "Review changes" },
  { id: 6, titleFa: "پیش‌نمایش", titleEn: "Preview" },
];

const toMinutes = (timeText = "") => {
  if (!/^\d{2}:\d{2}$/.test(timeText)) return 0;
  const [h, m] = timeText.split(":").map((v) => Number(v));
  return h * 60 + m;
};

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

const extractYouTubeLinks = (value = "") => {
  const matches = String(value || "").match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return matches
    .map((url) => url.replace(/[),.;،؛]+$/g, ""))
    .filter((url) => Boolean(getYouTubeVideoKey(url)));
};

const hasYouTubeLink = (value = "") => extractYouTubeLinks(value).length > 0;

const filterTextListLines = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item && !hasYouTubeLink(item));

const collectCoursePreviewVideoLinks = (course = {}) => {
  const rows = [
    ...(Array.isArray(course?.previewVideoUrls) ? course.previewVideoUrls : []),
    ...(course?.promoVideo ? [course.promoVideo] : []),
    ...(Array.isArray(course?.targetAudience) ? course.targetAudience : []),
    ...(Array.isArray(course?.whatYouWillLearn) ? course.whatYouWillLearn : []),
    ...(Array.isArray(course?.requirements) ? course.requirements : []),
    ...(Array.isArray(course?.curriculumTopics) ? course.curriculumTopics : []),
  ].flatMap((item) => {
    const value = String(item || "").trim();
    if (!value) return [];
    const extracted = extractYouTubeLinks(value);
    return extracted.length ? extracted : [value];
  });

  const seen = new Set();
  return rows
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = getYouTubeVideoKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

const calculateTeacherPayout = (
  basePrice,
  totalDiscountPercentage,
  teacherDeductionPercentage,
) => {
  const normalizedBasePrice = Number.isFinite(Number(basePrice))
    ? Math.max(0, Number(basePrice))
    : 0;
  const normalizedTotalDiscount = clampPercentage(totalDiscountPercentage);
  const normalizedDeduction = clampPercentage(teacherDeductionPercentage);
  const studentFinalPrice = Math.max(
    0,
    roundCurrencyAmount(
      normalizedBasePrice -
        (normalizedBasePrice * normalizedTotalDiscount) / 100,
    ),
  );
  const platformDeductionAmount = roundCurrencyAmount(
    (studentFinalPrice * normalizedDeduction) / 100,
  );
  const teacherNetIncome = Math.max(
    0,
    roundCurrencyAmount(studentFinalPrice - platformDeductionAmount),
  );

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
  const normalizedBasePrice = Number.isFinite(Number(basePrice))
    ? Math.max(0, Number(basePrice))
    : 0;
  const normalizedTeacherDiscount = clampPercentage(teacherDiscountPercentage);
  const normalizedGlobalDiscount = clampPercentage(globalDiscountPercentage);
  const normalizedTeacherDeduction = clampPercentage(
    teacherDeductionPercentage,
  );
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

const linesFromArray = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join("\n") : "";

const resolveAssetUrl = (rawPath = "") => {
  const value = String(rawPath || "").trim();
  if (!value) return "";
  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  if (value.startsWith("/")) {
    const backendOrigin = getApiBase()
      .replace(/\/api\/v\d+$/i, "")
      .replace(/\/+$/, "");
    return `${backendOrigin}${value}`;
  }
  return value;
};

const toDateInputValue = (value, timeZone = getBrowserTimeZone()) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
};

const inferDurationWeeks = (startDateValue, endDateValue) => {
  const start = new Date(startDateValue || "");
  const end = new Date(endDateValue || "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 8;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 8;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.ceil(days / 7));
};

const normalizeDayKey = (value = "") => {
  const key = String(value).trim().toLowerCase();
  const map = {
    شنبه: "saturday",
    یکشنبه: "sunday",
    دوشنبه: "monday",
    سه‌شنبه: "tuesday",
    چهارشنبه: "wednesday",
    پنجشنبه: "thursday",
    جمعه: "friday",
  };
  return map[key] || key;
};

const getInitialForm = (course, categories = [], defaultTimeZone = "") => {
  const scheduleRows = Array.isArray(course?.schedule) ? course.schedule : [];
  const firstSchedule = scheduleRows[0] || {};
  const selectedDays = Array.from(
    new Set(
      scheduleRows
        .map((row) => normalizeDayKey(row?.day))
        .filter((dayKey) => DAY_OPTIONS.some((item) => item.key === dayKey)),
    ),
  );

  const parentCategories = getParentCategories(categories);
  const firstCategory = parentCategories[0]?._id || "";
  const categoryValue =
    course?.categoryId ||
    course?.category?._id ||
    course?.category ||
    firstCategory;
  const subcategoryValue =
    course?.subcategoryId ||
    course?.subcategory?._id ||
    course?.subcategory ||
    "";
  const isFree = Boolean(course?.isFree) || Number(course?.price || 0) <= 0;

  return {
    title: course?.title || "",
    description: course?.description || "",
    category: String(categoryValue || ""),
    subcategory: String(subcategoryValue || ""),
    level: course?.level || "beginner",
    courseType: course?.courseType === "special" ? "special" : "general",
    language: course?.language || "English",
    pricingType: isFree ? "free" : "paid",
    paymentPlan:
      course?.paymentPlan === "whole_period" ? "whole_period" : "monthly",
    price: isFree ? "0" : String(course?.price ?? ""),
    teacherDiscountPercentage: isFree
      ? "0"
      : Number(course?.teacherDiscountPercentage || 0) > 0
        ? String(course?.teacherDiscountPercentage || 0)
        : Number(course?.discountPrice || 0) > 0 &&
            Number(course?.price || 0) > 0
          ? String(
              Math.round(
                ((Number(course.price || 0) -
                  Number(course.discountPrice || 0)) /
                  Number(course.price || 0)) *
                  100 *
                  100,
              ) / 100,
            )
          : "0",
    maxStudents: String(course?.maxStudents || 30),
    minimumStudentsToStart: String(course?.minimumStudentsToStart || 1),
    durationWeeks: String(
      Number(course?.durationWeeks || 0) > 0
        ? Number(course.durationWeeks)
        : inferDurationWeeks(course?.startDate, course?.endDate),
    ),
    totalSessions: String(
      Number(course?.totalSessions || 0) >= COURSE_SESSIONS_MIN
        ? Number(course.totalSessions)
        : Math.max(
            COURSE_SESSIONS_MIN,
            (Number(course?.durationWeeks || 0) ||
              inferDurationWeeks(course?.startDate, course?.endDate)) *
              Math.max(1, selectedDays.length),
          ),
    ),
    startDate: toDateInputValue(
      course?.startDate,
      course?.timezone || getBrowserTimeZone(),
    ),
    startTime: firstSchedule?.startTime || "18:00",
    endTime: firstSchedule?.endTime || "19:00",
    selectedDays: selectedDays.length
      ? selectedDays
      : ["monday", "wednesday", "friday"],
    targetAudienceText: linesFromArray(filterTextListLines(course?.targetAudience)),
    whatYouWillLearnText: linesFromArray(filterTextListLines(course?.whatYouWillLearn)),
    requirementsText: linesFromArray(filterTextListLines(course?.requirements)),
    curriculumTopicsText: linesFromArray(filterTextListLines(course?.curriculumTopics)),
    previewVideoUrlsText: linesFromArray(collectCoursePreviewVideoLinks(course)),
    timezone:
      course?.timezone ||
      (isValidTimeZone(defaultTimeZone) ? defaultTimeZone : getBrowserTimeZone()),
    certificateMinimumAttendance: String(
      course?.certificate?.minimumAttendance ?? 70,
    ),
    certificateMinimumPassingGrade: String(
      course?.certificate?.minimumPassingGrade ?? 60,
    ),
    existingThumbnail: course?.thumbnail || course?.thumbnailUrl || "",
    thumbnailFile: null,
  };
};

export default function EditCourseModal({
  open,
  course,
  categories = [],
  onClose,
  onSubmit,
  language,
  isRTL,
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

  const [form, setForm] = useState(getInitialForm(course, categories));
  const [formError, setFormError] = useState("");
  const [editStep, setEditStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [submissionSucceeded, setSubmissionSucceeded] = useState(false);
  const [pendingThumbnailFile, setPendingThumbnailFile] = useState(null);
  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const courseLanguageOptions = useMemo(
    () => buildCourseLanguageOptions(teacherLanguages),
    [teacherLanguages],
  );
  const minTeacherCoursePrice = normalizeMinimumCoursePrice(
    pricingSettings?.minTeacherCoursePrice,
  );
  const globalCourseDiscountPercentage = Number(
    pricingSettings?.globalCourseDiscountPercentage ?? 0,
  );
  const teacherDeductionPercentage = Number(
    pricingSettings?.teacherDeductionPercentage ?? 0,
  );
  const isScheduleLocked = Boolean(course?.classEndedAt);
  const isCoursePricingLocked = Boolean(course?.classStartedAt);
  const isPaymentPlanLocked =
    Boolean(course?.classStartedAt) ||
    Number(course?.students || course?.enrolledStudentsCount || 0) > 0;
  const pricingPreview = buildPricingPreview({
    basePrice: form.price,
    teacherDiscountPercentage: form.teacherDiscountPercentage,
    globalDiscountPercentage: globalCourseDiscountPercentage,
    teacherDeductionPercentage,
  });
  const isCoursePriceValid =
    pricingPreview.normalizedBasePrice >= minTeacherCoursePrice;
  const teachingDayCount = new Set(form.selectedDays || []).size;
  const totalSessionCount = Number(form.totalSessions || 0);
  const durationWeeksValue = Number(form.durationWeeks || 0);
  const suggestedTotalSessions =
    teachingDayCount > 0 && Number.isInteger(durationWeeksValue)
      ? durationWeeksValue * teachingDayCount
      : 0;
  const selectedThumbnailPreviewUrl = useMemo(() => {
    if (typeof URL === "undefined" || !form.thumbnailFile) return "";
    return URL.createObjectURL(form.thumbnailFile);
  }, [form.thumbnailFile]);
  const thumbnailPreviewUrl =
    selectedThumbnailPreviewUrl || resolveAssetUrl(form.existingThumbnail);
  const isFinalStep = editStep === EDIT_FORM_STEPS.length;
  const stepContainerClass = (stepId) =>
    editStep === stepId ? "contents" : "hidden";

  useEffect(() => {
    if (!open || !course) return undefined;
    const timer = setTimeout(() => {
      setForm(getInitialForm(course, categories, defaultTimeZone));
      setFormError("");
      setEditStep(1);
      setIsSaving(false);
      setSubmissionSucceeded(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [open, course, categories, defaultTimeZone]);

  useEffect(() => {
    if (!selectedThumbnailPreviewUrl || typeof URL === "undefined")
      return undefined;
    return () => URL.revokeObjectURL(selectedThumbnailPreviewUrl);
  }, [selectedThumbnailPreviewUrl]);
  const selectedCategory = form.category || parentCategories[0]?._id || "";
  const selectedSubcategory = categories.some(
    (item) => String(item._id) === String(form.subcategory || ""),
  )
    ? String(form.subcategory || "")
    : "";
  const matchedCourseLanguage = courseLanguageOptions.find(
    (item) =>
      item.value.toLowerCase() ===
      String(form.language || "")
        .trim()
        .toLowerCase(),
  );
  const selectedCourseLanguage =
    matchedCourseLanguage?.value || courseLanguageOptions[0]?.value || "";
  const listFieldConfigs = [
    { key: "targetAudienceText", items: parseListLines(form.targetAudienceText), labelFa: "مخاطبین هدف", labelEn: "Target audience" },
    { key: "whatYouWillLearnText", items: parseListLines(form.whatYouWillLearnText), labelFa: "آنچه شاگرد یاد می‌گیرد", labelEn: "What students will learn" },
    { key: "requirementsText", items: parseListLines(form.requirementsText), labelFa: "پیش‌نیازها", labelEn: "Requirements" },
    { key: "curriculumTopicsText", items: parseListLines(form.curriculumTopicsText), labelFa: "موضوعات درسی", labelEn: "Curriculum topics" },
  ];
  const invalidListField = getInvalidListField(listFieldConfigs);

  if (!open || !course) return null;

  const handleThumbnailInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (!THUMBNAIL_MIME_TYPES.has(file.type)) {
      setFormError(
        language === "fa"
          ? "فقط تصویر PNG، JPG یا WEBP مجاز است."
          : "Only PNG, JPG, or WEBP images are allowed.",
      );
      return;
    }
    if (file.size > THUMBNAIL_RAW_MAX_BYTES) {
      setFormError(
        language === "fa"
          ? "حجم تصویر اصلی باید کمتر از ۱۰ مگابایت باشد؛ تصویر نهایی خودکار به کمتر از ۵۰۰ کیلوبایت فشرده می‌شود."
          : "The source image must be under 10 MB; the final image is automatically compressed below 500 KB.",
      );
      return;
    }
    setPendingThumbnailFile(file);
  };

  const handleApplyThumbnailCrop = (file) => {
    if (file?.size > THUMBNAIL_MAX_BYTES) {
      setFormError(
        language === "fa"
          ? "حجم تصویر کورس بعد از آماده‌سازی باید حداکثر ۵۰۰ کیلوبایت باشد."
          : "The prepared course image must be 500 KB or smaller.",
      );
      setPendingThumbnailFile(null);
      return;
    }
    setForm((prev) => ({ ...prev, thumbnailFile: file }));
    setFormError("");
    setPendingThumbnailFile(null);
  };

  const toggleDay = (dayKey) => {
    if (isScheduleLocked) return;
    setForm((prev) => {
      const exists = prev.selectedDays.includes(dayKey);
      return {
        ...prev,
        selectedDays: exists
          ? prev.selectedDays.filter((row) => row !== dayKey)
          : [...prev.selectedDays, dayKey],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const isFree = form.pricingType === "free";
    const price = Number(form.price || 0);
    const teacherDiscountPercentage = Number(
      form.teacherDiscountPercentage || 0,
    );
    const normalizedTeacherDiscountPercentage = clampPercentage(
      Number.isFinite(teacherDiscountPercentage)
        ? teacherDiscountPercentage
        : 0,
    );
    const titleLength = String(form.title || "").trim().length;
    const descriptionLength = String(form.description || "").trim().length;
    const targetAudience = listFieldConfigs[0].items;
    const whatYouWillLearn = listFieldConfigs[1].items;
    const requirements = listFieldConfigs[2].items;
    const curriculumTopics = listFieldConfigs[3].items;
    const previewVideoUrls = parseVideoLinks(form.previewVideoUrlsText);
    const listFieldError = getInvalidListFieldError(listFieldConfigs, language);
    const thumbnail = form.thumbnailFile || null;
    const hasExistingThumbnail = Boolean(
      String(form.existingThumbnail || "").trim(),
    );
    const durationWeeks = Number(form.durationWeeks || 0);
    const totalSessions = Number(form.totalSessions || 0);
    const minimumStudentsToStart = Number(form.minimumStudentsToStart || 0);
    const certificateMinimumAttendance = Number(
      form.certificateMinimumAttendance,
    );
    const certificateMinimumPassingGrade = Number(
      form.certificateMinimumPassingGrade,
    );

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

    if (
      !isFree &&
      (price < minTeacherCoursePrice ||
        price > PRICE_MAX_USD ||
        !isWholeDollarAmount(price))
    ) {
      setFormError(
        language === "fa"
          ? `برای کورس پولی، قیمت باید حداقل ${minTeacherCoursePrice} دالر، حداکثر ${PRICE_MAX_USD} دالر و فقط به‌صورت عدد صحیح باشد.`
          : `For a paid course, price must be at least ${minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`,
      );
      return;
    }

    if (
      !isFree &&
      (normalizedTeacherDiscountPercentage < 0 ||
        normalizedTeacherDiscountPercentage > 100)
    ) {
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

    if (!form.startDate) {
      setFormError(
        language === "fa"
          ? "تاریخ شروع کورس را انتخاب کنید."
          : "Select a course start date.",
      );
      return;
    }

    if (!isAllowedCourseStartDate(form.startDate)) {
      setFormError(
        language === "fa"
          ? "تاریخ شروع کورس فقط می‌تواند روز اول یا پانزدهم ماه باشد."
          : "Course start date can only be the 1st or 15th of a month.",
      );
      return;
    }

    if (
      !Number.isInteger(durationWeeks) ||
      durationWeeks < COURSE_WEEKS_MIN ||
      durationWeeks > COURSE_WEEKS_MAX
    ) {
      setFormError(
        language === "fa"
          ? `مدت کورس به هفته باید بین ${COURSE_WEEKS_MIN} تا ${COURSE_WEEKS_MAX} باشد.`
          : `Course duration in weeks must be between ${COURSE_WEEKS_MIN} and ${COURSE_WEEKS_MAX}.`,
      );
      return;
    }

    if (
      !/^\d{2}:\d{2}$/.test(form.startTime) ||
      !/^\d{2}:\d{2}$/.test(form.endTime)
    ) {
      setFormError(
        language === "fa"
          ? "زمان شروع/پایان معتبر نیست."
          : "Start/end time is invalid.",
      );
      return;
    }

    if (
      descriptionLength < DESCRIPTION_MIN_CHARS ||
      descriptionLength > DESCRIPTION_MAX_CHARS
    ) {
      setFormError(
        language === "fa"
          ? `توضیحات کامل باید بین ${DESCRIPTION_MIN_CHARS} تا ${DESCRIPTION_MAX_CHARS} کاراکتر باشد.`
          : `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`,
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

    if (!hasExistingThumbnail && !thumbnail) {
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

    const maxStudents = Number(form.maxStudents || 0);
    if (
      !Number.isInteger(maxStudents) ||
      maxStudents < MAX_STUDENTS_MIN ||
      maxStudents > MAX_STUDENTS_MAX
    ) {
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

    if (
      !isFree &&
      (!Number.isFinite(certificateMinimumAttendance) ||
        certificateMinimumAttendance < 0 ||
        certificateMinimumAttendance > 100 ||
        !Number.isFinite(certificateMinimumPassingGrade) ||
        certificateMinimumPassingGrade < 0 ||
        certificateMinimumPassingGrade > 100)
    ) {
      setFormError(
        language === "fa"
          ? "شرایط گواهینامه باید عددی بین ۰ تا ۱۰۰ باشد."
          : "Certificate requirements must be numbers between 0 and 100.",
      );
      return;
    }

    const startMinutes = toMinutes(form.startTime);
    const endMinutes = toMinutes(form.endTime);
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
      startTime: form.startTime,
      endTime: form.endTime,
    }));

    const startDateTime = zonedDateTimeToUtc(
      form.startDate,
      form.startTime,
      form.timezone,
    );
    if (!startDateTime) {
      setFormError(
        language === "fa"
          ? "تاریخ و زمان شروع معتبر نیست."
          : "Start date/time is invalid.",
      );
      return;
    }

    const computedEndDate = zonedDateTimeToUtc(
      addDaysToDateValue(form.startDate, durationWeeks * 7 - 1),
      form.endTime,
      form.timezone,
    );
    if (!computedEndDate) {
      setFormError(
        language === "fa"
          ? "تاریخ و زمان پایان معتبر نیست."
          : "End date/time is invalid.",
      );
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit({
      title: form.title,
      description: form.description,
      category: selectedCategory,
      subcategory: selectedSubcategory || null,
      level: form.level,
      courseType: form.courseType === "special" ? "special" : "general",
      language: selectedCourseLanguage,
      durationWeeks,
      totalSessions,
      isFree,
      paymentPlan: form.paymentPlan,
      price: isFree ? 0 : price,
      teacherDiscountPercentage: isFree
        ? 0
        : normalizedTeacherDiscountPercentage,
      maxStudents,
      minimumStudentsToStart,
      currency: "USD",
      meetingType: "google_meet",
      meetingLink: "",
      startDate: startDateTime.toISOString(),
      endDate: computedEndDate.toISOString(),
      schedule,
      timezone: form.timezone || "Asia/Kabul",
      certificate: {
        enabled: !isFree,
        minimumAttendance: isFree ? 0 : certificateMinimumAttendance,
        minimumPassingGrade: isFree ? 0 : certificateMinimumPassingGrade,
        fullPaymentRequired: !isFree,
      },
      targetAudience,
      whatYouWillLearn,
      requirements,
      curriculumTopics,
      previewVideoUrls,
      thumbnailFile: thumbnail,
      });
      setSubmissionSucceeded(true);
    } catch (error) {
      setFormError(
        error?.message ||
          (language === "fa"
            ? "ذخیره تغییرات ناموفق بود. دوباره تلاش کنید."
            : "Could not save the changes. Please try again."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0F172A]/55 p-0 sm:items-center sm:p-4">
      <div
        className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[95vh] sm:rounded-2xl"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] px-4 py-3 sm:px-5 sm:py-4">
          <h3 className="min-w-0 text-start text-lg font-black text-[#0F172A]">
            {language === "fa" ? "ویرایش کورس" : "Edit Course"}
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
              {language === "fa" ? "تغییرات با موفقیت ذخیره شد" : "Changes saved successfully"}
            </h4>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-600">
              {language === "fa"
                ? "نسخه تازه کورس ذخیره شد و فهرست کورس‌های شما نیز به‌روزرسانی گردید."
                : "The updated course was saved and your course list has been refreshed."}
            </p>
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
          noValidate
          onSubmit={handleSubmit}
          className="min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
          dir="ltr"
        >
          <div
            className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <p className="text-xs font-bold text-slate-500">
              {language === "fa"
                ? `مرحله ${editStep} از ${EDIT_FORM_STEPS.length}`
                : `Step ${editStep} of ${EDIT_FORM_STEPS.length}`}
            </p>
            <p className="mt-1 text-sm font-black text-slate-800">
              {language === "fa"
                ? EDIT_FORM_STEPS[editStep - 1]?.titleFa
                : EDIT_FORM_STEPS[editStep - 1]?.titleEn}
            </p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {EDIT_FORM_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError("");
                    setEditStep(step.id);
                  }}
                  className={`flex min-w-[42px] flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-black transition sm:min-w-[96px] ${
                    editStep === step.id
                      ? "bg-[#0B4FD8] text-white"
                      : step.id < editStep
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-white text-slate-500"
                  }`}
                  aria-current={editStep === step.id ? "step" : undefined}
                >
                  {step.id < editStep ? <Check size={13} /> : <span>{step.id}</span>}
                  <span className="hidden sm:inline">
                    {language === "fa" ? step.titleFa : step.titleEn}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div
            className="grid gap-3 text-start sm:grid-cols-2 sm:gap-4"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {formError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 sm:col-span-2">
                {formError}
              </div>
            ) : null}
            {isScheduleLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-6 text-amber-800 sm:col-span-2">
                {language === "fa"
                  ? "این صنف پایان یافته است. تاریخ شروع، تاریخ ختم، مدت کورس، زمان شروع/ختم و روزهای تدریس دیگر قابل تغییر نیست."
                  : "This class has ended. The start date, end date, duration, lesson start/end time, and teaching days can no longer be changed."}
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
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none"
                minLength={TITLE_MIN_CHARS}
                required
              />
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {language === "fa"
                  ? `${String(form.title || "").trim().length} / ${TITLE_MAX_CHARS} کاراکتر (حداقل ${TITLE_MIN_CHARS})`
                  : `${String(form.title || "").trim().length} / ${TITLE_MAX_CHARS} chars (min ${TITLE_MIN_CHARS})`}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "توضیحات کامل" : "Detailed description"}
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={
                  language === "fa" ? "توضیحات کامل" : "Detailed description"
                }
                className="min-h-[90px] w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm font-semibold"
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "تصویر کورس *" : "Course image *"}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleThumbnailInputChange}
                className="block w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-bold"
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {language === "fa"
                  ? "اندازه پیشنهادی: ۱۲۰۰ × ۶۷۵ پیکسل (۱۶:۹) | PNG, JPG, WEBP | حداکثر ۵۰۰KB"
                  : "Recommended size: 1200 × 675 px (16:9) | PNG, JPG, WEBP | Max 500 KB"}
                {form.thumbnailFile
                  ? ` | ${form.thumbnailFile.name}`
                  : form.existingThumbnail
                    ? language === "fa"
                      ? " | تصویر فعلی ثبت شده است"
                      : " | Current image is saved"
                    : ""}
              </p>
              {thumbnailPreviewUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-50">
                  <img
                    src={thumbnailPreviewUrl}
                    alt={
                      language === "fa"
                        ? "پیش‌نمایش تصویر کورس"
                        : "Course image preview"
                    }
                    className="aspect-video w-full bg-slate-50 object-contain"
                  />
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4">
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
                className="mt-3 min-h-[112px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary-300"
                dir="ltr"
              />
              <p className="mt-2 text-[11px] font-bold text-slate-500">
                {language === "fa"
                  ? `${parseVideoLinks(form.previewVideoUrlsText).length} لینک اضافه شده`
                  : `${parseVideoLinks(form.previewVideoUrlsText).length} links added`}
              </p>
            </div>
            </div>
            <div className={stepContainerClass(2)}>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "مخاطبین هدف" : "Target audience"}
              </label>
              <textarea
                value={form.targetAudienceText}
                onChange={(e) =>
                  setForm({ ...form, targetAudienceText: e.target.value })
                }
                placeholder={
                  language === "fa"
                    ? "این کورس برای چه کسانی مناسب است؟ (هر مورد در یک خط)"
                    : "Who is this course for? (one item per line)"
                }
                className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                  invalidListField?.key === "targetAudienceText"
                    ? "border border-rose-300 bg-rose-50"
                    : "border border-[#E2E8F0] bg-[#F8FAFC]"
                }`}
                minLength={LIST_ITEM_MIN_CHARS}
                maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa"
                  ? "آنچه شاگرد یاد می‌گیرد"
                  : "What students will learn"}
              </label>
              <textarea
                value={form.whatYouWillLearnText}
                onChange={(e) =>
                  setForm({ ...form, whatYouWillLearnText: e.target.value })
                }
                placeholder={
                  language === "fa"
                    ? "آنچه در این کورس یاد می‌گیرید (هر مورد در یک خط)"
                    : "What students will learn (one item per line)"
                }
                className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                  invalidListField?.key === "whatYouWillLearnText"
                    ? "border border-rose-300 bg-rose-50"
                    : "border border-[#E2E8F0] bg-[#F8FAFC]"
                }`}
                minLength={LIST_ITEM_MIN_CHARS}
                maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "پیش‌نیازها" : "Requirements"}
              </label>
              <textarea
                value={form.requirementsText}
                onChange={(e) =>
                  setForm({ ...form, requirementsText: e.target.value })
                }
                placeholder={
                  language === "fa"
                    ? "پیش‌نیازها (هر مورد در یک خط)"
                    : "Requirements (one item per line)"
                }
                className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                  invalidListField?.key === "requirementsText"
                    ? "border border-rose-300 bg-rose-50"
                    : "border border-[#E2E8F0] bg-[#F8FAFC]"
                }`}
                minLength={LIST_ITEM_MIN_CHARS}
                maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "موضوعات درسی" : "Curriculum topics"}
              </label>
              <textarea
                value={form.curriculumTopicsText}
                onChange={(e) =>
                  setForm({ ...form, curriculumTopicsText: e.target.value })
                }
                placeholder={
                  language === "fa"
                    ? "موضوعات درسی (هر مورد در یک خط)"
                    : "Curriculum topics (one item per line)"
                }
                className={`min-h-[90px] w-full rounded-xl p-3 text-sm font-semibold ${
                  invalidListField?.key === "curriculumTopicsText"
                    ? "border border-rose-300 bg-rose-50"
                    : "border border-[#E2E8F0] bg-[#F8FAFC]"
                }`}
                minLength={LIST_ITEM_MIN_CHARS}
                maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
                required
              />
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
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  courseLanguageOptions.length
                    ? "bg-[#F8FAFC]"
                    : "bg-slate-100 text-slate-500"
                }`}
                required
                disabled={!courseLanguageOptions.length}
              >
                {courseLanguageOptions.length ? null : (
                  <option value="">
                    {language === "fa"
                      ? "اول زبان‌های تدریس را در پروفایل انتخاب کنید"
                      : "Select teaching languages in your profile first"}
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
            </div>

            <CourseTypePicker
              value={form.courseType}
              onChange={(courseType) => setForm({ ...form, courseType })}
              language={language}
            />

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "مدت کورس (هفته)" : "Course duration (weeks)"}
              </label>
              <input
                type="number"
                min={COURSE_WEEKS_MIN}
                max={COURSE_WEEKS_MAX}
                step="1"
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
                placeholder={language === "fa" ? "مثلاً 8 هفته" : "For example 8 weeks"}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  isScheduleLocked ? "bg-slate-100 text-slate-500" : "bg-[#F8FAFC]"
                }`}
                disabled={isScheduleLocked}
                required
              />
            </div>

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
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  isScheduleLocked ? "bg-slate-100 text-slate-500" : "bg-[#F8FAFC]"
                }`}
                disabled={isScheduleLocked}
                required
              />
            </div>

            <CourseStartDatePicker
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
              language={language}
              disabled={isScheduleLocked}
            />

            <div className="sm:col-span-2">
              <CourseTimeZonePicker
                value={form.timezone}
                onChange={(timezone) => setForm({ ...form, timezone })}
                language={language}
                disabled={isScheduleLocked}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "زمان شروع درس" : "Lesson start time"}
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  isScheduleLocked ? "bg-slate-100 text-slate-500" : "bg-[#F8FAFC]"
                }`}
                disabled={isScheduleLocked}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "زمان ختم درس" : "Lesson end time"}
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  isScheduleLocked ? "bg-slate-100 text-slate-500" : "bg-[#F8FAFC]"
                }`}
                disabled={isScheduleLocked}
                required
              />
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:col-span-2">
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
                      disabled={isScheduleLocked}
                    />
                    <span>{language === "fa" ? day.labelFa : day.labelEn}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-black text-blue-900">
                    {language === "fa" ? "برنامه کورس" : "Course schedule"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-blue-700">
                    {language === "fa"
                      ? `${totalSessionCount || 0} جلسه در ${Number(form.durationWeeks || 0) || 0} هفته، با ${teachingDayCount} روز در هفته`
                      : `${totalSessionCount || 0} sessions across ${Number(form.durationWeeks || 0) || 0} weeks, ${teachingDayCount} days per week`}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-blue-700">
                    {language === "fa"
                      ? `تعداد پیشنهادی جلسات: ${suggestedTotalSessions || 0}`
                      : `Suggested session count: ${suggestedTotalSessions || 0}`}
                  </p>
                </div>
                <span className="inline-flex min-w-12 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-lg font-black text-white">
                  {totalSessionCount || 0}
                </span>
              </div>
            </div>
            </div>

            <div className={stepContainerClass(4)}>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa" ? "نوع قیمت‌گذاری" : "Pricing type"}
              </label>
              <select
                value={form.pricingType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pricingType: e.target.value,
                    price: e.target.value === "free" ? "0" : form.price,
                    teacherDiscountPercentage:
                      e.target.value === "free"
                        ? "0"
                        : form.teacherDiscountPercentage,
                  })
                }
                disabled={isCoursePricingLocked}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  isCoursePricingLocked ? "bg-slate-100 text-slate-400" : "bg-[#F8FAFC]"
                }`}
              >
                <option value="paid">
                  {language === "fa" ? "پولی" : "Paid"}
                </option>
                <option value="free">
                  {language === "fa" ? "رایگان" : "Free"}
                </option>
              </select>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                {isCoursePricingLocked
                  ? language === "fa"
                    ? "بعد از شروع صنف، نوع قیمت‌گذاری و مبلغ کورس قفل می‌شود."
                    : "After class start, the course pricing type and amount are locked."
                  : language === "fa"
                    ? "تا قبل از شروع صنف می‌توانید نوع قیمت‌گذاری و مبلغ کورس را تغییر دهید."
                    : "You can change the pricing type and course amount until the class starts."}
              </p>
            </div>

            <section className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    {language === "fa" ? "گواهینامه کورس" : "Course certificate"}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {language === "fa"
                      ? "گواهینامه مستقیماً به نوع قیمت‌گذاری کورس وابسته است."
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
              <p
                className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${
                  form.pricingType === "free"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {form.pricingType === "free"
                  ? language === "fa"
                    ? "این کورس رایگان است؛ برای فعال‌کردن گواهینامه، نوع قیمت‌گذاری را در همین مرحله به پولی تغییر دهید."
                    : "This course is free. Change it to paid in this step to enable a certificate."
                  : language === "fa"
                    ? "پس از تکمیل کورس، پرداخت کامل و رسیدن به شرایط زیر گواهینامه صادر می‌شود."
                    : "A certificate is issued after course completion, full payment, and the requirements below."}
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
                      onChange={(event) =>
                        setForm({
                          ...form,
                          certificateMinimumAttendance: event.target.value,
                        })
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    {language === "fa" ? "حداقل نمره قبولی (%)" : "Minimum passing grade (%)"}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.certificateMinimumPassingGrade}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          certificateMinimumPassingGrade: event.target.value,
                        })
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                    />
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
                disabled={form.pricingType === "free" || isPaymentPlanLocked}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  form.pricingType === "free" || isPaymentPlanLocked
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
                {isPaymentPlanLocked
                  ? language === "fa"
                    ? "بعد از ثبت‌نام شاگرد یا شروع صنف، روش پرداخت قابل تغییر نیست."
                    : "The payment plan cannot change after enrollment or class start."
                  : form.paymentPlan === "monthly"
                    ? language === "fa"
                      ? "شاگرد برای تمدید دسترسی، این مبلغ را هر ماه می‌پردازد."
                      : "Students pay this amount monthly to renew access."
                    : language === "fa"
                      ? "شاگرد یک‌بار پرداخت می‌کند و تا پایان کورس دسترسی دارد."
                      : "Students pay once for access through the course end."}
              </p>
            </div>

            <div className="sm:col-span-2">
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
                  setForm({ ...form, price: e.target.value.replace(/[^\d]/g, "") })
                }
                placeholder={language === "fa" ? "قیمت (دالر)" : "Price (USD)"}
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  form.pricingType === "free" || isCoursePricingLocked
                    ? "bg-slate-100 text-slate-400"
                    : "bg-[#F8FAFC]"
                }`}
                required={form.pricingType !== "free"}
                disabled={form.pricingType === "free" || isCoursePricingLocked}
              />
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
                    <p
                      className={`mt-1 text-[11px] font-semibold ${isCoursePriceValid ? "text-emerald-700" : "text-rose-700"}`}
                    >
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
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-600">
                {language === "fa"
                  ? "درصد تخفیف مدرس (%)"
                  : "Teacher discount percentage (%)"}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                max={100}
                value={form.teacherDiscountPercentage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    teacherDiscountPercentage: e.target.value,
                  })
                }
                placeholder={
                  language === "fa"
                    ? "اختیاری - مثال: 10"
                    : "Optional - e.g. 10"
                }
                className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
                  form.pricingType === "free" || isCoursePricingLocked
                    ? "bg-slate-100 text-slate-400"
                    : "bg-[#F8FAFC]"
                }`}
                disabled={form.pricingType === "free" || isCoursePricingLocked}
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {isCoursePricingLocked
                  ? language === "fa"
                    ? "بعد از شروع صنف، تخفیف مدرس و قیمت نهایی شاگرد تغییر نمی‌کند."
                    : "After class start, the teacher discount and final student price cannot change."
                  : language === "fa"
                    ? "بین ۰ تا ۱۰۰. مثال: اگر ۱۰ وارد کنید، ۱۰٪ از قیمت کورس کم می‌شود."
                    : "Between 0 and 100. Example: 10 means a 10% teacher discount."}
              </p>
            </div>

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
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
                required
              />
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
                className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
                placeholder={language === "fa" ? "مثلاً 10 نفر" : "For example 10 students"}
                required
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {language === "fa"
                  ? "تا رسیدن به این تعداد، کورس آماده شروع کامل نیست؛ اما شما هنوز می‌توانید خودتان صنف را شروع کنید."
                  : "Until this number is reached, the course is not fully ready automatically, but you can still start the class manually."}
              </p>
            </div>
            </div>

            <div className={stepContainerClass(5)}>
              <section className="sm:col-span-2 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 sm:p-5">
                <h4 className="text-base font-black text-slate-950">
                  {language === "fa" ? "بررسی تغییرات کورس" : "Review course changes"}
                </h4>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
                  {language === "fa"
                    ? "اطلاعات، برنامه، قیمت و شرایط گواهینامه را بررسی کنید. تغییرات حساس کورس‌های منتشرشده ممکن است دوباره برای بررسی مدیر ارسال شود."
                    : "Review the content, schedule, pricing, and certificate requirements. Sensitive changes to published courses may be sent for admin review again."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white bg-white p-3">
                    <p className="text-xs font-bold text-slate-500">
                      {language === "fa" ? "نوع کورس" : "Course type"}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {form.pricingType === "free"
                        ? language === "fa"
                          ? "رایگان، بدون گواهینامه"
                          : "Free, without certificate"
                        : language === "fa"
                          ? "پولی، همراه گواهینامه"
                          : "Paid, with certificate"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white bg-white p-3">
                    <p className="text-xs font-bold text-slate-500">
                      {language === "fa" ? "برنامه" : "Schedule"}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {totalSessionCount || 0} {language === "fa" ? "جلسه" : "sessions"} · {teachingDayCount} {language === "fa" ? "روز در هفته" : "days/week"}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className={stepContainerClass(6)}>
              <section className="sm:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {thumbnailPreviewUrl ? (
                  <img
                    src={thumbnailPreviewUrl}
                    alt=""
                    className="aspect-video max-h-72 w-full bg-slate-50 object-contain"
                  />
                ) : null}
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-xs font-black text-primary-700">
                    <Eye size={16} />
                    {language === "fa" ? "پیش‌نمایش تغییرات" : "Changes preview"}
                  </div>
                  <h4 className="mt-3 break-words text-2xl font-black text-slate-950">
                    {form.title || "—"}
                  </h4>
                  <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-7 text-slate-700">
                    {form.description}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [language === "fa" ? "زبان" : "Language", selectedCourseLanguage || "—"],
                      [language === "fa" ? "جلسات" : "Sessions", totalSessionCount || "—"],
                      [language === "fa" ? "منطقه زمانی" : "Timezone", form.timezone],
                      [
                        language === "fa" ? "گواهینامه" : "Certificate",
                        form.pricingType === "free"
                          ? language === "fa"
                            ? "ندارد"
                            : "Not included"
                          : language === "fa"
                            ? "فعال"
                            : "Included",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] font-black text-slate-500">{label}</p>
                        <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 z-10 mt-2 flex gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur sm:col-span-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (editStep === 1) {
                    onClose();
                    return;
                  }
                  setFormError("");
                  setEditStep((previous) => Math.max(1, previous - 1));
                }}
                className="h-11 flex-1 rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editStep === 1
                  ? language === "fa"
                    ? "لغو"
                    : "Cancel"
                  : language === "fa"
                    ? "مرحله قبل"
                    : "Previous"}
              </button>
              {isFinalStep ? (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isSaving
                    ? language === "fa"
                      ? "در حال ذخیره..."
                      : "Saving..."
                    : language === "fa"
                      ? "ذخیره تغییرات"
                      : "Save Changes"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError("");
                    setEditStep((previous) =>
                      Math.min(EDIT_FORM_STEPS.length, previous + 1),
                    );
                  }}
                  className="h-11 flex-1 rounded-xl bg-[#0B4FD8] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {language === "fa" ? "مرحله بعد" : "Next"}
                </button>
              )}
            </div>
          </div>
        </form>
        )}
      </div>
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
