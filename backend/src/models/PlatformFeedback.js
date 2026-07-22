import mongoose from "mongoose";

const platformFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["feedback", "suggestion", "complaint", "bug"], default: "feedback", index: true },
    score: { type: Number, min: 1, max: 5, required: true },
    feedbackMonth: { type: String, trim: true, match: /^\d{4}-\d{2}$/, index: true },
    message: { type: String, trim: true, maxlength: 2000, default: "" },
    page: { type: String, trim: true, maxlength: 200, default: "" },
    status: { type: String, enum: ["new", "reviewing", "resolved"], default: "new", index: true },
    adminNote: { type: String, trim: true, maxlength: 1000, default: "" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: true },
);

platformFeedbackSchema.index({ createdAt: -1 });
platformFeedbackSchema.index(
  { userId: 1, feedbackMonth: 1 },
  { unique: true, partialFilterExpression: { feedbackMonth: { $type: "string" } } },
);

export default mongoose.model("PlatformFeedback", platformFeedbackSchema);
