import mongoose from "mongoose";
import { SUPPORT_SPECIALIZATIONS } from "./supportStaff.constants.js";

const supportStaffProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    specialization: {
      type: String,
      enum: SUPPORT_SPECIALIZATIONS,
      default: "general",
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("SupportStaffProfile", supportStaffProfileSchema);
