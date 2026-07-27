import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      enum: ["student", "teacher"],
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: [
        "account",
        "course",
        "payment",
        "technical",
        "teaching",
        "certificate",
        "consultation",
        "registration",
        "feedback",
        "complaint",
        "other",
      ],
      default: "other",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_for_user", "resolved", "closed"],
      default: "open",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    claimedAt: { type: Date, default: null },
    lastAssignedAt: { type: Date, default: null },
    lastAssignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    handoffCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, trim: true, maxlength: 240, default: "" },
    lastSenderRole: {
      type: String,
      enum: ["student", "teacher", "admin", "support"],
      required: true,
    },
    unreadForRequester: { type: Number, default: 0, min: 0 },
    unreadForSupport: { type: Number, default: 1, min: 0 },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

supportTicketSchema.index({ requester: 1, lastMessageAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, lastMessageAt: -1 });
supportTicketSchema.index({
  ticketNumber: "text",
  subject: "text",
  lastMessagePreview: "text",
});

export default mongoose.model("SupportTicket", supportTicketSchema);
