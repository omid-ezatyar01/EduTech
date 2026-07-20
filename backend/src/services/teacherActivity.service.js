import TeacherFollow from "../models/TeacherFollow.js";
import StudentNotification from "../models/StudentNotification.js";
import { notifyTeacherFollowers } from "./webPush.service.js";

export const publishTeacherActivity = async ({ teacherId, type, title, body = "", url = "", eventKey }) => {
  if (!teacherId || !eventKey) return { recipients: 0 };
  const follows = await TeacherFollow.find({ teacher: teacherId, notificationsEnabled: true })
    .select("follower")
    .lean();
  const followerIds = follows.map((row) => row.follower);
  if (!followerIds.length) return { recipients: 0 };

  await StudentNotification.insertMany(
    followerIds.map((recipient) => ({ recipient, teacher: teacherId, type, title, body, url, eventKey })),
    { ordered: false },
  ).catch((error) => {
    if (error?.code !== 11000 && !error?.writeErrors?.every((row) => row?.code === 11000)) throw error;
  });

  notifyTeacherFollowers({ followerIds, teacherId, type, title, body, url }).catch((error) => {
    console.warn(`Failed to send teacher follower push notifications: ${error.message}`);
  });
  return { recipients: followerIds.length };
};
