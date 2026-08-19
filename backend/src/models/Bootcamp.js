import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, maxlength: 1600, default: "" },
    en: { type: String, trim: true, maxlength: 1600, default: "" },
  },
  { _id: false },
);

const bootcampSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, default: () => ({}) },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coverImage: { type: String, trim: true, maxlength: 1000, default: "" },
    status: {
      type: String,
      enum: ["draft", "registration_open", "registration_closed", "in_progress", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    minimumStudents: { type: Number, min: 1, max: 2000, default: 10 },
    maximumStudents: { type: Number, min: 1, max: 2000, default: 100 },
    registeredCount: { type: Number, min: 0, default: 0 },
    registrationOpensAt: { type: Date, default: null },
    registrationClosesAt: { type: Date, default: null, index: true },
    plannedStartAt: { type: Date, default: null },
    scheduleTimeZone: { type: String, default: "Asia/Kabul", immutable: true },
    minimumReachedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

bootcampSchema.pre("validate", function () {
  if (Number(this.minimumStudents) > Number(this.maximumStudents)) {
    this.invalidate("minimumStudents", "Minimum students cannot exceed maximum students");
  }
  if (
    this.registrationOpensAt &&
    this.registrationClosesAt &&
    new Date(this.registrationClosesAt) <= new Date(this.registrationOpensAt)
  ) {
    this.invalidate("registrationClosesAt", "Registration closing time must be after opening time");
  }
});

bootcampSchema.index({ status: 1, registrationClosesAt: 1, createdAt: -1 });

export default mongoose.model("Bootcamp", bootcampSchema);
