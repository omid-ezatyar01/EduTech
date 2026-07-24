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
    role: {
      type: String,
      enum: ["student", "teacher", "admin", ""],
      default: "",
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
    reconnectRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastError: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true },
);

googleAccountSchema.index({ googleEmail: 1 });

const GoogleAccount = mongoose.model("GoogleAccount", googleAccountSchema);

export default GoogleAccount;
