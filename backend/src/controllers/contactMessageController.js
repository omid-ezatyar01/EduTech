import ContactMessage from "../models/ContactMessage.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { sendEduTechEmail } from "../utils/Email.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapMessageRow = (row) => ({
  _id: row._id,
  name: row.name,
  contact: row.contact,
  subject: row.subject,
  message: row.message,
  status: row.status,
  source: row.source,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  repliedAt: row.repliedAt || null,
  adminReply: row.adminReply || "",
});

export const getAdminMessages = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query || {};
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const search = String(query.search || "").trim();
  const status = String(query.status || "all");
  const skip = (page - 1) * limit;

  const filter = {};
  if (status !== "all") {
    filter.status = status;
  }

  if (search) {
    const pattern = { $regex: search, $options: "i" };
    filter.$or = [
      { name: pattern },
      { contact: pattern },
      { subject: pattern },
      { message: pattern },
    ];
  }

  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);

  const summary = await ContactMessage.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const summaryMap = summary.reduce(
    (acc, item) => {
      acc[item._id] = Number(item.count || 0);
      return acc;
    },
    {
      new: 0,
      pending: 0,
      replied: 0,
      resolved: 0,
    },
  );

  return res.json(
    new ApiResponse({
      message: "Messages fetched successfully",
      data: {
        messages: messages.map(mapMessageRow),
        summary: {
          total: Object.values(summaryMap).reduce((sum, value) => sum + value, 0),
          new: summaryMap.new || 0,
          pending: summaryMap.pending || 0,
          replied: summaryMap.replied || 0,
          resolved: summaryMap.resolved || 0,
          unresolved: (summaryMap.new || 0) + (summaryMap.pending || 0),
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

export const updateAdminMessageStatus = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params || req.params;
  const { status } = req.validated?.body || req.body;

  const row = await ContactMessage.findById(id);
  if (!row) {
    throw new ApiError(404, "Message not found");
  }

  row.status = status;
  if (status === "replied" || status === "resolved") {
    row.repliedAt = new Date();
  }

  await row.save();

  return res.json(
    new ApiResponse({
      message: "Message status updated successfully",
      data: mapMessageRow(row),
    }),
  );
});

export const replyAdminMessage = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params || req.params;
  const payload = req.validated?.body || req.body;

  const row = await ContactMessage.findById(id);
  if (!row) {
    throw new ApiError(404, "Message not found");
  }

  const recipientEmail = String(row.contact || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipientEmail)) {
    throw new ApiError(400, "This message does not have a valid email address to reply to.");
  }

  const subject = String(payload.subject || `Re: ${row.subject}`).trim();
  const message = String(payload.message || "").trim();

  await sendEduTechEmail({
    to: recipientEmail,
    subject,
    heading: subject,
    greetingName: row.name,
    body: message,
    footerNote: "This reply was sent by EduTech support.",
  });

  row.status = "replied";
  row.repliedAt = new Date();
  row.adminReply = message;
  row.repliedBy = req.user?._id;
  await row.save();

  return res.json(
    new ApiResponse({
      message: "Reply sent successfully from EduTech email",
      data: mapMessageRow(row),
    }),
  );
});

export const sendAdminEmailToUser = asyncHandler(async (req, res) => {
  const payload = req.validated?.body || req.body;
  const recipientRole = String(payload.recipientRole || "").toLowerCase();
  const recipientEmail = String(payload.recipientEmail || "").trim().toLowerCase();

  const user = await User.findOne({
    email: recipientEmail,
    role: recipientRole,
  }).select("_id name email role status");

  if (!user) {
    throw new ApiError(404, `No ${recipientRole} account found with this email.`);
  }

  if (user.status === "blocked") {
    throw new ApiError(400, "Cannot send email to a blocked account.");
  }

  await sendEduTechEmail({
    to: user.email,
    subject: payload.subject,
    heading: payload.subject,
    greetingName: user.name,
    body: payload.message,
    footerNote: "This email was sent by EduTech administration.",
  });

  return res.status(201).json(
    new ApiResponse({
      message: "Email sent successfully from EduTech email",
      data: {
        recipient: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    }),
  );
});
