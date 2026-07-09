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
