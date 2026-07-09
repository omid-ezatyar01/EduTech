import mongoose from "mongoose";

const SEVENTY_TWO_HOURS_IN_SECONDS = 72 * 60 * 60;
const SEVENTY_TWO_HOURS_IN_MILLISECONDS = SEVENTY_TWO_HOURS_IN_SECONDS * 1000;

const directMessageSchema = new mongoose.Schema(
  {
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
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["teacher", "student"],
      required: true,
      index: true,
    },
    broadcastGroupId: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
    readByTeacher: {
      type: Boolean,
      default: false,
      index: true,
    },
    readByStudent: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + SEVENTY_TWO_HOURS_IN_MILLISECONDS),
    },
  },
  { timestamps: true },
);

directMessageSchema.index({ teacherId: 1, studentId: 1, createdAt: -1 });
directMessageSchema.index({ studentId: 1, teacherId: 1, createdAt: -1 });
directMessageSchema.index({ teacherId: 1, readByTeacher: 1, createdAt: -1 });
directMessageSchema.index({ studentId: 1, readByStudent: 1, createdAt: -1 });

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;
