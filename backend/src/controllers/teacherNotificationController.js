import TeacherNotification from "../models/TeacherNotification.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getTeacherNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    TeacherNotification.find({ recipient: req.user._id })
      .populate("course", "title slug")
      .populate("student", "name avatar")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    TeacherNotification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    }),
  ]);

  return res.json(
    new ApiResponse({
      message: "Teacher notifications fetched successfully",
      data: { notifications, unreadCount },
    }),
  );
});

export const markTeacherNotificationRead = asyncHandler(async (req, res) => {
  const notification = await TeacherNotification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { isRead: true } },
    { returnDocument: "after" },
  );

  if (!notification) throw new ApiError(404, "Notification not found");

  return res.json(
    new ApiResponse({
      message: "Notification marked as read",
      data: notification,
    }),
  );
});

export const markAllTeacherNotificationsRead = asyncHandler(async (req, res) => {
  await TeacherNotification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } },
  );

  return res.json(
    new ApiResponse({
      message: "All notifications marked as read",
      data: { unreadCount: 0 },
    }),
  );
});

export const deleteTeacherNotification = asyncHandler(async (req, res) => {
  const notification = await TeacherNotification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });

  if (!notification) throw new ApiError(404, "Notification not found");

  return res.json(
    new ApiResponse({
      message: "Notification deleted",
      data: { id: notification._id },
    }),
  );
});
