import mongoose from "mongoose";

const telegramSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "telegram",
      unique: true,
      index: true,
      trim: true,
    },
    publicChannelId: {
      type: String,
      trim: true,
      default: "",
    },
    publicChannelUsername: {
      type: String,
      trim: true,
      default: "",
    },
    autoPostCourses: {
      type: Boolean,
      default: true,
    },
    autoPostTeachers: {
      type: Boolean,
      default: true,
    },
    autoPostEvents: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

telegramSettingsSchema.statics.getSingleton = async function getSingleton() {
  return this.findOneAndUpdate(
    { singletonKey: "telegram" },
    { $setOnInsert: { singletonKey: "telegram" } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
};

const TelegramSettings = mongoose.model("TelegramSettings", telegramSettingsSchema);

export default TelegramSettings;
