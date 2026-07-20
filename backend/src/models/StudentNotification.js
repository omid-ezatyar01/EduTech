import mongoose from "mongoose";

const studentNotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["teacher_video", "teacher_course"], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, trim: true, default: "", maxlength: 500 },
    url: { type: String, trim: true, default: "" },
    eventKey: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

studentNotificationSchema.index({ recipient: 1, createdAt: -1 });
studentNotificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });
export default mongoose.model("StudentNotification", studentNotificationSchema);

