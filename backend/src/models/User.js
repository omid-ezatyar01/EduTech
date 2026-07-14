import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import socialPostsSchema from "./schemas/socialPosts.schema.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student",
    },
    status: {
      type: String,
      enum: ["active", "blocked", "pending_verification"],
      default: "active",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    lastContactMessageAt: {
      type: Date,
      default: null,
    },

    emailOtpHash: {
      type: String,
    },

    emailOtpExpiresAt: {
      type: Date,
    },

    emailOtpAttempts: {
      type: Number,
      default: 0,
    },

    emailBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailBlockReason: {
      type: String,
      trim: true,
      default: "",
    },

    emailBlockedAt: {
      type: Date,
      default: null,
    },

    avatar: {
      type: String,
      trim: true,
      default: "",
    },

    googleId: {
      type: String,
      trim: true,
      default: "",
    },

    username: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    firstNameFa: {
      type: String,
      trim: true,
      default: "",
    },

    lastNameFa: {
      type: String,
      trim: true,
      default: "",
    },

    birthDate: {
      type: String,
      trim: true,
      default: "",
    },

    gender: {
      type: String,
      trim: true,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    postalCode: {
      type: String,
      trim: true,
      default: "",
    },

    gradeLevel: {
      type: String,
      trim: true,
      default: "",
    },

    schoolName: {
      type: String,
      trim: true,
      default: "",
    },

    preferredLanguage: {
      type: String,
      trim: true,
      default: "",
    },

    timezone: {
      type: String,
      trim: true,
      default: "",
    },

    parentName: {
      type: String,
      trim: true,
      default: "",
    },

    parentPhone: {
      type: String,
      trim: true,
      default: "",
    },

    emergencyContactName: {
      type: String,
      trim: true,
      default: "",
    },

    emergencyContactPhone: {
      type: String,
      trim: true,
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      default: "",
    },

    contractStartDate: {
      type: Date,
      default: null,
    },

    contractValidUntil: {
      type: Date,
      default: null,
    },

    contractExpiryOverride: {
      type: Boolean,
      default: false,
    },

    studentId: {
      type: String,
      trim: true,
      default: "",
    },

    socialLinks: {
      linkedin: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      instagram: { type: String, trim: true, default: "" },
      facebook: { type: String, trim: true, default: "" },
      whatsapp: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
      github: { type: String, trim: true, default: "" },
    },
    socialPosts: {
      type: socialPostsSchema,
      default: () => ({}),
    },

    notifications: {
      course: { type: Boolean, default: true },
      assignments: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      news: { type: Boolean, default: false },
      important: { type: Boolean, default: true },
    },
    communicationSettings: {
      allowStudentDirectMessages: {
        type: Boolean,
        default: true,
      },
    },
    bankPaymentInfo: {
      accountHolderName: {
        type: String,
        trim: true,
        default: "",
      },
      bankName: {
        type: String,
        trim: true,
        default: "",
      },
      accountNumber: {
        type: String,
        trim: true,
        default: "",
      },
      cardNumber: {
        type: String,
        trim: true,
        default: "",
      },
      iban: {
        type: String,
        trim: true,
        default: "",
      },
      note: {
        type: String,
        trim: true,
        default: "",
      },
    },

    teacherApplication: {
      status: {
        type: String,
        enum: ["draft", "submitted", "approved", "rejected"],
        default: "draft",
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewNote: {
        type: String,
        trim: true,
        default: "",
      },
      professionalTitle: {
        type: String,
        trim: true,
        default: "",
      },
      yearsExperience: {
        type: Number,
        default: 0,
        min: 0,
      },
      education: {
        type: String,
        trim: true,
        default: "",
      },
      expertiseAreas: {
        type: [String],
        default: [],
      },
      teachingLevels: {
        type: [String],
        default: [],
      },
      certifications: {
        type: [String],
        default: [],
      },
      languages: {
        type: [String],
        default: [],
      },
      skillRatings: {
        type: [
          {
            name: { type: String, trim: true, default: "" },
            percentage: { type: Number, min: 0, max: 100, default: 0 },
          },
        ],
        default: [],
      },
      portfolioUrl: {
        type: String,
        trim: true,
        default: "",
      },
      cvUrl: {
        type: String,
        trim: true,
        default: "",
      },
      certificatesFileUrl: {
        type: String,
        trim: true,
        default: "",
      },
      introVideoUrl: {
        type: String,
        trim: true,
        default: "",
      },
      nationalId: {
        type: String,
        trim: true,
        default: "",
      },
      availableHoursPerWeek: {
        type: Number,
        default: 0,
        min: 0,
      },
      expectedMonthlySalaryAfn: {
        type: Number,
        default: 0,
        min: 0,
      },
      motivation: {
        type: String,
        trim: true,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      studentId: { $type: "string", $ne: "" },
    },
  },
);

userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      googleId: { $type: "string", $ne: "" },
    },
  },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
