import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, maxlength: 180, default: "" },
    en: { type: String, trim: true, maxlength: 180, default: "" },
  },
  { _id: false },
);

const heroMediaSchema = new mongoose.Schema(
  {
    mediaType: { type: String, enum: ["image"], required: true, index: true },
    mediaUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    title: { type: localizedTextSchema, default: () => ({}) },
    altText: { type: localizedTextSchema, default: () => ({}) },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    sortOrder: { type: Number, integer: true, min: 0, max: 10000, default: 0 },
    displayDurationSeconds: { type: Number, min: 3, max: 30, default: 6 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

heroMediaSchema.index({ status: 1, sortOrder: 1, createdAt: 1 });

export default mongoose.model("HeroMedia", heroMediaSchema);
