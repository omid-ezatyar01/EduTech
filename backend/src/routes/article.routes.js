import express from "express";
import { admin, protect } from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import requireApprovedTeacher from "../middlewares/requireApprovedTeacher.js";
import articleCoverUpload from "../middlewares/articleCoverUpload.js";
import validateRequest from "../middlewares/validateRequest.js";
import { createArticle, createTeacherArticle, deleteArticle, deleteTeacherArticle, getAdminArticles, getPublicArticleBySlug, getPublicArticles, getTeacherArticles, updateArticle, updateTeacherArticle, uploadArticleCover } from "../controllers/articleController.js";
import { adminArticleQuerySchema, articleIdParamSchema, articleSlugParamSchema, createArticleSchema, publicArticleQuerySchema, updateArticleSchema } from "../validators/article.validators.js";

const router = express.Router();

router.get("/articles", validateRequest(publicArticleQuerySchema, "query"), getPublicArticles);
router.get("/articles/:slug", validateRequest(articleSlugParamSchema, "params"), getPublicArticleBySlug);

router.get("/teacher/articles", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(adminArticleQuerySchema, "query"), getTeacherArticles);
router.post("/teacher/articles/cover", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), articleCoverUpload.single("cover"), uploadArticleCover);
router.post("/teacher/articles", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(createArticleSchema), createTeacherArticle);
router.patch("/teacher/articles/:id", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(articleIdParamSchema, "params"), validateRequest(updateArticleSchema), updateTeacherArticle);
router.delete("/teacher/articles/:id", protect, authorizeRoles("teacher"), requireApprovedTeacher({ allowAdmin: false }), validateRequest(articleIdParamSchema, "params"), deleteTeacherArticle);

router.get("/admin/articles", protect, admin, validateRequest(adminArticleQuerySchema, "query"), getAdminArticles);
router.post("/admin/articles/cover", protect, admin, articleCoverUpload.single("cover"), uploadArticleCover);
router.post("/admin/articles", protect, admin, validateRequest(createArticleSchema), createArticle);
router.patch("/admin/articles/:id", protect, admin, validateRequest(articleIdParamSchema, "params"), validateRequest(updateArticleSchema), updateArticle);
router.delete("/admin/articles/:id", protect, admin, validateRequest(articleIdParamSchema, "params"), deleteArticle);

export default router;
