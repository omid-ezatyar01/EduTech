import mongoose from "mongoose";

const teacherNotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["student_enrolled", "minimum_students_reached"],
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, trim: true, default: "", maxlength: 500 },
    url: { type: String, trim: true, default: "/teacher/courses" },
    eventKey: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

teacherNotificationSchema.index({ recipient: 1, createdAt: -1 });
teacherNotificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });

export default mongoose.model("TeacherNotification", teacherNotificationSchema);
