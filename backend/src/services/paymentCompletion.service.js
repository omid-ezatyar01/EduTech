import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import Payment from "../models/Payment.js";
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
const PAYMENT_COMPLETION_CLAIM_LEASE_MS = 2 * 60 * 1000;

const readCompletedPaymentResult = async (attempt) => {
  const order = await Order.findById(attempt.orderId);
  const payment = attempt.legacyPaymentId
    ? await Payment.findById(attempt.legacyPaymentId)
    : await Payment.findOne({ paymentAttemptId: attempt._id });
  let enrollment = null;
  if (payment?.enrollmentId) {
    enrollment = await Enrollment.findById(payment.enrollmentId);
  } else if (attempt.status === "SUCCEEDED" && order) {
    enrollment = await Enrollment.findOne({
      studentId: order.userId,
      courseId: order.courseId,
    });
  }

  return {
    order,
    attempt,
    payment,
    enrollment,
    duplicate: attempt.status === "DUPLICATE_PAYMENT",
    alreadySucceeded: attempt.status === "SUCCEEDED",
    shouldSendEnrollmentEmail: false,
    courseStarted: false,
  };
};

const acquirePaymentCompletionClaim = async (paymentAttemptId) => {
  const now = new Date();
  const claimToken = crypto.randomUUID();
  const claimExpiresAt = new Date(
    now.getTime() + PAYMENT_COMPLETION_CLAIM_LEASE_MS,
  );
  const attempt = await PaymentAttempt.findOneAndUpdate(
    {
      _id: paymentAttemptId,
      fulfillmentCompletedAt: null,
      $or: [
        { completionClaimToken: null },
        { completionClaimExpiresAt: null },
        { completionClaimExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        completionClaimToken: claimToken,
        completionClaimExpiresAt: claimExpiresAt,
      },
    },
    { returnDocument: "after" },
  );

  if (attempt) return { claimToken };

  const currentAttempt = await PaymentAttempt.findById(paymentAttemptId);
  if (!currentAttempt) throw new Error("Payment attempt not found");
  if (currentAttempt.fulfillmentCompletedAt) {
    return { completedResult: await readCompletedPaymentResult(currentAttempt) };
  }

  const error = new Error("Payment completion is already in progress");
  error.code = "PAYMENT_COMPLETION_IN_PROGRESS";
  throw error;
};

const releasePaymentCompletionClaim = async ({ paymentAttemptId, claimToken }) => {
  if (!paymentAttemptId || !claimToken) return;
  await PaymentAttempt.updateOne(
    { _id: paymentAttemptId, completionClaimToken: claimToken },
    {
      $unset: {
        completionClaimToken: 1,
        completionClaimExpiresAt: 1,
      },
    },
  );
};

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
  allowPaidOrderRecovery = false,
} = {}) => {
  const completionClaim = await acquirePaymentCompletionClaim(paymentAttemptId);
  if (completionClaim.completedResult) return completionClaim.completedResult;
  const { claimToken } = completionClaim;

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

      const isRetryingSucceededAttempt = attempt.status === "SUCCEEDED";
      let paidOrderRecoveryEnrollment = null;
      let checkedPaidOrderRecoveryEnrollment = false;
      let canRecoverPaidOrder = false;

      if (
        order.status === "PAID" &&
        !isRetryingSucceededAttempt &&
        allowPaidOrderRecovery &&
        attempt.status !== "DUPLICATE_PAYMENT"
      ) {
        const recoveryPayment = attempt.legacyPaymentId
          ? await withOptionalSession(Payment.findById(attempt.legacyPaymentId), session)
          : await withOptionalSession(Payment.findOne({ paymentAttemptId: attempt._id }), session);
        paidOrderRecoveryEnrollment = await withOptionalSession(Enrollment.findOne({
          studentId: order.userId,
          courseId: order.courseId,
        }), session);
        checkedPaidOrderRecoveryEnrollment = true;

        const recoveryPaymentIsPaid =
          recoveryPayment?.status === "paid" ||
          recoveryPayment?.paymentStatus === "paid";
        const enrollmentBelongsToRecoveryPayment =
          !paidOrderRecoveryEnrollment ||
          (
            paidOrderRecoveryEnrollment.paymentId &&
            String(paidOrderRecoveryEnrollment.paymentId) === String(recoveryPayment?._id || "")
          );
        canRecoverPaidOrder = Boolean(
          recoveryPaymentIsPaid && enrollmentBelongsToRecoveryPayment,
        );
      }

      if (
        order.status === "PAID" &&
        !isRetryingSucceededAttempt &&
        !canRecoverPaidOrder
      ) {
        const duplicateNote = [
          "Duplicate payment requires manual refund review",
          note,
        ].filter(Boolean).join(": ");
        attempt.status = "DUPLICATE_PAYMENT";
        attempt.providerPaymentId = providerPaymentId || attempt.providerPaymentId;
        attempt.blockchainReference = blockchainReference || attempt.blockchainReference;
        attempt.transactionSignature = transactionSignature || attempt.transactionSignature;
        attempt.verifiedAt = verifiedAt;
        attempt.paidAt = attempt.paidAt || paidAt;
        attempt.rawWebhookPayload = rawWebhookPayload || attempt.rawWebhookPayload;
        attempt.rawVerificationPayload = rawVerificationPayload || attempt.rawVerificationPayload;
        attempt.note = duplicateNote;
        await attempt.save(session ? { session } : undefined);

        const payment = await syncLegacyPaymentRecord(
          { order, attempt, course: null, rawWebhookPayload, rawVerificationPayload, note: duplicateNote, transactionId: providerPaymentId || null, senderAccount },
          session,
        );
        result = { order, attempt, payment, enrollment: null, duplicate: true };
        return;
      }

      attempt.status = "SUCCEEDED";
      attempt.providerPaymentId = providerPaymentId || attempt.providerPaymentId;
      attempt.blockchainReference = blockchainReference || attempt.blockchainReference;
      attempt.transactionSignature = transactionSignature || attempt.transactionSignature;
      attempt.paidAt = attempt.paidAt || paidAt;
      attempt.verifiedAt = attempt.verifiedAt || verifiedAt;
      attempt.rawWebhookPayload = rawWebhookPayload || attempt.rawWebhookPayload;
      attempt.rawVerificationPayload = rawVerificationPayload || attempt.rawVerificationPayload;
      attempt.note = note || attempt.note;
      await attempt.save(session ? { session } : undefined);

      const lockedOrder = order.status === "PAID"
        ? order
        : await Order.findOneAndUpdate(
          { _id: order._id, status: "PENDING" },
          { $set: { status: "PAID", paidAt: attempt.paidAt || paidAt } },
          session ? { returnDocument: "after", session } : { returnDocument: "after" },
        );

      if (!lockedOrder) {
        const duplicateNote = [
          "Duplicate payment requires manual refund review",
          note,
        ].filter(Boolean).join(": ");
        attempt.status = "DUPLICATE_PAYMENT";
        attempt.note = duplicateNote;
        await attempt.save(session ? { session } : undefined);
        const payment = await syncLegacyPaymentRecord(
          { order, attempt, course: null, rawWebhookPayload, rawVerificationPayload, note: duplicateNote, transactionId: providerPaymentId || null, senderAccount },
          session,
        );
        result = { order, attempt, payment, enrollment: null, duplicate: true };
        return;
      }

      const course = await withOptionalSession(Course.findById(order.courseId), session);
      if (!course) {
        throw new Error("Course not found");
      }
      const existingEnrollment = checkedPaidOrderRecoveryEnrollment
        ? paidOrderRecoveryEnrollment
        : await withOptionalSession(Enrollment.findOne({
            studentId: order.userId,
            courseId: order.courseId,
          }), session);
      const completionPaidAt = attempt.paidAt || lockedOrder.paidAt || paidAt;
      const shouldSendEnrollmentEmail =
        !existingEnrollment ||
        existingEnrollment.enrollmentStatus !== "active" ||
        existingEnrollment.accessStatus !== "allowed";

      const payment = await syncLegacyPaymentRecord(
        { order: lockedOrder, attempt, course, rawWebhookPayload, rawVerificationPayload, note, transactionId: providerPaymentId || null, senderAccount },
        session,
      );
      await recordCouponRedemption(
        {
          // The attempt is the immutable quote that the customer actually
          // accepted. Never redeem from a subsequently changed Order snapshot.
          couponId: attempt.couponId,
          couponCode: attempt.couponCode,
          userId: lockedOrder.userId,
          courseId: lockedOrder.courseId,
          orderId: lockedOrder._id,
          paymentId: payment._id,
          originalBaseAmountUsdCents:
            attempt.originalBaseAmountUsdCents ??
            attempt.baseAmountUsdCents,
          discountAmountUsdCents:
            attempt.discountAmountUsdCents || 0,
          finalBaseAmountUsdCents: attempt.baseAmountUsdCents,
          redeemedAt: completionPaidAt,
        },
        session,
      );

      let keepExistingEnrollment = Boolean(
        canRecoverPaidOrder &&
        existingEnrollment &&
        (
          existingEnrollment.lastRenewedAt ||
          (
            existingEnrollment.enrollmentStatus === "active" &&
            existingEnrollment.accessStatus === "allowed"
          )
        )
      );
      let enrollmentLinkedToCurrentPayment = false;
      if (isRetryingSucceededAttempt && existingEnrollment) {
        const samePayment =
          existingEnrollment.paymentId &&
          String(existingEnrollment.paymentId) === String(payment._id);
        enrollmentLinkedToCurrentPayment = Boolean(samePayment);
        if (samePayment) {
          const lastRenewedAtMs = existingEnrollment.lastRenewedAt
            ? new Date(existingEnrollment.lastRenewedAt).getTime()
            : Number.NaN;
          const accessStartsAtMs = existingEnrollment.accessStartsAt
            ? new Date(existingEnrollment.accessStartsAt).getTime()
            : Number.NaN;
          const accessExpiresAtMs = existingEnrollment.accessExpiresAt
            ? new Date(existingEnrollment.accessExpiresAt).getTime()
            : Number.NaN;
          const hasAppliedAccessWindow =
            Number.isFinite(lastRenewedAtMs) &&
            Number.isFinite(accessStartsAtMs) &&
            Number.isFinite(accessExpiresAtMs) &&
            Boolean(existingEnrollment.paymentPlan);
          const accessAlreadyExpired =
            Number.isFinite(accessExpiresAtMs) && accessExpiresAtMs <= Date.now();

          // A fully applied (including naturally expired) access window is an
          // idempotent replay. A partial enrollment that merely points at this
          // payment must still be repaired and activated once.
          keepExistingEnrollment = hasAppliedAccessWindow || accessAlreadyExpired;
        } else if (existingEnrollment.paymentId) {
          let appliedPaidAt = existingEnrollment.lastRenewedAt
            ? new Date(existingEnrollment.lastRenewedAt)
            : null;
          if (!appliedPaidAt || !Number.isFinite(appliedPaidAt.getTime())) {
            const appliedPayment = await withOptionalSession(
              Payment.findById(existingEnrollment.paymentId).select("paidAt"),
              session,
            );
            appliedPaidAt = appliedPayment?.paidAt
              ? new Date(appliedPayment.paidAt)
              : null;
          }
          const replayPaidAt = completionPaidAt ? new Date(completionPaidAt) : null;
          // When ordering cannot be proven, preserve the existing link. A
          // support/admin reconciliation can resolve it without granting time.
          keepExistingEnrollment =
            !appliedPaidAt ||
            !Number.isFinite(appliedPaidAt.getTime()) ||
            !replayPaidAt ||
            !Number.isFinite(replayPaidAt.getTime()) ||
            appliedPaidAt.getTime() >= replayPaidAt.getTime();
        }
      }

      // Replays are monotonic: repair a missing/unapplied enrollment, but do
      // not renew or rebind one that already reflects this payment or a newer
      // payment.
      if (keepExistingEnrollment) {
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { enrollmentId: existingEnrollment._id } },
          session ? { session } : undefined,
        );
        payment.enrollmentId = existingEnrollment._id;

        const wasCourseStarted = Boolean(course.classStartedAt);
        await ensureCourseAutoStarted(course, {
          session,
          suppressNotifications: true,
        });
        result = {
          order: lockedOrder,
          attempt,
          payment,
          enrollment: existingEnrollment,
          duplicate: false,
          alreadySucceeded: isRetryingSucceededAttempt || canRecoverPaidOrder,
          shouldSendEnrollmentEmail: false,
          courseStarted: !wasCourseStarted && Boolean(course.classStartedAt),
        };
        return;
      }

      const accessWindow = resolveCourseAccessWindow({
        course,
        paidAt: completionPaidAt,
        // Rebuilding a partial enrollment for this same payment must use its
        // immutable paidAt, not extend from a half-written access window.
        previousAccessExpiresAt: enrollmentLinkedToCurrentPayment
          ? null
          : existingEnrollment?.accessExpiresAt,
      });

      const enrollment = await Enrollment.findOneAndUpdate(
        {
          studentId: order.userId,
          courseId: order.courseId,
        },
        {
          $setOnInsert: {
            enrolledAt: completionPaidAt,
          },
          $set: {
            paymentId: payment._id,
            enrollmentStatus: "active",
            accessStatus: "allowed",
            status: "active",
            accessStartsAt: accessWindow.accessStartsAt,
            accessExpiresAt: accessWindow.accessExpiresAt,
            paymentPlan: accessWindow.paymentPlan,
            lastRenewedAt: completionPaidAt,
          },
        },
        session ? { upsert: true, returnDocument: "after", session } : { upsert: true, returnDocument: "after" },
      );

      await Payment.updateOne(
        { _id: payment._id },
        { $set: { enrollmentId: enrollment._id } },
        session ? { session } : undefined,
      );
      payment.enrollmentId = enrollment._id;

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
        alreadySucceeded: isRetryingSucceededAttempt || canRecoverPaidOrder,
        shouldSendEnrollmentEmail,
        courseStarted: !wasCourseStarted && Boolean(course.classStartedAt),
      };
    };

    const executeAndFinalize = async () => {
      await execute();
      const completedAt = new Date();
      const completionResult = await PaymentAttempt.updateOne(
        { _id: paymentAttemptId, completionClaimToken: claimToken },
        {
          $set: { fulfillmentCompletedAt: completedAt },
          $unset: {
            completionClaimToken: 1,
            completionClaimExpiresAt: 1,
          },
        },
        session ? { session } : undefined,
      );
      if (completionResult && Number(completionResult.matchedCount || 0) === 0) {
        const error = new Error("Payment completion claim was lost before fulfillment finished");
        error.code = "PAYMENT_COMPLETION_CLAIM_LOST";
        throw error;
      }
    };

    if (session) {
      await session.withTransaction(executeAndFinalize);
    } else {
      await executeAndFinalize();
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
      try {
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
      } catch (fallbackError) {
        await releasePaymentCompletionClaim({ paymentAttemptId, claimToken });
        throw fallbackError;
      }
    }
    await releasePaymentCompletionClaim({ paymentAttemptId, claimToken });
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
