import Joi from "joi";
import { objectId } from "./common.validators.js";

// Editors may type a human-readable Persian or English phrase. The controller
// normalizes it into a URL-safe, unique slug before storing it.
const slug = Joi.string().trim().max(200);
const localizedRequired = (max) => Joi.object({
  fa: Joi.string().trim().allow("").max(max).default(""),
  en: Joi.string().trim().allow("").max(max).default(""),
}).required();
const localizedOptional = (max) => Joi.object({
  fa: Joi.string().trim().allow("").max(max),
  en: Joi.string().trim().allow("").max(max),
});

const articleFields = {
  slug,
  title: localizedRequired(160),
  excerpt: localizedRequired(400),
  content: localizedRequired(50000),
  category: Joi.string().trim().lowercase().max(50).pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tags: Joi.array().items(Joi.string().trim().max(40)).max(12),
  coverImage: Joi.string().trim().allow("").max(1000),
  status: Joi.string().valid("draft", "published"),
  featured: Joi.boolean(),
  seoTitle: localizedOptional(180),
  seoDescription: localizedOptional(320),
};

const validateArticleLanguages = (value, helpers) => {
  let completedLanguages = 0;
  for (const language of ["fa", "en"]) {
    const fields = [value.title?.[language], value.excerpt?.[language], value.content?.[language]]
      .map((field) => String(field || "").trim());
    const started = fields.some(Boolean);
    const complete = fields.every(Boolean);
    if (started && !complete) return helpers.error("article.incompleteLanguage");
    if (complete) completedLanguages += 1;
  }
  if (completedLanguages === 0) return helpers.error("article.languageRequired");
  return value;
};

export const createArticleSchema = Joi.object({
  ...articleFields,
  slug: articleFields.slug.allow("").default(""),
  category: articleFields.category.required(),
  status: articleFields.status.default("draft"),
  featured: articleFields.featured.default(false),
  tags: articleFields.tags.default([]),
}).custom(validateArticleLanguages).messages({
  "article.incompleteLanguage": "Complete the title, excerpt, and content for each language you use",
  "article.languageRequired": "Complete the article in at least one language: Persian or English",
});

export const updateArticleSchema = Joi.object({
  ...articleFields,
  title: localizedOptional(160),
  excerpt: localizedOptional(400),
  content: localizedOptional(50000),
}).min(1);

export const articleIdParamSchema = Joi.object({ id: objectId.required() });
export const articleSlugParamSchema = Joi.object({ slug: Joi.string().trim().max(120).required() });

export const publicArticleQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(24).default(9),
  category: Joi.string().trim().lowercase().max(50).allow("", "all").default("all"),
  search: Joi.string().trim().max(100).allow("").default(""),
  sort: Joi.string().valid("latest", "popular").default("latest"),
  authorId: objectId,
});

export const adminArticleQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().valid("all", "draft", "published").default("all"),
  search: Joi.string().trim().max(100).allow("").default(""),
});
