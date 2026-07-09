import mongoose from "mongoose";

const appSettingSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "global",
      unique: true,
      index: true,
      trim: true,
    },
    teacherDeductionPercentage: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    minTeacherCoursePrice: {
      type: Number,
      default: 5,
      min: 0,
      max: 10000,
    },
    globalCourseDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

appSettingSchema.statics.getSingleton = async function getSingleton() {
  return this.findOneAndUpdate(
    { singletonKey: "global" },
    { $setOnInsert: { singletonKey: "global" } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  );
};

const AppSetting = mongoose.model("AppSetting", appSettingSchema);

export default AppSetting;
