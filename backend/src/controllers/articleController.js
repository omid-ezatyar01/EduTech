import Article from "../models/Article.js";
import ArticleView from "../models/ArticleView.js";
import crypto from "node:crypto";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { removeArticleCoverIfLocal, saveArticleCoverFromBuffer } from "../utils/articleCover.js";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const articleVisitorHash = (req) => {
  const suppliedId = String(req.get("x-edutech-visitor-id") || "").trim();
  const visitorKey = /^[a-zA-Z0-9_-]{16,100}$/.test(suppliedId)
    ? suppliedId
    : `${req.ip || "unknown"}|${req.get("user-agent") || "unknown"}`;
  return crypto.createHash("sha256").update(visitorKey).digest("hex");
};

const slugify = (value = "") => String(value)
  .normalize("NFKC")
  .toLowerCase()
  .trim()
  .replace(/[^\p{L}\p{N}]+/gu, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120);

const calculateReadMinutes = (content = {}) => {
  const words = `${content.fa || ""} ${content.en || ""}`.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(240, Math.ceil(words / 400)));
};

const assertCompleteArticleLanguages = ({ title = {}, excerpt = {}, content = {} }) => {
  let completedLanguages = 0;
  for (const language of ["fa", "en"]) {
    const fields = [title?.[language], excerpt?.[language], content?.[language]]
      .map((field) => String(field || "").trim());
    const started = fields.some(Boolean);
    const complete = fields.every(Boolean);
    if (started && !complete) throw new ApiError(400, "Complete the title, excerpt, and content for each language you use");
    if (complete) completedLanguages += 1;
  }
  if (completedLanguages === 0) throw new ApiError(400, "Complete the article in at least one language: Persian or English");
};

const mergedLocalizedFields = (existing, payload) => Object.fromEntries(
  ["title", "excerpt", "content"].map((field) => [field, Object.fromEntries(
    ["fa", "en"].map((language) => [
      language,
      Object.prototype.hasOwnProperty.call(payload[field] || {}, language)
        ? payload[field][language]
        : existing[field]?.[language],
    ]),
  )]),
);

const searchFilter = (search) => {
  if (!search) return {};
  const pattern = new RegExp(escapeRegex(search), "i");
  return { $or: [{ "title.fa": pattern }, { "title.en": pattern }, { "excerpt.fa": pattern }, { "excerpt.en": pattern }, { tags: pattern }] };
};

const ensureUniqueSlug = async (requestedSlug, title, excludeId = null) => {
  const base = slugify(requestedSlug || title?.en || title?.fa) || `article-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (await Article.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base.slice(0, Math.max(1, 116 - String(suffix).length))}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export const getPublicArticles = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 9);
  const category = req.query.category || "all";
  const search = req.query.search || "";
  const sort = req.query.sort || "latest";
  const filter = {
    status: "published",
    publishedAt: { $lte: new Date() },
    ...(req.query.authorId ? { author: req.query.authorId } : {}),
    ...(category && category !== "all" ? { category } : {}),
    ...searchFilter(search),
  };
  const order = sort === "popular" ? { viewCount: -1, publishedAt: -1 } : { featured: -1, publishedAt: -1 };
  const [articles, total, categories] = await Promise.all([
    Article.find(filter).select("-content -seoTitle -seoDescription").populate("author", "name avatar").sort(order).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
    Article.distinct("category", { status: "published", publishedAt: { $lte: new Date() } }),
  ]);
  res.set("Cache-Control", "no-store");
  return res.json(new ApiResponse({
    message: "Articles fetched successfully",
    data: articles,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total, category, sort, categories: categories.sort() },
  }));
});

export const getPublicArticleBySlug = asyncHandler(async (req, res) => {
  const article = await Article.findOne(
    { slug: req.params.slug.toLowerCase(), status: "published", publishedAt: { $lte: new Date() } },
  );
  if (!article) throw new ApiError(404, "Article not found");
  try {
    const view = await ArticleView.updateOne(
      { article: article._id, visitorHash: articleVisitorHash(req) },
      { $setOnInsert: { article: article._id, visitorHash: articleVisitorHash(req) } },
      { upsert: true },
    );
    if (view.upsertedCount > 0) {
      article.viewCount += 1;
      await Article.updateOne({ _id: article._id }, { $inc: { viewCount: 1 } });
    }
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  await article.populate("author", "name avatar");
  res.set("Cache-Control", "no-store");
  return res.json(new ApiResponse({ message: "Article fetched successfully", data: article.toObject() }));
});

export const getAdminArticles = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const status = req.query.status || "all";
  const filter = { ...(status !== "all" ? { status } : {}), ...searchFilter(req.query.search || "") };
  const [articles, total] = await Promise.all([
    Article.find(filter).populate("author", "name avatar").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);
  return res.json(new ApiResponse({ message: "Admin articles fetched successfully", data: articles, meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total } }));
});

export const getTeacherArticles = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const status = req.query.status || "all";
  const filter = {
    author: req.user._id,
    ...(status !== "all" ? { status } : {}),
    ...searchFilter(req.query.search || ""),
  };
  const [articles, total] = await Promise.all([
    Article.find(filter).populate("author", "name avatar").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);
  return res.json(new ApiResponse({ message: "Teacher articles fetched successfully", data: articles, meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total } }));
});

export const uploadArticleCover = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new ApiError(400, "Please select an article cover image");
  const coverImage = await saveArticleCoverFromBuffer(req.user._id, req.file.buffer);
  return res.status(201).json(new ApiResponse({ message: "Article cover uploaded successfully", data: { coverImage } }));
});

export const createArticle = asyncHandler(async (req, res) => {
  assertCompleteArticleLanguages(req.body);
  const slug = await ensureUniqueSlug(req.body.slug, req.body.title);
  const publishedAt = req.body.status === "published" ? new Date() : null;
  const article = await Article.create({
    ...req.body,
    slug,
    author: req.user._id,
    publishedAt,
    estimatedReadMinutes: calculateReadMinutes(req.body.content),
  });
  return res.status(201).json(new ApiResponse({ message: "Article created successfully", data: article }));
});

export const createTeacherArticle = asyncHandler(async (req, res) => {
  assertCompleteArticleLanguages(req.body);
  const slug = await ensureUniqueSlug(req.body.slug, req.body.title);
  const publishedAt = req.body.status === "published" ? new Date() : null;
  const article = await Article.create({
    ...req.body,
    slug,
    featured: false,
    author: req.user._id,
    publishedAt,
    estimatedReadMinutes: calculateReadMinutes(req.body.content),
  });
  return res.status(201).json(new ApiResponse({ message: "Article created successfully", data: article }));
});

export const updateArticle = asyncHandler(async (req, res) => {
  const existing = await Article.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Article not found");
  const payload = { ...req.body };
  assertCompleteArticleLanguages(mergedLocalizedFields(existing, payload));
  if (Object.prototype.hasOwnProperty.call(payload, "slug")) payload.slug = await ensureUniqueSlug(payload.slug, payload.title || existing.title, existing._id);
  if (payload.status === "published" && existing.status !== "published") payload.publishedAt = new Date();
  if (payload.status === "draft") payload.publishedAt = null;
  if (payload.content) payload.estimatedReadMinutes = calculateReadMinutes(payload.content);
  const article = await Article.findByIdAndUpdate(existing._id, payload, { returnDocument: "after", runValidators: true });
  if (Object.prototype.hasOwnProperty.call(payload, "coverImage") && payload.coverImage !== existing.coverImage) {
    await removeArticleCoverIfLocal(existing.coverImage);
  }
  return res.json(new ApiResponse({ message: "Article updated successfully", data: article }));
});

export const updateTeacherArticle = asyncHandler(async (req, res) => {
  const existing = await Article.findOne({ _id: req.params.id, author: req.user._id });
  if (!existing) throw new ApiError(404, "Article not found");
  const payload = { ...req.body };
  delete payload.featured;
  assertCompleteArticleLanguages(mergedLocalizedFields(existing, payload));
  if (Object.prototype.hasOwnProperty.call(payload, "slug")) payload.slug = await ensureUniqueSlug(payload.slug, payload.title || existing.title, existing._id);
  if (payload.status === "published" && existing.status !== "published") payload.publishedAt = new Date();
  if (payload.status === "draft") payload.publishedAt = null;
  if (payload.content) payload.estimatedReadMinutes = calculateReadMinutes(payload.content);
  const article = await Article.findOneAndUpdate(
    { _id: existing._id, author: req.user._id },
    payload,
    { returnDocument: "after", runValidators: true },
  );
  if (Object.prototype.hasOwnProperty.call(payload, "coverImage") && payload.coverImage !== existing.coverImage) {
    await removeArticleCoverIfLocal(existing.coverImage);
  }
  return res.json(new ApiResponse({ message: "Article updated successfully", data: article }));
});

export const deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) throw new ApiError(404, "Article not found");
  await ArticleView.deleteMany({ article: article._id });
  await removeArticleCoverIfLocal(article.coverImage);
  return res.json(new ApiResponse({ message: "Article deleted successfully", data: { id: article._id } }));
});

export const deleteTeacherArticle = asyncHandler(async (req, res) => {
  const article = await Article.findOneAndDelete({ _id: req.params.id, author: req.user._id });
  if (!article) throw new ApiError(404, "Article not found");
  await ArticleView.deleteMany({ article: article._id });
  await removeArticleCoverIfLocal(article.coverImage);
  return res.json(new ApiResponse({ message: "Article deleted successfully", data: { id: article._id } }));
});
