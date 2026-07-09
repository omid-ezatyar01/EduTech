import mongoose from "mongoose";
import Course from "../models/Course.js";
import User from "../models/User.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const compactText = (value = "", maxLength = 220) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

const normalizeOrigin = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const getStudentOrigin = () =>
  normalizeOrigin(
    process.env.COURSE_PUBLIC_ORIGIN ||
      process.env.STUDENT_CLIENT_URL ||
      process.env.STUDENT_FRONTEND_URL ||
      process.env.CLIENT_URL ||
      "https://edutech.study",
  );

const getApiOrigin = (req) => `${req.protocol}://${req.get("host")}`;
const getShareRequestUrl = (req) => new URL(req.originalUrl || req.url || "/", getApiOrigin(req)).toString();

const resolveImageUrl = (value, req) => {
  const image = String(value || "").trim();
  if (!image) return `${getStudentOrigin()}/logo-en.png`;
  if (/^https?:\/\//i.test(image)) return image;
  return new URL(image.startsWith("/") ? image : `/${image}`, getApiOrigin(req)).toString();
};

const renderSharePreview = (res, {
  title,
  description,
  image,
  url,
  destination,
  type = "website",
}) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(compactText(description));
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeDestination = escapeHtml(destination);
  const redirectTarget = JSON.stringify(destination).replaceAll("<", "\\u003c");

  res.removeHeader("Content-Security-Policy");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:type" content="${escapeHtml(type)}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:site_name" content="EduTech" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:url" content="${safeUrl}" />
    <link rel="canonical" href="${safeDestination}" />
  </head>
  <body>
    <p>Opening <a href="${safeDestination}">${safeTitle}</a>…</p>
    <script>window.location.replace(${redirectTarget});</script>
  </body>
</html>`);
};

const approvedTeacherFilter = {
  role: "teacher",
  status: "active",
  "teacherApplication.status": "approved",
};

export const getCourseSharePreview = asyncHandler(async (req, res) => {
  const identifier = String(req.params.identifier || "").trim();
  const lookup = mongoose.isValidObjectId(identifier)
    ? { $or: [{ _id: identifier }, { slug: identifier }] }
    : { slug: identifier };
  const course = await Course.findOne({
    ...lookup,
    status: "published",
    isPublished: true,
  }).lean();

  if (!course) throw new ApiError(404, "Course not found");

  const teacherId = course.teacher || course.teacherId || course.createdBy;
  const teacher = teacherId
    ? await User.findOne({ _id: teacherId, ...approvedTeacherFilter })
        .select("name")
        .lean()
    : null;
  if (!teacher) throw new ApiError(404, "Course not found");

  const destination = `${getStudentOrigin()}/course/${encodeURIComponent(course.slug || course._id)}`;
  const description =
    compactText(course.shortDescription || course.description) ||
    `Learn with ${teacher.name || "an EduTech instructor"}.`;

  return renderSharePreview(res, {
    title: `${course.title} | EduTech`,
    description: `${description} Instructor: ${teacher.name}.`,
    image: resolveImageUrl(course.thumbnail, req),
    url: getShareRequestUrl(req),
    destination,
    type: "article",
  });
});

export const getTeacherSharePreview = asyncHandler(async (req, res) => {
  const teacherId = String(req.params.id || "").trim();
  if (!mongoose.isValidObjectId(teacherId)) {
    throw new ApiError(404, "Teacher not found");
  }

  const teacher = await User.findOne({ _id: teacherId, ...approvedTeacherFilter })
    .select("name avatar bio teacherApplication")
    .lean();
  if (!teacher) throw new ApiError(404, "Teacher not found");

  const application = teacher.teacherApplication || {};
  const expertise = Array.isArray(application.expertiseAreas)
    ? application.expertiseAreas.filter(Boolean).slice(0, 3).join(", ")
    : "";
  const description =
    compactText(teacher.bio || application.bio || application.professionalSummary) ||
    (expertise
      ? `EduTech instructor specializing in ${expertise}.`
      : "View this instructor's profile and courses on EduTech.");

  return renderSharePreview(res, {
    title: `${teacher.name} | EduTech Instructor`,
    description,
    image: resolveImageUrl(teacher.avatar, req),
    url: getShareRequestUrl(req),
    destination: `${getStudentOrigin()}/teacher/${encodeURIComponent(teacher._id)}`,
    type: "profile",
  });
});
