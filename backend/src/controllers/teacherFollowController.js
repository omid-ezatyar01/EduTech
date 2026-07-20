import User from "../models/User.js";
import TeacherFollow from "../models/TeacherFollow.js";
import StudentNotification from "../models/StudentNotification.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const assertTeacher = async (id) => {
  const teacher = await User.findOne({ _id: id, role: "teacher", status: "active", "teacherApplication.status": "approved" }).select("_id name");
  if (!teacher) throw new ApiError(404, "Teacher not found");
  return teacher;
};

export const getTeacherFollowStatus = asyncHandler(async (req, res) => {
  await assertTeacher(req.params.id);
  const [follow, followerCount] = await Promise.all([
    TeacherFollow.findOne({ teacher: req.params.id, follower: req.user._id }).lean(),
    TeacherFollow.countDocuments({ teacher: req.params.id }),
  ]);
  return res.json(new ApiResponse({ message: "Follow status fetched", data: { following: Boolean(follow), notificationsEnabled: follow?.notificationsEnabled !== false, followerCount } }));
});

export const followTeacher = asyncHandler(async (req, res) => {
  await assertTeacher(req.params.id);
  await TeacherFollow.findOneAndUpdate(
    { teacher: req.params.id, follower: req.user._id },
    { $set: { notificationsEnabled: true } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  const followerCount = await TeacherFollow.countDocuments({ teacher: req.params.id });
  return res.json(new ApiResponse({ message: "Teacher followed", data: { following: true, notificationsEnabled: true, followerCount } }));
});

export const unfollowTeacher = asyncHandler(async (req, res) => {
  await TeacherFollow.deleteOne({ teacher: req.params.id, follower: req.user._id });
  const followerCount = await TeacherFollow.countDocuments({ teacher: req.params.id });
  return res.json(new ApiResponse({ message: "Teacher unfollowed", data: { following: false, followerCount } }));
});

export const getStudentTeacherNotifications = asyncHandler(async (req, res) => {
  const notifications = await StudentNotification.find({ recipient: req.user._id })
    .populate("teacher", "name avatar")
    .sort({ createdAt: -1 }).limit(100).lean();
  const unreadCount = notifications.filter((row) => !row.isRead).length;
  return res.json(new ApiResponse({ message: "Notifications fetched", data: { notifications, unreadCount } }));
});

export const markStudentTeacherNotificationRead = asyncHandler(async (req, res) => {
  const row = await StudentNotification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id }, { $set: { isRead: true } }, { returnDocument: "after" },
  );
  if (!row) throw new ApiError(404, "Notification not found");
  return res.json(new ApiResponse({ message: "Notification marked as read", data: row }));
});

export const markAllStudentTeacherNotificationsRead = asyncHandler(async (req, res) => {
  await StudentNotification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
  return res.json(new ApiResponse({ message: "All notifications marked as read", data: { unreadCount: 0 } }));
});
