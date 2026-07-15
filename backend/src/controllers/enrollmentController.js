import Course from "../models/Course.js";
import CourseResource from "../models/CourseResource.js";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  buildCertificateId,
  buildLegacyShortCertificateId,
  CERTIFICATE_ID_PATTERN,
  normalizeCertificateId,
} from "../utils/certificate.js";
import { getPlatformPricingSettings, resolveCourseDisplayPricing } from "../utils/platformSettings.js";
import {
  expireEnrollmentIfNeeded,
  isEnrollmentExpired,
} from "../utils/courseAccess.js";

const makePaymentReference = (studentId) => {
  const userSuffix = String(studentId).slice(-6).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PAY-${Date.now()}-${userSuffix}-${randomSuffix}`;
};

const resolveCourseAmount = async (course) => {
  if (course.isFree) return 0;
  const pricing = await getPlatformPricingSettings();
  const calculated = resolveCourseDisplayPricing(
    course,
    pricing?.globalCourseDiscountPercentage || 0,
  );
  return Number(calculated?.finalPrice || 0);
};

const resolveResourceType = (source = "", fallback = "PDF") => {
  const raw = String(source || "").split("?")[0];
  const ext = raw.includes(".") ? raw.split(".").pop().trim().toUpperCase() : "";

  if (ext === "PDF") return "PDF";
  if (["DOC", "DOCX"].includes(ext)) return "DOCX";
  if (["MP4", "MOV", "WEBM", "M4V"].includes(ext)) return "MP4";
  if (["MP3", "WAV", "OGG", "M4A"].includes(ext)) return "MP3";
  if (["PNG", "JPG", "JPEG", "WEBP", "SVG"].includes(ext)) return "PNG";
  return fallback;
};

const mapEnrollmentToResources = (enrollment = {}) => {
  const course = enrollment.courseId || {};
  const enrollmentId = String(enrollment._id || "");
  const courseTitle = course.title || "کورس";
  const resources = [];
  const baseDate = course.updatedAt || enrollment.updatedAt || enrollment.createdAt || new Date().toISOString();

  resources.push({
    id: `${enrollmentId}-overview`,
    title: `جزوه ${courseTitle}`,
    description:
      course.shortDescription ||
      course.description ||
      "خلاصه محتوای کورس برای مطالعه شاگردان.",
    course: courseTitle,
    type: "PDF",
    size: "-",
    addedAt: baseDate,
    url: "",
    source: "course_overview",
  });

  if (course.promoVideo) {
    resources.push({
      id: `${enrollmentId}-video`,
      title: `ویدیوی معرفی ${courseTitle}`,
      description: `ویدیوی معرفی و مرور مباحث کورس ${courseTitle}.`,
      course: courseTitle,
      type: resolveResourceType(course.promoVideo, "MP4"),
      size: "-",
      addedAt: baseDate,
      url: course.promoVideo,
      source: "promo_video",
    });
  }

  if (course.thumbnail) {
    resources.push({
      id: `${enrollmentId}-thumbnail`,
      title: `تصویر کورس ${courseTitle}`,
      description: `تصویر و بنر آموزشی کورس ${courseTitle}.`,
      course: courseTitle,
      type: resolveResourceType(course.thumbnail, "PNG"),
      size: "-",
      addedAt: baseDate,
      url: course.thumbnail,
      source: "thumbnail",
    });
  }

  return resources;
};

const parseTimeToMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const estimateScheduleHours = (schedule = []) => {
  if (!Array.isArray(schedule) || !schedule.length) return 0;
  const totalMinutes = schedule.reduce((sum, slot) => {
    const start = parseTimeToMinutes(slot?.startTime);
    const end = parseTimeToMinutes(slot?.endTime);
    if (start === null || end === null || end <= start) return sum;
    return sum + (end - start);
  }, 0);
  return totalMinutes / 60;
};

const estimateDurationHours = (durationLabel = "") => {
  const text = String(durationLabel || "").trim().toLowerCase();
  if (!text) return 0;

  const numericMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = numericMatch ? Number(numericMatch[1]) : 0;
  if (!amount || Number.isNaN(amount)) return 0;

  if (/(hour|hr|hours|ساعت)/i.test(text)) return amount;
  if (/(day|days|روز)/i.test(text)) return amount * 2;
  if (/(week|weeks|هفته)/i.test(text)) return amount * 4;
  if (/(month|months|ماه)/i.test(text)) return amount * 16;
  return amount;
};

const resolveCertificateIssuedAt = (enrollment = {}) =>
  enrollment?.certificateIssuedAt ||
  (enrollment?.enrollmentStatus === "completed"
    ? enrollment?.updatedAt || enrollment?.createdAt || null
    : null);

const isPaidCourse = (course = null) => {
  const resolvedCourse = course && typeof course === "object" ? course : {};
  return !Boolean(resolvedCourse?.isFree) && Number(resolvedCourse?.price || 0) > 0;
};

const shouldClearCertificateState = (enrollment = {}, course = null) => {
  const resolvedCourse =
    course ||
    (enrollment?.courseId && typeof enrollment.courseId === "object"
      ? enrollment.courseId
      : null) ||
    {};
  return (
    !isPaidCourse(resolvedCourse) &&
    Boolean(enrollment?.certificateId || enrollment?.certificateIssuedAt)
  );
};

const isCertificateEligible = (enrollment = {}, course = null) => {
  const resolvedCourse =
    course ||
    (enrollment?.courseId && typeof enrollment.courseId === "object"
      ? enrollment.courseId
      : null) ||
    {};
  return (
    String(enrollment?.enrollmentStatus || "") === "completed" &&
    Boolean(resolvedCourse?.classEndedAt) &&
    isPaidCourse(resolvedCourse)
  );
};

const hasVisibleCourse = (course = null) =>
  Boolean(course && typeof course === "object" && String(course.title || "").trim());

const hasAllowedEnrollmentAccess = (enrollment = {}) =>
  ["active", "completed"].includes(String(enrollment?.enrollmentStatus || "")) &&
  String(enrollment?.accessStatus || "") === "allowed" &&
  !isEnrollmentExpired(enrollment);

const mapVerifiedCertificate = (enrollmentDoc) => {
  const row =
    typeof enrollmentDoc?.toObject === "function"
      ? enrollmentDoc.toObject()
      : enrollmentDoc || {};
  const course = row?.courseId && typeof row.courseId === "object" ? row.courseId : {};
  const student =
    row?.studentId && typeof row.studentId === "object" ? row.studentId : {};
  const teacher =
    (course?.teacher && String(course.teacher?.name || "").trim()
      ? course.teacher
      : null) ||
    (course?.createdBy && String(course.createdBy?.name || "").trim()
      ? course.createdBy
      : null);
  const issuedAt = resolveCertificateIssuedAt(row);
  const certificateId = normalizeCertificateId(
    row?.certificateId || buildCertificateId(row?._id, issuedAt),
  );
  const fullNameFa = [student?.firstNameFa, student?.lastNameFa]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    certificateId,
    isValid: true,
    issuedAt,
    studentName: String(student?.name || "").trim() || fullNameFa || "Student",
    courseTitle: String(course?.title || "").trim() || "Course",
    teacherName: String(teacher?.name || "").trim() || "EduTech Instructor",
  };
};

export const enrollInCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (!course.isPublished || course.status !== "published") {
    throw new ApiError(400, "You can only enroll in published courses");
  }

  if (course.classEndedAt) {
    throw new ApiError(400, "This class has ended and no longer accepts enrollments");
  }

  if (course.classCancelledAt) {
    throw new ApiError(400, "This class has been cancelled and no longer accepts enrollments");
  }

  const existingEnrollment = await Enrollment.findOne({
    studentId: req.user._id,
    courseId: course._id,
  });

  const effectiveAmount = await resolveCourseAmount(course);
  const isEffectivelyFree = course.isFree || effectiveAmount <= 0;

  if (existingEnrollment) {
    await expireEnrollmentIfNeeded(existingEnrollment, course);

    if (isEffectivelyFree && existingEnrollment.enrollmentStatus !== "active") {
      existingEnrollment.enrollmentStatus = "active";
      existingEnrollment.accessStatus = "allowed";
      existingEnrollment.status = "active";
      existingEnrollment.accessStartsAt = undefined;
      existingEnrollment.accessExpiresAt = undefined;
      await existingEnrollment.save();

      await Course.findByIdAndUpdate(course._id, {
        $inc: { enrolledStudentsCount: 1 },
      });

      return res.status(200).json(
        new ApiResponse({
          message: "Enrollment activated successfully",
          data: {
            enrollment: existingEnrollment,
            payment: null,
          },
        }),
      );
    }

    if (isEffectivelyFree || !isEnrollmentExpired(existingEnrollment)) {
      throw new ApiError(400, "You are already enrolled in this course");
    }
  }

  if (
    !existingEnrollment &&
    course.maxStudents &&
    course.enrolledStudentsCount >= course.maxStudents
  ) {
    throw new ApiError(400, "Course is full");
  }

  if (isEffectivelyFree) {
    const enrollment = await Enrollment.create({
      studentId: req.user._id,
      courseId: course._id,
      enrollmentStatus: "active",
      accessStatus: "allowed",
      status: "active",
    });

    await Course.findByIdAndUpdate(course._id, {
      $inc: { enrolledStudentsCount: 1 },
    });

    return res.status(201).json(
      new ApiResponse({
        message: "Enrollment completed successfully",
        data: {
          enrollment,
          payment: null,
        },
      }),
    );
  }

  const amount = effectiveAmount;
  if (amount <= 0) {
    throw new ApiError(400, "Unable to create paid enrollment with zero amount");
  }

  const enrollment = existingEnrollment || await Enrollment.create({
    studentId: req.user._id,
    courseId: course._id,
    enrollmentStatus: "pending",
    accessStatus: "blocked",
    status: "inactive",
  });

  const payment = await Payment.create({
    studentId: req.user._id,
    courseId: course._id,
    enrollmentId: enrollment._id,
    amount,
    currency: "USDT",
    paymentMethod: "manual",
    provider: "manual",
    paymentStatus: "pending",
    status: "pending",
    paymentReference: makePaymentReference(req.user._id),
  });

  enrollment.enrollmentStatus = "pending";
  enrollment.accessStatus = "blocked";
  enrollment.status = "inactive";
  enrollment.paymentId = payment._id;
  await enrollment.save();

  return res.status(201).json(
    new ApiResponse({
      message: "Enrollment created. Payment is pending verification",
      data: {
        enrollment,
        payment,
      },
    }),
  );
});

export const getStudentEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ studentId: req.user._id })
    .populate({
      path: "courseId",
      select: "title slug shortDescription description thumbnail isPublished status price discountPrice currency isFree paymentPlan level duration durationWeeks totalSessions startDate endDate classEndedAt meetingType meetingLink schedule teacher createdBy",
      populate: [
        { path: "teacher", select: "name email avatar" },
        { path: "createdBy", select: "name email avatar" }
      ]
    })
    .populate("paymentId", "paymentStatus status amount currency paymentMethod paidAt")
    .sort({ createdAt: -1 });

  const certificateBackfillOps = [];
  const visibleEnrollments = enrollments.filter((enrollment) => hasVisibleCourse(enrollment?.courseId));

  for (const enrollment of visibleEnrollments) {
    await expireEnrollmentIfNeeded(enrollment, enrollment?.courseId);
  }

  const normalizedEnrollments = visibleEnrollments.map((enrollment) => {
    const row = typeof enrollment?.toObject === "function"
      ? enrollment.toObject()
      : enrollment;
    const course = row?.courseId && typeof row.courseId === "object" ? row.courseId : {};
    const teacherProfile =
      (course?.teacher && String(course.teacher?.name || "").trim()
        ? course.teacher
        : null) ||
      (course?.createdBy && String(course.createdBy?.name || "").trim()
        ? course.createdBy
        : null);
    const certificateEligible = isCertificateEligible(row, course);
    const issuedAt = certificateEligible ? resolveCertificateIssuedAt(row) : null;
    const certificateId =
      certificateEligible
        ? normalizeCertificateId(
            row?.certificateId || buildCertificateId(row?._id, issuedAt),
          )
        : null;

    if (certificateEligible && !row?.certificateId) {
      certificateBackfillOps.push({
        updateOne: {
          filter: {
            _id: row?._id,
            $or: [
              { certificateId: { $exists: false } },
              { certificateId: null },
              { certificateId: "" },
            ],
          },
          update: {
            $set: {
              certificateId,
              certificateIssuedAt: issuedAt,
            },
          },
        },
      });
    }

    if (shouldClearCertificateState(row, course)) {
      certificateBackfillOps.push({
        updateOne: {
          filter: { _id: row?._id },
          update: {
            $unset: {
              certificateId: 1,
              certificateIssuedAt: 1,
            },
          },
        },
      });
    }

    return {
      ...row,
      certificateIssuedAt: issuedAt,
      certificateId,
      courseId: {
        ...course,
        teacher: teacherProfile,
        teacherName: teacherProfile?.name || "",
      },
    };
  });

  if (certificateBackfillOps.length) {
    try {
      await Enrollment.bulkWrite(certificateBackfillOps, { ordered: false });
    } catch (_error) {
      // Continue response even if backfill fails; verify endpoint also supports legacy rows.
    }
  }

  return res.json(
    new ApiResponse({
      message: "Student enrollments fetched successfully",
      data: normalizedEnrollments,
    }),
  );
});

export const verifyCertificateById = asyncHandler(async (req, res) => {
  const requestedId = req?.params?.certificateId || req?.body?.certificateId || "";
  const certificateId = normalizeCertificateId(requestedId);
  if (!certificateId || !CERTIFICATE_ID_PATTERN.test(certificateId)) {
    throw new ApiError(400, "Invalid certificate ID format");
  }

  const enrollment = await Enrollment.findOne({
    certificateId,
    enrollmentStatus: "completed",
  })
    .populate("studentId", "name firstNameFa lastNameFa")
    .populate({
      path: "courseId",
      select: "title classEndedAt isFree price teacher createdBy",
      populate: [
        { path: "teacher", select: "name" },
        { path: "createdBy", select: "name" },
      ],
    });

  if (
    enrollment &&
    hasVisibleCourse(enrollment.courseId) &&
    isCertificateEligible(enrollment, enrollment.courseId)
  ) {
    return res.json(
      new ApiResponse({
        message: "Certificate verified successfully",
        data: mapVerifiedCertificate(enrollment),
      }),
    );
  }

  const legacyRows = await Enrollment.find({ enrollmentStatus: "completed" })
    .select("_id courseId studentId enrollmentStatus updatedAt createdAt certificateIssuedAt certificateId")
    .populate("studentId", "name firstNameFa lastNameFa")
    .populate({
      path: "courseId",
      select: "title classEndedAt isFree price teacher createdBy",
      populate: [
        { path: "teacher", select: "name" },
        { path: "createdBy", select: "name" },
      ],
    });

  const matchedLegacy = legacyRows.find((row) => {
    if (!hasVisibleCourse(row?.courseId)) return false;
    if (!isCertificateEligible(row, row?.courseId)) return false;
    const issuedAt = resolveCertificateIssuedAt(row);
    const generatedId = normalizeCertificateId(buildCertificateId(row?._id, issuedAt));
    const generatedShortId = normalizeCertificateId(
      buildLegacyShortCertificateId(row?._id, issuedAt),
    );
    return generatedId === certificateId || generatedShortId === certificateId;
  });

  if (!matchedLegacy) {
    throw new ApiError(404, "Certificate not found");
  }

  if (!matchedLegacy.certificateId) {
    try {
      const issuedAt = resolveCertificateIssuedAt(matchedLegacy);
      const canonicalCertificateId = normalizeCertificateId(
        buildCertificateId(matchedLegacy?._id, issuedAt),
      );
      await Enrollment.updateOne(
        { _id: matchedLegacy._id, $or: [{ certificateId: { $exists: false } }, { certificateId: null }, { certificateId: "" }] },
        {
          $set: {
            certificateId: canonicalCertificateId,
            certificateIssuedAt: issuedAt,
          },
        },
      );
    } catch (_error) {
      // Ignore persistence error; verification can still succeed for the request.
    }
  }

  return res.json(
    new ApiResponse({
      message: "Certificate verified successfully",
      data: mapVerifiedCertificate({
        ...matchedLegacy.toObject(),
        certificateId,
      }),
    }),
  );
});

export const getStudentAssignments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ studentId: req.user._id })
    .populate({
      path: "courseId",
      select: "title shortDescription description schedule teacher createdBy isFree price startDate classEndedAt",
      populate: [
        { path: "teacher", select: "name" },
        { path: "createdBy", select: "name" }
      ]
    })
    .sort({ createdAt: -1 });

  const visibleEnrollments = (Array.isArray(enrollments) ? enrollments : []).filter((enrollment) =>
    hasVisibleCourse(enrollment?.courseId) && !enrollment?.courseId?.classEndedAt,
  );

  for (const enrollment of visibleEnrollments) {
    await expireEnrollmentIfNeeded(enrollment, enrollment?.courseId);
  }

  const enrollmentByCourse = new Map();
  visibleEnrollments.filter(hasAllowedEnrollmentAccess).forEach((row) => {
    const courseId = String(row?.courseId?._id || row?.courseId || "");
    if (!courseId) return;
    enrollmentByCourse.set(courseId, row);
  });

  const courseIds = Array.from(enrollmentByCourse.keys());
  const assignmentDocs = courseIds.length
    ? await Assignment.find({
        courseId: { $in: courseIds },
        status: { $in: ["published", "closed"] },
      })
        .populate({
          path: "courseId",
          select: "title teacher createdBy classEndedAt",
          populate: [
            { path: "teacher", select: "name" },
            { path: "createdBy", select: "name" },
          ],
        })
        .sort({ dueAt: 1, createdAt: -1 })
    : [];

  const assignmentIds = assignmentDocs.map((row) => row._id);
  const submissions = assignmentIds.length
    ? await AssignmentSubmission.find({
        assignmentId: { $in: assignmentIds },
        studentId: req.user._id,
      })
    : [];
  const submissionMap = new Map(
    submissions.map((row) => [String(row.assignmentId), row]),
  );

  const assignments = assignmentDocs.map((row) => {
    const courseId = String(row?.courseId?._id || row?.courseId || "");
    const enrollment = enrollmentByCourse.get(courseId);
    const enrollmentStatus = enrollment?.enrollmentStatus || "pending";
    const course = row?.courseId || {};
    const teacher = course?.teacher || course?.createdBy || {};
    const submission = submissionMap.get(String(row._id)) || null;
    const dueAt = row?.dueAt ? new Date(row.dueAt) : null;
    const dueValid = dueAt && !Number.isNaN(dueAt.getTime());
    const now = Date.now();

    let status = "pending";
    let statusLabel = "در انتظار ارسال";

    if (enrollmentStatus === "pending" || enrollmentStatus === "cancelled") {
      status = "locked";
      statusLabel = "قفل شده";
    } else if (submission?.status === "reviewed") {
      status = "reviewed";
      statusLabel = "بررسی شده";
    } else if (submission?.status === "submitted") {
      status = "submitted";
      statusLabel = "ارسال شده";
    } else if (dueValid && dueAt.getTime() < now && !row.allowLateSubmission) {
      status = "locked";
      statusLabel = "مهلت گذشته";
    }

    const typeToIcon = {
      homework: "FileText",
      project: "Code",
      quiz: "Mic",
    };

    return {
      id: String(row._id || ""),
      assignmentId: String(row._id || ""),
      enrollmentId: String(enrollment?._id || ""),
      courseId,
      title: row?.title || "تمرین",
      description: row?.description || "جزئیات تمرین توسط استاد مشخص شده است.",
      course: course?.title || "Course",
      teacher: teacher?.name || "Teacher",
      deadline: dueValid
        ? dueAt.toLocaleDateString("fa-IR", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "نامشخص",
      time: dueValid
        ? dueAt.toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      status,
      statusLabel,
      icon: typeToIcon[row?.type] || "FileText",
      grade:
        submission?.status === "reviewed" && submission?.score !== null && submission?.score !== undefined
          ? `${submission.score} / ${row.maxScore || 100}`
          : null,
      feedback: submission?.status === "reviewed" ? submission?.feedback || "" : null,
      updatedAt: submission?.updatedAt || row?.updatedAt || row?.createdAt || null,
      createdAt: row?.createdAt || null,
      dueAt: row?.dueAt || null,
      maxScore: Number(row?.maxScore || 100),
      type: row?.type || "homework",
      submissionId: submission ? String(submission._id) : "",
      classEndedAt: course?.classEndedAt || null,
    };
  }).filter((row) => !row.classEndedAt);

  return res.json(
    new ApiResponse({
      message: "Student assignments fetched successfully",
      data: assignments,
    }),
  );
});

export const getStudentResources = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ studentId: req.user._id })
    .populate(
      "courseId",
      "title shortDescription description thumbnail promoVideo updatedAt isFree price startDate classEndedAt",
    )
    .sort({ createdAt: -1 });

  const visibleEnrollments = (Array.isArray(enrollments) ? enrollments : []).filter((enrollment) =>
    hasVisibleCourse(enrollment?.courseId) && !enrollment?.courseId?.classEndedAt,
  );

  for (const enrollment of visibleEnrollments) {
    await expireEnrollmentIfNeeded(enrollment, enrollment?.courseId);
  }

  const accessibleEnrollments = visibleEnrollments.filter(hasAllowedEnrollmentAccess);
  const courseIds = accessibleEnrollments
    .map((enrollment) => enrollment.courseId?._id || enrollment.courseId)
    .filter(Boolean);
  const teacherResources = courseIds.length
    ? await CourseResource.find({ courseId: { $in: courseIds } })
      .populate("courseId", "title classEndedAt")
      .sort({ createdAt: -1 })
      .lean()
    : [];

  const resources = teacherResources
    .filter((resource) => hasVisibleCourse(resource?.courseId) && !resource?.courseId?.classEndedAt)
    .map((resource) => ({
      id: String(resource._id),
      title: resource.title,
      description: resource.module,
      course: resource.courseId?.title || "Course",
      classEndedAt: resource.courseId?.classEndedAt || null,
      type: resource.type,
      size: resource.fileSize ? `${Math.round(resource.fileSize / 1024 / 1024)} MB` : "-",
      addedAt: resource.createdAt,
      url: resource.type === "PDF" ? resource.filePath : resource.url,
      source: "teacher_resource",
    }))
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  return res.json(
    new ApiResponse({
      message: "Student resources fetched successfully",
      data: resources,
    }),
  );
});

export const getStudentLearningStats = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ studentId: req.user._id })
    .populate("courseId", "duration schedule isFree price startDate")
    .sort({ createdAt: -1 });

  const rows = (Array.isArray(enrollments) ? enrollments : []).filter((row) =>
    hasVisibleCourse(row?.courseId),
  );
  for (const enrollment of rows) {
    await expireEnrollmentIfNeeded(enrollment, enrollment?.courseId);
  }
  const activeRows = rows.filter(hasAllowedEnrollmentAccess);
  const completedRows = activeRows.filter((row) => row?.enrollmentStatus === "completed");

  const progressMap = {
    pending: 20,
    active: 65,
    completed: 100,
    cancelled: 0,
  };

  const estimatedLearningHours = activeRows.reduce((sum, row) => {
    const course = row?.courseId || {};
    const durationHours = estimateDurationHours(course.duration);
    const scheduleHours = estimateScheduleHours(course.schedule);
    const baseHours = Math.max(durationHours, scheduleHours);
    const multiplier = row?.enrollmentStatus === "completed" ? 1 : row?.enrollmentStatus === "active" ? 0.6 : 0.2;
    return sum + baseHours * multiplier;
  }, 0);

  const totalProgress = activeRows.reduce(
    (sum, row) => sum + (progressMap[row?.enrollmentStatus] ?? 0),
    0,
  );
  const averageProgress = activeRows.length
    ? Math.round(totalProgress / activeRows.length)
    : 0;

  return res.json(
    new ApiResponse({
      message: "Student learning stats fetched successfully",
      data: {
        enrolledCourses: activeRows.length,
        completedAssignments: completedRows.length,
        learningHours: Math.round(estimatedLearningHours),
        averageProgress,
      },
    }),
  );
});
