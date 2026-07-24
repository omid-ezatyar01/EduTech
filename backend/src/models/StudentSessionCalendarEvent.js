import mongoose from "mongoose";

const studentSessionCalendarEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    calendarId: { type: String, trim: true, default: "primary" },
    eventId: { type: String, trim: true, default: "", index: true },
    status: {
      type: String,
      enum: ["pending", "synced", "pending_delete", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, min: 0, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, trim: true, default: "", maxlength: 500 },
    syncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studentSessionCalendarEventSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true },
);
studentSessionCalendarEventSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model(
  "StudentSessionCalendarEvent",
  studentSessionCalendarEventSchema,
);
