import mongoose from "mongoose";

const courseThumbnailAssetSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^course-[\w.-]+\.webp$/i,
    },
    contentType: {
      type: String,
      default: "image/webp",
      enum: ["image/webp"],
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true },
);

const CourseThumbnailAsset = mongoose.model(
  "CourseThumbnailAsset",
  courseThumbnailAssetSchema,
);

export default CourseThumbnailAsset;
