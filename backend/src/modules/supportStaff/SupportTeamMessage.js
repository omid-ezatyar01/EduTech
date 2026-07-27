import mongoose from "mongoose";

const supportTeamMessageSchema = new mongoose.Schema(
  {
    conversationType: {
      type: String,
      enum: ["direct", "channel"],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["general"],
      default: undefined,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
  },
  { timestamps: true },
);

supportTeamMessageSchema.pre("validate", function () {
  if (this.conversationType === "direct") {
    this.channel = undefined;
    if (!this.recipient) this.invalidate("recipient", "Direct messages require a recipient");
  } else {
    this.channel = this.channel || "general";
    this.recipient = null;
  }
});

supportTeamMessageSchema.index({ channel: 1, createdAt: -1 });
supportTeamMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
supportTeamMessageSchema.index({ recipient: 1, readBy: 1, createdAt: -1 });

export default mongoose.model("SupportTeamMessage", supportTeamMessageSchema);
