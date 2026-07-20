import Video from "../models/Video.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { normalizeVideoLink } from "../utils/videoEmbed.js";
import VideoLike from "../models/VideoLike.js";
import { publishTeacherActivity } from "../services/teacherActivity.service.js";

const sortVideos = { sortOrder: 1, createdAt: -1 };
const publicVideoSort = { likeCount: -1, sortOrder: 1, createdAt: -1 };

export const getPublicVideos = asyncHandler(async (req, res) => {
  const platform = req.query.platform || "all";
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
  const filter = {
    isPublished: true,
    ...(platform === "all" ? {} : { platform }),
  };
  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate("teacher", "name avatar teacherApplication.professionalTitle")
      .sort(publicVideoSort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  return res.json(new ApiResponse({
    message: "Videos fetched successfully",
    data: videos,
    meta: { platform, page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  }));
});

export const getAdminVideos = asyncHandler(async (_req, res) => {
  const videos = await Video.find().populate("teacher", "name avatar").sort(sortVideos).lean();
  return res.json(new ApiResponse({ message: "Videos fetched successfully", data: videos }));
});

export const createVideo = asyncHandler(async (req, res) => {
  const normalized = normalizeVideoLink(req.body.url);
  const video = await Video.create({ ...req.body, ...normalized });
  return res.status(201).json(new ApiResponse({ message: "Video created successfully", data: video }));
});

export const updateVideo = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(payload, "url")) {
    Object.assign(payload, normalizeVideoLink(payload.url));
  }
  const video = await Video.findByIdAndUpdate(req.params.id, payload, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!video) throw new ApiError(404, "Video not found");
  return res.json(new ApiResponse({ message: "Video updated successfully", data: video }));
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findByIdAndDelete(req.params.id);
  if (!video) throw new ApiError(404, "Video not found");
  return res.json(new ApiResponse({ message: "Video deleted successfully", data: { id: video._id } }));
});

export const getTeacherVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ teacher: req.user._id }).sort(sortVideos).lean();
  return res.json(new ApiResponse({ message: "Teacher videos fetched successfully", data: videos }));
});

export const createTeacherVideo = asyncHandler(async (req, res) => {
  const normalized = normalizeVideoLink(req.body.url);
  const video = await Video.create({ ...req.body, ...normalized, teacher: req.user._id });
  if (video.isPublished) {
    await publishTeacherActivity({
      teacherId: req.user._id,
      type: "teacher_video",
      title: `${req.user.name} posted a new video`,
      body: video.title,
      url: "/videos",
      eventKey: `video:${video._id}`,
    }).catch((error) => console.warn(`Failed to notify video followers: ${error.message}`));
  }
  return res.status(201).json(new ApiResponse({ message: "Video published successfully", data: video }));
});

export const updateTeacherVideo = asyncHandler(async (req, res) => {
  const existing = await Video.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!existing) throw new ApiError(404, "Video not found");
  const payload = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(payload, "url")) Object.assign(payload, normalizeVideoLink(payload.url));
  const video = await Video.findOneAndUpdate({ _id: req.params.id, teacher: req.user._id }, payload, {
    returnDocument: "after", runValidators: true,
  });
  if (!existing.isPublished && video.isPublished) {
    await publishTeacherActivity({
      teacherId: req.user._id, type: "teacher_video",
      title: `${req.user.name} posted a new video`, body: video.title,
      url: "/videos", eventKey: `video:${video._id}`,
    }).catch((error) => console.warn(`Failed to notify video followers: ${error.message}`));
  }
  return res.json(new ApiResponse({ message: "Video updated successfully", data: video }));
});

export const deleteTeacherVideo = asyncHandler(async (req, res) => {
  const video = await Video.findOneAndDelete({ _id: req.params.id, teacher: req.user._id });
  if (!video) throw new ApiError(404, "Video not found");
  await VideoLike.deleteMany({ video: video._id });
  return res.json(new ApiResponse({ message: "Video deleted successfully", data: { id: video._id } }));
});

export const toggleVideoLike = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ _id: req.params.id, isPublished: true }).select("_id");
  if (!video) throw new ApiError(404, "Video not found");
  const existing = await VideoLike.findOneAndDelete({ video: video._id, user: req.user._id });
  let liked = false;
  if (!existing) {
    await VideoLike.create({ video: video._id, user: req.user._id });
    liked = true;
  }
  const likeCount = await VideoLike.countDocuments({ video: video._id });
  await Video.updateOne({ _id: video._id }, { $set: { likeCount } });
  return res.json(new ApiResponse({ message: liked ? "Video liked" : "Video unliked", data: { liked, likeCount } }));
});

export const getStudentVideoSocialState = asyncHandler(async (req, res) => {
  const likes = await VideoLike.find({ user: req.user._id }).select("video").lean();
  return res.json(new ApiResponse({ message: "Video social state fetched", data: { likedVideoIds: likes.map((row) => String(row.video)) } }));
});
