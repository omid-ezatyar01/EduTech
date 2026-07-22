import mongoose from "mongoose";

const articleViewSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: "Article", required: true, index: true },
    visitorHash: { type: String, required: true, maxlength: 64 },
  },
  { timestamps: true },
);

articleViewSchema.index({ article: 1, visitorHash: 1 }, { unique: true });

export default mongoose.model("ArticleView", articleViewSchema);
