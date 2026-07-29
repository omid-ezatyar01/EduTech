import mongoose from "mongoose";

const persianTitleSchema = new mongoose.Schema(
  {
    fa: { type: String, required: true, trim: true, maxlength: 160 },
  },
  { _id: false },
);

const galleryImageSchema = new mongoose.Schema(
  {
    title: { type: persianTitleSchema, default: () => ({}) },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 60,
      index: true,
    },
    image: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

galleryImageSchema.index({ status: 1, category: 1, createdAt: -1 });

export default mongoose.model("GalleryImage", galleryImageSchema);
