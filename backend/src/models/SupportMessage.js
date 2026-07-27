import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["student", "teacher", "admin", "support"],
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
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportMessage",
      default: null,
      index: true,
    },
    hiddenFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    deletedForEveryoneAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    editedAt: { type: Date, default: null },
    internalNote: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

supportMessageSchema.index({ ticket: 1, createdAt: 1 });

export default mongoose.model("SupportMessage", supportMessageSchema);
