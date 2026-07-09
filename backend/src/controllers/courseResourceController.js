import mongoose from "mongoose";
import Course from "../models/Course.js";
import CourseResource from "../models/CourseResource.js";
import LiveSession from "../models/LiveSession.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  moveUploadedCourseResourcePdf,
  removeCourseResourcePdfIfLocal,
  removeUploadedTempCourseResourceFile,
} from "../utils/courseResourceFile.js";

const COURSE_RESOURCE_TOTAL_MAX_BYTES = 100 * 1024 * 1024;

const normalizeResourceType = (value = "") => {
  const type = String(value || "").trim();
  if (["PDF", "Link", "Video"].includes(type)) return type;
  return "";
};

const ensureOwnedCourse = async (courseId, teacherId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course id");
  }

  const course = await Course.findOne({
    _id: courseId,
    $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
  });

  if (!course) {
    throw new ApiError(404, "Course not found or not owned by teacher");
  }

  return course;
};

const buildResourcePayload = (body = {}) => {
  const title = String(body.title || "").trim();
  const module = String(body.module || "").trim();
  const sessionId = String(body.sessionId || "").trim();
  const type = normalizeResourceType(body.type);
  const url = String(body.url || "").trim();

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new ApiError(400, "A valid class session is required");
  }
  if (title.length < 2 || title.length > 140) {
    throw new ApiError(400, "Resource title must be between 2 and 140 characters");
  }
  if (module.length < 2 || module.length > 140) {
    throw new ApiError(400, "Module name must be between 2 and 140 characters");
  }
  if (!type) {
    throw new ApiError(400, "Resource type must be PDF, Link, or Video");
  }
  if ((type === "Link" || type === "Video") && !/^https?:\/\//i.test(url)) {
    throw new ApiError(400, "A valid http(s) link is required");
  }

  return { title, module, sessionId, type, url };
};

const mapResource = (resource = {}) => ({
  id: String(resource._id || ""),
  _id: String(resource._id || ""),
  courseId: String(resource.courseId || ""),
  sessionId: String(resource.sessionId || ""),
  title: resource.title,
  module: resource.module,
  description: resource.module,
  type: resource.type,
  url: resource.type === "PDF" ? resource.filePath : resource.url,
  fileName: resource.fileName || "",
  fileSize: Number(resource.fileSize || 0),
  size: resource.fileSize ? `${Math.round(resource.fileSize / 1024 / 1024)} MB` : "-",
  addedAt: resource.createdAt,
  updatedAt: resource.updatedAt,
});

const getCoursePdfUsage = async (courseId, teacherId, excludeResourceId = null) => {
  const match = {
    courseId: new mongoose.Types.ObjectId(courseId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    type: "PDF",
  };

  if (excludeResourceId && mongoose.Types.ObjectId.isValid(excludeResourceId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(excludeResourceId) };
  }

  const [summary] = await CourseResource.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$fileSize" } } },
  ]);

  return Number(summary?.total || 0);
};

const ensureCoursePdfLimit = async (courseId, teacherId, nextFileSize, excludeResourceId = null) => {
  const currentUsage = await getCoursePdfUsage(courseId, teacherId, excludeResourceId);
  if (currentUsage + Number(nextFileSize || 0) > COURSE_RESOURCE_TOTAL_MAX_BYTES) {
    throw new ApiError(400, "Total PDF resources for this course must not exceed 100MB");
  }
};

const ensureCourseSession = async (courseId, teacherId, sessionId) => {
  const session = await LiveSession.findOne({
    _id: sessionId,
    courseId,
    teacherId,
  }).select("_id title startAt endAt");

  if (!session) {
    const hasAnySession = await LiveSession.exists({ courseId, teacherId });
    if (!hasAnySession) {
      throw new ApiError(400, "Add at least one class session before adding course resources");
    }
    throw new ApiError(400, "Selected class session does not belong to this course");
  }

  return session;
};

export const getCourseResources = asyncHandler(async (req, res) => {
  await ensureOwnedCourse(req.params.id, req.user._id);

  const resources = await CourseResource.find({ courseId: req.params.id })
    .sort({ createdAt: -1 })
    .lean();

  return res.json(
    new ApiResponse({
      message: "Course resources fetched successfully",
      data: resources.map(mapResource),
    }),
  );
});

export const createCourseResource = asyncHandler(async (req, res) => {
  await ensureOwnedCourse(req.params.id, req.user._id);
  try {
    const payload = buildResourcePayload(req.body);
    await ensureCourseSession(req.params.id, req.user._id, payload.sessionId);

    if (payload.type === "PDF") {
      if (!req.file?.path) {
        throw new ApiError(400, "PDF file is required");
      }
      await ensureCoursePdfLimit(req.params.id, req.user._id, req.file.size || 0);
      payload.filePath = await moveUploadedCourseResourcePdf(req.user._id, req.params.id, req.file);
      payload.fileName = req.file.originalname || "resource.pdf";
      payload.fileSize = req.file.size || 0;
      payload.url = "";
    } else if (req.file?.path) {
      throw new ApiError(400, "Files are only allowed for PDF resources");
    }

    const resource = await CourseResource.create({
      ...payload,
      courseId: req.params.id,
      teacherId: req.user._id,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "Course resource created successfully",
        data: mapResource(resource),
      }),
    );
  } catch (error) {
    await removeUploadedTempCourseResourceFile(req.file);
    throw error;
  }
});

export const updateCourseResource = asyncHandler(async (req, res) => {
  await ensureOwnedCourse(req.params.id, req.user._id);
  if (!mongoose.Types.ObjectId.isValid(req.params.resourceId)) {
    throw new ApiError(400, "Invalid resource id");
  }
  const resource = await CourseResource.findOne({
    _id: req.params.resourceId,
    courseId: req.params.id,
    teacherId: req.user._id,
  });

  if (!resource) {
    throw new ApiError(404, "Course resource not found");
  }

  try {
    const payload = buildResourcePayload(req.body);
    await ensureCourseSession(req.params.id, req.user._id, payload.sessionId);
    const previousFilePath = resource.filePath || "";

    resource.title = payload.title;
    resource.module = payload.module;
    resource.sessionId = payload.sessionId;
    resource.type = payload.type;

    if (payload.type === "PDF") {
      if (req.file?.path) {
        await ensureCoursePdfLimit(
          req.params.id,
          req.user._id,
          req.file.size || 0,
          resource._id,
        );
        resource.filePath = await moveUploadedCourseResourcePdf(req.user._id, req.params.id, req.file);
        resource.fileName = req.file.originalname || "resource.pdf";
        resource.fileSize = req.file.size || 0;
        resource.url = "";
      } else if (!resource.filePath) {
        throw new ApiError(400, "PDF file is required");
      }
    } else {
      resource.url = payload.url;
      resource.filePath = "";
      resource.fileName = "";
      resource.fileSize = 0;
    }

    await resource.save();

    if (previousFilePath && previousFilePath !== resource.filePath) {
      await removeCourseResourcePdfIfLocal(previousFilePath);
    }

    return res.json(
      new ApiResponse({
        message: "Course resource updated successfully",
        data: mapResource(resource),
      }),
    );
  } catch (error) {
    await removeUploadedTempCourseResourceFile(req.file);
    throw error;
  }
});

export const deleteCourseResource = asyncHandler(async (req, res) => {
  await ensureOwnedCourse(req.params.id, req.user._id);
  if (!mongoose.Types.ObjectId.isValid(req.params.resourceId)) {
    throw new ApiError(400, "Invalid resource id");
  }
  const resource = await CourseResource.findOneAndDelete({
    _id: req.params.resourceId,
    courseId: req.params.id,
    teacherId: req.user._id,
  });

  if (!resource) {
    throw new ApiError(404, "Course resource not found");
  }

  await removeCourseResourcePdfIfLocal(resource.filePath);

  return res.json(
    new ApiResponse({
      message: "Course resource deleted successfully",
      data: { id: String(resource._id) },
    }),
  );
});
