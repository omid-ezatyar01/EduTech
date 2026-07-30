import mongoose from "mongoose";

const paymentAttemptSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
      alias: "order",
    },
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
    legacyPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["HESABPAY", "NOWPAYMENTS", "BSC_DIRECT"],
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["HESABPAY_HOSTED", "NOWPAYMENTS_CRYPTO", "USDT_BSC_DIRECT"],
      required: true,
      index: true,
    },
    baseAmountUsdCents: {
      type: Number,
      required: true,
      min: 0,
    },
    originalBaseAmountUsdCents: { type: Number, min: 0, default: null },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    couponCode: { type: String, uppercase: true, trim: true, default: "" },
    couponType: {
      type: String,
      enum: ["percent", "fixed", null],
      default: null,
    },
    couponValue: { type: Number, min: 0, default: null },
    discountAmountUsdCents: { type: Number, min: 0, default: 0 },
    amount: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    network: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    exchangeRate: {
      type: String,
      default: null,
      trim: true,
    },
    exchangeRateSource: {
      type: String,
      default: null,
      trim: true,
    },
    rateRetrievedAt: {
      type: Date,
      default: null,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
      default: undefined,
    },
    blockchainReference: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
      default: undefined,
    },
    transactionSignature: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
      default: undefined,
    },
    recipientAddress: {
      type: String,
      default: null,
      trim: true,
    },
    tokenMint: {
      type: String,
      default: null,
      trim: true,
    },
    providerUrl: {
      type: String,
      default: null,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "SUCCEEDED",
        "FAILED",
        "EXPIRED",
        "DUPLICATE_PAYMENT",
        "MANUAL_REVIEW",
      ],
      default: "PENDING",
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastVerificationAttemptAt: {
      type: Date,
      default: null,
    },
    verificationBlockedUntil: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
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
    rawVerificationPayload: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true },
);

paymentAttemptSchema.index({ userId: 1, createdAt: -1 });
paymentAttemptSchema.index({ orderId: 1, createdAt: -1 });
paymentAttemptSchema.index({ userId: 1, status: 1, createdAt: -1 });

const PaymentAttempt = mongoose.model("PaymentAttempt", paymentAttemptSchema);

export default PaymentAttempt;
