import mongoose from "mongoose";

const facebookSocialPostSchema = new mongoose.Schema(
  {
    posted: {
      type: Boolean,
      default: false,
    },
    postId: {
      type: String,
      trim: true,
      default: "",
    },
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const socialPostsSchema = new mongoose.Schema(
  {
    facebook: {
      type: facebookSocialPostSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

export default socialPostsSchema;
