import mongoose from "mongoose";

const adminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "course_review",
        "course_end_review",
        "course_minimum_override",
        "teacher_application_review",
      ],
      required: true,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    hiddenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

adminNotificationSchema.index({ createdAt: -1 });

const AdminNotification = mongoose.model(
  "AdminNotification",
  adminNotificationSchema,
);

export default AdminNotification;
