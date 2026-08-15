import assert from "node:assert/strict";
import test from "node:test";

import heroMediaRoutes from "../src/routes/heroMedia.routes.js";
import {
  createHeroMediaSchema,
  updateHeroMediaSchema,
} from "../src/validators/heroMedia.validators.js";

test("hero media exposes one public route and protected admin management routes", () => {
  const routes = heroMediaRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

  assert.ok(routes.some((route) => route.path === "/hero-media" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/admin/hero-media/upload" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/admin/hero-media/:id" && route.methods.includes("patch")));
  assert.ok(routes.some((route) => route.path === "/admin/hero-media/:id" && route.methods.includes("delete")));
});

test("hero media validation accepts images and rejects videos", () => {
  const image = createHeroMediaSchema.validate({
    mediaType: "image",
    mediaUrl: "/uploads/hero-media/hero-test-1.webp",
    sortOrder: 2,
    displayDurationSeconds: 7,
  });
  assert.equal(image.error, undefined);
  assert.equal(image.value.status, "active");

  const video = createHeroMediaSchema.validate({
    mediaType: "video",
    mediaUrl: "/uploads/hero-media/hero-test-2.mp4",
  });
  assert.ok(video.error);
  assert.ok(updateHeroMediaSchema.validate({ displayDurationSeconds: 31 }).error);
});
