import mongoose from "mongoose";

const videoSaveSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

videoSaveSchema.index({ video: 1, user: 1 }, { unique: true });

export default mongoose.model("VideoSave", videoSaveSchema);
