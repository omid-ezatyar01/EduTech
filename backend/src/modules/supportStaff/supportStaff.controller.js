import User from "../../models/User.js";
import SupportTicket from "../../models/SupportTicket.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import SupportTeamMessage from "./SupportTeamMessage.js";
import SupportStaffProfile from "./SupportStaffProfile.js";
import {
  normalizeSupportSpecialization,
  SPECIALIZATION_CATEGORIES,
} from "./supportStaff.constants.js";
import {
  disconnectSupportUser,
  emitSupportTeamMessage,
  getSupportPresenceSnapshot,
} from "../../services/supportRealtime.service.js";
import { notifySupportTeamChatMessage } from "../../services/webPush.service.js";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mapStaff = (user, profile = null) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  status: user.status,
  role: user.role,
  specialization: normalizeSupportSpecialization(profile?.specialization),
  preferredCategories:
    SPECIALIZATION_CATEGORIES[
      normalizeSupportSpecialization(profile?.specialization)
    ],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const mapTeamMessage = (message) => ({
  id: String(message._id),
  conversationType: message.conversationType,
  channel: message.channel || null,
  sender: message.sender
    ? {
        id: String(message.sender._id),
        name: message.sender.role === "admin" ? "Admin" : message.sender.name,
        email: message.sender.role === "admin" ? "" : message.sender.email,
        avatar:
          message.sender.role === "admin" ? "" : message.sender.avatar || "",
        role: message.sender.role || "",
      }
    : null,
  recipient: message.recipient
    ? {
        id: String(message.recipient._id),
        name:
          message.recipient.role === "admin"
            ? "Admin"
            : message.recipient.name,
        email:
          message.recipient.role === "admin" ? "" : message.recipient.email,
        avatar:
          message.recipient.role === "admin"
            ? ""
            : message.recipient.avatar || "",
        role: message.recipient.role || "",
      }
    : null,
  body: message.body,
  editedAt: message.editedAt || null,
  readBy: (message.readBy || []).map(String),
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const teamMessagePopulation = (query) =>
  query
    .populate("sender", "name email avatar role")
    .populate("recipient", "name email avatar role");

export const listSupportStaff = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query || {};
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const filter = { role: "support" };
  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.specialization && query.specialization !== "all") {
    if (query.specialization === "general") {
      const specializedProfiles = await SupportStaffProfile.find({
        specialization: { $ne: "general" },
      }).select("user");
      filter._id = {
        $nin: specializedProfiles.map((profile) => profile.user),
      };
    } else {
      const matchingProfiles = await SupportStaffProfile.find({
        specialization: query.specialization,
      }).select("user");
      filter._id = {
        $in: matchingProfiles.map((profile) => profile.user),
      };
    }
  }
  if (query.search) {
    const search = escapeRegex(query.search);
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const [staff, total] = await Promise.all([
    User.find(filter)
      .select("name email phone role status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  const staffIds = staff.map((row) => row._id);
  const profiles = staffIds.length
    ? await SupportStaffProfile.find({ user: { $in: staffIds } }).lean()
    : [];
  const profileByUser = new Map(
    profiles.map((profile) => [String(profile.user), profile]),
  );
  const workloadRows = staffIds.length
    ? await SupportTicket.aggregate([
        {
          $match: {
            assignedTo: { $in: staffIds },
            status: { $nin: ["resolved", "closed"] },
          },
        },
        {
          $group: {
            _id: "$assignedTo",
            activeTickets: { $sum: 1 },
          },
        },
      ])
    : [];
  const workload = new Map(
    workloadRows.map((row) => [String(row._id), row]),
  );

  return res.json(
    new ApiResponse({
      message: "Support staff fetched",
      data: {
        staff: staff.map((row) => ({
          ...mapStaff(row, profileByUser.get(String(row._id))),
          activeTickets:
            Number(workload.get(String(row._id))?.activeTickets) || 0,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    }),
  );
});

export const createSupportStaff = asyncHandler(async (req, res) => {
  const payload = req.validated?.body || req.body;
  const existing = await User.exists({ email: payload.email });
  if (existing) throw new ApiError(409, "An account already exists with this email");

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    role: "support",
    status: "active",
    isEmailVerified: true,
  });
  let profile;
  try {
    profile = await SupportStaffProfile.create({
      user: user._id,
      specialization: payload.specialization,
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id }).catch(() => null);
    throw error;
  }

  return res.status(201).json(
    new ApiResponse({
      message: "Support staff account created",
      data: { staff: mapStaff(user, profile) },
    }),
  );
});

export const updateSupportStaff = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.staffId, role: "support" });
  if (!user) throw new ApiError(404, "Support staff account not found");
  const payload = req.validated?.body || req.body;
  let profile = await SupportStaffProfile.findOne({ user: user._id });

  if (payload.name !== undefined) user.name = payload.name;
  if (payload.phone !== undefined) user.phone = payload.phone;
  if (payload.status !== undefined && payload.status !== user.status) {
    user.status = payload.status;
    if (payload.status === "blocked") {
      user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    }
  }
  await user.save();
  if (payload.specialization !== undefined) {
    profile = await SupportStaffProfile.findOneAndUpdate(
      { user: user._id },
      { $set: { specialization: payload.specialization } },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );
  }
  if (payload.status === "blocked") disconnectSupportUser(user._id);

  return res.json(
    new ApiResponse({
      message: "Support staff account updated",
      data: { staff: mapStaff(user, profile) },
    }),
  );
});

export const resetSupportStaffPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.staffId, role: "support" });
  if (!user) throw new ApiError(404, "Support staff account not found");

  user.password = (req.validated?.body || req.body).password;
  user.passwordChangedAt = new Date();
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  disconnectSupportUser(user._id);

  const profile = await SupportStaffProfile.findOne({ user: user._id });
  return res.json(
    new ApiResponse({
      message: "Support staff password reset; existing sessions were revoked",
      data: { staff: mapStaff(user, profile) },
    }),
  );
});

export const getSupportTeamDirectory = asyncHandler(async (req, res) => {
  const memberFilter =
    req.user.role === "admin"
      ? { role: "support", status: "active" }
      : {
          role: { $in: ["support", "admin"] },
          status: "active",
        };
  const members = await User.find(memberFilter)
    .select("name email phone avatar role createdAt")
    .sort({ name: 1 });
  const memberIds = members.map((member) => member._id);
  const profiles = memberIds.length
    ? await SupportStaffProfile.find({ user: { $in: memberIds } }).lean()
    : [];
  const profileByUser = new Map(
    profiles.map((profile) => [String(profile.user), profile]),
  );
  const [workloads, directUnread, generalUnread] = await Promise.all([
    memberIds.length
      ? SupportTicket.aggregate([
          {
            $match: {
              assignedTo: { $in: memberIds },
              status: { $nin: ["resolved", "closed"] },
            },
          },
          {
            $group: {
              _id: "$assignedTo",
              activeTickets: { $sum: 1 },
            },
          },
        ])
      : [],
    SupportTeamMessage.aggregate([
      {
        $match: {
          conversationType: "direct",
          recipient: req.user._id,
          readBy: { $ne: req.user._id },
        },
      },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]),
    SupportTeamMessage.countDocuments({
      conversationType: "channel",
      channel: "general",
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
      createdAt: { $gte: req.user.createdAt },
    }),
  ]);
  const workloadById = new Map(
    workloads.map((row) => [String(row._id), row]),
  );
  const unreadById = new Map(
    directUnread.map((row) => [String(row._id), Number(row.count) || 0]),
  );
  const presence = getSupportPresenceSnapshot();
  const onlineIds = new Set(presence.onlineIds);

  return res.json(
    new ApiResponse({
      message: "Support team directory fetched",
      data: {
        members: members.map((member) => ({
          id: String(member._id),
          name: member.role === "admin" ? "Admin" : member.name,
          email: member.role === "admin" ? "" : member.email,
          phone: member.phone,
          avatar: member.avatar || "",
          role: member.role,
          specialization:
            member.role === "admin"
              ? "team_lead"
              : normalizeSupportSpecialization(
                  profileByUser.get(String(member._id))?.specialization,
                ),
          preferredCategories:
            member.role === "admin"
              ? []
              : SPECIALIZATION_CATEGORIES[
                  normalizeSupportSpecialization(
                    profileByUser.get(String(member._id))?.specialization,
                  )
                ],
          online: onlineIds.has(String(member._id)),
          lastSeenAt:
            presence.lastSeenById[String(member._id)] || null,
          activeTickets:
            Number(workloadById.get(String(member._id))?.activeTickets) || 0,
          unreadMessages: unreadById.get(String(member._id)) || 0,
        })),
        generalUnread: Number(generalUnread) || 0,
      },
    }),
  );
});

const conversationFilter = (userId, conversationId) => {
  if (conversationId === "general") {
    return { conversationType: "channel", channel: "general" };
  }
  return {
    conversationType: "direct",
    $or: [
      { sender: userId, recipient: conversationId },
      { sender: conversationId, recipient: userId },
    ],
  };
};

export const canDeleteSupportTeamMessage = (user = {}, message = {}) => {
  const isOwn = String(message.sender?._id || message.sender || "") ===
    String(user._id || user.id || "");
  const isAdminGeneral =
    user.role === "admin" &&
    message.conversationType === "channel" &&
    message.channel === "general";
  return isOwn || isAdminGeneral;
};

export const getSupportTeamMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  if (conversationId !== "general") {
    const member = await User.exists({
      _id: conversationId,
      role: { $in: ["support", "admin"] },
      status: "active",
    });
    if (!member) throw new ApiError(404, "Support team member not found");
  }
  const query = req.validated?.query || req.query || {};
  const filter = conversationFilter(req.user._id, conversationId);
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };
  const messages = await teamMessagePopulation(
    SupportTeamMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(query.limit) || 100),
  );

  return res.json(
    new ApiResponse({
      message: "Team messages fetched",
      data: { messages: messages.reverse().map(mapTeamMessage) },
    }),
  );
});

export const sendSupportTeamMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  let recipient = null;
  if (conversationId !== "general") {
    if (String(req.user._id) === conversationId) {
      throw new ApiError(400, "Choose another team member");
    }
    recipient = await User.findOne({
      _id: conversationId,
      role: { $in: ["support", "admin"] },
      status: "active",
    }).select("_id");
    if (!recipient) throw new ApiError(404, "Support team member not found");
  }

  let message = await SupportTeamMessage.create({
    conversationType: recipient ? "direct" : "channel",
    channel: recipient ? undefined : "general",
    sender: req.user._id,
    recipient: recipient?._id || null,
    body: (req.validated?.body || req.body).body,
    readBy: [req.user._id],
  });
  message = await teamMessagePopulation(
    SupportTeamMessage.findById(message._id),
  );
  const data = { message: mapTeamMessage(message) };
  emitSupportTeamMessage({
    recipientId: recipient ? String(recipient._id) : "",
    data,
  });
  notifySupportTeamChatMessage({
    senderId: req.user._id,
    senderName: req.user.role === "admin" ? "Admin" : req.user.name,
    recipientId: recipient ? recipient._id : "",
    body: data.message.body,
  }).catch((error) => {
    console.warn(`Failed to send support team push notification: ${error.message}`);
  });

  return res.status(201).json(
    new ApiResponse({ message: "Team message sent", data }),
  );
});

export const updateSupportTeamMessage = asyncHandler(async (req, res) => {
  const message = await SupportTeamMessage.findById(req.params.messageId);
  if (!message) throw new ApiError(404, "Team message not found");
  if (String(message.sender) !== String(req.user._id)) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  message.body = (req.validated?.body || req.body).body;
  message.editedAt = new Date();
  await message.save();
  const populated = await teamMessagePopulation(
    SupportTeamMessage.findById(message._id),
  );
  const data = { message: mapTeamMessage(populated) };
  emitSupportTeamMessage({
    recipientId:
      message.conversationType === "direct" ? String(message.recipient) : "",
    event: "support:team-message-updated",
    data,
  });
  return res.json(new ApiResponse({ message: "Team message updated", data }));
});

export const deleteSupportTeamMessage = asyncHandler(async (req, res) => {
  const message = await SupportTeamMessage.findById(req.params.messageId);
  if (!message) throw new ApiError(404, "Team message not found");
  if (!canDeleteSupportTeamMessage(req.user, message)) {
    throw new ApiError(403, "You cannot delete this team message");
  }

  const data = {
    messageId: String(message._id),
    conversationType: message.conversationType,
    channel: message.channel || null,
    senderId: String(message.sender),
    recipientId: message.recipient ? String(message.recipient) : "",
  };
  await message.deleteOne();
  emitSupportTeamMessage({
    recipientId:
      message.conversationType === "direct" ? String(message.recipient) : "",
    event: "support:team-message-deleted",
    data,
  });
  return res.json(new ApiResponse({ message: "Team message deleted", data }));
});

export const deleteGeneralSupportTeamMessages = asyncHandler(async (req, res) => {
  const payload = req.validated?.body || req.body || {};
  const filter = {
    conversationType: "channel",
    channel: "general",
  };
  if (!payload.all) filter._id = { $in: payload.messageIds };
  const result = await SupportTeamMessage.deleteMany(filter);
  const data = {
    all: Boolean(payload.all),
    messageIds: payload.all ? [] : payload.messageIds.map(String),
    deletedCount: Number(result.deletedCount || 0),
  };
  emitSupportTeamMessage({
    event: "support:team-general-cleared",
    data,
  });
  return res.json(
    new ApiResponse({ message: "General team messages deleted", data }),
  );
});

export const markSupportTeamConversationRead = asyncHandler(async (req, res) => {
  const filter = conversationFilter(req.user._id, req.params.conversationId);
  if (req.params.conversationId === "general") {
    filter.createdAt = { $gte: req.user.createdAt };
  }
  filter.sender = { $ne: req.user._id };
  filter.readBy = { $ne: req.user._id };
  await SupportTeamMessage.updateMany(filter, {
    $addToSet: { readBy: req.user._id },
  });
  return res.json(
    new ApiResponse({ message: "Team conversation marked as read" }),
  );
});
