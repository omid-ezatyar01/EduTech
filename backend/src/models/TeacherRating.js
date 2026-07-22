import mongoose from "mongoose";

const teacherRatingSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eligibilityCourseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true, maxlength: 500, default: "" },
  tags: [{ type: String, trim: true, maxlength: 60 }],
  displayName: { type: Boolean, default: true },
  moderationStatus: { type: String, enum: ["pending", "published", "hidden"], default: "pending", index: true },
  teacherReply: { type: String, trim: true, maxlength: 500, default: "" },
  teacherRepliedAt: Date,
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  moderatedAt: Date,
  removedByTeacherAt: Date,
  helpfulBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  reports: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, reason: { type: String, trim: true, maxlength: 300, default: "" }, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

teacherRatingSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });
teacherRatingSchema.index({ teacherId: 1, createdAt: -1 });

export default mongoose.model("TeacherRating", teacherRatingSchema);
