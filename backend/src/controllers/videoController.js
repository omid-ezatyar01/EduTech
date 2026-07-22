import Video from "../models/Video.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { normalizeVideoLink } from "../utils/videoEmbed.js";
import VideoLike from "../models/VideoLike.js";
import VideoSave from "../models/VideoSave.js";
import TeacherFollow from "../models/TeacherFollow.js";
import { publishTeacherActivity } from "../services/teacherActivity.service.js";

const sortVideos = { sortOrder: 1, createdAt: -1 };

const resolvePublicSort = (sort) => {
  if (sort === "newest") return { createdAt: -1, sortOrder: 1 };
  if (sort === "trending") return { trendingScore: -1, createdAt: -1 };
  return { likeCount: -1, createdAt: -1, sortOrder: 1 };
};

const fetchVideoPage = async ({ filter, page, limit, sort }) => {
  const skip = (page - 1) * limit;
  if (sort !== "trending") {
    const [videos, total] = await Promise.all([
      Video.find(filter)
        .populate("teacher", "name avatar teacherApplication.professionalTitle")
        .sort(resolvePublicSort(sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      Video.countDocuments(filter),
    ]);
    return { videos, total };
  }

  const [videos, total] = await Promise.all([
    Video.aggregate([
      { $match: filter },
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $multiply: [{ $ifNull: ["$likeCount", 0] }, 3] },
              { $divide: [{ $toLong: "$createdAt" }, 86400000] },
            ],
          },
        },
      },
      { $sort: resolvePublicSort(sort) },
      { $skip: skip },
      { $limit: limit },
      { $project: { trendingScore: 0 } },
    ]),
    Video.countDocuments(filter),
  ]);
  await Video.populate(videos, { path: "teacher", select: "name avatar teacherApplication.professionalTitle" });
  return { videos, total };
};

const videoPageMeta = ({ total, platform, feed = "all", sort, page, limit }) => ({
  feed, platform, sort, page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total,
});

export const getPublicVideos = asyncHandler(async (req, res) => {
  const platform = req.query.platform || "all";
  const sort = req.query.sort || "popular";
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
  const filter = {
    isPublished: true,
    ...(req.query.teacherId ? { teacher: req.query.teacherId } : {}),
    ...(platform === "all" ? {} : { platform }),
  };
  const { videos, total } = await fetchVideoPage({ filter, page, limit, sort });
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  return res.json(new ApiResponse({
    message: "Videos fetched successfully",
    data: videos,
    meta: videoPageMeta({ total, platform, sort, page, limit }),
  }));
});

export const getPublicVideo = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ _id: req.params.id, isPublished: true })
    .populate("teacher", "name avatar teacherApplication.professionalTitle")
    .lean();
  if (!video) throw new ApiError(404, "Video not found");
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  return res.json(new ApiResponse({ message: "Video fetched successfully", data: video }));
});

export const getStudentVideos = asyncHandler(async (req, res) => {
  const feed = req.query.feed;
  const platform = req.query.platform || "all";
  const sort = req.query.sort || "popular";
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
  let relationFilter = {};

  if (feed === "following") {
    const follows = await TeacherFollow.find({ follower: req.user._id }).select("teacher").lean();
    relationFilter = { teacher: { $in: follows.map((row) => row.teacher) } };
  } else {
    const saves = await VideoSave.find({ user: req.user._id }).select("video").lean();
    relationFilter = { _id: { $in: saves.map((row) => row.video) } };
  }

  const filter = {
    isPublished: true,
    ...relationFilter,
    ...(platform === "all" ? {} : { platform }),
  };
  const { videos, total } = await fetchVideoPage({ filter, page, limit, sort });
  res.set("Cache-Control", "private, no-store");
  return res.json(new ApiResponse({
    message: "Student videos fetched successfully",
    data: videos,
    meta: videoPageMeta({ total, platform, feed, sort, page, limit }),
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
  await Promise.all([VideoLike.deleteMany({ video: video._id }), VideoSave.deleteMany({ video: video._id })]);
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
  await VideoSave.deleteMany({ video: video._id });
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

export const toggleVideoSave = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ _id: req.params.id, isPublished: true }).select("_id");
  if (!video) throw new ApiError(404, "Video not found");
  const existing = await VideoSave.findOneAndDelete({ video: video._id, user: req.user._id });
  let saved = false;
  if (!existing) {
    await VideoSave.create({ video: video._id, user: req.user._id });
    saved = true;
  }
  return res.json(new ApiResponse({ message: saved ? "Video saved" : "Video removed from saved videos", data: { saved } }));
});

export const getStudentVideoSocialState = asyncHandler(async (req, res) => {
  const [likes, saves] = await Promise.all([
    VideoLike.find({ user: req.user._id }).select("video").lean(),
    VideoSave.find({ user: req.user._id }).select("video").lean(),
  ]);
  return res.json(new ApiResponse({
    message: "Video social state fetched",
    data: {
      likedVideoIds: likes.map((row) => String(row.video)),
      savedVideoIds: saves.map((row) => String(row.video)),
    },
  }));
});
