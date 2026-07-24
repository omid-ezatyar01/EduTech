import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  assignmentSubmissionFileHasValidSignature,
  removeAssignmentSubmissionFileIfLocal,
  saveAssignmentSubmissionFileFromBuffer,
} from "../utils/assignmentSubmissionFile.js";
import {
  expireEnrollmentIfNeeded,
  isEnrollmentExpired,
} from "../utils/courseAccess.js";

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const assignmentTypeLabel = {
  homework: "تمرین",
  project: "پروژه",
  quiz: "کوییز",
};

const assignmentStatusLabel = {
  draft: "پیش‌نویس",
  published: "فعال",
  closed: "بسته",
};

const submissionStatusLabel = {
  missing: "ارسال نشده",
  submitted: "ارسال شده",
  reviewed: "بررسی شده",
};

const activeAccessFilter = () => ({
  enrollmentStatus: { $in: ["active", "completed"] },
  accessStatus: "allowed",
  $or: [
    { accessExpiresAt: { $exists: false } },
    { accessExpiresAt: null },
    { accessExpiresAt: { $gt: new Date() } },
  ],
});

const mapAssignmentRow = (assignment, stats = {}, now = new Date()) => {
  const dueAt = assignment?.dueAt ? new Date(assignment.dueAt) : null;
  const isDueValid = dueAt && !Number.isNaN(dueAt.getTime());
  const isOverdue = isDueValid && dueAt.getTime() < now.getTime();
  const canAcceptSubmission =
    assignment?.status === "published" &&
    (assignment?.allowLateSubmission || !isOverdue);

  return {
    id: String(assignment?._id || ""),
    courseId: String(assignment?.courseId?._id || assignment?.courseId || ""),
    courseTitle: assignment?.courseId?.title || assignment?.courseTitle || "Course",
    title: assignment?.title || "",
    description: assignment?.description || "",
    type: assignment?.type || "homework",
    typeLabel: assignmentTypeLabel[assignment?.type] || assignment?.type || "تمرین",
    dueAt: assignment?.dueAt || null,
    maxScore: Number(assignment?.maxScore || 100),
    status: assignment?.status || "draft",
    statusLabel: assignmentStatusLabel[assignment?.status] || assignment?.status || "پیش‌نویس",
    allowLateSubmission: Boolean(assignment?.allowLateSubmission),
    attachmentUrl: assignment?.attachmentUrl || "",
    publishedAt: assignment?.publishedAt || null,
    closedAt: assignment?.closedAt || null,
    eligibleStudents: Number(stats.eligibleStudents || 0),
    submittedCount: Number(stats.submittedCount || 0),
    reviewedCount: Number(stats.reviewedCount || 0),
    lateCount: Number(stats.lateCount || 0),
    pendingReviewCount: Math.max(0, Number(stats.submittedCount || 0) - Number(stats.reviewedCount || 0)),
    isOverdue: Boolean(isOverdue),
    canAcceptSubmission,
    createdAt: assignment?.createdAt || null,
    updatedAt: assignment?.updatedAt || null,
  };
};

const assertTeacherOwnsCourse = async (teacherId, courseId) => {
  const course = await Course.findOne({
    _id: courseId,
    ...teacherCourseFilter(teacherId),
  }).select("_id title classEndedAt");

  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  return course;
};

const assertTeacherCanManageAssignmentCourse = (course) => {
  if (course?.classEndedAt) {
    throw new ApiError(400, "Ended courses cannot be managed by teacher");
  }
};

const assertTeacherOwnsAssignment = async (teacherId, assignmentId) => {
  const assignment = await Assignment.findOne({
    _id: assignmentId,
    teacherId,
  }).populate("courseId", "title level classEndedAt");

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  return assignment;
};

const buildAssignmentFilter = (teacherId, query = {}) => {
  const filter = { teacherId };

  if (query.courseId) {
    filter.courseId = query.courseId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (String(query.search || "").trim()) {
    const regex = new RegExp(String(query.search).trim(), "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  return filter;
};

const buildSort = (sortBy, sortOrder) => {
  const order = sortOrder === "asc" ? 1 : -1;
  if (sortBy === "dueAt") return { dueAt: order, createdAt: -1 };
  if (sortBy === "title") return { title: order, createdAt: -1 };
  return { createdAt: order };
};

const fetchEligibilityByCourse = async (courseIds = []) => {
  if (!courseIds.length) return {};

  const rows = await Enrollment.aggregate([
    {
      $match: {
        courseId: { $in: courseIds },
        enrollmentStatus: { $in: ["active", "completed"] },
      },
    },
    {
      $group: {
        _id: "$courseId",
        total: { $sum: 1 },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = Number(row.total || 0);
    return acc;
  }, {});
};

const fetchSubmissionStatsByAssignment = async (assignmentIds = []) => {
  if (!assignmentIds.length) return {};

  const rows = await AssignmentSubmission.aggregate([
    {
      $match: {
        assignmentId: { $in: assignmentIds },
      },
    },
    {
      $group: {
        _id: "$assignmentId",
        submittedCount: { $sum: 1 },
        reviewedCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0],
          },
        },
        lateCount: {
          $sum: {
            $cond: [{ $eq: ["$isLate", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = {
      submittedCount: Number(row.submittedCount || 0),
      reviewedCount: Number(row.reviewedCount || 0),
      lateCount: Number(row.lateCount || 0),
    };
    return acc;
  }, {});
};

const mapTeacherSubmissionRow = (student, submission, assignment) => {
  const dueAt = assignment?.dueAt ? new Date(assignment.dueAt) : null;
  const dueValid = dueAt && !Number.isNaN(dueAt.getTime());
  const submittedAt = submission?.submittedAt ? new Date(submission.submittedAt) : null;
  const submittedValid = submittedAt && !Number.isNaN(submittedAt.getTime());

  const status = submission?.status || (submission ? "submitted" : "missing");
  const isLate = Boolean(submission?.isLate || (submittedValid && dueValid && submittedAt.getTime() > dueAt.getTime()));

  return {
    id: submission ? String(submission._id) : "",
    studentId: String(student?._id || ""),
    studentName: student?.name || "Student",
    studentEmail: student?.email || "-",
    studentPhone: student?.phone || "-",
    status,
    statusLabel: submissionStatusLabel[status] || status,
    textAnswer: submission?.textAnswer || "",
    attachmentUrl: submission?.attachmentUrl || "",
    submittedAt: submission?.submittedAt || null,
    reviewedAt: submission?.reviewedAt || null,
    score: submission?.score ?? null,
    feedback: submission?.feedback || "",
    isLate,
  };
};

export const getTeacherAssignments = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

  if (req.query.courseId) {
    await assertTeacherOwnsCourse(teacherId, req.query.courseId);
  }

  const filter = buildAssignmentFilter(teacherId, req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder);

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate("courseId", "title level")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Assignment.countDocuments(filter),
  ]);

  const courseIds = [...new Set(assignments.map((row) => String(row?.courseId?._id || row?.courseId || "")).filter(Boolean))];
  const assignmentIds = assignments.map((row) => row._id);

  const [eligibilityByCourse, submissionStatsByAssignment] = await Promise.all([
    fetchEligibilityByCourse(courseIds),
    fetchSubmissionStatsByAssignment(assignmentIds),
  ]);

  const now = new Date();
  const data = assignments.map((row) => {
    const assignmentId = String(row._id);
    const courseId = String(row?.courseId?._id || row?.courseId || "");
    return mapAssignmentRow(
      row,
      {
        eligibleStudents: eligibilityByCourse[courseId] || 0,
        ...(submissionStatsByAssignment[assignmentId] || {}),
      },
      now,
    );
  });

  return res.json(
    new ApiResponse({
      message: "Teacher assignments fetched successfully",
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }),
  );
});

export const createTeacherAssignment = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const payload = req.body || {};
  const course = await assertTeacherOwnsCourse(teacherId, payload.courseId);
  assertTeacherCanManageAssignmentCourse(course);

  const assignment = await Assignment.create({
    courseId: course._id,
    teacherId,
    title: payload.title,
    description: payload.description || "",
    type: payload.type || "homework",
    dueAt: payload.dueAt,
    maxScore: payload.maxScore || 100,
    status: payload.status || "draft",
    allowLateSubmission: Boolean(payload.allowLateSubmission),
    attachmentUrl: payload.attachmentUrl || "",
  });

  const populated = await Assignment.findById(assignment._id).populate("courseId", "title level");

  return res.status(201).json(
    new ApiResponse({
      message: "Assignment created successfully",
      data: mapAssignmentRow(populated, { eligibleStudents: 0, submittedCount: 0, reviewedCount: 0, lateCount: 0 }),
    }),
  );
});

export const getTeacherAssignmentById = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const assignment = await assertTeacherOwnsAssignment(teacherId, req.params.id);
  const courseId = assignment?.courseId?._id || assignment?.courseId;

  const [eligibleStudents, submissionStats] = await Promise.all([
    Enrollment.countDocuments({
      courseId,
      ...activeAccessFilter(),
    }),
    fetchSubmissionStatsByAssignment([assignment._id]),
  ]);

  const stats = submissionStats[String(assignment._id)] || {};
  const data = mapAssignmentRow(assignment, {
    eligibleStudents,
    ...stats,
  });

  return res.json(
    new ApiResponse({
      message: "Teacher assignment fetched successfully",
      data,
    }),
  );
});

export const updateTeacherAssignment = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const payload = req.body || {};
  const assignment = await assertTeacherOwnsAssignment(teacherId, req.params.id);
  assertTeacherCanManageAssignmentCourse(assignment.courseId);

  if (payload.courseId && String(payload.courseId) !== String(assignment.courseId?._id || assignment.courseId)) {
    const nextCourse = await assertTeacherOwnsCourse(teacherId, payload.courseId);
    assertTeacherCanManageAssignmentCourse(nextCourse);
    assignment.courseId = payload.courseId;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "title")) assignment.title = payload.title;
  if (Object.prototype.hasOwnProperty.call(payload, "description")) assignment.description = payload.description || "";
  if (Object.prototype.hasOwnProperty.call(payload, "type")) assignment.type = payload.type;
  if (Object.prototype.hasOwnProperty.call(payload, "dueAt")) assignment.dueAt = payload.dueAt;
  if (Object.prototype.hasOwnProperty.call(payload, "maxScore")) assignment.maxScore = payload.maxScore;
  if (Object.prototype.hasOwnProperty.call(payload, "status")) assignment.status = payload.status;
  if (Object.prototype.hasOwnProperty.call(payload, "allowLateSubmission")) {
    assignment.allowLateSubmission = Boolean(payload.allowLateSubmission);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "attachmentUrl")) {
    assignment.attachmentUrl = payload.attachmentUrl || "";
  }

  await assignment.save();

  const refreshed = await Assignment.findById(assignment._id).populate("courseId", "title level");
  const eligibleStudents = await Enrollment.countDocuments({
    courseId: refreshed?.courseId?._id || refreshed?.courseId,
    ...activeAccessFilter(),
  });
  const submissionStats = await fetchSubmissionStatsByAssignment([assignment._id]);

  return res.json(
    new ApiResponse({
      message: "Assignment updated successfully",
      data: mapAssignmentRow(refreshed, {
        eligibleStudents,
        ...(submissionStats[String(assignment._id)] || {}),
      }),
    }),
  );
});

export const deleteTeacherAssignment = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const assignment = await assertTeacherOwnsAssignment(teacherId, req.params.id);
  assertTeacherCanManageAssignmentCourse(assignment.courseId);
  const submissionRows = await AssignmentSubmission.find({
    assignmentId: assignment._id,
  }).select("attachmentUrl");

  const localFilePaths = [...new Set(submissionRows.map((row) => String(row?.attachmentUrl || "")).filter(Boolean))];
  await Promise.allSettled(localFilePaths.map((filePath) => removeAssignmentSubmissionFileIfLocal(filePath)));

  await Promise.all([
    AssignmentSubmission.deleteMany({ assignmentId: assignment._id }),
    Assignment.deleteOne({ _id: assignment._id }),
  ]);

  return res.json(
    new ApiResponse({
      message: "Assignment deleted successfully",
      data: { id: String(assignment._id) },
    }),
  );
});

export const getTeacherAssignmentSubmissions = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const assignment = await assertTeacherOwnsAssignment(teacherId, req.params.id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const statusFilter = String(req.query.status || "all");
  const search = String(req.query.search || "").trim().toLowerCase();

  const enrollments = await Enrollment.find({
    courseId: assignment.courseId?._id || assignment.courseId,
    ...activeAccessFilter(),
  }).populate("studentId", "name email phone");

  const studentMap = new Map();
  enrollments.forEach((row) => {
    const student = row?.studentId;
    const studentId = String(student?._id || "");
    if (!studentId) return;
    studentMap.set(studentId, student);
  });

  const studentIds = Array.from(studentMap.keys());
  const submissions = studentIds.length
    ? await AssignmentSubmission.find({
        assignmentId: assignment._id,
        studentId: { $in: studentIds },
      })
    : [];

  const submissionByStudent = new Map();
  submissions.forEach((row) => {
    submissionByStudent.set(String(row.studentId), row);
  });

  let rows = studentIds.map((studentId) => {
    const student = studentMap.get(studentId);
    const submission = submissionByStudent.get(studentId) || null;
    return mapTeacherSubmissionRow(student, submission, assignment);
  });

  if (search) {
    rows = rows.filter((row) => {
      return (
        String(row.studentName || "").toLowerCase().includes(search) ||
        String(row.studentEmail || "").toLowerCase().includes(search)
      );
    });
  }

  if (statusFilter !== "all") {
    rows = rows.filter((row) => {
      if (statusFilter === "late") return row.isLate;
      return row.status === statusFilter;
    });
  }

  rows.sort((a, b) => {
    const aTime = new Date(a.submittedAt || 0).getTime();
    const bTime = new Date(b.submittedAt || 0).getTime();
    return bTime - aTime;
  });

  const total = rows.length;
  const pagedRows = rows.slice((page - 1) * limit, page * limit);

  const submittedCount = rows.filter((row) => row.status === "submitted" || row.status === "reviewed").length;
  const reviewedCount = rows.filter((row) => row.status === "reviewed").length;
  const missingCount = rows.filter((row) => row.status === "missing").length;
  const lateCount = rows.filter((row) => row.isLate).length;

  return res.json(
    new ApiResponse({
      message: "Assignment submissions fetched successfully",
      data: {
        assignment: mapAssignmentRow(assignment, {
          eligibleStudents: studentIds.length,
          submittedCount,
          reviewedCount,
          lateCount,
        }),
        submissions: pagedRows,
        stats: {
          totalStudents: studentIds.length,
          submittedCount,
          reviewedCount,
          missingCount,
          lateCount,
        },
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }),
  );
});

export const reviewTeacherAssignmentSubmission = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const assignment = await assertTeacherOwnsAssignment(teacherId, req.params.id);
  assertTeacherCanManageAssignmentCourse(assignment.courseId);
  const { score, feedback = "" } = req.body || {};
  const studentId = req.params.studentId;

  if (Number(score) > Number(assignment.maxScore || 100)) {
    throw new ApiError(400, `Score cannot be greater than max score (${assignment.maxScore})`);
  }

  const submission = await AssignmentSubmission.findOne({
    assignmentId: assignment._id,
    studentId,
  });

  if (!submission) {
    throw new ApiError(404, "Submission not found for this student");
  }

  if (submission.status === "reviewed") {
    throw new ApiError(409, "This submission is already reviewed and locked");
  }

  submission.status = "reviewed";
  submission.score = Number(score);
  submission.feedback = String(feedback || "").trim();
  submission.reviewedAt = new Date();
  submission.reviewedBy = teacherId;
  await submission.save();

  const student = await Enrollment.findOne({
    courseId: assignment.courseId?._id || assignment.courseId,
    studentId,
  }).populate("studentId", "name email phone");

  return res.json(
    new ApiResponse({
      message: "Submission reviewed successfully",
      data: mapTeacherSubmissionRow(student?.studentId, submission, assignment),
    }),
  );
});

export const submitStudentAssignment = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const assignment = await Assignment.findById(req.params.id).populate("courseId", "title isFree price startDate");

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (assignment.status !== "published") {
    throw new ApiError(400, "Assignment is not open for submission");
  }

  const enrollment = await Enrollment.findOne({
    studentId,
    courseId: assignment.courseId?._id || assignment.courseId,
    enrollmentStatus: { $in: ["active", "completed"] },
  });

  await expireEnrollmentIfNeeded(enrollment, assignment.courseId);

  if (
    !enrollment ||
    enrollment.accessStatus !== "allowed" ||
    isEnrollmentExpired(enrollment)
  ) {
    throw new ApiError(403, "You are not enrolled in this course");
  }

  const now = new Date();
  const dueAt = assignment?.dueAt ? new Date(assignment.dueAt) : null;
  const isDueValid = dueAt && !Number.isNaN(dueAt.getTime());
  const isLate = Boolean(isDueValid && now.getTime() > dueAt.getTime());

  if (isLate && !assignment.allowLateSubmission) {
    throw new ApiError(400, "Submission deadline has passed");
  }

  const payload = req.body || {};
  const textAnswer = String(payload.textAnswer || "").trim();
  const providedAttachmentUrl = String(payload.attachmentUrl || "").trim();
  const hasUploadedFile = Boolean(req.file?.buffer);
  if (hasUploadedFile && !assignmentSubmissionFileHasValidSignature(req.file)) {
    throw new ApiError(400, "The uploaded assignment file content does not match its file type");
  }
  if (!textAnswer && !providedAttachmentUrl && !hasUploadedFile) {
    throw new ApiError(400, "Provide textAnswer, attachmentUrl, or submission file");
  }

  const existing = await AssignmentSubmission.findOne({
    assignmentId: assignment._id,
    studentId,
  });
  const previousFilePath = existing?.attachmentUrl || "";

  let finalAttachmentUrl = providedAttachmentUrl;
  if (hasUploadedFile) {
    finalAttachmentUrl = await saveAssignmentSubmissionFileFromBuffer(
      studentId,
      assignment._id,
      req.file,
    );
  }

  const submission = await AssignmentSubmission.findOneAndUpdate(
    {
      assignmentId: assignment._id,
      studentId,
    },
    {
      $set: {
        courseId: assignment.courseId?._id || assignment.courseId,
        teacherId: assignment.teacherId,
        enrollmentId: enrollment._id,
        textAnswer,
        attachmentUrl: finalAttachmentUrl,
        submittedAt: now,
        isLate,
        status: "submitted",
        score: null,
        feedback: "",
        reviewedAt: null,
        reviewedBy: null,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );

  if (hasUploadedFile && previousFilePath && previousFilePath !== finalAttachmentUrl) {
    await removeAssignmentSubmissionFileIfLocal(previousFilePath);
  }

  return res.json(
    new ApiResponse({
      message: "Assignment submitted successfully",
      data: {
        id: String(submission._id),
        assignmentId: String(assignment._id),
        status: submission.status,
        statusLabel: submissionStatusLabel[submission.status] || "ارسال شده",
        submittedAt: submission.submittedAt,
        isLate: submission.isLate,
      },
    }),
  );
});
