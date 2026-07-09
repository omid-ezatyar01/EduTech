import mongoose from "mongoose";

const telegramPostSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["course", "teacher", "event"],
      required: true,
      index: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    telegramMessageId: {
      type: Number,
      default: null,
    },
    channelId: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["posted", "failed", "removed"],
      required: true,
      index: true,
    },
    error: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

telegramPostSchema.index({ type: 1, refId: 1 }, { unique: true });

const TelegramPost = mongoose.model("TelegramPost", telegramPostSchema);

export default TelegramPost;
