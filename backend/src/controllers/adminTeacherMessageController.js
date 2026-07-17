import mongoose from "mongoose";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import AdminTeacherMessage from "../models/AdminTeacherMessage.js";
import User from "../models/User.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const mapMessageRow = (row) => {
  const sender = row?.senderId && typeof row.senderId === "object" ? row.senderId : null;
  return {
    id: String(row?._id || ""),
    teacherId: String(row?.teacherId || ""),
    senderRole: String(row?.senderRole || ""),
    senderName:
      sender?.name ||
      (row?.senderRole === "admin" ? "EduTech Admin" : row?.senderRole === "teacher" ? "Teacher" : "User"),
    senderAvatar: sender?.avatar || "",
    body: String(row?.body || "").trim(),
    createdAt: row?.createdAt || null,
    readByAdmin: Boolean(row?.readByAdmin),
    readByTeacher: Boolean(row?.readByTeacher),
  };
};

const findTeacherOrThrow = async (teacherId) => {
  const teacher = await User.findOne({
    _id: teacherId,
    role: "teacher",
  }).select("_id name email avatar status teacherApplication");

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};

const buildConversationStats = (conversations = []) =>
  (Array.isArray(conversations) ? conversations : []).reduce(
    (acc, row) => {
      acc.totalConversations += 1;
      acc.unreadMessages += Number(row?.unreadCount || 0);
      acc.adminSentMessages += Number(row?.adminSentCount || 0);
      acc.teacherSentMessages += Number(row?.teacherSentCount || 0);
      if (Number(row?.unreadCount || 0) > 0) {
        acc.unreadConversations += 1;
      }
      return acc;
    },
    {
      totalConversations: 0,
      unreadConversations: 0,
      unreadMessages: 0,
      adminSentMessages: 0,
      teacherSentMessages: 0,
    },
  );

const listAdminTeacherConversations = async ({ search = "", unreadOnly = false } = {}) => {
  const [lastRows, unreadRows, countRows] = await Promise.all([
    AdminTeacherMessage.aggregate([
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
    AdminTeacherMessage.aggregate([
      {
        $match: {
          senderRole: "teacher",
          readByAdmin: false,
        },
      },
      {
        $group: {
          _id: "$teacherId",
          unreadCount: { $sum: 1 },
        },
      },
    ]),
    AdminTeacherMessage.aggregate([
      {
        $group: {
          _id: {
            teacherId: "$teacherId",
            senderRole: "$senderRole",
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const teacherIds = Array.from(
    new Set(
      [...(Array.isArray(lastRows) ? lastRows : []), ...(Array.isArray(unreadRows) ? unreadRows : [])]
        .map((row) => String(row?._id || ""))
        .filter(Boolean),
    ),
  );

  if (!teacherIds.length) {
    return {
      conversations: [],
      stats: buildConversationStats([]),
    };
  }

  const teachers = await User.find({
    _id: { $in: teacherIds.map((id) => toObjectId(id)) },
    role: "teacher",
  }).select("_id name email avatar status teacherApplication");

  const teacherMap = new Map((Array.isArray(teachers) ? teachers : []).map((row) => [String(row?._id || ""), row]));
  const lastMap = new Map((Array.isArray(lastRows) ? lastRows : []).map((row) => [String(row?._id || ""), row]));
  const unreadMap = new Map((Array.isArray(unreadRows) ? unreadRows : []).map((row) => [String(row?._id || ""), Number(row?.unreadCount || 0)]));
  const countMap = new Map();

  (Array.isArray(countRows) ? countRows : []).forEach((row) => {
    const teacherId = String(row?._id?.teacherId || "");
    const senderRole = String(row?._id?.senderRole || "");
    if (!teacherId || !senderRole) return;
    const current = countMap.get(teacherId) || { admin: 0, teacher: 0 };
    current[senderRole] = Number(row?.count || 0);
    countMap.set(teacherId, current);
  });

  let conversations = teacherIds
    .map((teacherId) => {
      const teacher = teacherMap.get(teacherId);
      if (!teacher) return null;
      const last = lastMap.get(teacherId) || {};
      const counts = countMap.get(teacherId) || { admin: 0, teacher: 0 };
      return {
        teacherId,
        name: String(teacher?.name || "Teacher").trim() || "Teacher",
        email: String(teacher?.email || "").trim(),
        avatar: String(teacher?.avatar || "").trim(),
        status: String(teacher?.status || ""),
        applicationStatus: String(teacher?.teacherApplication?.status || ""),
        unreadCount: unreadMap.get(teacherId) || 0,
        lastMessage: String(last?.lastMessage || "").trim(),
        lastMessageAt: last?.lastMessageAt || null,
        lastSenderRole: String(last?.lastSenderRole || ""),
        adminSentCount: Number(counts.admin || 0),
        teacherSentCount: Number(counts.teacher || 0),
      };
    })
    .filter(Boolean);

  if (search) {
    conversations = conversations.filter((row) =>
      String(row?.name || "").toLowerCase().includes(search) ||
      String(row?.email || "").toLowerCase().includes(search) ||
      String(row?.lastMessage || "").toLowerCase().includes(search),
    );
  }

  if (unreadOnly) {
    conversations = conversations.filter((row) => Number(row?.unreadCount || 0) > 0);
  }

  conversations.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

  return {
    conversations,
    stats: buildConversationStats(conversations),
  };
};

export const getAdminTeacherConversations = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";
  const result = await listAdminTeacherConversations({ search, unreadOnly });

  return res.json(
    new ApiResponse({
      message: "Admin teacher conversations fetched successfully",
      data: result,
    }),
  );
});

export const getAdminTeacherConversationMessages = asyncHandler(async (req, res) => {
  const teacherId = String(req.params.teacherId || "").trim();
  const teacher = await findTeacherOrThrow(teacherId);

  const messages = await AdminTeacherMessage.find({ teacherId })
    .populate("senderId", "name avatar role")
    .sort({ createdAt: 1 });

  return res.json(
    new ApiResponse({
      message: "Admin teacher conversation messages fetched successfully",
      data: {
        teacher: {
          id: String(teacher?._id || teacherId),
          name: String(teacher?.name || "Teacher").trim() || "Teacher",
          email: String(teacher?.email || "").trim(),
          avatar: String(teacher?.avatar || "").trim(),
          status: String(teacher?.status || ""),
          applicationStatus: String(teacher?.teacherApplication?.status || ""),
        },
        messages: (Array.isArray(messages) ? messages : []).map(mapMessageRow),
      },
    }),
  );
});

export const sendAdminTeacherMessage = asyncHandler(async (req, res) => {
  const teacherId = String(req.params.teacherId || "").trim();
  const teacher = await findTeacherOrThrow(teacherId);
  const body = String(req.body?.body || "").trim();

  if (String(teacher?.status || "").toLowerCase() === "blocked") {
    throw new ApiError(400, "Cannot send message to a blocked teacher");
  }

  const message = await AdminTeacherMessage.create({
    teacherId,
    senderId: req.user._id,
    senderRole: "admin",
    body,
    readByAdmin: true,
    readByTeacher: false,
  });

  const populated = await AdminTeacherMessage.findById(message._id).populate("senderId", "name avatar role");

  return res.status(201).json(
    new ApiResponse({
      message: "Admin message sent successfully",
      data: mapMessageRow(populated),
    }),
  );
});

export const markAdminTeacherConversationRead = asyncHandler(async (req, res) => {
  const teacherId = String(req.params.teacherId || "").trim();
  await findTeacherOrThrow(teacherId);

  const result = await AdminTeacherMessage.updateMany(
    {
      teacherId,
      senderRole: "teacher",
      readByAdmin: false,
    },
    {
      $set: { readByAdmin: true },
    },
  );

  return res.json(
    new ApiResponse({
      message: "Admin teacher conversation marked as read successfully",
      data: {
        updatedCount: Number(result?.modifiedCount || 0),
      },
    }),
  );
});

export const getTeacherAdminConversation = asyncHandler(async (req, res) => {
  const teacherId = String(req.user?._id || "").trim();

  const messages = await AdminTeacherMessage.find({ teacherId })
    .populate("senderId", "name avatar role")
    .sort({ createdAt: 1 });

  const unreadCount = await AdminTeacherMessage.countDocuments({
    teacherId,
    senderRole: "admin",
    readByTeacher: false,
  });

  const lastMessage = messages[messages.length - 1] || null;

  return res.json(
    new ApiResponse({
      message: "Teacher admin conversation fetched successfully",
      data: {
        conversation: {
          teacherId,
          unreadCount: Number(unreadCount || 0),
          lastMessage: String(lastMessage?.body || "").trim(),
          lastMessageAt: lastMessage?.createdAt || null,
          lastSenderRole: String(lastMessage?.senderRole || ""),
        },
        admin: {
          name: "EduTech Admin",
          email: "support@edutech.study",
        },
        messages: (Array.isArray(messages) ? messages : []).map(mapMessageRow),
      },
    }),
  );
});

export const sendTeacherAdminMessage = asyncHandler(async (req, res) => {
  const teacherId = String(req.user?._id || "").trim();
  const body = String(req.body?.body || "").trim();

  const message = await AdminTeacherMessage.create({
    teacherId,
    senderId: req.user._id,
    senderRole: "teacher",
    body,
    readByAdmin: false,
    readByTeacher: true,
  });

  const populated = await AdminTeacherMessage.findById(message._id).populate("senderId", "name avatar role");

  return res.status(201).json(
    new ApiResponse({
      message: "Teacher message sent to admin successfully",
      data: mapMessageRow(populated),
    }),
  );
});

export const markTeacherAdminConversationRead = asyncHandler(async (req, res) => {
  const teacherId = String(req.user?._id || "").trim();

  const result = await AdminTeacherMessage.updateMany(
    {
      teacherId,
      senderRole: "admin",
      readByTeacher: false,
    },
    {
      $set: { readByTeacher: true },
    },
  );

  return res.json(
    new ApiResponse({
      message: "Teacher admin conversation marked as read successfully",
      data: {
        updatedCount: Number(result?.modifiedCount || 0),
      },
    }),
  );
});
