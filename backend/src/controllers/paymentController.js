import Payment from "../models/Payment.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
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
import { recordCouponRedemption } from "../services/coupon.service.js";
import { completePayment } from "../services/paymentCompletion.service.js";

const UNIFIED_HOSTED_OR_CRYPTO_METHODS = new Set([
  "HESABPAY_HOSTED",
  "NOWPAYMENTS_CRYPTO",
  "USDT_BSC_DIRECT",
]);

const isPaidStatus = (payment) => {
  return payment.status === "paid" || payment.paymentStatus === "paid";
};
const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const recordPaymentCouponRedemption = (payment) =>
  recordCouponRedemption({
    couponId: payment.couponId,
    couponCode: payment.couponCode,
    userId: payment.studentId,
    courseId: payment.courseId,
    orderId: payment.orderId || undefined,
    paymentId: payment._id,
    originalBaseAmountUsdCents:
      payment.originalBaseAmountUsdCents ?? payment.baseAmountUsdCents,
    discountAmountUsdCents: payment.discountAmountUsdCents || 0,
    finalBaseAmountUsdCents: payment.baseAmountUsdCents,
    redeemedAt: payment.paidAt || new Date(),
  });

export const getAdminPaymentsList = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    filter.$or = [{ status: req.query.status }, { paymentStatus: req.query.status }];
  }

  if (req.query.search) {
    const safeSearch = escapeRegex(req.query.search);
    const userIds = await User.find({
      $or: [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ],
    }).select("_id");

    const matchedStudentIds = userIds.map((u) => u._id);

    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { transactionId: { $regex: safeSearch, $options: "i" } },
        { paymentReference: { $regex: safeSearch, $options: "i" } },
        { customerEmail: { $regex: safeSearch, $options: "i" } },
        { couponCode: { $regex: safeSearch, $options: "i" } },
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
        $project: {
          effectiveStatus: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", "paid"] },
                  { $eq: ["$paymentStatus", "paid"] },
                ],
              },
              "paid",
              { $ifNull: ["$status", "$paymentStatus"] },
            ],
          },
          baseRevenueUsd: {
            $cond: [
              { $gt: ["$baseAmountUsdCents", 0] },
              { $divide: ["$baseAmountUsdCents", 100] },
              {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ["$currency", ""] } }, ["USD", "USDT"]] },
                  "$amount",
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$effectiveStatus",
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$effectiveStatus", "paid"] }, "$baseRevenueUsd", 0],
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

  if (payment.paymentAttemptId) {
    const attempt = await PaymentAttempt.findById(payment.paymentAttemptId);
    if (!attempt) {
      throw new ApiError(404, "Related payment attempt not found");
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    if (
      UNIFIED_HOSTED_OR_CRYPTO_METHODS.has(String(attempt.method || "").toUpperCase()) &&
      !transactionId
    ) {
      throw new ApiError(400, "Transaction ID is required to verify this hosted or crypto payment");
    }

    const verifiedAt = new Date();
    const note = String(req.body?.note || "").trim() || "Verified by admin";
    const allowPaidOrderRecovery = Boolean(
      isPaidStatus(payment) &&
      !payment.enrollmentId &&
      attempt.status !== "DUPLICATE_PAYMENT"
    );
    const completion = await completePayment({
      paymentAttemptId: attempt._id,
      providerPaymentId: attempt.providerPaymentId || null,
      transactionSignature: transactionId || attempt.transactionSignature || null,
      note,
      paidAt: payment.paidAt || attempt.paidAt || verifiedAt,
      verifiedAt,
      allowPaidOrderRecovery,
    });

    if (!completion?.payment || !completion?.enrollment) {
      throw new ApiError(409, "Payment completion could not activate the related enrollment");
    }

    const convergedPayment = completion.payment;
    convergedPayment.verifiedAt = verifiedAt;
    convergedPayment.verifiedBy = req.user._id;
    convergedPayment.note = note;
    if (transactionId) convergedPayment.transactionId = transactionId;
    await convergedPayment.save();

    return res.json(
      new ApiResponse({
        message: "Payment verified and enrollment activated successfully",
        data: convergedPayment,
      }),
    );
  }

  if (isPaidStatus(payment)) {
    await recordPaymentCouponRedemption(payment);
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
  await recordPaymentCouponRedemption(payment);

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

  if (payment.paymentAttemptId) {
    const attempt = await PaymentAttempt.findById(payment.paymentAttemptId);
    if (!attempt) {
      throw new ApiError(404, "Related payment attempt not found");
    }
    if (["SUCCEEDED", "DUPLICATE_PAYMENT"].includes(attempt.status)) {
      throw new ApiError(
        409,
        "A completed or duplicate charge cannot be rejected; use the refund review workflow",
      );
    }

    const rejectedAt = new Date();
    attempt.status = "FAILED";
    attempt.failedAt = rejectedAt;
    attempt.verifiedAt = rejectedAt;
    if (attempt.method === "HESABPAY_HOSTED") {
      // This explicit decision is safe only after the administrator has
      // checked the provider dashboard. It releases an ambiguous hosted
      // session so the student can start a fresh checkout.
      attempt.issuanceState = "DEFINITIVELY_FAILED";
      attempt.issuanceCompletedAt = rejectedAt;
    }
    attempt.note =
      String(req.body?.note || "").trim() ||
      "Rejected by admin after provider review";
    await attempt.save();
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
  })
    .populate("courseId", "title slug price currency")
    .populate(
      "paymentAttemptId",
      "status expiresAt orderId paymentReference transactionSignature",
    )
    .sort({ createdAt: -1 });

  const safePayments = payments.map((paymentDocument) => {
    const payment = typeof paymentDocument?.toObject === "function"
      ? paymentDocument.toObject()
      : paymentDocument || {};
    const attempt = payment.paymentAttemptId && typeof payment.paymentAttemptId === "object"
      ? payment.paymentAttemptId
      : null;
    const course = payment.courseId && typeof payment.courseId === "object"
      ? payment.courseId
      : payment.courseId;

    return {
      _id: payment._id,
      orderId: payment.orderId?._id || payment.orderId || null,
      courseId: course && typeof course === "object"
        ? {
            _id: course._id,
            title: course.title,
            slug: course.slug,
            price: course.price,
            currency: course.currency,
          }
        : course,
      paymentAttemptId: attempt
        ? {
            _id: attempt._id,
            orderId: attempt.orderId?._id || attempt.orderId || null,
            status: attempt.status,
            expiresAt: attempt.expiresAt,
          }
        : payment.paymentAttemptId || null,
      attemptStatus: attempt?.status,
      baseAmountUsdCents: payment.baseAmountUsdCents,
      originalBaseAmountUsdCents: payment.originalBaseAmountUsdCents,
      couponCode: payment.couponCode,
      discountAmountUsdCents: payment.discountAmountUsdCents,
      pricingRegion: payment.pricingRegion,
      sourcePriceAmount: payment.sourcePriceAmount,
      sourcePriceCurrency: payment.sourcePriceCurrency,
      amount: payment.amount,
      gatewayAmount: payment.gatewayAmount,
      currency: payment.currency,
      gatewayCurrency: payment.gatewayCurrency,
      exchangeRate: payment.exchangeRate,
      provider: payment.provider,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paymentStatus: payment.paymentStatus,
      paymentReference: payment.paymentReference,
      transactionId: payment.transactionId,
      transactionSignature:
        attempt?.transactionSignature || payment.transactionSignature,
      network: payment.network,
      expiresAt: attempt?.expiresAt || payment.expiresAt,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  });

  return res.json(
    new ApiResponse({
      message: "Student payments fetched successfully",
      data: safePayments,
    }),
  );
});
