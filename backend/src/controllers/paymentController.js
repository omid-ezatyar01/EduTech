import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { resolveCourseAccessWindow } from "../utils/courseAccess.js";
import { sendCourseEnrollmentCongratsEmail } from "../utils/Email.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";
import { publishCourseEnrollmentEvents } from "../services/courseNotification.service.js";

const isPaidStatus = (payment) => {
  return payment.status === "paid" || payment.paymentStatus === "paid";
};

export const getAdminPaymentsList = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.$or = [{ status: req.query.status }, { paymentStatus: req.query.status }];
  }

  if (req.query.search) {
    const userIds = await User.find({
      $or: [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ],
    }).select("_id");

    const matchedStudentIds = userIds.map((u) => u._id);

    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { transactionId: { $regex: req.query.search, $options: "i" } },
        { paymentReference: { $regex: req.query.search, $options: "i" } },
        { customerEmail: { $regex: req.query.search, $options: "i" } },
        { studentId: { $in: matchedStudentIds } },
      ],
    });
  }

  const [payments, total, summaryAgg] = await Promise.all([
    Payment.find(filter)
      .populate("studentId", "name email")
      .populate("courseId", "title")
      .populate("verifiedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const summary = {
    totalPayments: total,
    totalRevenue: 0,
    paidPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
  };

  summaryAgg.forEach((item) => {
    summary.totalRevenue += item.revenue || 0;
    if (item._id === "paid") summary.paidPayments = item.count;
    if (item._id === "pending") summary.pendingPayments = item.count;
    if (item._id === "failed") summary.failedPayments = item.count;
  });

  return res.json(
    new ApiResponse({
      message: "Payments fetched successfully",
      data: {
        payments,
        summary,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }),
  );
});

export const getAdminPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("studentId", "name email")
    .populate("courseId", "title")
    .populate("enrollmentId")
    .populate("verifiedBy", "name email");

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  return res.json(
    new ApiResponse({
      message: "Payment fetched successfully",
      data: payment,
    }),
  );
});

export const verifyPaymentByAdmin = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  if (isPaidStatus(payment)) {
    return res.json(
      new ApiResponse({
        message: "Payment already verified",
        data: payment,
      }),
    );
  }

  const enrollment = await Enrollment.findById(payment.enrollmentId || payment.enrollment);
  if (!enrollment) {
    throw new ApiError(404, "Related enrollment not found");
  }

  const course = await Course.findById(payment.courseId);
  if (!course) {
    throw new ApiError(404, "Course not found for payment");
  }

  const hasPreviousPaidPayment = await Payment.exists({
    _id: { $ne: payment._id },
    enrollmentId: enrollment._id,
    paymentStatus: "paid",
  });
  const shouldSendEnrollmentEmail =
    enrollment.enrollmentStatus !== "active" || enrollment.accessStatus !== "allowed";
  const shouldIncrement = !hasPreviousPaidPayment;
  if (shouldIncrement && course.maxStudents && course.enrolledStudentsCount >= course.maxStudents) {
    throw new ApiError(400, "Course is full, cannot verify this payment");
  }

  payment.paymentStatus = "paid";
  payment.status = "paid";
  payment.paidAt = new Date();
  payment.verifiedAt = new Date();
  payment.verifiedBy = req.user._id;
  payment.note = req.body.note || payment.note;
  payment.paymentMethod = req.body.paymentMethod || payment.paymentMethod || "manual";

  if (req.body.transactionId) {
    payment.transactionId = req.body.transactionId;
  }

  await payment.save();

  const accessWindow = resolveCourseAccessWindow({
    course,
    paidAt: payment.paidAt,
    previousAccessExpiresAt: enrollment.accessExpiresAt,
  });

  enrollment.paymentId = payment._id;
  enrollment.enrollmentStatus = "active";
  enrollment.accessStatus = "allowed";
  enrollment.status = "active";
  enrollment.accessStartsAt = accessWindow.accessStartsAt;
  enrollment.accessExpiresAt = accessWindow.accessExpiresAt;
  enrollment.paymentPlan = accessWindow.paymentPlan;
  enrollment.lastRenewedAt = payment.paidAt;
  await enrollment.save();

  if (shouldIncrement) {
    await Course.findByIdAndUpdate(course._id, {
      $inc: { enrolledStudentsCount: 1 },
    });
  }

  if (shouldSendEnrollmentEmail) {
    await publishCourseEnrollmentEvents({
      courseId: course._id,
      enrollmentId: enrollment._id,
      studentId: enrollment.studentId,
    });
  }
  await ensureCourseAutoStarted(course);

  if (shouldSendEnrollmentEmail && payment?.studentId) {
    const student = await User.findById(payment.studentId).select("name email").lean();
    const teacher = course?.teacher ? await User.findById(course.teacher).select("name").lean() : null;
    if (student?.email) {
      sendCourseEnrollmentCongratsEmail({
        to: student.email,
        name: student.name,
        courseTitle: course.title,
        teacherName: teacher?.name || "",
        paymentPlan: enrollment.paymentPlan || "",
        accessStartsAt: enrollment.accessStartsAt || null,
        accessExpiresAt: enrollment.accessExpiresAt || null,
        amount: payment.amount ?? "",
        currency: payment.currency || "",
        paymentMethod: payment.paymentMethod || "",
        paidAt: payment.paidAt || null,
      }).catch((error) => {
        console.warn(`Failed to send enrollment email: ${error.message}`);
      });
    }
  }

  return res.json(
    new ApiResponse({
      message: "Payment verified successfully",
      data: payment,
    }),
  );
});

export const rejectPaymentByAdmin = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  payment.paymentStatus = "failed";
  payment.status = "failed";
  payment.failedAt = new Date();
  payment.note = req.body.note;
  await payment.save();

  const enrollment = await Enrollment.findById(payment.enrollmentId || payment.enrollment);
  if (enrollment && enrollment.enrollmentStatus === "pending") {
    enrollment.enrollmentStatus = "cancelled";
    enrollment.accessStatus = "blocked";
    enrollment.status = "cancelled";
    await enrollment.save();
  }

  return res.json(
    new ApiResponse({
      message: "Payment rejected successfully",
      data: payment,
    }),
  );
});

export const getStudentPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({
    studentId: req.user._id,
    $or: [
      { status: { $in: ["pending", "paid"] } },
      { paymentStatus: { $in: ["pending", "paid"] } },
    ],
  })
    .populate("courseId", "title slug")
    .sort({ createdAt: -1 });

  return res.json(
    new ApiResponse({
      message: "Student payments fetched successfully",
      data: payments,
    }),
  );
});
