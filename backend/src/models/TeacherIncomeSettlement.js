import mongoose from "mongoose";

const teacherIncomeSettlementSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    cycleStartDay: {
      type: Number,
      enum: [1, 15],
      required: true,
      default: 1,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

teacherIncomeSettlementSchema.index(
  { teacherId: 1, courseId: 1, monthKey: 1 },
  { unique: true, name: "teacher_course_month_unique" },
);

const TeacherIncomeSettlement = mongoose.model(
  "TeacherIncomeSettlement",
  teacherIncomeSettlementSchema,
);

export default TeacherIncomeSettlement;
