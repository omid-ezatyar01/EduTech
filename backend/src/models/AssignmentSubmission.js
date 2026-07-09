import mongoose from "mongoose";

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },
    textAnswer: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },
    attachmentUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1200,
    },
    status: {
      type: String,
      enum: ["submitted", "reviewed"],
      default: "submitted",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isLate: {
      type: Boolean,
      default: false,
      index: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 1000,
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
assignmentSubmissionSchema.index({ assignmentId: 1, status: 1, submittedAt: -1 });
assignmentSubmissionSchema.index({ studentId: 1, submittedAt: -1 });

const AssignmentSubmission = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);

export default AssignmentSubmission;

