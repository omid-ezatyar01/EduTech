import mongoose from "mongoose";

const courseResourceSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    type: {
      type: String,
      enum: ["PDF", "Link", "Video"],
      required: true,
      index: true,
    },
    url: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    filePath: {
      type: String,
      trim: true,
      default: "",
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

courseResourceSchema.index({ courseId: 1, createdAt: -1 });
courseResourceSchema.index({ courseId: 1, sessionId: 1, createdAt: -1 });

const CourseResource = mongoose.model("CourseResource", courseResourceSchema);

export default CourseResource;
