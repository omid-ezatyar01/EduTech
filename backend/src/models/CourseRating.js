import mongoose from "mongoose";

const courseRatingSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    courseRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    teacherRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    tags: [{ type: String, trim: true, maxlength: 60 }],
    displayName: {
      type: Boolean,
      default: true,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "published", "hidden"],
      default: "pending",
      index: true,
    },
    teacherReply: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    teacherRepliedAt: Date,
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
    removedByTeacherAt: Date,
    helpfulBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reports: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: { type: String, trim: true, maxlength: 300, default: "" },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

courseRatingSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
courseRatingSchema.index({ courseId: 1, createdAt: -1 });
courseRatingSchema.index({ teacherId: 1, createdAt: -1 });
courseRatingSchema.index({ moderationStatus: 1, createdAt: -1 });

const CourseRating = mongoose.model("CourseRating", courseRatingSchema);

export default CourseRating;
