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
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true },
);

courseRatingSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
courseRatingSchema.index({ courseId: 1, createdAt: -1 });
courseRatingSchema.index({ teacherId: 1, createdAt: -1 });

const CourseRating = mongoose.model("CourseRating", courseRatingSchema);

export default CourseRating;
