import AppSetting from "../models/AppSetting.js";

export const DEFAULT_TEACHER_DEDUCTION_PERCENTAGE = 15;
export const DEFAULT_MIN_TEACHER_COURSE_PRICE = 5;
export const DEFAULT_GLOBAL_COURSE_DISCOUNT_PERCENTAGE = 0;

const roundCurrencyAmount = (value, decimalPlaces = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round(numeric * factor) / factor;
};

export const normalizeTeacherDeductionPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TEACHER_DEDUCTION_PERCENTAGE;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric * 100) / 100;
};

export const normalizeMinTeacherCoursePrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MIN_TEACHER_COURSE_PRICE;
  if (numeric < 0) return 0;
  if (numeric > 10000) return 10000;
  return roundCurrencyAmount(numeric, 1);
};

export const normalizeGlobalCourseDiscountPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GLOBAL_COURSE_DISCOUNT_PERCENTAGE;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric * 100) / 100;
};

export const normalizeTeacherCourseDiscountPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric * 100) / 100;
};

export const getTeacherDeductionPercentage = async () => {
  try {
    const settings = await AppSetting.getSingleton();
    return normalizeTeacherDeductionPercentage(settings?.teacherDeductionPercentage);
  } catch {
    return DEFAULT_TEACHER_DEDUCTION_PERCENTAGE;
  }
};

export const getPlatformPricingSettings = async () => {
  try {
    const settings = await AppSetting.getSingleton();
    return {
      minTeacherCoursePrice: normalizeMinTeacherCoursePrice(settings?.minTeacherCoursePrice),
      teacherDeductionPercentage: normalizeTeacherDeductionPercentage(
        settings?.teacherDeductionPercentage,
      ),
      globalCourseDiscountPercentage: normalizeGlobalCourseDiscountPercentage(
        settings?.globalCourseDiscountPercentage,
      ),
    };
  } catch {
    return {
      minTeacherCoursePrice: DEFAULT_MIN_TEACHER_COURSE_PRICE,
      teacherDeductionPercentage: DEFAULT_TEACHER_DEDUCTION_PERCENTAGE,
      globalCourseDiscountPercentage: DEFAULT_GLOBAL_COURSE_DISCOUNT_PERCENTAGE,
    };
  }
};

export const resolveCourseDisplayPricing = (course = {}, globalDiscountPercentage = 0) => {
  const basePrice = Number(course?.price || 0);
  const rawTeacherDiscountPercentage = Number(course?.teacherDiscountPercentage);
  const teacherDiscountPrice = Number(course?.discountPrice || 0);
  const teacherDiscountPercentage = Number.isFinite(rawTeacherDiscountPercentage)
    ? normalizeTeacherCourseDiscountPercentage(rawTeacherDiscountPercentage)
    : (
        teacherDiscountPrice > 0 && teacherDiscountPrice <= basePrice && basePrice > 0
          ? normalizeTeacherCourseDiscountPercentage(
              ((basePrice - teacherDiscountPrice) / basePrice) * 100,
            )
          : 0
      );
  const teacherDiscountAmount = roundCurrencyAmount((basePrice * teacherDiscountPercentage) / 100);
  const teacherEffectivePrice = Math.max(0, roundCurrencyAmount(basePrice - teacherDiscountAmount));

  if (Boolean(course?.isFree) || basePrice <= 0) {
    return {
      basePrice: roundCurrencyAmount(basePrice),
      teacherDiscountPercentage: 0,
      teacherDiscountAmount: 0,
      teacherEffectivePrice: 0,
      finalPrice: 0,
      originalPriceForDisplay: 0,
      globalDiscountPercentage: 0,
      globalDiscountAmount: 0,
      totalDiscountPercentage: 0,
    };
  }

  const normalizedGlobalDiscount = normalizeGlobalCourseDiscountPercentage(globalDiscountPercentage);
  const totalDiscountPercentage = Math.min(
    100,
    normalizeTeacherCourseDiscountPercentage(teacherDiscountPercentage + normalizedGlobalDiscount),
  );
  const finalPrice = Math.max(0, roundCurrencyAmount(basePrice - ((basePrice * totalDiscountPercentage) / 100)));
  const totalDiscountAmount = Math.max(0, roundCurrencyAmount(basePrice - finalPrice));
  const teacherDiscountAmountApplied = Math.min(teacherDiscountAmount, totalDiscountAmount);
  const globalDiscountAmount = Math.max(0, roundCurrencyAmount(totalDiscountAmount - teacherDiscountAmountApplied));
  const originalPriceForDisplay =
    totalDiscountPercentage > 0 && finalPrice < basePrice ? roundCurrencyAmount(basePrice) : 0;

  return {
    basePrice: roundCurrencyAmount(basePrice),
    teacherDiscountPercentage,
    teacherDiscountAmount: teacherDiscountAmountApplied,
    teacherEffectivePrice,
    finalPrice,
    originalPriceForDisplay,
    globalDiscountPercentage: normalizedGlobalDiscount,
    globalDiscountAmount,
    totalDiscountPercentage,
  };
};
