import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import learningPackageRoutes from "../src/routes/learningPackage.routes.js";
import LearningPackage from "../src/models/LearningPackage.js";
import { encodeLearningPackageCover } from "../src/utils/learningPackageCover.js";
import {
  createLearningPackageSchema,
  updateLearningPackageSchema,
} from "../src/validators/learningPackage.validators.js";

const courseId = "680000000000000000000001";

test("learning packages expose public reads and protected admin CRUD routes", () => {
  const routes = learningPackageRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  assert.ok(routes.some((route) => route.path === "/packages" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/packages/:slug" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/admin/packages" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/admin/packages/cover" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/admin/packages/:id" && route.methods.includes("patch")));
  assert.ok(routes.some((route) => route.path === "/admin/packages/:id" && route.methods.includes("delete")));
});

test("package validation accepts only normalized local cover images", () => {
  const base = {
    title: { en: "Web Development" },
    status: "draft",
    steps: [{ title: { en: "HTML" }, courses: [] }],
  };
  assert.equal(createLearningPackageSchema.validate({
    ...base,
    coverImage: "/uploads/learning-package-covers/package-admin-123.webp",
  }).error, undefined);
  assert.ok(createLearningPackageSchema.validate({
    ...base,
    coverImage: "https://untrusted.example/package.jpg",
  }).error);
});

test("package covers are normalized to a responsive 1600 by 900 WebP", async () => {
  const portraitSource = await sharp({
    create: {
      width: 700,
      height: 1200,
      channels: 3,
      background: "#2563eb",
    },
  }).png().toBuffer();
  const result = await encodeLearningPackageCover(portraitSource);
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 900);
  assert.equal(metadata.format, "webp");
  assert.ok(result.length <= 400 * 1024);
});

test("package validation accepts incomplete drafts but keeps course IDs unique", () => {
  const valid = createLearningPackageSchema.validate({
    title: { en: "Web Development", fa: "توسعه وب" },
    status: "published",
    steps: [{ title: { en: "HTML and CSS" }, courses: [courseId] }],
  });
  assert.equal(valid.error, undefined);
  assert.equal(createLearningPackageSchema.validate({
    title: { en: "Draft package" },
    status: "draft",
    steps: [{ title: { en: "Unfinished step" }, courses: [] }],
  }).error, undefined);
  assert.ok(createLearningPackageSchema.validate({ title: { en: "Empty" }, steps: [] }).error);
  assert.ok(updateLearningPackageSchema.validate({
    steps: [{ title: { en: "Duplicate" }, courses: [courseId, courseId] }],
  }).error);
});

test("package model permits empty draft steps but blocks publishing them", async () => {
  const base = {
    title: { en: "Draft package" },
    slug: `draft-package-${Date.now()}`,
    createdBy: "680000000000000000000002",
    steps: [{ title: { en: "Unfinished" }, courses: [] }],
  };
  await assert.doesNotReject(() => new LearningPackage({ ...base, status: "draft" }).validate());
  await assert.rejects(
    () => new LearningPackage({ ...base, status: "published" }).validate(),
    /must contain between 1 and 20 courses/i,
  );
});
