import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      alias: "student",
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
      alias: "course",
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      index: true,
      alias: "enrollment",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
      default: null,
    },
    paymentAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentAttempt",
      index: true,
      default: null,
    },
    baseAmountUsdCents: {
      type: Number,
      min: 0,
      default: 0,
    },
    pricingRegion: {
      type: String,
      enum: ["afghanistan", "iran", "international"],
      default: null,
      index: true,
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    gatewayAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
    },
    gatewayCurrency: {
      type: String,
      default: "AFN",
      trim: true,
      uppercase: true,
    },
    provider: {
      type: String,
      default: "hesabpay",
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "expired", "refunded"],
      default: "pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "hesabpay", "stripe", "paypal", "manual", "nowpayments_crypto", "usdt_bsc_direct"],
      default: "hesabpay",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentReference: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },
    hesabSessionId: {
      type: String,
      trim: true,
    },
    hesabPaymentUrl: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      default: null,
    },
    blockchainReference: {
      type: String,
      trim: true,
      default: null,
    },
    transactionSignature: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    network: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    exchangeRate: {
      type: String,
      trim: true,
      default: null,
    },
    exchangeRateSource: {
      type: String,
      trim: true,
      default: null,
    },
    senderAccount: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    expiresAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    paymentProof: {
      type: String,
      trim: true,
    },
    paymentProofOriginalName: {
      type: String,
      trim: true,
      default: "",
    },
    paymentProofSubmittedAt: {
      type: Date,
      default: null,
    },
    bankTransferReviewStatus: {
      type: String,
      enum: ["not_applicable", "pending_teacher_review", "approved_by_teacher", "rejected_by_teacher"],
      default: "not_applicable",
      index: true,
    },
    reviewedByTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedByTeacherAt: {
      type: Date,
      default: null,
    },
    isExternalCollection: {
      type: Boolean,
      default: false,
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    rawCreateSessionResponse: {
      type: Object,
      default: null,
    },
    rawWebhookPayload: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true },
);

paymentSchema.pre("validate", function () {
  if (this.isModified("paymentStatus")) {
    if (this.paymentStatus === "pending") this.status = "pending";
    if (this.paymentStatus === "paid") this.status = "paid";
    if (this.paymentStatus === "failed") this.status = "failed";
    if (this.paymentStatus === "cancelled") this.status = "cancelled";
    if (this.paymentStatus === "refunded") this.status = "refunded";
  } else if (this.isModified("status")) {
    if (["pending", "paid", "failed", "cancelled", "refunded"].includes(this.status)) {
      this.paymentStatus = this.status;
    } else if (this.status === "expired") {
      this.paymentStatus = "failed";
    }
  }

  if (!this.paymentMethod && this.provider) {
    this.paymentMethod = this.provider;
  }
});

paymentSchema.index({ studentId: 1, createdAt: -1 });
paymentSchema.index({ courseId: 1, status: 1 });
paymentSchema.index({ paymentStatus: 1, paymentMethod: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
