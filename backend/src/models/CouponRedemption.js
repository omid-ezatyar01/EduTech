import mongoose from "mongoose";

const couponRedemptionSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: undefined,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: undefined,
    },
    code: { type: String, required: true, uppercase: true, trim: true },
    originalAmountUsdCents: { type: Number, required: true, min: 1 },
    discountAmountUsdCents: { type: Number, required: true, min: 1 },
    finalAmountUsdCents: { type: Number, required: true, min: 1 },
    redeemedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ orderId: 1 }, { unique: true, sparse: true });
couponRedemptionSchema.index({ paymentId: 1 }, { unique: true, sparse: true });
couponRedemptionSchema.index({ couponId: 1, userId: 1, redeemedAt: -1 });

const CouponRedemption = mongoose.model(
  "CouponRedemption",
  couponRedemptionSchema,
);

export default CouponRedemption;
