import Enrollment from "../models/Enrollment.js";
import { buildCertificateId, normalizeCertificateId } from "../utils/certificate.js";
import {
  notifyStudentCertificateIssued,
} from "./webPush.service.js";
import {
  sendCourseCertificateIssuedEmail,
} from "../utils/Email.js";

const isPaidCourse = (course = null) =>
  !Boolean(course?.isFree) && Number(course?.price || 0) > 0;

const ensureEnrollmentCertificate = (enrollment, fallbackDate, course = null) => {
  if (!isPaidCourse(course)) {
    return {
      issuedAt: null,
      certificateId: null,
    };
  }

  const issuedAt = enrollment?.certificateIssuedAt || fallbackDate || new Date();
  const certificateId = normalizeCertificateId(
    enrollment?.certificateId || buildCertificateId(enrollment?._id, issuedAt),
  );

  return {
    issuedAt,
    certificateId,
  };
};

const getVerifyOrigin = () =>
  String(process.env.CERTIFICATE_VERIFY_ORIGIN || "https://verify.edutech.study").trim().replace(/\/+$/, "");

const buildVerifyUrl = (certificateId = "") =>
  `${getVerifyOrigin()}/verify/${encodeURIComponent(String(certificateId || "").trim())}`;

const notifyIssuedCertificates = async ({
  course,
  notificationTargets = [],
}) => {
  if (!notificationTargets.length) return;

  await Promise.allSettled(
    notificationTargets.map(async (target) => {
      if (!target?.certificateId || !target?.studentId?._id) return;

      const certificateId = String(target.certificateId).trim().toUpperCase();
      const courseTitle = String(course?.title || "").trim();
      const teacherName = String(
        course?.teacher?.name ||
        course?.createdBy?.name ||
        "",
      ).trim();
      const studentId = String(target.studentId._id || "").trim();
      const studentEmail = String(target.studentId.email || "").trim();
      const studentName = String(
        target.studentId.name ||
        [target.studentId.firstNameFa, target.studentId.lastNameFa]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" "),
      ).trim();
      const verifyUrl = buildVerifyUrl(certificateId);

      notifyStudentCertificateIssued({
        studentId,
        courseTitle,
        certificateId,
      }).catch((error) => {
        console.warn(
          `Failed to send student certificate push notification: ${error.message}`,
        );
      });

      if (studentEmail) {
        sendCourseCertificateIssuedEmail({
          to: studentEmail,
          name: studentName,
          courseTitle,
          teacherName,
          certificateId,
          verifyUrl,
        }).catch((error) => {
          console.warn(`Failed to send certificate email: ${error.message}`);
        });
      }
    }),
  );
};

export const finalizeCourseEnd = async ({
  course,
  endedAt = new Date(),
  forceCourseUpdate = false,
} = {}) => {
  if (!course?._id) {
    throw new Error("Course is required to finalize course end");
  }

  const resolvedEndedAt = endedAt instanceof Date ? endedAt : new Date(endedAt);
  const effectiveEndedAt = Number.isNaN(resolvedEndedAt.getTime()) ? new Date() : resolvedEndedAt;
  const shouldUpdateCourse = forceCourseUpdate || !course.classEndedAt;

  if (shouldUpdateCourse) {
    course.classEndedAt = effectiveEndedAt;
    if (!course.endDate || new Date(course.endDate).getTime() > effectiveEndedAt.getTime()) {
      course.endDate = effectiveEndedAt;
    }
    await course.save();
  }

  const enrollments = await Enrollment.find({
    courseId: course._id,
    enrollmentStatus: { $in: ["active", "completed"] },
    accessStatus: "allowed",
  }).select("_id studentId enrollmentStatus accessStatus certificateId certificateIssuedAt");

  if (!enrollments.length) {
    return {
      courseId: String(course._id),
      classEndedAt: course.classEndedAt || effectiveEndedAt,
      completedStudents: 0,
      newlyCompletedStudents: 0,
      certificatesIssued: 0,
    };
  }

  let newlyCompletedStudents = 0;
  let certificatesIssued = 0;
  const notificationTargets = [];

  const ops = enrollments.map((enrollment) => {
    if (enrollment.enrollmentStatus !== "completed") {
      newlyCompletedStudents += 1;
    }

    const { issuedAt, certificateId } = ensureEnrollmentCertificate(
      enrollment,
      effectiveEndedAt,
      course,
    );

    if (certificateId) {
      certificatesIssued += 1;
      if (enrollment.enrollmentStatus !== "completed" || !enrollment.certificateId) {
        notificationTargets.push({
          studentId: enrollment.studentId,
          certificateId,
        });
      }
    }

    return {
      updateOne: {
        filter: { _id: enrollment._id },
        update: {
          $set: {
            enrollmentStatus: "completed",
            accessStatus: "allowed",
            certificateIssuedAt: issuedAt,
            certificateId,
          },
        },
      },
    };
  });

  if (ops.length) {
    await Enrollment.bulkWrite(ops, { ordered: false });
  }

  if (notificationTargets.length) {
    const enrichedTargets = await Enrollment.find({
      courseId: course._id,
      studentId: { $in: notificationTargets.map((row) => row.studentId) },
      certificateId: { $in: notificationTargets.map((row) => row.certificateId) },
    })
      .select("studentId certificateId")
      .populate("studentId", "name firstNameFa lastNameFa email");

    await notifyIssuedCertificates({
      course,
      notificationTargets: enrichedTargets,
    });
  }

  return {
    courseId: String(course._id),
    classEndedAt: course.classEndedAt || effectiveEndedAt,
    completedStudents: enrollments.length,
    newlyCompletedStudents,
    certificatesIssued,
  };
};
