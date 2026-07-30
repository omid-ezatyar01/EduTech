import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";

export const normalizeCouponCode = (value = "") =>
  String(value || "").trim().toUpperCase();

const couponError = (message, code) =>
  Object.assign(new Error(message), { statusCode: 400, code });

export const calculateCouponDiscountUsdCents = (coupon, baseAmountUsdCents) => {
  const base = Math.max(0, Math.round(Number(baseAmountUsdCents || 0)));
  if (coupon?.type === "percent") {
    return Math.round(base * (Number(coupon.discountValue || 0) / 100));
  }
  return Math.round(Number(coupon?.discountValue || 0) * 100);
};

export const resolveCouponForCheckout = async ({
  code,
  userId,
  courseId,
  baseAmountUsdCents,
  now = new Date(),
}) => {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return null;

  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon || coupon.status !== "active") {
    throw couponError("Coupon is invalid or inactive", "COUPON_INVALID");
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    throw couponError("Coupon is not active yet", "COUPON_NOT_STARTED");
  }
  if (coupon.expiresAt && coupon.expiresAt <= now) {
    throw couponError("Coupon has expired", "COUPON_EXPIRED");
  }
  if (
    coupon.usageLimit &&
    Number(coupon.usageCount || 0) >= Number(coupon.usageLimit)
  ) {
    throw couponError("Coupon usage limit has been reached", "COUPON_USED_UP");
  }
  if (
    coupon.courseIds?.length &&
    !coupon.courseIds.some((id) => String(id) === String(courseId))
  ) {
    throw couponError(
      "Coupon is not valid for this course",
      "COUPON_COURSE_MISMATCH",
    );
  }

  const base = Math.round(Number(baseAmountUsdCents || 0));
  if (base < Number(coupon.minimumPurchaseUsdCents || 0)) {
    throw couponError(
      "Course price does not meet the coupon minimum",
      "COUPON_MINIMUM_NOT_MET",
    );
  }

  const userUsage = await CouponRedemption.countDocuments({
    couponId: coupon._id,
    userId,
  });
  if (userUsage >= Number(coupon.perUserLimit || 1)) {
    throw couponError(
      "You have already used this coupon",
      "COUPON_USER_LIMIT",
    );
  }

  const discountAmountUsdCents = calculateCouponDiscountUsdCents(coupon, base);
  if (discountAmountUsdCents <= 0 || discountAmountUsdCents >= base) {
    throw couponError(
      "Coupon discount is not valid for this course price",
      "COUPON_DISCOUNT_INVALID",
    );
  }

  return {
    couponId: coupon._id,
    couponCode: coupon.code,
    couponType: coupon.type,
    couponValue: coupon.discountValue,
    originalBaseAmountUsdCents: base,
    discountAmountUsdCents,
    finalBaseAmountUsdCents: base - discountAmountUsdCents,
  };
};

export const recordCouponRedemption = async (
  {
    couponId,
    couponCode,
    userId,
    courseId,
    orderId,
    paymentId,
    originalBaseAmountUsdCents,
    discountAmountUsdCents,
    finalBaseAmountUsdCents,
    redeemedAt = new Date(),
  },
  session = null,
) => {
  if (!couponId || !discountAmountUsdCents) return false;
  const existingFilter = orderId
    ? { orderId }
    : { paymentId };
  const existing = await CouponRedemption.findOne(existingFilter).session(
    session,
  );
  if (existing) {
    const actualUsage = await CouponRedemption.countDocuments({ couponId }).session(
      session,
    );
    await Coupon.findByIdAndUpdate(
      couponId,
      { $set: { usageCount: actualUsage } },
      session ? { session } : undefined,
    );
    return false;
  }
  let redemption;
  try {
    redemption = await CouponRedemption.create(
      [{
        couponId,
        userId,
        courseId,
        orderId: orderId || undefined,
        paymentId: paymentId || undefined,
        code: couponCode,
        originalAmountUsdCents: originalBaseAmountUsdCents,
        discountAmountUsdCents,
        finalAmountUsdCents: finalBaseAmountUsdCents,
        redeemedAt,
      }],
      session ? { session } : undefined,
    ).then((rows) => rows[0]);
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }

  try {
    await Coupon.findByIdAndUpdate(
      couponId,
      { $inc: { usageCount: 1 } },
      session ? { session } : undefined,
    );
  } catch (error) {
    await CouponRedemption.deleteOne({ _id: redemption._id })
      .session(session)
      .catch(() => null);
    throw error;
  }
  return true;
};
