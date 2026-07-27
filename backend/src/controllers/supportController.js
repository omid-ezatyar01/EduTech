import SupportTicket from "../models/SupportTicket.js";
import SupportMessage from "../models/SupportMessage.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { emitSupportEvent } from "../services/supportRealtime.service.js";
import { notifySupportStaffForTicket } from "../services/webPush.service.js";

const preview = (value) => String(value || "").trim().slice(0, 240);
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ticketNumber = () =>
  `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const isSupportAgent = (user = {}) =>
  ["admin", "support"].includes(String(user?.role || ""));

const mapUser = (user) => {
  if (!user || typeof user !== "object") return null;
  const role = user.role || "";
  const isAdmin = role === "admin";
  return {
    id: String(user._id || ""),
    name: isAdmin ? "Admin" : user.name || "",
    email: isAdmin ? "" : user.email || "",
    avatar: isAdmin ? "" : user.avatar || "",
    role,
  };
};

const mapTicket = (row) => ({
  id: String(row._id),
  ticketNumber: row.ticketNumber,
  requester: mapUser(row.requester),
  requesterRole: row.requesterRole,
  subject: row.subject,
  category: row.category,
  status: row.status,
  assignedTo: mapUser(row.assignedTo),
  claimedAt: row.claimedAt || null,
  lastAssignedAt: row.lastAssignedAt || null,
  handoffCount: Number(row.handoffCount || 0),
  lastMessageAt: row.lastMessageAt,
  lastMessagePreview: row.lastMessagePreview,
  lastSenderRole: row.lastSenderRole,
  unreadForRequester: Number(row.unreadForRequester || 0),
  unreadForSupport: Number(row.unreadForSupport || 0),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapMessage = (row) => ({
  id: String(row._id),
  ticketId: String(row.ticket),
  sender: mapUser(row.sender),
  senderRole: row.senderRole,
  body: row.body,
  editedAt: row.editedAt || null,
  internalNote: Boolean(row.internalNote),
  createdAt: row.createdAt,
});

const populatedTicket = (query) =>
  query.populate("requester", "name email avatar role").populate("assignedTo", "name email avatar role");

export const buildSupportAccessFilter = async (user) => ({
  $or: [{ assignedTo: user._id }, { assignedTo: null }],
});

export const buildAdminSupportTicketFilter = (
  {
    status = "all",
    category = "all",
    requesterRole = "all",
    search = "",
  } = {},
  requesterIds = [],
) => {
  const filter = {};
  if (status === "active") {
    filter.status = { $in: ["open", "in_progress", "waiting_for_user"] };
  } else if (status && status !== "all") {
    filter.status = status;
  }
  if (category && category !== "all") filter.category = category;
  if (requesterRole && requesterRole !== "all") {
    filter.requesterRole = requesterRole;
  }
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { ticketNumber: { $regex: safeSearch, $options: "i" } },
      { subject: { $regex: safeSearch, $options: "i" } },
      { requester: { $in: requesterIds } },
    ];
  }
  return filter;
};

const findAccessibleTicket = async (ticketId, user) => {
  const filter = { _id: ticketId, deletedAt: null };
  if (user.role === "support") {
    Object.assign(filter, await buildSupportAccessFilter(user));
  } else if (!isSupportAgent(user)) {
    filter.requester = user._id;
  }
  const ticket = await populatedTicket(SupportTicket.findOne(filter));
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  return ticket;
};

export const createSupportTicket = asyncHandler(async (req, res) => {
  if (!["student", "teacher"].includes(req.user.role)) {
    throw new ApiError(403, "Only students and teachers can create support tickets");
  }
  const payload = req.validated?.body || req.body;
  let ticket;
  let message;
  try {
    ticket = await SupportTicket.create({
      ticketNumber: ticketNumber(),
      requester: req.user._id,
      requesterRole: req.user.role,
      subject: payload.subject,
      category: payload.category,
      lastMessagePreview: preview(payload.message),
      lastSenderRole: req.user.role,
    });
    message = await SupportMessage.create({
      ticket: ticket._id,
      sender: req.user._id,
      senderRole: req.user.role,
      body: payload.message,
    });
  } catch (error) {
    if (ticket?._id && !message) await SupportTicket.deleteOne({ _id: ticket._id }).catch(() => null);
    throw error;
  }
  ticket = await populatedTicket(SupportTicket.findById(ticket._id));
  message = await SupportMessage.findById(message._id).populate("sender", "name email avatar role");
  const data = { ticket: mapTicket(ticket), message: mapMessage(message) };
  emitSupportEvent({ ticket, event: "support:ticket-created", data });
  notifySupportStaffForTicket({
    ticket,
    message,
    kind: "new_ticket",
  }).catch((error) => {
    console.warn(`Failed to notify support staff about new ticket: ${error.message}`);
  });
  return res.status(201).json(new ApiResponse({ message: "Support ticket created", data }));
});

export const getMySupportTickets = asyncHandler(async (req, res) => {
  const tickets = await populatedTicket(
    SupportTicket.find({
      requester: req.user._id,
      deletedAt: null,
    }).sort({ lastMessageAt: -1 }),
  );
  return res.json(new ApiResponse({
    message: "Support tickets fetched",
    data: {
      tickets: tickets.map(mapTicket),
      unreadCount: tickets.reduce((sum, row) => sum + Number(row.unreadForRequester || 0), 0),
    },
  }));
});

export const getSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const filter = { ticket: ticket._id };
  if (!isSupportAgent(req.user)) filter.internalNote = false;
  const messages = await SupportMessage.find(filter)
    .populate("sender", "name email avatar role")
    .sort({ createdAt: 1 });
  return res.json(new ApiResponse({
    message: "Support conversation fetched",
    data: { ticket: mapTicket(ticket), messages: messages.map(mapMessage) },
  }));
});

export const sendSupportMessage = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const payload = req.validated?.body || req.body;
  const isAgent = isSupportAgent(req.user);
  const assignedUserId = String(ticket.assignedTo?._id || ticket.assignedTo || "");
  if (
    req.user.role === "support" &&
    assignedUserId !== String(req.user._id)
  ) {
    throw new ApiError(
      assignedUserId ? 409 : 403,
      assignedUserId
        ? "This ticket is owned by another support agent"
        : "Claim this ticket before replying",
    );
  }
  if (!isAgent && ["resolved", "closed"].includes(ticket.status)) {
    throw new ApiError(400, "Reopen this ticket before sending another message");
  }
  if (!isAgent && payload.internalNote) throw new ApiError(403, "Internal notes are for support staff");

  let message = await SupportMessage.create({
    ticket: ticket._id,
    sender: req.user._id,
    senderRole: req.user.role,
    body: payload.body,
    internalNote: isAgent && Boolean(payload.internalNote),
  });
  const setUpdates = {};
  const update = { $set: setUpdates };
  if (isAgent && payload.internalNote) {
    // Private notes must not change requester-visible conversation metadata.
  } else if (isAgent) {
    Object.assign(setUpdates, {
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview(payload.body),
      lastSenderRole: req.user.role,
    });
    update.$inc = { unreadForRequester: 1 };
    if (ticket.status === "open") setUpdates.status = "in_progress";
  } else {
    Object.assign(setUpdates, {
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview(payload.body),
      lastSenderRole: req.user.role,
    });
    update.$inc = { unreadForSupport: 1 };
    if (ticket.status === "waiting_for_user") setUpdates.status = "in_progress";
  }
  if (Object.keys(setUpdates).length || update.$inc) {
    await SupportTicket.updateOne({ _id: ticket._id }, update);
  }
  const updatedTicket = await populatedTicket(SupportTicket.findById(ticket._id));
  message = await SupportMessage.findById(message._id).populate("sender", "name email avatar role");
  const data = { ticket: mapTicket(updatedTicket), message: mapMessage(message) };
  emitSupportEvent({
    ticket: updatedTicket,
    event: payload.internalNote ? "support:internal-note" : "support:message",
    data,
    supportOnly: Boolean(payload.internalNote),
  });
  if (!isAgent) {
    notifySupportStaffForTicket({
      ticket: updatedTicket,
      message,
      kind: "new_message",
    }).catch((error) => {
      console.warn(`Failed to notify support staff about ticket reply: ${error.message}`);
    });
  }
  return res.status(201).json(new ApiResponse({ message: "Message sent", data }));
});

const findOwnedSupportMessage = async (ticketId, messageId, user) => {
  const ticket = await findAccessibleTicket(ticketId, user);
  const message = await SupportMessage.findOne({
    _id: messageId,
    ticket: ticket._id,
  });
  if (!message) throw new ApiError(404, "Support message not found");
  if (String(message.sender) !== String(user._id)) {
    throw new ApiError(403, "You can only change your own messages");
  }
  return { ticket, message };
};

const refreshTicketLastMessage = async (ticketId) => {
  const latest = await SupportMessage.findOne({
    ticket: ticketId,
    internalNote: false,
  }).sort({ createdAt: -1 });
  const updates = latest
    ? {
        lastMessageAt: latest.createdAt,
        lastMessagePreview: preview(latest.body),
        lastSenderRole: latest.senderRole,
      }
    : {
        lastMessagePreview: "",
      };
  await SupportTicket.updateOne({ _id: ticketId }, { $set: updates });
};

export const updateSupportMessage = asyncHandler(async (req, res) => {
  const { message } = await findOwnedSupportMessage(
    req.params.ticketId,
    req.params.messageId,
    req.user,
  );
  message.body = (req.validated?.body || req.body).body;
  message.editedAt = new Date();
  await message.save();
  await refreshTicketLastMessage(message.ticket);
  const [ticket, populatedMessage] = await Promise.all([
    populatedTicket(SupportTicket.findById(message.ticket)),
    SupportMessage.findById(message._id).populate(
      "sender",
      "name email avatar role",
    ),
  ]);
  const data = {
    ticket: mapTicket(ticket),
    message: mapMessage(populatedMessage),
  };
  emitSupportEvent({ ticket, event: "support:message-updated", data });
  return res.json(new ApiResponse({ message: "Support message updated", data }));
});

export const deleteSupportMessage = asyncHandler(async (req, res) => {
  const { ticket, message } = await findOwnedSupportMessage(
    req.params.ticketId,
    req.params.messageId,
    req.user,
  );
  await message.deleteOne();
  await refreshTicketLastMessage(ticket._id);
  const updatedTicket = await populatedTicket(
    SupportTicket.findById(ticket._id),
  );
  const data = {
    ticket: mapTicket(updatedTicket),
    messageId: String(message._id),
  };
  emitSupportEvent({
    ticket: updatedTicket,
    event: "support:message-deleted",
    data,
  });
  return res.json(new ApiResponse({ message: "Support message deleted", data }));
});

export const markSupportTicketRead = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  if (
    req.user.role === "support" &&
    String(ticket.assignedTo?._id || ticket.assignedTo || "") !==
      String(req.user._id)
  ) {
    throw new ApiError(403, "Claim this ticket before marking it as read");
  }
  const field = isSupportAgent(req.user) ? "unreadForSupport" : "unreadForRequester";
  ticket[field] = 0;
  await ticket.save();
  return res.json(new ApiResponse({ message: "Ticket marked as read", data: mapTicket(ticket) }));
});

export const getAdminSupportTickets = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query || {};
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const search = String(query.search || "").trim();
  let requesterIds = [];
  if (search) {
    const safeSearch = escapeRegex(search);
    const users = await User.find({
      $or: [{ name: { $regex: safeSearch, $options: "i" } }, { email: { $regex: safeSearch, $options: "i" } }],
    }).select("_id");
    requesterIds = users.map((row) => row._id);
  }
  const filter = buildAdminSupportTicketFilter(query, requesterIds);
  let accessFilter = null;
  if (req.user.role === "support") {
    accessFilter = await buildSupportAccessFilter(req.user);
  }
  const visibleFilter = { deletedAt: null };
  const scopedFilter = accessFilter
    ? { $and: [visibleFilter, filter, accessFilter] }
    : { $and: [visibleFilter, filter] };
  const skip = (page - 1) * limit;
  const summaryPipeline = [
    { $match: visibleFilter },
    ...(accessFilter ? [{ $match: accessFilter }] : []),
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ];
  const unreadFilter = accessFilter
    ? { $and: [visibleFilter, accessFilter, { unreadForSupport: { $gt: 0 } }] }
    : { $and: [visibleFilter, { unreadForSupport: { $gt: 0 } }] };
  const [tickets, total, summary, unread] = await Promise.all([
    populatedTicket(SupportTicket.find(scopedFilter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit)),
    SupportTicket.countDocuments(scopedFilter),
    SupportTicket.aggregate(summaryPipeline),
    SupportTicket.countDocuments(unreadFilter),
  ]);
  const counts = Object.fromEntries(summary.map((row) => [row._id, row.count]));
  return res.json(new ApiResponse({
    message: "Support queue fetched",
    data: {
      tickets: tickets.map(mapTicket),
      summary: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        open: counts.open || 0,
        inProgress: counts.in_progress || 0,
        waitingForUser: counts.waiting_for_user || 0,
        resolved: counts.resolved || 0,
        closed: counts.closed || 0,
        unread,
      },
    },
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  }));
});

export const updateAdminSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const payload = req.validated?.body || req.body;
  const { handoffReason, ...changes } = payload;
  const currentOwnerId = String(
    ticket.assignedTo?._id || ticket.assignedTo || "",
  );
  const actorId = String(req.user._id);
  let handoffMessage = null;

  if (req.user.role === "support") {
    const isClaim = changes.assignedTo === actorId;
    const isRelease = changes.assignedTo === null;

    if (
      Object.prototype.hasOwnProperty.call(changes, "assignedTo") &&
      !isClaim &&
      !isRelease
    ) {
      throw new ApiError(403, "Support agents can only claim tickets for themselves");
    }
    if (isClaim && currentOwnerId && currentOwnerId !== actorId) {
      throw new ApiError(409, "This ticket is already owned by another support agent");
    }
    if (isRelease) {
      if (currentOwnerId !== actorId) {
        throw new ApiError(403, "Only the current owner can hand off this ticket");
      }
      if (!handoffReason) {
        throw new ApiError(400, "A handoff reason is required");
      }
    }

    const effectiveOwnerId = isClaim
      ? actorId
      : isRelease
        ? ""
        : currentOwnerId;
    if (
      changes.status !== undefined &&
      effectiveOwnerId !== actorId
    ) {
      throw new ApiError(403, "Claim this ticket before changing it");
    }

    if (
      Object.prototype.hasOwnProperty.call(changes, "assignedTo") &&
      String(changes.assignedTo || "") !== currentOwnerId
    ) {
      const now = new Date();
      const isClaiming = Boolean(changes.assignedTo);
      const assignmentUpdate = {
        $set: {
          assignedTo: isClaiming ? req.user._id : null,
          claimedAt: isClaiming ? now : null,
          lastAssignedAt: now,
          lastAssignedBy: req.user._id,
        },
      };
      if (isClaiming && ticket.status === "open") {
        assignmentUpdate.$set.status = "in_progress";
        ticket.status = "in_progress";
      }
      if (!isClaiming) {
        assignmentUpdate.$set.unreadForSupport = 1;
        assignmentUpdate.$inc = { handoffCount: 1 };
        ticket.unreadForSupport = 1;
      }
      const assignmentResult = await SupportTicket.updateOne(
        {
          _id: ticket._id,
          assignedTo: isClaiming ? null : req.user._id,
        },
        assignmentUpdate,
      );
      if (!assignmentResult.matchedCount) {
        throw new ApiError(
          409,
          isClaiming
            ? "Another support agent claimed this ticket first"
            : "This ticket is no longer assigned to you",
        );
      }
      ticket.assignedTo = isClaiming ? req.user._id : null;
      ticket.claimedAt = isClaiming ? now : null;
      ticket.lastAssignedAt = now;
      ticket.lastAssignedBy = req.user._id;
      if (!isClaiming) {
        ticket.handoffCount = Number(ticket.handoffCount || 0) + 1;
        handoffMessage = await SupportMessage.create({
          ticket: ticket._id,
          sender: req.user._id,
          senderRole: req.user.role,
          body: `Handoff: ${handoffReason}`,
          internalNote: true,
        });
      }
      delete changes.assignedTo;
    }
  }

  if (changes.assignedTo) {
    const agent = await User.exists({
      _id: changes.assignedTo,
      role: { $in: ["admin", "support"] },
      status: "active",
    });
    if (!agent) throw new ApiError(400, "Assigned user is not an active support agent");
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, "assignedTo") &&
    String(changes.assignedTo || "") !== currentOwnerId
  ) {
    ticket.lastAssignedAt = new Date();
    ticket.lastAssignedBy = req.user._id;
    ticket.claimedAt = changes.assignedTo ? new Date() : null;
    if (changes.assignedTo && ticket.status === "open") {
      changes.status = "in_progress";
    }
    if (!changes.assignedTo && currentOwnerId) {
      ticket.handoffCount = Number(ticket.handoffCount || 0) + 1;
      ticket.unreadForSupport = Math.max(
        1,
        Number(ticket.unreadForSupport || 0),
      );
      if (handoffReason) {
        handoffMessage = await SupportMessage.create({
          ticket: ticket._id,
          sender: req.user._id,
          senderRole: req.user.role,
          body: `Handoff: ${handoffReason}`,
          internalNote: true,
        });
      }
    }
  }
  Object.assign(ticket, changes);
  if (changes.status === "resolved") ticket.resolvedAt = new Date();
  if (changes.status === "closed") ticket.closedAt = new Date();
  if (changes.status && !["resolved", "closed"].includes(changes.status)) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }
  await ticket.save();
  const updated = await populatedTicket(SupportTicket.findById(ticket._id));
  if (handoffMessage) {
    handoffMessage = await SupportMessage.findById(handoffMessage._id).populate(
      "sender",
      "name email avatar role",
    );
  }
  const data = {
    ticket: mapTicket(updated),
    ...(handoffMessage ? { message: mapMessage(handoffMessage) } : {}),
  };
  emitSupportEvent({ ticket: updated, event: "support:ticket-updated", data });
  return res.json(new ApiResponse({ message: "Support ticket updated", data }));
});

export const deleteResolvedSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const ownerId = String(ticket.assignedTo?._id || ticket.assignedTo || "");
  if (ownerId !== String(req.user._id)) {
    throw new ApiError(403, "Only the assigned support agent can delete this conversation");
  }
  if (!["resolved", "closed"].includes(ticket.status)) {
    throw new ApiError(400, "Resolve or close this ticket before deleting it");
  }

  ticket.deletedAt = new Date();
  ticket.deletedBy = req.user._id;
  await ticket.save();

  const data = {
    ticket: {
      ...mapTicket(ticket),
      deletedAt: ticket.deletedAt,
    },
  };
  emitSupportEvent({ ticket, event: "support:ticket-deleted", data });
  return res.json(
    new ApiResponse({
      message: "Completed support conversation deleted",
      data,
    }),
  );
});
