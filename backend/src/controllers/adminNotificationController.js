import AdminNotification from "../models/AdminNotification.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const mapNotification = (notification, adminId) => {
  const row = notification.toObject ? notification.toObject() : notification;
  const readBy = Array.isArray(row.readBy) ? row.readBy : [];

  return {
    _id: row._id,
    type: row.type,
    title: row.title,
    message: row.message,
    courseId: row.course?._id || row.course || null,
    courseTitle: row.course?.title || "",
    teacherId: row.submittedBy?._id || row.submittedBy || null,
    teacherName: row.submittedBy?.name || "",
    teacherEmail: row.submittedBy?.email || "",
    isRead: readBy.some((id) => String(id?._id || id) === String(adminId)),
    createdAt: row.createdAt,
  };
};

export const getAdminNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const adminId = req.user._id;
  const visibleFilter = { hiddenBy: { $ne: adminId } };

  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find(visibleFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("course", "title status")
      .populate("submittedBy", "name email")
      .lean(),
    AdminNotification.countDocuments({
      ...visibleFilter,
      readBy: { $ne: adminId },
    }),
  ]);

  return res.json(
    new ApiResponse({
      message: "Admin notifications fetched successfully",
      data: {
        notifications: notifications.map((row) => mapNotification(row, adminId)),
        unreadCount,
      },
    }),
  );
});

export const markAdminNotificationRead = asyncHandler(async (req, res) => {
  const notification = await AdminNotification.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { readBy: req.user._id } },
    { returnDocument: "after" },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  return res.json(
    new ApiResponse({
      message: "Notification marked as read",
      data: mapNotification(notification, req.user._id),
    }),
  );
});

export const markAllAdminNotificationsRead = asyncHandler(async (req, res) => {
  await AdminNotification.updateMany(
    {
      readBy: { $ne: req.user._id },
      hiddenBy: { $ne: req.user._id },
    },
    { $addToSet: { readBy: req.user._id } },
  );

  return res.json(
    new ApiResponse({
      message: "All notifications marked as read",
      data: { unreadCount: 0 },
    }),
  );
});

export const deleteAdminNotification = asyncHandler(async (req, res) => {
  const notification = await AdminNotification.findByIdAndUpdate(
    req.params.id,
    {
      $addToSet: {
        hiddenBy: req.user._id,
        readBy: req.user._id,
      },
    },
    { returnDocument: "after" },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  return res.json(
    new ApiResponse({
      message: "Notification removed",
      data: { id: notification._id },
    }),
  );
});
