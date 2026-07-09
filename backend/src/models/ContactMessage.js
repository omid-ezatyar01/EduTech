import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ["new", "pending", "replied", "resolved"],
      default: "new",
      index: true,
    },
    source: {
      type: String,
      default: "contact_form",
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    repliedAt: {
      type: Date,
    },
    adminReply: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ name: "text", contact: "text", subject: "text", message: "text" });

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessage;
