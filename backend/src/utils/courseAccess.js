export const addOneMonth = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const source = Number.isNaN(date.getTime()) ? new Date() : date;
  const next = new Date(source);
  next.setMonth(next.getMonth() + 1);
  return next;
};

export const isPaidCourse = (course = {}) =>
  !Boolean(course?.isFree) && Number(course?.price || 0) > 0;

export const resolveCoursePaymentPlan = (course = {}, enrollment = {}) =>
  enrollment?.paymentPlan === "whole_period" ||
  course?.paymentPlan === "whole_period"
    ? "whole_period"
    : "monthly";

export const isEnrollmentExpired = (enrollment = {}, now = new Date()) => {
  const expiresAt = enrollment?.accessExpiresAt
    ? new Date(enrollment.accessExpiresAt)
    : null;
  return Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now);
};

export const inferLegacyAccessWindow = (enrollment = {}, course = {}) => {
  const startSource =
    course?.startDate ||
    enrollment?.accessStartsAt ||
    enrollment?.enrolledAt ||
    enrollment?.createdAt ||
    new Date();
  const accessStartsAt = new Date(startSource);
  const safeAccessStartsAt = Number.isNaN(accessStartsAt.getTime())
    ? new Date()
    : accessStartsAt;

  return {
    accessStartsAt: safeAccessStartsAt,
    accessExpiresAt: addOneMonth(safeAccessStartsAt),
  };
};

export const resolveMonthlyAccessWindow = ({
  course = {},
  paidAt = new Date(),
  previousAccessExpiresAt = null,
} = {}) => {
  const paidDate = new Date(paidAt);
  const safePaidAt = Number.isNaN(paidDate.getTime()) ? new Date() : paidDate;
  const courseStart = course?.startDate ? new Date(course.startDate) : null;
  const safeCourseStart =
    courseStart && !Number.isNaN(courseStart.getTime()) ? courseStart : null;
  const previousExpiry = previousAccessExpiresAt ? new Date(previousAccessExpiresAt) : null;
  const safePreviousExpiry =
    previousExpiry && !Number.isNaN(previousExpiry.getTime()) ? previousExpiry : null;

  const accessStartsAt =
    safePreviousExpiry && safePreviousExpiry > safePaidAt
      ? safePreviousExpiry
      : safeCourseStart && safeCourseStart > safePaidAt
        ? safeCourseStart
        : safePaidAt;

  const monthlyExpiry = addOneMonth(accessStartsAt);
  const courseEnd = course?.endDate ? new Date(course.endDate) : null;
  const safeCourseEnd =
    courseEnd && !Number.isNaN(courseEnd.getTime()) && courseEnd > accessStartsAt
      ? courseEnd
      : null;

  return {
    accessStartsAt,
    accessExpiresAt:
      safeCourseEnd && safeCourseEnd < monthlyExpiry
        ? safeCourseEnd
        : monthlyExpiry,
  };
};

export const resolveCourseAccessWindow = ({
  course = {},
  paidAt = new Date(),
  previousAccessExpiresAt = null,
} = {}) => {
  const paymentPlan = resolveCoursePaymentPlan(course);
  if (paymentPlan === "monthly") {
    return {
      paymentPlan,
      ...resolveMonthlyAccessWindow({
        course,
        paidAt,
        previousAccessExpiresAt,
      }),
    };
  }

  const paidDate = new Date(paidAt);
  const safePaidAt = Number.isNaN(paidDate.getTime()) ? new Date() : paidDate;
  const courseStart = course?.startDate ? new Date(course.startDate) : null;
  const safeCourseStart =
    courseStart && !Number.isNaN(courseStart.getTime()) && courseStart > safePaidAt
      ? courseStart
      : safePaidAt;
  const courseEnd = course?.endDate ? new Date(course.endDate) : null;
  const accessExpiresAt =
    courseEnd &&
    !Number.isNaN(courseEnd.getTime()) &&
    courseEnd > safeCourseStart
      ? courseEnd
      : addOneMonth(safeCourseStart);

  return {
    paymentPlan,
    accessStartsAt: safeCourseStart,
    accessExpiresAt,
  };
};

export const expireEnrollmentIfNeeded = async (enrollment, course = null, now = new Date()) => {
  if (!enrollment || !isPaidCourse(course)) {
    return false;
  }

  const paymentPlan = resolveCoursePaymentPlan(course, enrollment);
  enrollment.paymentPlan = paymentPlan;

  if (paymentPlan === "whole_period") {
    const wholePeriodWindow = resolveCourseAccessWindow({
      course: {
        paymentPlan,
        startDate: course?.startDate,
        endDate: course?.endDate,
      },
      paidAt: enrollment.lastRenewedAt || enrollment.enrolledAt || enrollment.createdAt,
      previousAccessExpiresAt: enrollment.accessExpiresAt,
    });
    enrollment.accessStartsAt =
      enrollment.accessStartsAt || wholePeriodWindow.accessStartsAt;
    enrollment.accessExpiresAt = wholePeriodWindow.accessExpiresAt;
  } else if (!enrollment.accessExpiresAt) {
    const legacyWindow = inferLegacyAccessWindow(enrollment, course);
    enrollment.accessStartsAt = legacyWindow.accessStartsAt;
    enrollment.accessExpiresAt = legacyWindow.accessExpiresAt;
  }

  const courseStart = course?.startDate ? new Date(course.startDate) : null;
  const renewedAt = enrollment.lastRenewedAt ? new Date(enrollment.lastRenewedAt) : null;
  const accessStartsAt = enrollment.accessStartsAt ? new Date(enrollment.accessStartsAt) : null;
  const shouldFollowChangedCourseStart =
    courseStart &&
    renewedAt &&
    !Number.isNaN(courseStart.getTime()) &&
    !Number.isNaN(renewedAt.getTime()) &&
    courseStart > renewedAt &&
    (
      !accessStartsAt ||
      Number.isNaN(accessStartsAt.getTime()) ||
      Math.abs(accessStartsAt.getTime() - courseStart.getTime()) > 60 * 1000
    );

  if (paymentPlan === "monthly" && shouldFollowChangedCourseStart) {
    enrollment.accessStartsAt = courseStart;
    enrollment.accessExpiresAt = resolveMonthlyAccessWindow({
      course,
      paidAt: courseStart,
    }).accessExpiresAt;
  }

  if (!isEnrollmentExpired(enrollment, now)) {
    if (enrollment.isModified?.("accessStartsAt") || enrollment.isModified?.("accessExpiresAt")) {
      await enrollment.save();
    }
    return false;
  }

  if (enrollment.enrollmentStatus === "active") {
    enrollment.enrollmentStatus = "pending";
  }
  enrollment.accessStatus = "blocked";
  enrollment.status = "inactive";
  await enrollment.save();
  return true;
};
