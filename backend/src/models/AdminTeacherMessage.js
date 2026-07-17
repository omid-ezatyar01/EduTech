import mongoose from "mongoose";

const adminTeacherMessageSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: ["admin", "teacher"],
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
    readByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    readByTeacher: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

adminTeacherMessageSchema.index({ teacherId: 1, createdAt: -1 });
adminTeacherMessageSchema.index({ teacherId: 1, senderRole: 1, createdAt: -1 });

const AdminTeacherMessage = mongoose.model("AdminTeacherMessage", adminTeacherMessageSchema);

export default AdminTeacherMessage;
