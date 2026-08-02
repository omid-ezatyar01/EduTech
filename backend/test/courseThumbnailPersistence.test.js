import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import request from "supertest";
import app from "../src/app.js";
import CourseThumbnailAsset from "../src/models/CourseThumbnailAsset.js";
import { saveCourseThumbnailFromBuffer } from "../src/utils/courseImage.js";

test("missing local course thumbnail is served from its durable database copy", async (t) => {
  const originalFindOne = CourseThumbnailAsset.findOne;
  t.after(() => {
    CourseThumbnailAsset.findOne = originalFindOne;
  });

  const image = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 20, g: 80, b: 160 },
    },
  }).webp().toBuffer();

  CourseThumbnailAsset.findOne = ({ filename }) => ({
    lean: async () => ({ filename, contentType: "image/webp", data: image }),
  });

  const response = await request(app)
    .get("/uploads/course-thumbnails/course-test-999999.webp")
    .expect(200)
    .expect("Content-Type", /image\/webp/);

  assert.deepEqual(response.body, image);
  assert.match(response.headers["cache-control"], /immutable/);
});

test("saving a course thumbnail writes a durable database copy", async (t) => {
  const originalUpdateOne = CourseThumbnailAsset.updateOne;
  let persisted = null;
  let savedFile = "";

  CourseThumbnailAsset.updateOne = async (...args) => {
    persisted = args;
    return { acknowledged: true, upsertedCount: 1 };
  };

  t.after(async () => {
    CourseThumbnailAsset.updateOne = originalUpdateOne;
    if (savedFile) await fs.unlink(savedFile).catch(() => {});
  });

  const source = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 30, g: 120, b: 70 },
    },
  }).png().toBuffer();

  const thumbnail = await saveCourseThumbnailFromBuffer("testasset", source);
  savedFile = path.resolve("uploads", thumbnail.replace(/^\/uploads\//, ""));

  assert.match(thumbnail, /^\/uploads\/course-thumbnails\/course-testasset-\d+\.webp$/);
  assert.equal(persisted?.[0]?.filename, path.basename(thumbnail));
  assert.equal(persisted?.[1]?.$set?.contentType, "image/webp");
  assert.ok(Buffer.isBuffer(persisted?.[1]?.$set?.data));
  assert.equal(persisted?.[2]?.upsert, true);
});
