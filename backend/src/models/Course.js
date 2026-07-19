import mongoose from "mongoose";
import generateSlug from "../utils/generateSlug.js";
import { deriveCourseSchedule } from "../utils/courseSchedule.js";
import socialPostsSchema from "./schemas/socialPosts.schema.js";

const SUPPORTED_COURSE_CURRENCIES = ["USD", "AFN", "IRR"];

const scheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      trim: true,
      required: true,
    },
    startTime: {
      type: String,
      trim: true,
      required: true,
    },
    endTime: {
      type: String,
      trim: true,
      required: true,
    },
  },
  { _id: false },
);

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 120,
      maxlength: 2000,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
      index: true,
    },
    courseType: {
      type: String,
      enum: ["general", "special"],
      default: "general",
      index: true,
    },
    language: {
      type: String,
      default: "English",
      trim: true,
      minlength: 2,
      maxlength: 60,
      index: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    promoVideo: {
      type: String,
      trim: true,
    },
    previewVideoUrls: {
      type: [String],
      default: [],
      validate: {
        validator(value) {
          return !value || value.length <= 5;
        },
        message: "previewVideoUrls cannot contain more than 5 links",
      },
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
      max: 10000,
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
      max: 10000,
    },
    teacherDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      enum: SUPPORTED_COURSE_CURRENCIES,
      default: "USD",
      trim: true,
      uppercase: true,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    paymentPlan: {
      type: String,
      enum: ["monthly", "whole_period"],
      default: "monthly",
      index: true,
    },
    duration: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    durationWeeks: {
      type: Number,
      min: 1,
      max: 104,
    },
    totalSessions: {
      type: Number,
      min: 8,
      max: 728,
      validate: {
        validator: Number.isInteger,
        message: "totalSessions must be a whole number",
      },
    },
    startDate: {
      type: Date,
      index: true,
    },
    endDate: {
      type: Date,
      index: true,
    },
    classEndedAt: {
      type: Date,
      index: true,
    },
    classStartedAt: {
      type: Date,
      index: true,
    },
    lastAutoRescheduledAt: {
      type: Date,
    },
    classCancelledAt: {
      type: Date,
      index: true,
    },
    cancellationRequest: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
        index: true,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      requestedAt: {
        type: Date,
      },
      reviewedAt: {
        type: Date,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      adminResponse: {
        type: String,
        trim: true,
        default: "",
      },
    },
    endRequest: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
        index: true,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      requestedAt: {
        type: Date,
      },
      reviewedAt: {
        type: Date,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      adminResponse: {
        type: String,
        trim: true,
        default: "",
      },
    },
    schedule: {
      type: [scheduleSchema],
      default: [],
    },
    meetingType: {
      type: String,
      enum: ["google_meet", "zoom", "physical", "recorded"],
      default: "recorded",
    },
    meetingLink: {
      type: String,
      trim: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    whatYouWillLearn: {
      type: [String],
      default: [],
    },
    targetAudience: {
      type: [String],
      default: [],
    },
    curriculumTopics: {
      type: [String],
      default: [],
    },
    maxStudents: {
      type: Number,
      min: 1,
      max: 2000,
      default: 100,
    },
    minimumStudentsToStart: {
      type: Number,
      min: 1,
      max: 2000,
      default: 1,
    },
    enrolledStudentsCount: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    commissionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "published", "cancelled"],
      default: "draft",
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    allowStudentGroupMessages: {
      type: Boolean,
      default: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    socialPosts: {
      type: socialPostsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

courseSchema.pre("validate", async function () {
  if (this.isModified("title") || !this.slug) {
    this.slug = generateSlug(this.title || "");
  }

  if (this.isNew || this.isModified("title") || this.isModified("slug")) {
    const baseSlug = String(this.slug || "").trim() || generateSlug(this.title || "course");
    let nextSlug = baseSlug;
    let suffix = 2;

    // Resolve collisions like "javascript-basics", "javascript-basics-2", ...
    // Keep existing slug for same document when updating.
    // eslint-disable-next-line no-await-in-loop
    while (
      await mongoose.models.Course.exists({
        slug: nextSlug,
        _id: { $ne: this._id },
      })
    ) {
      nextSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    this.slug = nextSlug;
  }

  if (!this.teacherId && this.teacher) {
    this.teacherId = this.teacher;
  }

  if (!this.teacher && this.teacherId) {
    this.teacher = this.teacherId;
  }

  if (this.isFree) {
    this.price = 0;
    this.discountPrice = 0;
    this.teacherDiscountPercentage = 0;
  }

  if (!this.isFree) {
    const price = Number(this.price || 0);
    if (!Number.isInteger(price) || price < 1 || price > 10000) {
      throw new Error("paid course price must be >= 1");
    }

    let teacherDiscountPercentage = Number(this.teacherDiscountPercentage || 0);
    if (!Number.isFinite(teacherDiscountPercentage)) {
      teacherDiscountPercentage = 0;
    }
    teacherDiscountPercentage = Math.max(0, Math.min(100, Math.round(teacherDiscountPercentage * 100) / 100));

    if (teacherDiscountPercentage > 0) {
      this.teacherDiscountPercentage = teacherDiscountPercentage;
      this.discountPrice = Math.max(
        0,
        Math.round(price - ((price * teacherDiscountPercentage) / 100)),
      );
    } else if (this.discountPrice > 0 && this.discountPrice <= price) {
      const derivedPercentage = ((price - Number(this.discountPrice || 0)) / price) * 100;
      this.teacherDiscountPercentage = Math.max(
        0,
        Math.min(100, Math.round(derivedPercentage * 100) / 100),
      );
    } else {
      this.discountPrice = 0;
      this.teacherDiscountPercentage = 0;
    }
  }

  if (this.discountPrice > this.price) {
    throw new Error("discountPrice cannot be greater than price");
  }

  const exactSchedule = deriveCourseSchedule({
    startDate: this.startDate,
    schedule: this.schedule,
    totalSessions: this.totalSessions,
  });
  const weeks = Number(this.durationWeeks || 0);
  if (exactSchedule) {
    this.durationWeeks = exactSchedule.durationWeeks;
    this.endDate = exactSchedule.endDate;
  } else if (this.startDate && Number.isFinite(weeks) && weeks > 0) {
    const start = new Date(this.startDate);
    const endTimeSource = this.endDate ? new Date(this.endDate) : start;
    const computedEnd = new Date(start);
    computedEnd.setDate(computedEnd.getDate() + Math.max(1, Math.round(weeks)) * 7 - 1);
    computedEnd.setHours(
      endTimeSource.getHours(),
      endTimeSource.getMinutes(),
      endTimeSource.getSeconds(),
      endTimeSource.getMilliseconds(),
    );
    this.endDate = computedEnd;
  } else if (this.startDate && this.endDate && (!this.durationWeeks || this.durationWeeks < 1)) {
    const startDay = new Date(this.startDate);
    const endDay = new Date(this.endDate);
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);
    const diffMs = endDay.getTime() - startDay.getTime();
    if (diffMs >= 0) {
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
      this.durationWeeks = Math.max(1, Math.ceil(days / 7));
    }
  }

  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    throw new Error("startDate cannot be after endDate");
  }

  if (this.status === "published") {
    this.isPublished = true;
  } else if (this.isModified("status")) {
    this.isPublished = false;
  }

  if (this.status !== "rejected") {
    this.rejectionReason = "";
  }

  if (!this.isFree && Number(this.price || 0) > 0 && !this.currency) {
    this.currency = "USD";
  }
});

courseSchema.index(
  { title: "text", shortDescription: "text", description: "text" },
  {
    default_language: "none",
    language_override: "textSearchLanguage",
    name: "course_text_search",
  },
);
courseSchema.index({ category: 1, level: 1, language: 1, status: 1, teacherId: 1 });
courseSchema.index({ createdAt: -1 });

const Course = mongoose.model("Course", courseSchema);

export default Course;
