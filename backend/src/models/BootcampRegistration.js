import mongoose from "mongoose";

const bootcampRegistrationSchema = new mongoose.Schema(
  {
    bootcampId: { type: mongoose.Schema.Types.ObjectId, ref: "Bootcamp", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Enrollment", default: null },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    motivation: { type: String, trim: true, maxlength: 1000, default: "" },
    preferredSchedule: { type: String, trim: true, maxlength: 300, default: "" },
    status: {
      type: String,
      enum: ["registered", "waitlisted", "cancelled", "rejected"],
      default: "registered",
      index: true,
    },
    source: { type: String, trim: true, maxlength: 100, default: "public_form" },
  },
  { timestamps: true },
);

bootcampRegistrationSchema.index({ bootcampId: 1, studentId: 1 }, { unique: true });
bootcampRegistrationSchema.index({ studentId: 1, createdAt: -1 });

export default mongoose.model("BootcampRegistration", bootcampRegistrationSchema);
