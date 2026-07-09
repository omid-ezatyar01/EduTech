import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 4000,
    },
    type: {
      type: String,
      enum: ["homework", "project", "quiz"],
      default: "homework",
      index: true,
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 1000,
      default: 100,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },
    allowLateSubmission: {
      type: Boolean,
      default: false,
    },
    attachmentUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1200,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

assignmentSchema.pre("save", function () {
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  if (this.status !== "published") {
    this.publishedAt = this.publishedAt || null;
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }

  if (this.status !== "closed") {
    this.closedAt = null;
  }
});

assignmentSchema.index({ teacherId: 1, courseId: 1, status: 1, createdAt: -1 });
assignmentSchema.index({ title: "text", description: "text" });

const Assignment = mongoose.model("Assignment", assignmentSchema);

export default Assignment;

