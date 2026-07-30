import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    type: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
      index: true,
    },
    discountValue: { type: Number, required: true, min: 0.01 },
    minimumPurchaseUsdCents: { type: Number, min: 0, default: 0 },
    usageLimit: { type: Number, min: 1, default: null },
    perUserLimit: { type: Number, min: 1, default: 1 },
    usageCount: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    courseIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

couponSchema.index({ status: 1, expiresAt: 1 });
couponSchema.pre("validate", function validateCoupon() {
  if (this.type === "percent" && Number(this.discountValue) > 90) {
    throw new Error("Percentage coupons cannot exceed 90%");
  }
  if (
    this.startsAt &&
    this.expiresAt &&
    new Date(this.expiresAt) <= new Date(this.startsAt)
  ) {
    throw new Error("Coupon expiry must be after its start date");
  }
});

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
