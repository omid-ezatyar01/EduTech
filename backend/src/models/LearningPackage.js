import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, maxlength: 300, default: "" },
    en: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { _id: false },
);

const packageStepSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, default: () => ({}) },
    courses: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
      validate: {
        validator(value) {
          const packageStatus = this.ownerDocument?.().status;
          return Array.isArray(value)
            && value.length <= 20
            && (packageStatus !== "published" || value.length > 0);
        },
        message: "Published package steps must contain between 1 and 20 courses",
      },
    },
  },
  { _id: true },
);

const learningPackageSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, default: () => ({}) },
    coverImage: { type: String, trim: true, default: "", maxlength: 500 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    steps: {
      type: [packageStepSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0 && value.length <= 20,
        message: "A package must contain between 1 and 20 steps",
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

learningPackageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("LearningPackage", learningPackageSchema);
