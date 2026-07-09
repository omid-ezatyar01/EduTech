import mongoose from "mongoose";
import generateSlug from "../utils/generateSlug.js";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

categorySchema.pre("validate", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = generateSlug(this.name || "");
  }
});

categorySchema.index({ createdAt: -1 });
categorySchema.index({ parent: 1, name: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;
