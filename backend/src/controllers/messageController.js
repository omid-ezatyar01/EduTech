import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import DirectMessage from "../models/DirectMessage.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { isEnrollmentExpired } from "../utils/courseAccess.js";

const ACTIVE_ENROLLMENT_STATUSES = ["active", "completed"];

const ELIGIBLE_ENROLLMENT_FILTER = {
  $or: [
    {
      enrollmentStatus: { $in: ACTIVE_ENROLLMENT_STATUSES },
      accessStatus: "allowed",
    },
    // Backward compatibility for legacy rows that only stored `status`.
    { enrollmentStatus: { $exists: false }, status: "active" },
  ],
};

const hasAllowedEnrollmentAccess = (enrollment = {}) => {
  if (!enrollment) return false;
  const status = String(enrollment?.enrollmentStatus || "");
  const isLegacyActive = !status && String(enrollment?.status || "") === "active";
  return (
    (ACTIVE_ENROLLMENT_STATUSES.includes(status) || isLegacyActive) &&
    (isLegacyActive || String(enrollment?.accessStatus || "") === "allowed") &&
    !isEnrollmentExpired(enrollment)
  );
};

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

const GROUP_CHAT_TTL_MS = 72 * 60 * 60 * 1000;

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const normalizeId = (value) => String(value || "").trim();
const toValidDateOrNull = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed) return null;
  const time = parsed.getTime();
  return Number.isFinite(time) ? parsed : null;
};

const toGroupExpiresAt = (anchorDate = new Date()) => {
  const safeAnchor = toValidDateOrNull(anchorDate) || new Date();
  return new Date(safeAnchor.getTime() + GROUP_CHAT_TTL_MS);
};

const resolveCourseGroupExpiresAt = async ({ teacherId, courseId }) => {
  const firstMessage = await DirectMessage.findOne({
    teacherId,
    courseId,
  })
    .select("createdAt expiresAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!firstMessage) {
    return toGroupExpiresAt(new Date());
  }

  const existingExpiresAt = toValidDateOrNull(firstMessage.expiresAt);
  if (existingExpiresAt) {
    return existingExpiresAt;
  }

  return toGroupExpiresAt(firstMessage.createdAt);
};

const resolveTeacherIdFromCourse = (course = {}) => {
  const teacher = course?.teacher;
  if (teacher && typeof teacher === "object") {
    const id = teacher?._id || teacher?.id;
    if (id) return normalizeId(id);
  }

  const teacherId = course?.teacherId;
  if (teacherId && typeof teacherId === "object") {
    const id = teacherId?._id || teacherId?.id;
    if (id) return normalizeId(id);
  }
  if (teacherId) return normalizeId(teacherId);

  const createdBy = course?.createdBy;
  if (createdBy && typeof createdBy === "object") {
    const id = createdBy?._id || createdBy?.id;
    if (id) return normalizeId(id);
  }

  return "";
};

const getTeacherOwnedCourses = async (teacherId, courseId = "") => {
  const filter = {
    ...teacherCourseFilter(teacherId),
  };
  if (courseId) filter._id = courseId;

  return Course.find(filter).select(
    "_id title status classEndedAt classCancelledAt allowStudentGroupMessages",
  );
};

const assertTeacherCanMessageStudent = async (teacherId, studentId, courseId = "") => {
  const courses = await getTeacherOwnedCourses(teacherId, courseId);
  if (!courses.length) {
    if (courseId) {
      throw new ApiError(404, "Course not found or not owned by teacher");
    }
    throw new ApiError(403, "You can only message your enrolled students");
  }

  const courseIds = courses.map((row) => row._id);
  const enrollment = await Enrollment.findOne({
    studentId,
    courseId: { $in: courseIds },
    ...ELIGIBLE_ENROLLMENT_FILTER,
  }).select("_id courseId enrollmentStatus accessStatus accessExpiresAt status");

  if (!hasAllowedEnrollmentAccess(enrollment)) {
    throw new ApiError(403, "You can only message your enrolled students");
  }

  return {
    enrollment,
    courseId: enrollment.courseId,
  };
};

const assertStudentCanMessageTeacher = async (studentId, teacherId, courseId = "") => {
  const filter = {
    studentId,
    ...ELIGIBLE_ENROLLMENT_FILTER,
  };

  if (courseId) {
    filter.courseId = courseId;
  }

  const enrollments = await Enrollment.find(filter).populate({
    path: "courseId",
    select: "title teacher teacherId createdBy",
    populate: [
      { path: "teacher", select: "name email avatar" },
      { path: "teacherId", select: "name email avatar" },
      { path: "createdBy", select: "name email avatar" },
    ],
  });

  const targetTeacherId = normalizeId(teacherId);
  const matched = (Array.isArray(enrollments) ? enrollments : []).find((row) => {
    if (!hasAllowedEnrollmentAccess(row)) return false;
    const course = row?.courseId;
    if (!course || typeof course !== "object") return false;
    const resolvedTeacherId = resolveTeacherIdFromCourse(course);
    return resolvedTeacherId && resolvedTeacherId === targetTeacherId;
  });

  if (!matched) {
    throw new ApiError(403, "You can only message teachers of your enrolled courses");
  }

  return {
    enrollment: matched,
    courseId: matched.courseId?._id || matched.courseId,
  };
};

const hasConversationHistory = async (teacherId, studentId) => {
  const existing = await DirectMessage.exists({
    teacherId,
    studentId,
  });
  return Boolean(existing);
};

const assertTeacherCanAccessStudentConversation = async (teacherId, studentId) => {
  try {
    await assertTeacherCanMessageStudent(teacherId, studentId);
    return;
  } catch (error) {
    const canAccessHistory = await hasConversationHistory(teacherId, studentId);
    if (canAccessHistory) return;
    throw error;
  }
};

const assertStudentCanAccessTeacherConversation = async (studentId, teacherId) => {
  try {
    await assertStudentCanMessageTeacher(studentId, teacherId);
    return;
  } catch (error) {
    const canAccessHistory = await hasConversationHistory(teacherId, studentId);
    if (canAccessHistory) return;
    throw error;
  }
};

const isCourseStudentMessagingEnabled = (course = {}) => {
  if (!course || typeof course !== "object") return true;
  const value = course?.allowStudentGroupMessages;
  if (typeof value === "boolean") return value;
  return true;
};

const mapCourseMessageSetting = (course = {}) => ({
  allowStudentGroupMessages: isCourseStudentMessagingEnabled(course),
});

const assertTeacherOwnsCourse = async (teacherId, courseId) => {
  const courses = await getTeacherOwnedCourses(teacherId, courseId);
  if (!courses.length) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }
  return courses[0];
};

const assertTeacherCanManageCourseMessaging = (course) => {
  if (
    course?.classEndedAt ||
    course?.classCancelledAt ||
    course?.status === "cancelled"
  ) {
    throw new ApiError(400, "Ended or cancelled courses cannot be managed by teacher");
  }
};

const getStudentActiveEnrollmentByCourse = async (studentId, courseId) => {
  const enrollment = await Enrollment.findOne({
    studentId,
    courseId,
    ...ELIGIBLE_ENROLLMENT_FILTER,
  }).select("_id courseId enrollmentStatus accessStatus accessExpiresAt status");

  if (!hasAllowedEnrollmentAccess(enrollment)) {
    throw new ApiError(403, "You can only access class chats for your enrolled courses");
  }

  return enrollment;
};

const mapMessageRow = (row = {}, ownUserId) => {
  const sender = row?.senderId && typeof row.senderId === "object" ? row.senderId : {};
  const senderRole = String(row?.senderRole || "");
  const course = row?.courseId && typeof row.courseId === "object" ? row.courseId : null;
  return {
    id: String(row?._id || ""),
    teacherId: String(row?.teacherId || ""),
    studentId: String(row?.studentId || ""),
    courseId: String(course?._id || row?.courseId || ""),
    courseTitle: String(course?.title || "").trim(),
    senderRole,
    senderId: String(sender?._id || row?.senderId || ""),
    senderName: sender?.name || (senderRole === "teacher" ? "Teacher" : "Student"),
    senderAvatar: sender?.avatar || "",
    body: row?.body || "",
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
    expiresAt: row?.expiresAt || null,
    readByTeacher: Boolean(row?.readByTeacher),
    readByStudent: Boolean(row?.readByStudent),
    isOwnMessage: String(row?.senderId?._id || row?.senderId || "") === String(ownUserId || ""),
  };
};

const buildConversationStats = (rows = []) => ({
  totalConversations: rows.length,
  unreadConversations: rows.filter((row) => Number(row.unreadCount || 0) > 0).length,
  totalUnreadMessages: rows.reduce((sum, row) => sum + Number(row.unreadCount || 0), 0),
});

const sortConversations = (rows = []) => {
  rows.sort((a, b) => {
    const aTime = new Date(a.lastMessageAt || 0).getTime();
    const bTime = new Date(b.lastMessageAt || 0).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return String(a.name || "").localeCompare(String(b.name || ""), "fa");
  });
  return rows;
};

const isTeacherStudentMessagingEnabled = (teacher = {}) => {
  if (!teacher || typeof teacher !== "object") return true;
  const value = teacher?.communicationSettings?.allowStudentDirectMessages;
  if (typeof value === "boolean") return value;
  return true;
};

const mapTeacherMessageSetting = (teacher = {}) => ({
  allowStudentDirectMessages: isTeacherStudentMessagingEnabled(teacher),
});

const parsePrefixedMessageIds = (messageIds = []) => {
  const groupIds = new Set();
  const directMessageIds = new Set();

  (Array.isArray(messageIds) ? messageIds : []).forEach((raw) => {
    const value = String(raw || "").trim();
    if (!value) return;

    if (value.startsWith("group:")) {
      const id = value.slice(6);
      if (mongoose.Types.ObjectId.isValid(id)) {
        groupIds.add(id);
      }
      return;
    }

    if (value.startsWith("msg:")) {
      const id = value.slice(4);
      if (mongoose.Types.ObjectId.isValid(id)) {
        directMessageIds.add(id);
      }
    }
  });

  return {
    groupIds: Array.from(groupIds),
    directMessageIds: Array.from(directMessageIds),
  };
};

export const getTeacherMessageSettings = asyncHandler(async (req, res) => {
  const teacher = await User.findById(req.user._id).select("communicationSettings.allowStudentDirectMessages");
  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return res.json(
    new ApiResponse({
      message: "Teacher message settings fetched successfully",
      data: mapTeacherMessageSetting(teacher),
    }),
  );
});

export const updateTeacherMessageSettings = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const allowStudentDirectMessages = Boolean(payload.allowStudentDirectMessages);

  const teacher = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        "communicationSettings.allowStudentDirectMessages": allowStudentDirectMessages,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("communicationSettings.allowStudentDirectMessages");

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return res.json(
    new ApiResponse({
      message: "Teacher message settings updated successfully",
      data: mapTeacherMessageSetting(teacher),
    }),
  );
});

export const getTeacherCourseGroupMessageSettings = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();

  const course = await Course.findOne({
    _id: courseId,
    ...teacherCourseFilter(teacherId),
  }).select("_id title allowStudentGroupMessages");

  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  return res.json(
    new ApiResponse({
      message: "Teacher course group message settings fetched successfully",
      data: {
        courseId: String(course._id),
        courseTitle: String(course.title || "Course").trim() || "Course",
        ...mapCourseMessageSetting(course),
      },
    }),
  );
});

export const updateTeacherCourseGroupMessageSettings = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();
  const allowStudentGroupMessages = Boolean(req.body?.allowStudentGroupMessages);
  const ownedCourse = await assertTeacherOwnsCourse(teacherId, courseId);
  assertTeacherCanManageCourseMessaging(ownedCourse);

  const course = await Course.findOneAndUpdate(
    {
      _id: courseId,
      ...teacherCourseFilter(teacherId),
    },
    {
      $set: {
        allowStudentGroupMessages,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("_id title allowStudentGroupMessages");

  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  return res.json(
    new ApiResponse({
      message: "Teacher course group message settings updated successfully",
      data: {
        courseId: String(course._id),
        courseTitle: String(course.title || "Course").trim() || "Course",
        ...mapCourseMessageSetting(course),
      },
    }),
  );
});

export const getTeacherMessageConversations = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const unreadOnly = req.query.unreadOnly === true || req.query.unreadOnly === "true";
  const search = String(req.query.search || "").trim().toLowerCase();

  const ownedCourses = await getTeacherOwnedCourses(teacherId, req.query.courseId || "");
  if (req.query.courseId && !ownedCourses.length) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  const ownedCourseIds = ownedCourses.map((row) => row._id);
  const enrollments = ownedCourseIds.length
    ? await Enrollment.find({
        courseId: { $in: ownedCourseIds },
        ...ELIGIBLE_ENROLLMENT_FILTER,
      })
        .populate("studentId", "name email avatar status")
        .populate("courseId", "title")
        .sort({ updatedAt: -1 })
    : [];

  const studentMap = new Map();
  for (const row of enrollments) {
    if (!hasAllowedEnrollmentAccess(row)) continue;
    const student = row?.studentId;
    const studentId = String(student?._id || "");
    if (!studentId) continue;

    const course = row?.courseId;
    const courseId = String(course?._id || row?.courseId || "");
    const courseTitle = String(course?.title || "").trim();

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        studentId,
        name: student?.name || "Student",
        email: student?.email || "",
        avatar: student?.avatar || "",
        status: student?.status || "active",
        courseMap: new Map(),
        lastEnrollmentAt: row?.updatedAt || row?.createdAt || null,
      });
    }

    const target = studentMap.get(studentId);
    if (courseId && courseTitle) {
      target.courseMap.set(courseId, courseTitle);
    }

    const rowTime = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
    const targetTime = new Date(target.lastEnrollmentAt || 0).getTime();
    if (rowTime > targetTime) {
      target.lastEnrollmentAt = row?.updatedAt || row?.createdAt || target.lastEnrollmentAt;
    }
  }

  const messageMatch = {
    teacherId: toObjectId(teacherId),
  };
  if (req.query.courseId) {
    messageMatch.courseId = toObjectId(req.query.courseId);
  }

  const [lastRows, unreadRows, courseRows] = await Promise.all([
    DirectMessage.aggregate([
      {
        $match: messageMatch,
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$studentId",
          lastMessage: { $first: "$body" },
          lastMessageAt: { $first: "$createdAt" },
          lastSenderRole: { $first: "$senderRole" },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          ...messageMatch,
          senderRole: "student",
          readByTeacher: false,
        },
      },
      {
        $group: {
          _id: "$studentId",
          unreadCount: { $sum: 1 },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: messageMatch,
      },
      {
        $group: {
          _id: {
            studentId: "$studentId",
            courseId: "$courseId",
          },
          lastMessageAt: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const messageStudentIds = new Set(
    (Array.isArray(lastRows) ? lastRows : []).map((row) => String(row._id || "")).filter(Boolean),
  );
  (Array.isArray(unreadRows) ? unreadRows : []).forEach((row) => {
    const id = String(row?._id || "");
    if (id) messageStudentIds.add(id);
  });
  (Array.isArray(courseRows) ? courseRows : []).forEach((row) => {
    const id = String(row?._id?.studentId || "");
    if (id) messageStudentIds.add(id);
  });

  const missingStudentIds = Array.from(messageStudentIds).filter((id) => !studentMap.has(id));
  if (missingStudentIds.length) {
    const missingStudents = await User.find({
      _id: { $in: missingStudentIds.map((id) => toObjectId(id)) },
    }).select("_id name email avatar status");

    (Array.isArray(missingStudents) ? missingStudents : []).forEach((student) => {
      const studentId = String(student?._id || "");
      if (!studentId || studentMap.has(studentId)) return;
      studentMap.set(studentId, {
        studentId,
        name: student?.name || "Student",
        email: student?.email || "",
        avatar: student?.avatar || "",
        status: student?.status || "active",
        courseMap: new Map(),
        lastEnrollmentAt: null,
      });
    });

  }

  const courseIdsFromEnrollments = Array.from(studentMap.values()).flatMap((row) => Array.from(row.courseMap.keys()));
  const courseIdsFromMessages = (Array.isArray(courseRows) ? courseRows : [])
    .map((row) => String(row?._id?.courseId || ""))
    .filter(Boolean);
  const allCourseIds = [...new Set([...courseIdsFromEnrollments, ...courseIdsFromMessages])];

  const courseTitleMap = new Map();
  if (allCourseIds.length) {
    const courses = await Course.find({
      _id: { $in: allCourseIds.map((id) => toObjectId(id)) },
    }).select("_id title");
    (Array.isArray(courses) ? courses : []).forEach((course) => {
      const id = String(course?._id || "");
      if (!id) return;
      courseTitleMap.set(id, String(course?.title || "").trim());
    });
  }

  (Array.isArray(courseRows) ? courseRows : []).forEach((row) => {
    const studentId = String(row?._id?.studentId || "");
    const courseId = String(row?._id?.courseId || "");
    if (!studentId || !courseId) return;

    if (!studentMap.has(studentId)) return;

    const target = studentMap.get(studentId);
    const title = courseTitleMap.get(courseId) || target.courseMap.get(courseId) || "Course";
    target.courseMap.set(courseId, title);

    const rowTime = new Date(row?.lastMessageAt || 0).getTime();
    const targetTime = new Date(target.lastEnrollmentAt || 0).getTime();
    if (rowTime > targetTime) {
      target.lastEnrollmentAt = row?.lastMessageAt || target.lastEnrollmentAt;
    }
  });

  const studentIds = Array.from(studentMap.keys());

  const lastByStudent = new Map(
    (Array.isArray(lastRows) ? lastRows : []).map((row) => [String(row._id), row]),
  );
  const unreadByStudent = new Map(
    (Array.isArray(unreadRows) ? unreadRows : []).map((row) => [String(row._id), Number(row.unreadCount || 0)]),
  );

  let conversations = studentIds.map((studentId) => {
    const base = studentMap.get(studentId);
    const last = lastByStudent.get(studentId) || {};
    const unreadCount = unreadByStudent.get(studentId) || 0;
    const courseEntries = Array.from(base.courseMap.entries()).map(([id, title]) => ({
      id,
      title,
    }));

    return {
      studentId: base.studentId,
      name: base.name,
      email: base.email,
      avatar: base.avatar,
      status: base.status,
      unreadCount,
      lastMessage: String(last?.lastMessage || "").trim(),
      lastMessageAt: last?.lastMessageAt || base.lastEnrollmentAt || null,
      lastSenderRole: last?.lastSenderRole || "",
      courses: courseEntries,
    };
  });

  if (search) {
    conversations = conversations.filter((row) => {
      const courseText = row.courses.map((course) => course.title).join(" ").toLowerCase();
      return (
        String(row.name || "").toLowerCase().includes(search) ||
        String(row.email || "").toLowerCase().includes(search) ||
        String(row.lastMessage || "").toLowerCase().includes(search) ||
        courseText.includes(search)
      );
    });
  }

  if (unreadOnly) {
    conversations = conversations.filter((row) => row.unreadCount > 0);
  }

  sortConversations(conversations);

  const total = conversations.length;
  const pagedConversations = conversations.slice((page - 1) * limit, page * limit);

  return res.json(
    new ApiResponse({
      message: "Teacher message conversations fetched successfully",
      data: {
        conversations: pagedConversations,
        stats: buildConversationStats(conversations),
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

export const getTeacherConversationMessages = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const studentId = req.params.studentId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const before = req.query.before ? new Date(req.query.before) : null;

  await assertTeacherCanAccessStudentConversation(teacherId, studentId);

  const filter = {
    teacherId,
    studentId,
  };
  if (before && !Number.isNaN(before.getTime())) {
    filter.createdAt = { $lt: before };
  }

  const [messages, total, student] = await Promise.all([
    DirectMessage.find(filter)
      .populate("senderId", "name avatar role")
      .populate("courseId", "title")
      .sort({ createdAt: -1 })
      .skip(before && !Number.isNaN(before.getTime()) ? 0 : (page - 1) * limit)
      .limit(limit),
    DirectMessage.countDocuments(filter),
    User.findById(studentId).select("_id name email avatar role"),
  ]);

  const normalizedRows = (Array.isArray(messages) ? messages : [])
    .map((row) => mapMessageRow(row, teacherId))
    .reverse();

  return res.json(
    new ApiResponse({
      message: "Teacher conversation messages fetched successfully",
      data: {
        student: student
          ? {
              id: String(student._id),
              name: student.name || "Student",
              email: student.email || "",
              avatar: student.avatar || "",
            }
          : null,
        messages: normalizedRows,
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

export const sendTeacherConversationMessage = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const studentId = req.params.studentId;
  const payload = req.body || {};
  const body = String(payload.body || "").trim();

  const { courseId } = await assertTeacherCanMessageStudent(teacherId, studentId, payload.courseId || "");

  const message = await DirectMessage.create({
    teacherId,
    studentId,
    courseId,
    senderId: teacherId,
    senderRole: "teacher",
    body,
    readByTeacher: true,
    readByStudent: false,
  });

  const populated = await DirectMessage.findById(message._id)
    .populate("senderId", "name avatar role")
    .populate("courseId", "title");
  return res.status(201).json(
    new ApiResponse({
      message: "Message sent successfully",
      data: mapMessageRow(populated, teacherId),
    }),
  );
});

export const markTeacherConversationAsRead = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const studentId = req.params.studentId;

  await assertTeacherCanAccessStudentConversation(teacherId, studentId);

  const result = await DirectMessage.updateMany(
    {
      teacherId,
      studentId,
      senderRole: "student",
      readByTeacher: false,
    },
    {
      $set: { readByTeacher: true },
    },
  );

  return res.json(
    new ApiResponse({
      message: "Conversation marked as read successfully",
      data: {
        updatedCount: Number(result?.modifiedCount || 0),
      },
    }),
  );
});

export const getTeacherCourseBroadcastConversations = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const [ownedCourses, teacher] = await Promise.all([
    Course.find({
      ...teacherCourseFilter(teacherId),
    }).select("_id title allowStudentGroupMessages"),
    User.findById(teacherId).select("communicationSettings.allowStudentDirectMessages"),
  ]);
  const ownedCourseIds = ownedCourses.map((row) => row._id);

  if (!ownedCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Teacher course group conversations fetched successfully",
        data: [],
      }),
    );
  }

  const [lastRows, unreadRows] = await Promise.all([
    DirectMessage.aggregate([
      {
        $match: {
          teacherId: toObjectId(teacherId),
          courseId: { $in: ownedCourseIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$courseId",
          lastMessage: { $first: "$body" },
          lastMessageAt: { $first: "$createdAt" },
          lastSenderRole: { $first: "$senderRole" },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          teacherId: toObjectId(teacherId),
          courseId: { $in: ownedCourseIds },
          senderRole: "student",
          readByTeacher: false,
        },
      },
      {
        $group: {
          _id: "$courseId",
          unreadCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const courseMap = new Map(
    (Array.isArray(ownedCourses) ? ownedCourses : []).map((row) => [String(row?._id || ""), row]),
  );
  const unreadMap = new Map(
    (Array.isArray(unreadRows) ? unreadRows : []).map((row) => [String(row?._id || ""), Number(row?.unreadCount || 0)]),
  );
  const allowGlobalStudentMessages = isTeacherStudentMessagingEnabled(teacher);

  const conversations = (Array.isArray(lastRows) ? lastRows : [])
    .map((row) => {
      const courseId = String(row?._id || "");
      if (!courseId) return null;
      const course = courseMap.get(courseId);
      const allowByCourse = isCourseStudentMessagingEnabled(course);
      return {
        courseId,
        courseTitle: String(course?.title || "Course").trim() || "Course",
        allowStudentGroupMessages: allowByCourse,
        allowStudentMessagesEffective: allowGlobalStudentMessages && allowByCourse,
        lastMessage: String(row?.lastMessage || "").trim(),
        lastMessageAt: row?.lastMessageAt || null,
        lastSenderRole: String(row?.lastSenderRole || ""),
        unreadCount: unreadMap.get(courseId) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

  return res.json(
    new ApiResponse({
      message: "Teacher course group conversations fetched successfully",
      data: conversations,
    }),
  );
});

export const getTeacherCourseBroadcastMessages = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();

  const [course, teacher] = await Promise.all([
    Course.findOne({
      _id: courseId,
      ...teacherCourseFilter(teacherId),
    }).select("_id title allowStudentGroupMessages"),
    User.findById(teacherId).select("communicationSettings.allowStudentDirectMessages"),
  ]);
  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  await DirectMessage.updateMany(
    {
      teacherId,
      courseId,
      senderRole: "student",
      readByTeacher: false,
    },
    {
      $set: { readByTeacher: true },
    },
  );

  const rows = await DirectMessage.find({
    teacherId,
    courseId,
  })
    .populate("senderId", "name avatar role")
    .sort({ createdAt: 1 });

  const groupedTeacherMap = new Map();
  const messages = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const senderRole = String(row?.senderRole || "");
    const sender = row?.senderId && typeof row.senderId === "object" ? row.senderId : null;

    if (senderRole === "teacher") {
      const groupId = String(row?.broadcastGroupId || "").trim();
      if (groupId) {
        if (groupedTeacherMap.has(groupId)) {
          const target = groupedTeacherMap.get(groupId);
          target.sentCount += 1;
          return;
        }
      }

      const entry = {
        id: groupId ? `group:${groupId}` : `msg:${String(row?._id || "")}`,
        courseId,
        courseTitle: String(course?.title || "Course").trim() || "Course",
        senderRole: "teacher",
        senderName: sender?.name || "Teacher",
        senderAvatar: sender?.avatar || "",
        body: String(row?.body || "").trim(),
        createdAt: row?.createdAt || null,
        sentCount: 1,
      };
      messages.push(entry);
      if (groupId) {
        groupedTeacherMap.set(groupId, entry);
      }
      return;
    }

    messages.push({
      id: `msg:${String(row?._id || "")}`,
      courseId,
      courseTitle: String(course?.title || "Course").trim() || "Course",
      senderRole: "student",
      senderName: sender?.name || "Student",
      senderAvatar: sender?.avatar || "",
      body: String(row?.body || "").trim(),
      createdAt: row?.createdAt || null,
      sentCount: 1,
    });
  });

  return res.json(
    new ApiResponse({
      message: "Teacher course group messages fetched successfully",
      data: {
        course: {
          id: String(course?._id || courseId),
          title: String(course?.title || "Course").trim() || "Course",
          allowStudentGroupMessages: isCourseStudentMessagingEnabled(course),
          allowStudentMessagesEffective:
            isTeacherStudentMessagingEnabled(teacher) && isCourseStudentMessagingEnabled(course),
        },
        messages,
      },
    }),
  );
});

export const deleteTeacherCourseBroadcastMessages = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();
  const payload = req.body || {};

  const ownedCourse = await assertTeacherOwnsCourse(teacherId, courseId);
  assertTeacherCanManageCourseMessaging(ownedCourse);

  let deletedCount = 0;

  if (payload.clearAll) {
    const result = await DirectMessage.deleteMany({
      teacherId,
      courseId,
    });
    deletedCount = Number(result?.deletedCount || 0);
  } else {
    const { groupIds, directMessageIds } = parsePrefixedMessageIds(payload.messageIds);
    const deleteFilters = [];

    if (groupIds.length) {
      deleteFilters.push({
        teacherId,
        courseId,
        senderRole: "teacher",
        broadcastGroupId: { $in: groupIds },
      });
    }

    if (directMessageIds.length) {
      deleteFilters.push({
        teacherId,
        courseId,
        _id: { $in: directMessageIds.map((id) => toObjectId(id)) },
      });
    }

    if (!deleteFilters.length) {
      throw new ApiError(400, "No valid messages were selected for deletion");
    }

    const result = await DirectMessage.deleteMany({
      $or: deleteFilters,
    });
    deletedCount = Number(result?.deletedCount || 0);
  }

  return res.json(
    new ApiResponse({
      message: "Teacher course group messages deleted successfully",
      data: {
        courseId,
        deletedCount,
      },
    }),
  );
});

export const sendTeacherCourseBroadcastMessage = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const payload = req.body || {};
  const courseId = String(payload.courseId || "").trim();
  const body = String(payload.body || "").trim();

  const courses = await getTeacherOwnedCourses(teacherId, courseId);
  if (!courses.length) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }
  assertTeacherCanManageCourseMessaging(courses[0]);

  const enrollments = await Enrollment.find({
    courseId,
    ...ELIGIBLE_ENROLLMENT_FILTER,
  }).select("studentId enrollmentStatus accessStatus accessExpiresAt status");

  const studentIds = [
    ...new Set(
      (Array.isArray(enrollments) ? enrollments : [])
        .filter(hasAllowedEnrollmentAccess)
        .map((row) => String(row.studentId || ""))
        .filter(Boolean),
    ),
  ];

  if (!studentIds.length) {
    throw new ApiError(400, "No enrolled students found for this course");
  }

  const expiresAt = await resolveCourseGroupExpiresAt({ teacherId, courseId });
  const broadcastGroupId = new mongoose.Types.ObjectId().toHexString();

  const docs = studentIds.map((studentId) => ({
    teacherId,
    studentId,
    courseId,
    broadcastGroupId,
    senderId: teacherId,
    senderRole: "teacher",
    body,
    readByTeacher: true,
    readByStudent: false,
    expiresAt,
  }));

  const result = await DirectMessage.insertMany(docs);

  return res.status(201).json(
    new ApiResponse({
      message: "Course group message sent successfully",
      data: {
        courseId,
        sentCount: Array.isArray(result) ? result.length : 0,
      },
    }),
  );
});

export const getStudentCourseGroupConversations = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const unreadOnly = req.query.unreadOnly === true || req.query.unreadOnly === "true";
  const search = String(req.query.search || "").trim().toLowerCase();

  const enrollments = await Enrollment.find({
    studentId,
    ...ELIGIBLE_ENROLLMENT_FILTER,
  }).select("courseId enrollmentStatus accessStatus accessExpiresAt status");

  const enrolledCourseIdSet = new Set(
    (Array.isArray(enrollments) ? enrollments : [])
      .filter(hasAllowedEnrollmentAccess)
      .map((row) => String(row?.courseId || ""))
      .filter(Boolean),
  );

  const [lastRows, unreadRows, messageCourseRows] = await Promise.all([
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$courseId",
          lastMessage: { $first: "$body" },
          lastMessageAt: { $first: "$createdAt" },
          lastSenderRole: { $first: "$senderRole" },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
          senderRole: "teacher",
          readByStudent: false,
        },
      },
      {
        $group: {
          _id: "$courseId",
          unreadCount: { $sum: 1 },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
        },
      },
      {
        $group: {
          _id: "$courseId",
        },
      },
    ]),
  ]);

  const messageCourseIds = (Array.isArray(messageCourseRows) ? messageCourseRows : [])
    .map((row) => String(row?._id || ""))
    .filter(Boolean);
  const allCourseIds = [...new Set([...Array.from(enrolledCourseIdSet), ...messageCourseIds])];

  if (!allCourseIds.length) {
    return res.json(
      new ApiResponse({
        message: "Student class group conversations fetched successfully",
        data: {
          conversations: [],
          stats: {
            totalConversations: 0,
            unreadConversations: 0,
            totalUnreadMessages: 0,
          },
        },
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      }),
    );
  }

  const courses = await Course.find({
    _id: { $in: allCourseIds.map((id) => toObjectId(id)) },
  })
    .select("_id title teacher teacherId createdBy allowStudentGroupMessages")
    .populate("teacher", "_id name email avatar status communicationSettings.allowStudentDirectMessages")
    .populate("teacherId", "_id name email avatar status communicationSettings.allowStudentDirectMessages")
    .populate("createdBy", "_id name email avatar status communicationSettings.allowStudentDirectMessages");

  const courseMap = new Map(
    (Array.isArray(courses) ? courses : []).map((course) => [String(course?._id || ""), course]),
  );

  const teacherIds = new Set();
  courseMap.forEach((course) => {
    const teacherId = resolveTeacherIdFromCourse(course);
    if (teacherId) teacherIds.add(teacherId);
  });

  const teacherSettingsRows = teacherIds.size
    ? await User.find({
        _id: { $in: Array.from(teacherIds).map((id) => toObjectId(id)) },
      }).select("_id communicationSettings.allowStudentDirectMessages")
    : [];
  const teacherSettingsMap = new Map(
    (Array.isArray(teacherSettingsRows) ? teacherSettingsRows : []).map((row) => [
      String(row._id),
      mapTeacherMessageSetting(row),
    ]),
  );

  const lastByCourse = new Map(
    (Array.isArray(lastRows) ? lastRows : []).map((row) => [String(row._id), row]),
  );
  const unreadByCourse = new Map(
    (Array.isArray(unreadRows) ? unreadRows : []).map((row) => [String(row._id), Number(row.unreadCount || 0)]),
  );

  let conversations = allCourseIds
    .map((courseId) => {
      const course = courseMap.get(courseId);
      if (!course) return null;

      const resolvedTeacherId = resolveTeacherIdFromCourse(course);
      const teacherProfile =
        (course?.teacher && typeof course.teacher === "object" && String(course.teacher?._id || "").trim()
          ? course.teacher
          : null) ||
        (course?.teacherId && typeof course.teacherId === "object" && String(course.teacherId?._id || "").trim()
          ? course.teacherId
          : null) ||
        (course?.createdBy && typeof course.createdBy === "object" && String(course.createdBy?._id || "").trim()
          ? course.createdBy
          : null);

      const allowByCourse = isCourseStudentMessagingEnabled(course);
      const allowByTeacher =
        teacherSettingsMap.get(resolvedTeacherId)?.allowStudentDirectMessages !== false;
      const hasActiveEnrollment = enrolledCourseIdSet.has(courseId);
      const canSendMessages = allowByTeacher && allowByCourse && hasActiveEnrollment;

      const last = lastByCourse.get(courseId) || {};
      const unreadCount = unreadByCourse.get(courseId) || 0;

      return {
        courseId,
        courseTitle: String(course?.title || "Course").trim() || "Course",
        teacherId: resolvedTeacherId,
        teacherName: teacherProfile?.name || "Teacher",
        teacherAvatar: teacherProfile?.avatar || "",
        allowStudentGroupMessages: allowByCourse,
        allowStudentMessagesEffective: allowByTeacher && allowByCourse,
        canSendMessages,
        unreadCount,
        lastMessage: String(last?.lastMessage || "").trim(),
        lastMessageAt: last?.lastMessageAt || course?.updatedAt || course?.createdAt || null,
        lastSenderRole: String(last?.lastSenderRole || ""),
      };
    })
    .filter(Boolean);

  if (search) {
    conversations = conversations.filter((row) =>
      String(row.courseTitle || "").toLowerCase().includes(search) ||
      String(row.teacherName || "").toLowerCase().includes(search) ||
      String(row.lastMessage || "").toLowerCase().includes(search),
    );
  }

  if (unreadOnly) {
    conversations = conversations.filter((row) => row.unreadCount > 0);
  }

  conversations.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

  const total = conversations.length;
  const pagedConversations = conversations.slice((page - 1) * limit, page * limit);

  return res.json(
    new ApiResponse({
      message: "Student class group conversations fetched successfully",
      data: {
        conversations: pagedConversations,
        stats: buildConversationStats(conversations),
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

export const getStudentCourseGroupMessages = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();

  const [course, enrollment] = await Promise.all([
    Course.findById(courseId)
      .select("_id title teacher teacherId createdBy allowStudentGroupMessages")
      .populate("teacher", "_id name email avatar status communicationSettings.allowStudentDirectMessages")
      .populate("teacherId", "_id name email avatar status communicationSettings.allowStudentDirectMessages")
      .populate("createdBy", "_id name email avatar status communicationSettings.allowStudentDirectMessages"),
    Enrollment.findOne({
      studentId,
      courseId,
      ...ELIGIBLE_ENROLLMENT_FILTER,
    }).select("_id enrollmentStatus accessStatus accessExpiresAt status"),
  ]);

  if (!course || !hasAllowedEnrollmentAccess(enrollment)) {
    throw new ApiError(403, "You can only access class chats for your enrolled courses");
  }

  const resolvedTeacherId = resolveTeacherIdFromCourse(course);
  const teacher = resolvedTeacherId
    ? await User.findById(resolvedTeacherId).select("_id communicationSettings.allowStudentDirectMessages")
    : null;

  await DirectMessage.updateMany(
    {
      studentId,
      courseId,
      senderRole: "teacher",
      readByStudent: false,
    },
    {
      $set: { readByStudent: true },
    },
  );

  const rows = await DirectMessage.find({
    studentId,
    courseId,
  })
    .populate("senderId", "name avatar role")
    .populate("courseId", "title")
    .sort({ createdAt: 1 });

  const groupedTeacherMap = new Map();
  const messages = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const senderRole = String(row?.senderRole || "");
    const sender = row?.senderId && typeof row.senderId === "object" ? row.senderId : null;

    if (senderRole === "teacher") {
      const groupId = String(row?.broadcastGroupId || "").trim();
      if (groupId) {
        if (groupedTeacherMap.has(groupId)) {
          const target = groupedTeacherMap.get(groupId);
          target.sentCount += 1;
          return;
        }
      }

      const entry = {
        id: `${groupId ? `group:${groupId}` : `msg:${String(row?._id || "")}`}`,
        courseId,
        courseTitle: String(course?.title || "Course").trim() || "Course",
        senderRole: "teacher",
        senderName: sender?.name || "Teacher",
        senderAvatar: sender?.avatar || "",
        body: String(row?.body || "").trim(),
        createdAt: row?.createdAt || null,
        sentCount: 1,
      };
      messages.push(entry);
      if (groupId) {
        groupedTeacherMap.set(groupId, entry);
      }
      return;
    }

    messages.push({
      id: `msg:${String(row?._id || "")}`,
      courseId,
      courseTitle: String(course?.title || "Course").trim() || "Course",
      senderRole: "student",
      senderName: sender?.name || "Student",
      senderAvatar: sender?.avatar || "",
      body: String(row?.body || "").trim(),
      createdAt: row?.createdAt || null,
      sentCount: 1,
    });
  });

  const allowByTeacher = isTeacherStudentMessagingEnabled(teacher);
  const allowByCourse = isCourseStudentMessagingEnabled(course);

  return res.json(
    new ApiResponse({
      message: "Student class group messages fetched successfully",
      data: {
        course: {
          id: String(course?._id || courseId),
          title: String(course?.title || "Course").trim() || "Course",
          allowStudentGroupMessages: allowByCourse,
          allowStudentMessagesEffective: allowByTeacher && allowByCourse,
          canSendMessages: Boolean(enrollment) && allowByTeacher && allowByCourse,
        },
        messages,
      },
    }),
  );
});

export const sendStudentCourseGroupMessage = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();
  const body = String(req.body?.body || "").trim();

  await getStudentActiveEnrollmentByCourse(studentId, courseId);

  const course = await Course.findById(courseId)
    .select("_id title teacher teacherId createdBy allowStudentGroupMessages")
    .populate("teacher", "_id communicationSettings.allowStudentDirectMessages")
    .populate("teacherId", "_id communicationSettings.allowStudentDirectMessages")
    .populate("createdBy", "_id communicationSettings.allowStudentDirectMessages");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const resolvedTeacherId = resolveTeacherIdFromCourse(course);
  if (!resolvedTeacherId) {
    throw new ApiError(400, "Course teacher could not be resolved");
  }

  const teacher = await User.findById(resolvedTeacherId).select("communicationSettings.allowStudentDirectMessages");
  if (!isTeacherStudentMessagingEnabled(teacher)) {
    throw new ApiError(403, "Teacher has disabled student direct messages for now");
  }
  if (!isCourseStudentMessagingEnabled(course)) {
    throw new ApiError(403, "Teacher has disabled student messaging for this class");
  }

  const expiresAt = await resolveCourseGroupExpiresAt({
    teacherId: resolvedTeacherId,
    courseId,
  });

  const message = await DirectMessage.create({
    teacherId: resolvedTeacherId,
    studentId,
    courseId,
    senderId: studentId,
    senderRole: "student",
    body,
    readByTeacher: false,
    readByStudent: true,
    broadcastGroupId: "",
    expiresAt,
  });

  const populated = await DirectMessage.findById(message._id)
    .populate("senderId", "name avatar role")
    .populate("courseId", "title");

  return res.status(201).json(
    new ApiResponse({
      message: "Class group message sent successfully",
      data: mapMessageRow(populated, studentId),
    }),
  );
});

export const markStudentCourseGroupAsRead = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();

  const hasAccess = await DirectMessage.exists({ studentId, courseId });
  if (!hasAccess) {
    await getStudentActiveEnrollmentByCourse(studentId, courseId);
  }

  const result = await DirectMessage.updateMany(
    {
      studentId,
      courseId,
      senderRole: "teacher",
      readByStudent: false,
    },
    {
      $set: { readByStudent: true },
    },
  );

  return res.json(
    new ApiResponse({
      message: "Class group conversation marked as read successfully",
      data: {
        updatedCount: Number(result?.modifiedCount || 0),
      },
    }),
  );
});

export const deleteStudentCourseGroupMessages = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const courseId = String(req.params.courseId || "").trim();
  const payload = req.body || {};

  const hasAccess = await DirectMessage.exists({ studentId, courseId });
  if (!hasAccess) {
    await getStudentActiveEnrollmentByCourse(studentId, courseId);
  }

  let deletedCount = 0;

  if (payload.clearAll) {
    const result = await DirectMessage.deleteMany({
      studentId,
      courseId,
    });
    deletedCount = Number(result?.deletedCount || 0);
  } else {
    const { groupIds, directMessageIds } = parsePrefixedMessageIds(payload.messageIds);
    const deleteFilters = [];

    if (groupIds.length) {
      deleteFilters.push({
        studentId,
        courseId,
        senderRole: "teacher",
        broadcastGroupId: { $in: groupIds },
      });
    }

    if (directMessageIds.length) {
      deleteFilters.push({
        studentId,
        courseId,
        _id: { $in: directMessageIds.map((id) => toObjectId(id)) },
      });
    }

    if (!deleteFilters.length) {
      throw new ApiError(400, "No valid messages were selected for deletion");
    }

    const result = await DirectMessage.deleteMany({
      $or: deleteFilters,
    });
    deletedCount = Number(result?.deletedCount || 0);
  }

  return res.json(
    new ApiResponse({
      message: "Student class group messages deleted successfully",
      data: {
        courseId,
        deletedCount,
      },
    }),
  );
});

export const getStudentMessageConversations = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const unreadOnly = req.query.unreadOnly === true || req.query.unreadOnly === "true";
  const search = String(req.query.search || "").trim().toLowerCase();

  const enrollments = await Enrollment.find({
    studentId,
    ...ELIGIBLE_ENROLLMENT_FILTER,
  }).populate({
    path: "courseId",
    select: "title teacher teacherId createdBy",
    populate: [
      { path: "teacher", select: "name email avatar status" },
      { path: "teacherId", select: "name email avatar status" },
      { path: "createdBy", select: "name email avatar status" },
    ],
  });

  const teacherMap = new Map();
  for (const row of Array.isArray(enrollments) ? enrollments : []) {
    if (!hasAllowedEnrollmentAccess(row)) continue;
    const course = row?.courseId;
    if (!course || typeof course !== "object") continue;

    const resolvedTeacherId = resolveTeacherIdFromCourse(course);
    if (!resolvedTeacherId) continue;

    const teacherProfile =
      (course?.teacher && typeof course.teacher === "object" && String(course.teacher?._id || "").trim()
        ? course.teacher
        : null) ||
      (course?.teacherId && typeof course.teacherId === "object" && String(course.teacherId?._id || "").trim()
        ? course.teacherId
        : null) ||
      (course?.createdBy && typeof course.createdBy === "object" && String(course.createdBy?._id || "").trim()
        ? course.createdBy
        : null);

    const courseId = normalizeId(course?._id || row?.courseId || "");
    const courseTitle = String(course?.title || "").trim();

    if (!teacherMap.has(resolvedTeacherId)) {
      teacherMap.set(resolvedTeacherId, {
        teacherId: resolvedTeacherId,
        name: teacherProfile?.name || "Teacher",
        email: teacherProfile?.email || "",
        avatar: teacherProfile?.avatar || "",
        status: teacherProfile?.status || "active",
        courseMap: new Map(),
        lastEnrollmentAt: row?.updatedAt || row?.createdAt || null,
      });
    }

    const target = teacherMap.get(resolvedTeacherId);
    if (courseId && courseTitle) {
      target.courseMap.set(courseId, courseTitle);
    }

    const rowTime = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
    const targetTime = new Date(target.lastEnrollmentAt || 0).getTime();
    if (rowTime > targetTime) {
      target.lastEnrollmentAt = row?.updatedAt || row?.createdAt || target.lastEnrollmentAt;
    }
  }

  const [lastRows, unreadRows, courseRows] = await Promise.all([
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$teacherId",
          lastMessage: { $first: "$body" },
          lastMessageAt: { $first: "$createdAt" },
          lastSenderRole: { $first: "$senderRole" },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
          senderRole: "teacher",
          readByStudent: false,
        },
      },
      {
        $group: {
          _id: "$teacherId",
          unreadCount: { $sum: 1 },
        },
      },
    ]),
    DirectMessage.aggregate([
      {
        $match: {
          studentId: toObjectId(studentId),
        },
      },
      {
        $group: {
          _id: {
            teacherId: "$teacherId",
            courseId: "$courseId",
          },
          lastMessageAt: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const messageTeacherIds = new Set(
    (Array.isArray(lastRows) ? lastRows : []).map((row) => String(row._id || "")).filter(Boolean),
  );
  (Array.isArray(unreadRows) ? unreadRows : []).forEach((row) => {
    const id = String(row?._id || "");
    if (id) messageTeacherIds.add(id);
  });
  (Array.isArray(courseRows) ? courseRows : []).forEach((row) => {
    const id = String(row?._id?.teacherId || "");
    if (id) messageTeacherIds.add(id);
  });

  const missingTeacherIds = Array.from(messageTeacherIds).filter((id) => !teacherMap.has(id));
  if (missingTeacherIds.length) {
    const missingTeachers = await User.find({
      _id: { $in: missingTeacherIds.map((id) => toObjectId(id)) },
    }).select("_id name email avatar status");

    (Array.isArray(missingTeachers) ? missingTeachers : []).forEach((teacher) => {
      const teacherId = String(teacher?._id || "");
      if (!teacherId || teacherMap.has(teacherId)) return;

      teacherMap.set(teacherId, {
        teacherId,
        name: teacher?.name || "Teacher",
        email: teacher?.email || "",
        avatar: teacher?.avatar || "",
        status: teacher?.status || "active",
        courseMap: new Map(),
        lastEnrollmentAt: null,
      });
    });

  }

  const courseIdsFromEnrollments = Array.from(teacherMap.values()).flatMap((row) => Array.from(row.courseMap.keys()));
  const courseIdsFromMessages = (Array.isArray(courseRows) ? courseRows : [])
    .map((row) => String(row?._id?.courseId || ""))
    .filter(Boolean);
  const allCourseIds = [...new Set([...courseIdsFromEnrollments, ...courseIdsFromMessages])];

  const courseTitleMap = new Map();
  if (allCourseIds.length) {
    const courses = await Course.find({
      _id: { $in: allCourseIds.map((id) => toObjectId(id)) },
    }).select("_id title");

    (Array.isArray(courses) ? courses : []).forEach((course) => {
      const id = String(course?._id || "");
      if (!id) return;
      courseTitleMap.set(id, String(course?.title || "").trim());
    });
  }

  (Array.isArray(courseRows) ? courseRows : []).forEach((row) => {
    const teacherId = String(row?._id?.teacherId || "");
    const courseId = String(row?._id?.courseId || "");
    if (!teacherId || !courseId) return;

    if (!teacherMap.has(teacherId)) return;

    const target = teacherMap.get(teacherId);
    const title = courseTitleMap.get(courseId) || target.courseMap.get(courseId) || "Course";
    target.courseMap.set(courseId, title);

    const rowTime = new Date(row?.lastMessageAt || 0).getTime();
    const targetTime = new Date(target.lastEnrollmentAt || 0).getTime();
    if (rowTime > targetTime) {
      target.lastEnrollmentAt = row?.lastMessageAt || target.lastEnrollmentAt;
    }
  });

  const teacherIds = Array.from(teacherMap.keys());
  const teacherObjectIds = teacherIds.map((id) => toObjectId(id));
  const teacherSettingsRows = teacherObjectIds.length
    ? await User.find({
        _id: { $in: teacherObjectIds },
      }).select("_id communicationSettings.allowStudentDirectMessages")
    : [];
  const teacherSettingsMap = new Map(
    (Array.isArray(teacherSettingsRows) ? teacherSettingsRows : []).map((row) => [
      String(row._id),
      mapTeacherMessageSetting(row),
    ]),
  );

  const lastByTeacher = new Map(
    (Array.isArray(lastRows) ? lastRows : []).map((row) => [String(row._id), row]),
  );
  const unreadByTeacher = new Map(
    (Array.isArray(unreadRows) ? unreadRows : []).map((row) => [String(row._id), Number(row.unreadCount || 0)]),
  );

  let conversations = teacherIds.map((teacherId) => {
    const base = teacherMap.get(teacherId);
    const last = lastByTeacher.get(teacherId) || {};
    const unreadCount = unreadByTeacher.get(teacherId) || 0;

    return {
      teacherId: base.teacherId,
      name: base.name,
      email: base.email,
      avatar: base.avatar,
      status: base.status,
      allowStudentDirectMessages:
        teacherSettingsMap.get(teacherId)?.allowStudentDirectMessages !== false,
      unreadCount,
      lastMessage: String(last?.lastMessage || "").trim(),
      lastMessageAt: last?.lastMessageAt || base.lastEnrollmentAt || null,
      lastSenderRole: last?.lastSenderRole || "",
      courses: Array.from(base.courseMap.entries()).map(([id, title]) => ({ id, title })),
    };
  });

  if (search) {
    conversations = conversations.filter((row) => {
      const courseText = row.courses.map((course) => course.title).join(" ").toLowerCase();
      return (
        String(row.name || "").toLowerCase().includes(search) ||
        String(row.email || "").toLowerCase().includes(search) ||
        String(row.lastMessage || "").toLowerCase().includes(search) ||
        courseText.includes(search)
      );
    });
  }

  if (unreadOnly) {
    conversations = conversations.filter((row) => row.unreadCount > 0);
  }

  sortConversations(conversations);

  const total = conversations.length;
  const pagedConversations = conversations.slice((page - 1) * limit, page * limit);

  return res.json(
    new ApiResponse({
      message: "Student message conversations fetched successfully",
      data: {
        conversations: pagedConversations,
        stats: buildConversationStats(conversations),
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

export const getStudentConversationMessages = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const teacherId = req.params.teacherId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const before = req.query.before ? new Date(req.query.before) : null;

  await assertStudentCanAccessTeacherConversation(studentId, teacherId);

  const filter = {
    studentId,
    teacherId,
  };
  if (before && !Number.isNaN(before.getTime())) {
    filter.createdAt = { $lt: before };
  }

  const [messages, total, teacher] = await Promise.all([
    DirectMessage.find(filter)
      .populate("senderId", "name avatar role")
      .populate("courseId", "title")
      .sort({ createdAt: -1 })
      .skip(before && !Number.isNaN(before.getTime()) ? 0 : (page - 1) * limit)
      .limit(limit),
    DirectMessage.countDocuments(filter),
    User.findById(teacherId).select("_id name email avatar role communicationSettings.allowStudentDirectMessages"),
  ]);

  const normalizedRows = (Array.isArray(messages) ? messages : [])
    .map((row) => mapMessageRow(row, studentId))
    .reverse();

  return res.json(
    new ApiResponse({
      message: "Student conversation messages fetched successfully",
      data: {
        teacher: teacher
          ? {
              id: String(teacher._id),
              name: teacher.name || "Teacher",
              email: teacher.email || "",
              avatar: teacher.avatar || "",
              allowStudentDirectMessages: isTeacherStudentMessagingEnabled(teacher),
            }
          : null,
        messages: normalizedRows,
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

export const sendStudentConversationMessage = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const teacherId = req.params.teacherId;
  const payload = req.body || {};
  const body = String(payload.body || "").trim();

  const teacher = await User.findById(teacherId).select("name communicationSettings.allowStudentDirectMessages");
  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }
  if (!isTeacherStudentMessagingEnabled(teacher)) {
    throw new ApiError(403, "Teacher has disabled student direct messages for now");
  }

  const { courseId } = await assertStudentCanMessageTeacher(studentId, teacherId, payload.courseId || "");

  const message = await DirectMessage.create({
    teacherId,
    studentId,
    courseId,
    senderId: studentId,
    senderRole: "student",
    body,
    readByTeacher: false,
    readByStudent: true,
  });

  const populated = await DirectMessage.findById(message._id)
    .populate("senderId", "name avatar role")
    .populate("courseId", "title");
  return res.status(201).json(
    new ApiResponse({
      message: "Message sent successfully",
      data: mapMessageRow(populated, studentId),
    }),
  );
});

export const markStudentConversationAsRead = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const teacherId = req.params.teacherId;

  await assertStudentCanAccessTeacherConversation(studentId, teacherId);

  const result = await DirectMessage.updateMany(
    {
      studentId,
      teacherId,
      senderRole: "teacher",
      readByStudent: false,
    },
    {
      $set: { readByStudent: true },
    },
  );

  return res.json(
    new ApiResponse({
      message: "Conversation marked as read successfully",
      data: {
        updatedCount: Number(result?.modifiedCount || 0),
      },
    }),
  );
});
