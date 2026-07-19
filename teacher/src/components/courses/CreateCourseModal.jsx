import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CourseStartDatePicker from "./CourseStartDatePicker";
import CourseImageCropModal from "./CourseImageCropModal";
import CourseTypePicker from "./CourseTypePicker";
import CourseCategoryFields from "./CourseCategoryFields";
import { isAllowedCourseStartDate } from "../../utils/courseStartDate";
import { getParentCategories } from "../../utils/categoryTree";

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
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
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
const MOBILE_BREAKPOINT = 640;
const CREATE_FORM_STEPS = [
  { id: 1, titleFa: "اطلاعات کورس", titleEn: "Course Info" },
  { id: 2, titleFa: "برنامه و زمان", titleEn: "Schedule" },
  { id: 3, titleFa: "قیمت‌گذاری", titleEn: "Pricing" },
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
    selectedDays: ["monday", "wednesday", "friday"],
    targetAudienceText: "",
    whatYouWillLearnText: "",
    requirementsText: "",
    curriculumTopicsText: "",
    previewVideoUrlsText: "",
    thumbnailFile: null,
  });

  const [form, setForm] = useState(getInitialForm());
  const [formError, setFormError] = useState("");
  const [pendingThumbnailFile, setPendingThumbnailFile] = useState(null);
  const [mobileStep, setMobileStep] = useState(1);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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
    `${mobileStep === stepId ? "contents" : "hidden"} sm:contents`;
  const thumbnailPreviewUrl = useMemo(() => {
    if (typeof URL === "undefined" || !form.thumbnailFile) return "";
    return URL.createObjectURL(form.thumbnailFile);
  }, [form.thumbnailFile]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!thumbnailPreviewUrl || typeof URL === "undefined") return undefined;
    return () => URL.revokeObjectURL(thumbnailPreviewUrl);
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => setMobileStep(1), 0);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleThumbnailInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    setPendingThumbnailFile(file);
  };

  const handleApplyThumbnailCrop = (file) => {
    setForm((prev) => ({ ...prev, thumbnailFile: file }));
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
      const listFieldError = getInvalidListFieldError(listFieldConfigs, language);

      if (titleLength < TITLE_MIN_CHARS || titleLength > TITLE_MAX_CHARS) {
        return language === "fa"
          ? `عنوان کورس باید بین ${TITLE_MIN_CHARS} تا ${TITLE_MAX_CHARS} کاراکتر باشد.`
          : `Course title must be between ${TITLE_MIN_CHARS} and ${TITLE_MAX_CHARS} characters.`;
      }
      if (descriptionLength < DESCRIPTION_MIN_CHARS || descriptionLength > DESCRIPTION_MAX_CHARS) {
        return language === "fa"
          ? `توضیحات کامل باید بین ${DESCRIPTION_MIN_CHARS} تا ${DESCRIPTION_MAX_CHARS} کاراکتر باشد.`
          : `Detailed description must be between ${DESCRIPTION_MIN_CHARS} and ${DESCRIPTION_MAX_CHARS} characters.`;
      }
      if (listFieldError) return listFieldError;
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
          ? "حجم تصویر کورس باید حداکثر ۲ مگابایت باشد."
          : "Course thumbnail must be 2MB or smaller.";
      }
      return "";
    }

    if (step === 2) {
      const durationWeeks = sessionWeekCount;
      const totalSessions = Number(form.totalSessions || 0);
      const maxStudents = Number(form.maxStudents || 0);
      const minimumStudentsToStart = Number(form.minimumStudentsToStart || 0);
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
      if (!isAllowedCourseStartDate(form.startDate)) {
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
      return "";
    }

    if (step === 3) {
      if (form.pricingType === "free") return "";
      const price = Number(form.price || 0);
      const teacherDiscountPercentage = Number(form.teacherDiscountPercentage || 0);
      const normalizedTeacherDiscountPercentage = clampPercentage(
        Number.isFinite(teacherDiscountPercentage) ? teacherDiscountPercentage : 0,
      );
      if (
        price < minTeacherCoursePrice ||
        price > PRICE_MAX_USD ||
        !isWholeDollarAmount(price)
      ) {
        return language === "fa"
          ? `برای کورس پولی، قیمت باید حداقل ${minTeacherCoursePrice} دالر، حداکثر ${PRICE_MAX_USD} دالر و فقط به‌صورت عدد صحیح باشد.`
          : `For a paid course, price must be at least ${minTeacherCoursePrice} USD, at most ${PRICE_MAX_USD} USD, and use whole numbers only.`;
      }
      if (normalizedTeacherDiscountPercentage < 0 || normalizedTeacherDiscountPercentage > 100) {
        return language === "fa"
          ? "درصد تخفیف مدرس باید بین ۰ تا ۱۰۰ باشد."
          : "Teacher discount percentage must be between 0 and 100.";
      }
    }

    return "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");
    const { pricingType, ...rest } = form;
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

    if (
      !isFree &&
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

    if (!isAllowedCourseStartDate(form.startDate)) {
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
          ? "حجم تصویر کورس باید حداکثر ۲ مگابایت باشد."
          : "Course thumbnail must be 2MB or smaller.",
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

    const startDateTime = new Date(`${form.startDate}T${startTime}:00`);
    if (Number.isNaN(startDateTime.getTime())) {
      setFormError(
        language === "fa"
          ? "تاریخ و زمان شروع کورس معتبر نیست."
          : "Course start date/time is invalid.",
      );
      return;
    }

    const computedEndDate = new Date(startDateTime);
    computedEndDate.setDate(computedEndDate.getDate() + durationWeeks * 7 - 1);
    const [endHours, endMinutesOnly] = endTime.split(":").map((value) => Number(value));
    computedEndDate.setHours(
      endHours || 0,
      endMinutesOnly || 0,
      0,
      0,
    );

    onSubmit({
      ...rest,
      category: selectedCategory,
      subcategory: selectedSubcategory || null,
      language: selectedCourseLanguage,
      price: isFree ? 0 : price,
      teacherDiscountPercentage: isFree ? 0 : normalizedTeacherDiscountPercentage,
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
    });
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

        <form
          noValidate
          onSubmit={handleSubmit}
          className="min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
          dir="ltr"
        >
          {isMobileViewport ? (
            <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3" dir={isRTL ? "rtl" : "ltr"}>
              <p className="text-xs font-bold text-slate-500">
                {language === "fa"
                  ? `مرحله ${mobileStep} از ${CREATE_FORM_STEPS.length}`
                  : `Step ${mobileStep} of ${CREATE_FORM_STEPS.length}`}
              </p>
              <p className="mt-1 text-sm font-black text-slate-700">
                {language === "fa"
                  ? CREATE_FORM_STEPS[mobileStep - 1]?.titleFa
                  : CREATE_FORM_STEPS[mobileStep - 1]?.titleEn}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 text-start sm:gap-4 lg:grid-cols-2" dir={isRTL ? "rtl" : "ltr"}>
          {formError ? (
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={language === "fa" ? "توضیحات کامل" : "Detailed description"}
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
                ? "اندازه دقیق پیشنهادی: ۱۲۰۰ × ۶۷۵ پیکسل (نسبت ۱۶:۹). با این اندازه نیازی به برش نیست. | PNG, JPG, WEBP | حداکثر ۲MB"
                : "Exact recommended size: 1200 × 675 px (16:9). This size needs no cropping. | PNG, JPG, WEBP | Max 2MB"}
              {form.thumbnailFile ? ` | ${form.thumbnailFile.name}` : ""}
            </p>
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
              className="mt-3 min-h-[112px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary-300"
              dir="ltr"
            />
            <p className="mt-2 text-[11px] font-bold text-slate-500">
              {language === "fa"
                ? `${parseVideoLinks(form.previewVideoUrlsText).length} لینک اضافه شده`
                : `${parseVideoLinks(form.previewVideoUrlsText).length} links added`}
            </p>
          </div>
          <div className="sm:col-span-2">
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
                invalidListField?.key === "targetAudienceText"
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
          </div>
          <div className="sm:col-span-2">
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
                invalidListField?.key === "whatYouWillLearnText"
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
          </div>
          <div className="sm:col-span-2">
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
                invalidListField?.key === "requirementsText"
                  ? "border border-rose-300 bg-rose-50"
                  : "border border-[#E2E8F0] bg-[#F8FAFC]"
              }`}
              minLength={LIST_ITEM_MIN_CHARS}
              maxLength={LIST_ITEM_MAX_CHARS * LIST_MAX_ITEMS}
              required
            />
          </div>
          <div className="sm:col-span-2">
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

          <div className={stepContainerClass(2)}>
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
          </div>

          <CourseTypePicker
            value={form.courseType}
            onChange={(courseType) => setForm({ ...form, courseType })}
            language={language}
          />

          <div className="lg:col-span-2">
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
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
              required
            />
          </div>

          <CourseStartDatePicker
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
              language={language}
            />

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "زمان شروع درس" : "Lesson start time"}
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
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
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
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
          </div>
          </div>

          <div className={stepContainerClass(3)}>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "نوع کورس" : "Course type"}
            </label>
            <select
              value={form.pricingType}
              onChange={(e) =>
                setForm({
                  ...form,
                  pricingType: e.target.value,
                  price: e.target.value === "free" ? "0" : form.price,
                  teacherDiscountPercentage:
                    e.target.value === "free" ? "0" : form.teacherDiscountPercentage,
                })
              }
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold"
            >
              <option value="paid">{language === "fa" ? "پولی" : "Paid"}</option>
              <option value="free">{language === "fa" ? "رایگان" : "Free"}</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              {language === "fa" ? "روش پرداخت کورس" : "Course payment plan"}
            </label>
            <select
              value={form.paymentPlan}
              onChange={(event) =>
                setForm({ ...form, paymentPlan: event.target.value })
              }
              disabled={form.pricingType === "free"}
              className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
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

          <div className="lg:col-span-2">
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
          </div>

          <div>
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
              className={`h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold ${
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

          <div className="lg:col-span-2">
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
                ? "تا رسیدن به این تعداد، کورس خودکار شروع نمی‌شود؛ اما شما همچنان می‌توانید خودتان صنف را شروع کنید."
                : "Until this number is reached, the course should not be considered ready automatically, but you can still start the class manually."}
            </p>
          </div>
          </div>

          <div className="mt-2 flex gap-2 sm:hidden">
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
                  const nextStepError = getStepValidationError(mobileStep);
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

          <div className="mt-3 hidden flex-col-reverse gap-2 border-t border-[#E2E8F0] pt-4 sm:col-span-2 sm:flex sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-36 sm:flex-none"
            >
              {language === "fa" ? "لغو" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B4FD8] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-44 sm:flex-none"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{isSubmitting ? (language === "fa" ? "در حال ایجاد..." : "Creating") : (language === "fa" ? "ایجاد کورس" : "Create Course")}</span>
            </button>
          </div>
          </div>
        </form>
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
