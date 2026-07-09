import mongoose from "mongoose";

const googleAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    googleEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    accessToken: {
      type: String,
      trim: true,
      default: "",
    },
    refreshToken: {
      type: String,
      trim: true,
      default: "",
    },
    expiryDate: {
      type: Date,
    },
    scope: {
      type: String,
      trim: true,
      default: "",
    },
    tokenType: {
      type: String,
      trim: true,
      default: "Bearer",
    },
  },
  { timestamps: true },
);

googleAccountSchema.index({ googleEmail: 1 });

const GoogleAccount = mongoose.model("GoogleAccount", googleAccountSchema);

export default GoogleAccount;
