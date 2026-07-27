import SupportTicket from "../models/SupportTicket.js";
import SupportMessage from "../models/SupportMessage.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { emitSupportEvent } from "../services/supportRealtime.service.js";

const preview = (value) => String(value || "").trim().slice(0, 240);
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ticketNumber = () =>
  `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const mapUser = (user) =>
  user && typeof user === "object"
    ? { id: String(user._id || ""), name: user.name || "", email: user.email || "", avatar: user.avatar || "", role: user.role || "" }
    : null;

const mapTicket = (row) => ({
  id: String(row._id),
  ticketNumber: row.ticketNumber,
  requester: mapUser(row.requester),
  requesterRole: row.requesterRole,
  subject: row.subject,
  category: row.category,
  priority: row.priority,
  status: row.status,
  assignedTo: mapUser(row.assignedTo),
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
  internalNote: Boolean(row.internalNote),
  createdAt: row.createdAt,
});

const populatedTicket = (query) =>
  query.populate("requester", "name email avatar role").populate("assignedTo", "name email avatar role");

export const buildAdminSupportTicketFilter = (
  {
    status = "all",
    category = "all",
    priority = "all",
    requesterRole = "all",
    search = "",
  } = {},
  requesterIds = [],
) => {
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (category && category !== "all") filter.category = category;
  if (priority && priority !== "all") filter.priority = priority;
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
  const filter = { _id: ticketId };
  if (user.role !== "admin") filter.requester = user._id;
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
  return res.status(201).json(new ApiResponse({ message: "Support ticket created", data }));
});

export const getMySupportTickets = asyncHandler(async (req, res) => {
  const tickets = await populatedTicket(
    SupportTicket.find({ requester: req.user._id }).sort({ lastMessageAt: -1 }),
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
  if (req.user.role !== "admin") filter.internalNote = false;
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
  const isAdmin = req.user.role === "admin";
  if (!isAdmin && ["resolved", "closed"].includes(ticket.status)) {
    throw new ApiError(400, "Reopen this ticket before sending another message");
  }
  if (!isAdmin && payload.internalNote) throw new ApiError(403, "Internal notes are for support staff");

  let message = await SupportMessage.create({
    ticket: ticket._id,
    sender: req.user._id,
    senderRole: req.user.role,
    body: payload.body,
    internalNote: isAdmin && Boolean(payload.internalNote),
  });
  const setUpdates = {};
  const update = { $set: setUpdates };
  if (isAdmin && payload.internalNote) {
    // Private notes must not change requester-visible conversation metadata.
  } else if (isAdmin) {
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
  return res.status(201).json(new ApiResponse({ message: "Message sent", data }));
});

export const markSupportTicketRead = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const field = req.user.role === "admin" ? "unreadForSupport" : "unreadForRequester";
  ticket[field] = 0;
  await ticket.save();
  return res.json(new ApiResponse({ message: "Ticket marked as read", data: mapTicket(ticket) }));
});

export const updateOwnSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  ticket.status = req.body.status;
  ticket.closedAt = req.body.status === "closed" ? new Date() : null;
  if (req.body.status === "open") ticket.resolvedAt = null;
  await ticket.save();
  const data = { ticket: mapTicket(ticket) };
  emitSupportEvent({ ticket, event: "support:ticket-updated", data });
  return res.json(new ApiResponse({ message: "Ticket updated", data }));
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
  const skip = (page - 1) * limit;
  const [tickets, total, summary] = await Promise.all([
    populatedTicket(SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit)),
    SupportTicket.countDocuments(filter),
    SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
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
        unread: await SupportTicket.countDocuments({ unreadForSupport: { $gt: 0 } }),
      },
    },
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  }));
});

export const updateAdminSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await findAccessibleTicket(req.params.ticketId, req.user);
  const payload = req.validated?.body || req.body;
  if (payload.assignedTo) {
    const admin = await User.exists({ _id: payload.assignedTo, role: "admin", status: "active" });
    if (!admin) throw new ApiError(400, "Assigned support user is not an active admin");
  }
  Object.assign(ticket, payload);
  if (payload.status === "resolved") ticket.resolvedAt = new Date();
  if (payload.status === "closed") ticket.closedAt = new Date();
  if (payload.status && !["resolved", "closed"].includes(payload.status)) {
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }
  await ticket.save();
  const updated = await populatedTicket(SupportTicket.findById(ticket._id));
  const data = { ticket: mapTicket(updated) };
  emitSupportEvent({ ticket: updated, event: "support:ticket-updated", data });
  return res.json(new ApiResponse({ message: "Support ticket updated", data }));
});
