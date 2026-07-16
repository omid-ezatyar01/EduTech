import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
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
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      alias: "payment",
    },
    enrollmentStatus: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    accessStatus: {
      type: String,
      enum: ["allowed", "blocked"],
      default: "blocked",
      index: true,
    },
    accessStartsAt: {
      type: Date,
    },
    accessExpiresAt: {
      type: Date,
      index: true,
    },
    lastRenewedAt: {
      type: Date,
    },
    paymentPlan: {
      type: String,
      enum: ["monthly", "whole_period"],
      default: "monthly",
    },
    // legacy compatibility with existing code
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled"],
      default: "inactive",
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    certificateId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    certificateIssuedAt: {
      type: Date,
    },
    certificateApprovalStatus: {
      type: String,
      enum: ["approved", "rejected"],
      default: "approved",
      index: true,
    },
    certificateReviewedAt: {
      type: Date,
    },
    certificateReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    certificateRejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

enrollmentSchema.pre("validate", function () {
  if (this.enrollmentStatus === "active" && this.accessStatus === "allowed") {
    this.status = "active";
  } else if (this.enrollmentStatus === "cancelled") {
    this.status = "cancelled";
  } else {
    this.status = "inactive";
  }
});

enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ enrollmentStatus: 1, accessStatus: 1, createdAt: -1 });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

export default Enrollment;
