import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    url: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["youtube", "instagram"], required: true, index: true },
    embedUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    likeCount: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 100000 },
  },
  { timestamps: true },
);

videoSchema.index({ isPublished: 1, sortOrder: 1, createdAt: -1 });
videoSchema.index({ isPublished: 1, likeCount: -1, createdAt: -1 });
videoSchema.index({ teacher: 1, createdAt: -1 });

export default mongoose.model("Video", videoSchema);
