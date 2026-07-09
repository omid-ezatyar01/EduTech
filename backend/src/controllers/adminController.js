import Joi from "joi";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import AppSetting from "../models/AppSetting.js";
import OtpVerification from "../models/OtpVerification.js";
import {
  normalizeGlobalCourseDiscountPercentage,
  getTeacherDeductionPercentage,
  normalizeMinTeacherCoursePrice,
  normalizeTeacherDeductionPercentage,
} from "../utils/platformSettings.js";
import { cleanUser } from "../utils/userUtils.js";
import { deleteUserRelatedData } from "../services/userCascadeDelete.service.js";
import { notifyApprovedTeacherApplication } from "../services/webPush.service.js";
import {
  triggerTelegramPostRemoval,
  triggerTelegramTeacherAnnouncement,
} from "../services/telegramAnnouncement.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const teacherCvDirectory = path.resolve(__dirname, "../../uploads/teacher-cv");
const teacherCertificatesDirectory = path.resolve(
  __dirname,
  "../../uploads/teacher-certificates",
);

const removeOldTeacherCvIfLocal = async (cvPath = "") => {
  if (!cvPath || !cvPath.startsWith("/uploads/teacher-cv/")) return;
  const filename = path.basename(cvPath);
  if (!filename) return;
  const oldFilePath = path.resolve(teacherCvDirectory, filename);
  await fs.unlink(oldFilePath).catch(() => {});
};

const removeOldTeacherCertificateIfLocal = async (certificatePath = "") => {
  if (!certificatePath || !certificatePath.startsWith("/uploads/teacher-certificates/")) return;
  const filename = path.basename(certificatePath);
  if (!filename) return;
  const oldFilePath = path.resolve(teacherCertificatesDirectory, filename);
  await fs.unlink(oldFilePath).catch(() => {});
};

const applyAdminStatusUpdate = (user, nextStatus) => {
  if (!user || !nextStatus) return;

  user.status = nextStatus;

  if (nextStatus === "active") {
    user.emailBlocked = false;
    user.emailBlockReason = "";
    user.emailBlockedAt = null;

    if (user.role === "student" && !user.isEmailVerified) {
      user.isEmailVerified = true;
    }

    if (user.role === "teacher") {
      user.contractExpiryOverride = true;
    }
  }

  if (nextStatus === "blocked" && user.role === "teacher") {
    user.contractExpiryOverride = false;
  }
};

const createUserSchema = Joi.object({
  name: Joi.string().trim().required(),

  email: Joi.string().email().trim().lowercase().required(),

  phone: Joi.string().trim().required(),

  password: Joi.string().min(6).required(),

  role: Joi.string().valid("student", "teacher", "admin").required(),

  status: Joi.string().valid("active", "blocked", "pending_verification").default("active"),

  isEmailVerified: Joi.boolean().default(true),
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim(),

  email: Joi.string().email().trim().lowercase(),

  phone: Joi.string().trim(),

  password: Joi.string().min(6),

  role: Joi.string().valid("student", "teacher", "admin"),

  status: Joi.string().valid("active", "blocked", "pending_verification"),

  isEmailVerified: Joi.boolean(),
  contractStartDate: Joi.date().iso().allow(null, ""),
  contractValidUntil: Joi.date().iso().allow(null, ""),
}).custom((value, helpers) => {
  if (!value.contractStartDate || !value.contractValidUntil) {
    return value;
  }

  const startAt = new Date(value.contractStartDate);
  const validUntil = new Date(value.contractValidUntil);

  if (validUntil < startAt) {
    return helpers.error("any.invalid");
  }

  return value;
}, "contract date validation").messages({
  "any.invalid": "Contract valid date must be on or after the contract date.",
}).min(1);

const createTeacherByAdminSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  contractStartDate: Joi.date().iso().allow(null, ""),
  contractValidUntil: Joi.date().iso().allow(null, ""),
}).custom((value, helpers) => {
  if (!value.contractStartDate || !value.contractValidUntil) {
    return value;
  }

  const startAt = new Date(value.contractStartDate);
  const validUntil = new Date(value.contractValidUntil);

  if (validUntil < startAt) {
    return helpers.error("any.invalid");
  }

  return value;
}, "contract date validation").messages({
  "any.invalid": "Contract valid date must be on or after the contract date.",
});

const reviewTeacherApplicationSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),
  note: Joi.string().trim().allow("").max(1000).default(""),
});

const DEFAULT_ADMIN_CREATED_TEACHER_PASSWORD = "123456";
const getTeacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const mapPlatformSettings = (settings = null) => {
  const deduction = normalizeTeacherDeductionPercentage(
    settings?.teacherDeductionPercentage,
  );
  const minTeacherCoursePrice = normalizeMinTeacherCoursePrice(
    settings?.minTeacherCoursePrice,
  );
  const globalCourseDiscountPercentage = normalizeGlobalCourseDiscountPercentage(
    settings?.globalCourseDiscountPercentage,
  );

  return {
    teacherDeductionPercentage: deduction,
    minTeacherCoursePrice,
    globalCourseDiscountPercentage,
  };
};

const resolveDashboardPaymentMethodLabel = (payment = {}) => {
  const method = String(payment?.paymentMethod || "").toLowerCase();
  if (method === "hesabpay") return "Visa / MasterCard";
  if (method === "usdt_bsc_direct") return "USDT";
  if (method === "nowpayments_crypto") return "Crypto Gateway";
  if (method === "bank_transfer") return "Bank";
  return payment?.paymentMethod || "Payment";
};

const resolveDashboardMarketLabel = (payment = {}) => {
  const currency = String(payment?.gatewayCurrency || payment?.currency || "USD").toUpperCase();
  if (currency === "AFN") return "Afghanistan";
  if (currency === "IRR") return "Iran";
  if (currency === "USDT" || currency === "USD") return "International";
  return "International";
};

const resolveDashboardBaseUsdAmount = (payment = {}) => {
  const baseUsd = Number(payment?.baseAmountUsdCents || 0) / 100;
  if (Number.isFinite(baseUsd) && baseUsd > 0) return baseUsd;

  const amount = Number(payment?.amount || 0);
  const currency = String(payment?.currency || "").toUpperCase();
  if (currency === "USD" || currency === "USDT") return amount;

  return 0;
};

// @desc    Admin dashboard stats
// @route   GET /api/v1/admin/dashboard
// @access  Admin
export const getAdminDashboard = async (req, res) => {
  try {
    const commissionRate = await getTeacherDeductionPercentage();
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalAdmins,
      activeStudents,
      pendingStudents,
      pendingUsers,
      verifiedUsers,
      unverifiedUsers,
      blockedUsers,
      paidPayments,
      recentPayments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "student", status: "active", isEmailVerified: true }),
      User.countDocuments({ role: "student", status: "pending_verification" }),
      User.countDocuments({ status: "pending_verification" }),
      User.countDocuments({ isEmailVerified: true }),
      User.countDocuments({ isEmailVerified: false }),
      User.countDocuments({ status: "blocked" }),
      Payment.find({
        $or: [{ status: "paid" }, { paymentStatus: "paid" }],
      })
        .select("amount baseAmountUsdCents paidAt createdAt")
        .lean(),
      Payment.find({
        $or: [{ status: "paid" }, { paymentStatus: "paid" }],
      })
        .select("amount baseAmountUsdCents currency gatewayAmount gatewayCurrency paymentMethod paidAt createdAt courseId studentId")
        .populate("courseId", "title")
        .populate("studentId", "name nameFa firstName firstNameFa email")
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const monthlyIncomeMap = new Map();
    const now = new Date();
    const monthKeys = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyIncomeMap.set(key, {
        monthKey: key,
        label: date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
        totalRevenue: 0,
        platformIncome: 0,
      });
      return key;
    });

    paidPayments.forEach((payment) => {
      const sourceDate = payment?.paidAt || payment?.createdAt;
      const date = sourceDate ? new Date(sourceDate) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const bucket = monthlyIncomeMap.get(monthKey);
      if (!bucket) return;
      const baseUsd = Number(payment?.baseAmountUsdCents || 0) / 100;
      const revenue = Number.isFinite(baseUsd) && baseUsd > 0 ? baseUsd : Number(payment?.amount || 0);
      const platformIncome = (revenue * Number(commissionRate || 0)) / 100;
      bucket.totalRevenue += revenue;
      bucket.platformIncome += platformIncome;
    });

    const monthlyIncome = monthKeys.map((key) => {
      const row = monthlyIncomeMap.get(key);
      return {
        ...row,
        totalRevenue: Math.round((Number(row?.totalRevenue || 0) + Number.EPSILON) * 100) / 100,
        platformIncome: Math.round((Number(row?.platformIncome || 0) + Number.EPSILON) * 100) / 100,
      };
    });

    return res.json({
      stats: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalAdmins,
        activeStudents,
        pendingStudents,
        pendingUsers,
        verifiedUsers,
        unverifiedUsers,
        blockedUsers,
        commissionRate,
      },
      monthlyIncome,
      recentPayments: recentPayments.map((payment) => {
        const baseRevenue = resolveDashboardBaseUsdAmount(payment);
        const platformIncome = (baseRevenue * Number(commissionRate || 0)) / 100;
        const studentName =
          payment?.studentId?.nameFa ||
          payment?.studentId?.firstNameFa ||
          payment?.studentId?.name ||
          payment?.studentId?.firstName ||
          payment?.studentId?.email ||
          "Student";

        return {
          id: String(payment?._id || ""),
          studentName,
          courseTitle: payment?.courseId?.title || "Course",
          paymentMethod: resolveDashboardPaymentMethodLabel(payment),
          market: resolveDashboardMarketLabel(payment),
          baseRevenue: Math.round((Number(baseRevenue || 0) + Number.EPSILON) * 100) / 100,
          platformIncome: Math.round((Number(platformIncome || 0) + Number.EPSILON) * 100) / 100,
          paidAt: payment?.paidAt || payment?.createdAt || null,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get admin platform settings
// @route   GET /api/v1/admin/settings
// @access  Admin
export const getAdminPlatformSettings = async (req, res) => {
  try {
    const settings = await AppSetting.getSingleton();

    return res.json({
      message: "Admin platform settings fetched successfully",
      data: mapPlatformSettings(settings),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Update admin platform settings
// @route   PATCH /api/v1/admin/settings
// @access  Admin
export const updateAdminPlatformSettings = async (req, res) => {
  try {
    const deduction = normalizeTeacherDeductionPercentage(
      req.body?.teacherDeductionPercentage,
    );
    const minTeacherCoursePrice = normalizeMinTeacherCoursePrice(
      req.body?.minTeacherCoursePrice,
    );
    const globalCourseDiscountPercentage = normalizeGlobalCourseDiscountPercentage(
      req.body?.globalCourseDiscountPercentage,
    );

    const settings = await AppSetting.findOneAndUpdate(
      { singletonKey: "global" },
      {
        $set: {
          teacherDeductionPercentage: deduction,
          minTeacherCoursePrice,
          globalCourseDiscountPercentage,
        },
        $setOnInsert: {
          singletonKey: "global",
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    return res.json({
      message: "Admin platform settings updated successfully",
      data: mapPlatformSettings(settings),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get all users
// @route   GET /api/v1/admin/users
// @access  Admin
export const getAllUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const { role, status, search, isEmailVerified } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.status = status;
    }

    if (typeof isEmailVerified !== "undefined" && isEmailVerified !== "") {
      filter.isEmailVerified = String(isEmailVerified) === "true";
    }

    if (search) {
      const searchFilters = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        searchFilters.push({ _id: search });
      }
      filter.$or = searchFilters;
    }

    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      User.countDocuments(filter),
    ]);

    const cleanedUsers = users.map(cleanUser);
    const studentIds = cleanedUsers
      .filter((user) => user?.role === "student" && user?._id)
      .map((user) => new mongoose.Types.ObjectId(user._id));

    const studentMetricsRows = studentIds.length
      ? await Enrollment.aggregate([
        { $match: { studentId: { $in: studentIds } } },
        {
          $group: {
            _id: "$studentId",
            totalEnrollmentsCount: { $sum: 1 },
            activeCoursesCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$enrollmentStatus", "active"] },
                      { $eq: ["$accessStatus", "allowed"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            completedCoursesCount: {
              $sum: {
                $cond: [{ $eq: ["$enrollmentStatus", "completed"] }, 1, 0],
              },
            },
            pendingCoursesCount: {
              $sum: {
                $cond: [{ $eq: ["$enrollmentStatus", "pending"] }, 1, 0],
              },
            },
            lastEnrollmentAt: {
              $max: { $ifNull: ["$updatedAt", "$createdAt"] },
            },
          },
        },
      ])
      : [];

    const studentMetricsMap = new Map(
      studentMetricsRows.map((row) => [
        String(row._id),
        {
          totalEnrollmentsCount: Number(row?.totalEnrollmentsCount || 0),
          activeCoursesCount: Number(row?.activeCoursesCount || 0),
          completedCoursesCount: Number(row?.completedCoursesCount || 0),
          pendingCoursesCount: Number(row?.pendingCoursesCount || 0),
          lastEnrollmentAt: row?.lastEnrollmentAt || null,
        },
      ]),
    );

    return res.json({
      users: cleanedUsers.map((user) => ({
        ...user,
        studentMetrics: user?.role === "student"
          ? (studentMetricsMap.get(String(user._id)) || {
            totalEnrollmentsCount: 0,
            activeCoursesCount: 0,
            completedCoursesCount: 0,
            pendingCoursesCount: 0,
            lastEnrollmentAt: null,
          })
          : undefined,
      })),
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get OTP email delivery status rows
// @route   GET /api/v1/admin/otp-email-statuses
// @access  Admin
export const getOtpEmailStatuses = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.emailStatus = status;
    }

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { recipientEmail: { $regex: search, $options: "i" } },
        { resendEmailId: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      OtpVerification.find(filter)
        .select("-otpHash -rawWebhookEvent")
        .populate("userId", "name email emailBlocked emailBlockReason")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OtpVerification.countDocuments(filter),
    ]);

    return res.json({
      message: "OTP email statuses fetched successfully",
      data: rows.map((row) => ({
        id: row._id,
        email: row.recipientEmail || row.email,
        userName: row.userId?.name || "",
        lastOtpRequestAt: row.lastRequestedAt || row.createdAt,
        resendEmailId: row.resendEmailId || "",
        status: row.emailStatus || "pending",
        reason: row.emailStatusReason || "",
        otpExpiresAt: row.otpExpiresAt || null,
        emailStatusUpdatedAt: row.emailStatusUpdatedAt || null,
        emailBlocked: Boolean(row.userId?.emailBlocked),
        emailBlockReason: row.userId?.emailBlockReason || "",
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create user by admin
// @route   POST /api/v1/admin/users
// @access  Admin
export const createUserByAdmin = async (req, res) => {
  try {
    const { error, value } = createUserSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const userExists = await User.findOne({ email: value.email });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    const user = await User.create(value);

    return res.status(201).json({
      message: "User created successfully",
      user: cleanUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Create teacher by admin using only email + default values
// @route   POST /api/v1/admin/teachers
// @access  Admin
export const createTeacherByAdmin = async (req, res) => {
  try {
    const { error, value } = createTeacherByAdminSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const { email, contractStartDate, contractValidUntil } = value;

    const existingTeacher = await User.findOne({ email });

    if (existingTeacher) {
      return res.status(400).json({
        message: `User already exists with email ${email}`,
      });
    }

    const emailPrefix = email.split("@")[0] || "teacher";
    const formattedName = `Teacher ${emailPrefix}`;

    const presetTeacherData = {
      name: formattedName,
      email,
      phone: "0700000000",
      password: DEFAULT_ADMIN_CREATED_TEACHER_PASSWORD,
      role: "teacher",
      status: "active",
      isEmailVerified: true,
      contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
      contractValidUntil: contractValidUntil ? new Date(contractValidUntil) : null,
    };

    const teacher = await User.create(presetTeacherData);

    return res.status(201).json({
      message: "Teacher created successfully",
      teacher: cleanUser(teacher),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get all teachers
// @route   GET /api/v1/admin/teachers
// @access  Admin
export const getAllTeachers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const { status, search, applicationStatus } = req.query;

    const filter = { role: "teacher" };

    if (status) {
      filter.status = status;
    }

    if (applicationStatus) {
      filter["teacherApplication.status"] = applicationStatus;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [teachers, totalTeachers] = await Promise.all([
      User.find(filter)
        .select("-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      teachers: teachers.map(cleanUser),
      pagination: {
        page,
        limit,
        totalTeachers,
        totalPages: Math.ceil(totalTeachers / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get single teacher
// @route   GET /api/v1/admin/teachers/:id
// @access  Admin
export const getTeacherById = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      role: "teacher",
    }).select("-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts");

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    const courses = await Course.find(getTeacherCourseFilter(teacher._id))
      .select(
        "title slug status isPublished enrolledStudentsCount maxStudents startDate endDate classEndedAt classCancelledAt createdAt updatedAt",
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const courseIds = courses.map((course) => course._id);
    const enrollments = courseIds.length
      ? await Enrollment.find({ courseId: { $in: courseIds } })
          .select("studentId courseId enrollmentStatus accessStatus enrolledAt createdAt updatedAt")
          .lean()
      : [];

    const uniqueStudentsAll = new Set();
    const uniqueStudentsActive = new Set();
    const now = Date.now();

    enrollments.forEach((row) => {
      const studentId = String(row?.studentId || "");
      if (!studentId) return;
      uniqueStudentsAll.add(studentId);

      if (row?.enrollmentStatus === "active" && row?.accessStatus === "allowed") {
        uniqueStudentsActive.add(studentId);
      }
    });

    const activeCoursesCount = courses.filter((course) => {
      if (course?.status === "cancelled" || course?.classCancelledAt) return false;
      if (course?.classEndedAt) return false;
      if (course?.endDate && new Date(course.endDate).getTime() < now) return false;
      return course?.status === "published" || course?.status === "approved";
    }).length;

    const completedCoursesCount = courses.filter((course) => {
      if (course?.classEndedAt) return true;
      if (course?.endDate && new Date(course.endDate).getTime() < now) return true;
      return false;
    }).length;

    const publishedCoursesCount = courses.filter(
      (course) => course?.status === "published" || course?.isPublished,
    ).length;

    const teacherInsights = {
      totalCoursesCount: courses.length,
      activeCoursesCount,
      completedCoursesCount,
      publishedCoursesCount,
      uniqueStudentsCount: uniqueStudentsAll.size,
      uniqueActiveStudentsCount: uniqueStudentsActive.size,
      totalEnrollmentsCount: enrollments.length,
      relatedCourses: courses.slice(0, 8).map((course) => ({
        id: String(course?._id || ""),
        title: course?.title || "Course",
        slug: course?.slug || "",
        status: course?.status || "draft",
        isPublished: Boolean(course?.isPublished),
        enrolledStudentsCount: Number(course?.enrolledStudentsCount || 0),
        maxStudents: Number(course?.maxStudents || 0),
        startDate: course?.startDate || null,
        endDate: course?.endDate || null,
        createdAt: course?.createdAt || null,
        updatedAt: course?.updatedAt || null,
      })),
    };

    return res.json({
      teacher: cleanUser(teacher),
      teacherInsights,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Update teacher by admin
// @route   PATCH /api/v1/admin/teachers/:id
// @access  Admin
export const updateTeacherByAdmin = async (req, res) => {
  try {
    const { error, value } = updateUserSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    if (value.role && value.role !== "teacher") {
      return res.status(400).json({
        message: "Teacher role cannot be changed from teacher endpoints",
      });
    }

    const teacher = await User.findOne({ _id: req.params.id, role: "teacher" });

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    if (value.email && value.email !== teacher.email) {
      const emailExists = await User.findOne({ email: value.email });

      if (emailExists) {
        return res.status(400).json({
          message: "Another user already uses this email",
        });
      }
    }

    Object.keys(value).forEach((key) => {
      if (key === "status") return;
      teacher[key] = value[key];
    });

    if (Object.prototype.hasOwnProperty.call(value, "contractValidUntil")) {
      const validUntil = teacher.contractValidUntil ? new Date(teacher.contractValidUntil) : null;
      teacher.contractExpiryOverride =
        Boolean(validUntil) &&
        !Number.isNaN(validUntil.getTime()) &&
        validUntil.getTime() >= Date.now()
          ? false
          : Boolean(teacher.contractExpiryOverride);
    }

    if (Object.prototype.hasOwnProperty.call(value, "status")) {
      applyAdminStatusUpdate(teacher, value.status);
    }

    teacher.role = "teacher";
    const updatedTeacher = await teacher.save();

    return res.json({
      message: "Teacher updated successfully",
      teacher: cleanUser(updatedTeacher),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Approve or reject teacher application profile
// @route   POST /api/v1/admin/teachers/:id/application-review
// @access  Admin
export const reviewTeacherApplicationByAdmin = async (req, res) => {
  try {
    const { error, value } = reviewTeacherApplicationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const teacher = await User.findOne({ _id: req.params.id, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    const currentApplication = teacher.teacherApplication || {};
    const existingCvUrl = String(currentApplication.cvUrl || "").trim();
    const existingCertificateUrls = Array.isArray(currentApplication.certifications)
      ? currentApplication.certifications
      : [];
    const existingLegacyCertificateUrl = String(currentApplication.certificatesFileUrl || "").trim();

    teacher.teacherApplication = {
      ...currentApplication,
      status: value.decision,
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
      reviewNote: value.note || "",
      submittedAt: currentApplication.submittedAt || new Date(),
      cvUrl: "",
      certifications: [],
      certificatesFileUrl: "",
    };

    await teacher.save();

    if (value.decision === "approved") {
      notifyApprovedTeacherApplication(teacher).catch((error) => {
        console.warn(`Failed to send teacher approval push notification: ${error.message}`);
      });
      triggerTelegramTeacherAnnouncement(teacher);
    }

    await removeOldTeacherCvIfLocal(existingCvUrl);
    for (const certificatePath of existingCertificateUrls) {
      await removeOldTeacherCertificateIfLocal(certificatePath);
    }
    await removeOldTeacherCertificateIfLocal(existingLegacyCertificateUrl);

    return res.json({
      message:
        value.decision === "approved"
          ? "Teacher application approved successfully"
          : "Teacher application rejected successfully",
      teacher: cleanUser(teacher),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Delete teacher by admin
// @route   DELETE /api/v1/admin/teachers/:id
// @access  Admin
export const deleteTeacherByAdmin = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    const teacherCourses = await Course.find({
      $or: [{ teacher: teacher._id }, { teacherId: teacher._id }, { createdBy: teacher._id }],
    })
      .select("_id socialPosts")
      .lean();

    const deletedData = await deleteUserRelatedData(teacher);
    await teacher.deleteOne();

    triggerTelegramPostRemoval("teacher", teacher._id);
    (deletedData?.deletedCourses || []).forEach((course) => {
      triggerTelegramPostRemoval("course", course?.id);
    });

    return res.json({
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get single user
// @route   GET /api/v1/admin/users/:id
// @access  Admin
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const cleanedUser = cleanUser(user);

    if (user.role !== "student") {
      return res.json({
        user: cleanedUser,
      });
    }

    const enrollments = await Enrollment.find({ studentId: user._id })
      .populate("courseId", "title paymentPlan startDate endDate")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const paidPaymentsCount = await Payment.countDocuments({
      studentId: user._id,
      $or: [{ status: "paid" }, { paymentStatus: "paid" }],
    });

    const studentInsights = {
      totalEnrollmentsCount: enrollments.length,
      activeCoursesCount: enrollments.filter(
        (row) => row?.enrollmentStatus === "active" && row?.accessStatus === "allowed",
      ).length,
      completedCoursesCount: enrollments.filter((row) => row?.enrollmentStatus === "completed").length,
      pendingCoursesCount: enrollments.filter((row) => row?.enrollmentStatus === "pending").length,
      paidPaymentsCount,
      recentCourses: enrollments.slice(0, 6).map((row) => ({
        id: String(row?._id || ""),
        title: row?.courseId?.title || "Course",
        paymentPlan: row?.paymentPlan || row?.courseId?.paymentPlan || "monthly",
        enrollmentStatus: row?.enrollmentStatus || "pending",
        accessStatus: row?.accessStatus || "blocked",
        enrolledAt: row?.enrolledAt || row?.createdAt || null,
        updatedAt: row?.updatedAt || row?.createdAt || null,
      })),
    };

    return res.json({
      user: cleanedUser,
      studentInsights,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Update user by admin
// @route   PATCH /api/v1/admin/users/:id
// @access  Admin
export const updateUserByAdmin = async (req, res) => {
  try {
    const { error, value } = updateUserSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (value.email && value.email !== user.email) {
      const emailExists = await User.findOne({ email: value.email });

      if (emailExists) {
        return res.status(400).json({
          message: "Another user already uses this email",
        });
      }
    }

    if (value.role && user._id.toString() === req.user._id.toString()) {
      if (value.role !== "admin") {
        return res.status(400).json({
          message: "You cannot remove your own admin role",
        });
      }
    }

    Object.keys(value).forEach((key) => {
      if (key === "status") return;
      user[key] = value[key];
    });

    if (Object.prototype.hasOwnProperty.call(value, "status")) {
      applyAdminStatusUpdate(user, value.status);
    }

    const updatedUser = await user.save();

    return res.json({
      message: "User updated successfully",
      user: cleanUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Delete user by admin
// @route   DELETE /api/v1/admin/users/:id
// @access  Admin
export const deleteUserByAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: "You cannot delete the last admin account",
        });
      }
    }

    await deleteUserRelatedData(user);
    await user.deleteOne();

    return res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
