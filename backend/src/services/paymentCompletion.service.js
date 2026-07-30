import mongoose from "mongoose";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import { resolveCourseAccessWindow } from "../utils/courseAccess.js";
import { syncLegacyPaymentRecord } from "./paymentSync.service.js";
import { ensureCourseAutoStarted } from "../utils/courseAutoStart.js";
import { sendCourseEnrollmentCongratsEmail } from "../utils/Email.js";
import {
  publishCourseEnrollmentEvents,
  publishCourseStarted,
} from "./courseNotification.service.js";
import { recordCouponRedemption } from "./coupon.service.js";

const ACTIVE_STATUS = new Set(["PENDING", "SUCCEEDED", "DUPLICATE_PAYMENT", "MANUAL_REVIEW", "FAILED", "EXPIRED"]);
const NON_TRANSACTIONAL_MONGO_PATTERNS = [
  "Transaction numbers are only allowed on a replica set member or mongos",
  "Standalone servers do not support transactions",
];

const usesStandaloneMongo = (error) =>
  NON_TRANSACTIONAL_MONGO_PATTERNS.some((pattern) =>
    String(error?.message || "").includes(pattern),
  );

const withOptionalSession = (query, session) => (session ? query.session(session) : query);

export const completePayment = async ({
  paymentAttemptId,
  providerPaymentId = null,
  blockchainReference = null,
  transactionSignature = null,
  rawWebhookPayload = null,
  rawVerificationPayload = null,
  note = "",
  paidAt = new Date(),
  verifiedAt = new Date(),
  senderAccount = null,
} = {}) => {
  const runCompletion = async (session = null) => {
    let result = null;

    const execute = async () => {
      const attempt = await withOptionalSession(PaymentAttempt.findById(paymentAttemptId), session);
      if (!attempt) {
        throw new Error("Payment attempt not found");
      }

      const order = await withOptionalSession(Order.findById(attempt.orderId), session);
      if (!order) {
        throw new Error("Order not found");
      }

      if (!ACTIVE_STATUS.has(attempt.status)) {
        return;
      }

      if (attempt.status === "SUCCEEDED") {
        const payment = await syncLegacyPaymentRecord(
          { order, attempt, course: null, rawWebhookPayload, rawVerificationPayload, note, transactionId: providerPaymentId || null, senderAccount },
          session,
        );
        await recordCouponRedemption(
          {
            couponId: order.couponId,
            couponCode: order.couponCode,
            userId: order.userId,
            courseId: order.courseId,
            orderId: order._id,
            paymentId: payment._id,
            originalBaseAmountUsdCents:
              order.originalBaseAmountUsdCents ?? order.baseAmountUsdCents,
            discountAmountUsdCents: order.discountAmountUsdCents || 0,
            finalBaseAmountUsdCents: order.baseAmountUsdCents,
            redeemedAt: attempt.paidAt || paidAt,
          },
          session,
        );
        result = { order, attempt, payment, enrollment: null, duplicate: false, alreadySucceeded: true };
        return;
      }

      if (order.status === "PAID") {
        attempt.status = "DUPLICATE_PAYMENT";
        attempt.providerPaymentId = providerPaymentId || attempt.providerPaymentId;
        attempt.blockchainReference = blockchainReference || attempt.blockchainReference;
        attempt.transactionSignature = transactionSignature || attempt.transactionSignature;
        attempt.verifiedAt = verifiedAt;
        attempt.paidAt = attempt.paidAt || paidAt;
        attempt.rawWebhookPayload = rawWebhookPayload || attempt.rawWebhookPayload;
        attempt.rawVerificationPayload = rawVerificationPayload || attempt.rawVerificationPayload;
        attempt.note = note || attempt.note;
        await attempt.save(session ? { session } : undefined);

        const payment = await syncLegacyPaymentRecord(
          { order, attempt, course: null, rawWebhookPayload, rawVerificationPayload, note, transactionId: providerPaymentId || null, senderAccount },
          session,
        );
        await recordCouponRedemption(
          {
            couponId: order.couponId,
            couponCode: order.couponCode,
            userId: order.userId,
            courseId: order.courseId,
            orderId: order._id,
            paymentId: payment._id,
            originalBaseAmountUsdCents:
              order.originalBaseAmountUsdCents ?? order.baseAmountUsdCents,
            discountAmountUsdCents: order.discountAmountUsdCents || 0,
            finalBaseAmountUsdCents: order.baseAmountUsdCents,
            redeemedAt: attempt.paidAt || paidAt,
          },
          session,
        );

        result = { order, attempt, payment, enrollment: null, duplicate: true };
        return;
      }

      attempt.status = "SUCCEEDED";
      attempt.providerPaymentId = providerPaymentId || attempt.providerPaymentId;
      attempt.blockchainReference = blockchainReference || attempt.blockchainReference;
      attempt.transactionSignature = transactionSignature || attempt.transactionSignature;
      attempt.paidAt = paidAt;
      attempt.verifiedAt = verifiedAt;
      attempt.rawWebhookPayload = rawWebhookPayload || attempt.rawWebhookPayload;
      attempt.rawVerificationPayload = rawVerificationPayload || attempt.rawVerificationPayload;
      attempt.note = note || attempt.note;
      await attempt.save(session ? { session } : undefined);

      const lockedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "PENDING" },
        { $set: { status: "PAID", paidAt } },
        session ? { returnDocument: "after", session } : { returnDocument: "after" },
      );

      if (!lockedOrder) {
        attempt.status = "DUPLICATE_PAYMENT";
        await attempt.save(session ? { session } : undefined);
        const payment = await syncLegacyPaymentRecord(
          { order, attempt, course: null, rawWebhookPayload, rawVerificationPayload, note, transactionId: providerPaymentId || null, senderAccount },
          session,
        );
        await recordCouponRedemption(
          {
            couponId: order.couponId,
            couponCode: order.couponCode,
            userId: order.userId,
            courseId: order.courseId,
            orderId: order._id,
            paymentId: payment._id,
            originalBaseAmountUsdCents:
              order.originalBaseAmountUsdCents ?? order.baseAmountUsdCents,
            discountAmountUsdCents: order.discountAmountUsdCents || 0,
            finalBaseAmountUsdCents: order.baseAmountUsdCents,
            redeemedAt: attempt.paidAt || paidAt,
          },
          session,
        );
        result = { order, attempt, payment, enrollment: null, duplicate: true };
        return;
      }

      const course = await withOptionalSession(Course.findById(order.courseId), session);
      const existingEnrollment = await withOptionalSession(Enrollment.findOne({
        studentId: order.userId,
        courseId: order.courseId,
      }), session);
      const shouldSendEnrollmentEmail =
        !existingEnrollment ||
        existingEnrollment.enrollmentStatus !== "active" ||
        existingEnrollment.accessStatus !== "allowed";

      const accessWindow = resolveCourseAccessWindow({
        course,
        paidAt,
        previousAccessExpiresAt: existingEnrollment?.accessExpiresAt,
      });

      const payment = await syncLegacyPaymentRecord(
        { order: lockedOrder, attempt, course, rawWebhookPayload, rawVerificationPayload, note, transactionId: providerPaymentId || null, senderAccount },
        session,
      );
      await recordCouponRedemption(
        {
          couponId: lockedOrder.couponId,
          couponCode: lockedOrder.couponCode,
          userId: lockedOrder.userId,
          courseId: lockedOrder.courseId,
          orderId: lockedOrder._id,
          paymentId: payment._id,
          originalBaseAmountUsdCents:
            lockedOrder.originalBaseAmountUsdCents ??
            lockedOrder.baseAmountUsdCents,
          discountAmountUsdCents:
            lockedOrder.discountAmountUsdCents || 0,
          finalBaseAmountUsdCents: lockedOrder.baseAmountUsdCents,
          redeemedAt: paidAt,
        },
        session,
      );

      const enrollment = await Enrollment.findOneAndUpdate(
        {
          studentId: order.userId,
          courseId: order.courseId,
        },
        {
          $setOnInsert: {
            enrolledAt: paidAt,
          },
          $set: {
            paymentId: payment._id,
            enrollmentStatus: "active",
            accessStatus: "allowed",
            status: "active",
            accessStartsAt: accessWindow.accessStartsAt,
            accessExpiresAt: accessWindow.accessExpiresAt,
            paymentPlan: accessWindow.paymentPlan,
            lastRenewedAt: paidAt,
          },
        },
        session ? { upsert: true, returnDocument: "after", session } : { upsert: true, returnDocument: "after" },
      );

      if (!existingEnrollment) {
        await Course.findByIdAndUpdate(
          order.courseId,
          { $inc: { enrolledStudentsCount: 1 } },
          session ? { session } : undefined,
        );
        course.enrolledStudentsCount = Number(course.enrolledStudentsCount || 0) + 1;
      }

      const wasCourseStarted = Boolean(course.classStartedAt);
      await ensureCourseAutoStarted(course, {
        session,
        suppressNotifications: true,
      });

      result = {
        order: lockedOrder,
        attempt,
        payment,
        enrollment,
        duplicate: false,
        shouldSendEnrollmentEmail,
        courseStarted: !wasCourseStarted && Boolean(course.classStartedAt),
      };
    };

    if (session) {
      await session.withTransaction(execute);
    } else {
      await execute();
    }

    return result;
  };

  let session = null;
  try {
    session = await mongoose.startSession();
    const result = await runCompletion(session);
    if (result?.enrollment && result?.shouldSendEnrollmentEmail) {
      const [student, course] = await Promise.all([
        User.findById(result.order?.userId).select("name email").lean(),
        Course.findById(result.order?.courseId).select("title").populate("teacher createdBy", "name").lean(),
      ]);
      const teacherName = String(course?.teacher?.name || course?.createdBy?.name || "").trim();
      if (student?.email) {
        sendCourseEnrollmentCongratsEmail({
          to: student.email,
          name: student.name,
          courseTitle: course?.title || "",
          teacherName,
          paymentPlan: result.enrollment?.paymentPlan || "",
          accessStartsAt: result.enrollment?.accessStartsAt || null,
          accessExpiresAt: result.enrollment?.accessExpiresAt || null,
          amount: result.payment?.amount ?? "",
          currency: result.payment?.currency || "",
          paymentMethod: result.payment?.paymentMethod || "",
          paidAt: result.payment?.paidAt || null,
        }).catch((error) => {
          console.warn(`Failed to send enrollment email: ${error.message}`);
        });
      }
    }
    if (result?.enrollment && result?.shouldSendEnrollmentEmail) {
      await publishCourseEnrollmentEvents({
        courseId: result.order?.courseId,
        enrollmentId: result.enrollment?._id,
        studentId: result.order?.userId,
      });
    }
    if (result?.courseStarted) {
      await publishCourseStarted({ courseId: result.order?.courseId });
    }
    return result;
  } catch (error) {
    if (session && usesStandaloneMongo(error)) {
      const result = await runCompletion(null);
      if (result?.enrollment && result?.shouldSendEnrollmentEmail) {
        const [student, course] = await Promise.all([
          User.findById(result.order?.userId).select("name email").lean(),
          Course.findById(result.order?.courseId).select("title").populate("teacher createdBy", "name").lean(),
        ]);
        const teacherName = String(course?.teacher?.name || course?.createdBy?.name || "").trim();
        if (student?.email) {
          sendCourseEnrollmentCongratsEmail({
            to: student.email,
            name: student.name,
            courseTitle: course?.title || "",
            teacherName,
            paymentPlan: result.enrollment?.paymentPlan || "",
            accessStartsAt: result.enrollment?.accessStartsAt || null,
            accessExpiresAt: result.enrollment?.accessExpiresAt || null,
            amount: result.payment?.amount ?? "",
            currency: result.payment?.currency || "",
            paymentMethod: result.payment?.paymentMethod || "",
            paidAt: result.payment?.paidAt || null,
          }).catch((sendError) => {
            console.warn(`Failed to send enrollment email: ${sendError.message}`);
          });
        }
      }
      if (result?.enrollment && result?.shouldSendEnrollmentEmail) {
        await publishCourseEnrollmentEvents({
          courseId: result.order?.courseId,
          enrollmentId: result.enrollment?._id,
          studentId: result.order?.userId,
        });
      }
      if (result?.courseStarted) {
        await publishCourseStarted({ courseId: result.order?.courseId });
      }
      return result;
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
