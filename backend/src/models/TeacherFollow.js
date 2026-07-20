import mongoose from "mongoose";

const teacherFollowSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    notificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

teacherFollowSchema.index({ teacher: 1, follower: 1 }, { unique: true });
export default mongoose.model("TeacherFollow", teacherFollowSchema);

