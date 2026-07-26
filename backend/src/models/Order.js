import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      alias: "user",
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
      alias: "course",
    },
    baseAmountUsdCents: {
      type: Number,
      required: true,
      min: 0,
    },
    pricingRegion: {
      type: String,
      enum: ["afghanistan", "iran", "international"],
      default: "international",
    },
    sourcePriceAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    sourcePriceCurrency: {
      type: String,
      enum: ["USD", "AFN", "TOMAN"],
      default: null,
    },
    platformCommissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "CANCELLED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index(
  { userId: 1, courseId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PENDING" },
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
