import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, default: "" },
    en: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const articleSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 120 },
    title: { type: localizedTextSchema, required: true },
    excerpt: { type: localizedTextSchema, required: true },
    content: { type: localizedTextSchema, required: true },
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 50, index: true },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    coverImage: { type: String, trim: true, default: "", maxlength: 1000 },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    featured: { type: Boolean, default: false, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seoTitle: { type: localizedTextSchema, default: () => ({}) },
    seoDescription: { type: localizedTextSchema, default: () => ({}) },
    publishedAt: { type: Date, default: null, index: true },
    estimatedReadMinutes: { type: Number, default: 1, min: 1, max: 240 },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

articleSchema.index({ status: 1, featured: -1, publishedAt: -1 });
articleSchema.index({ status: 1, category: 1, publishedAt: -1 });
articleSchema.index({ status: 1, viewCount: -1, publishedAt: -1 });

export default mongoose.model("Article", articleSchema);
