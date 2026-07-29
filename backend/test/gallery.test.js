import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import GalleryImage from "../src/models/GalleryImage.js";
import {
  createGalleryCategorySchema,
  createGalleryImageSchema,
  publicGalleryQuerySchema,
} from "../src/validators/gallery.validators.js";

test("gallery images validate Persian title and category", async () => {
  const item = new GalleryImage({
    title: { fa: "صنف انگلیسی" },
    category: "classes",
    image: "/uploads/gallery/gallery-abc123-123.webp",
    createdBy: new mongoose.Types.ObjectId(),
  });

  await item.validate();
  assert.equal(item.status, "published");
  assert.equal(item.category, "classes");
});

test("gallery payload validation rejects unsafe category names", () => {
  const valid = createGalleryImageSchema.validate({
    title: { fa: "رویداد ویژه" },
    category: "special-events",
    image: "/uploads/gallery/gallery-abc123-123.webp",
  });
  assert.equal(valid.error, undefined);
  assert.equal(valid.value.status, "published");

  const invalid = createGalleryImageSchema.validate({
    title: { fa: "رویداد" },
    category: "../events",
    image: "/uploads/gallery/gallery-abc123-123.webp",
  });
  assert.ok(invalid.error);
});

test("reusable gallery categories require a safe English slug", () => {
  assert.equal(
    createGalleryCategorySchema.validate({ name: "student-events" }).error,
    undefined,
  );
  assert.ok(createGalleryCategorySchema.validate({ name: "رویدادها" }).error);
});

test("public gallery queries apply safe pagination defaults", () => {
  const result = publicGalleryQuerySchema.validate({});
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, {
    category: "all",
    page: 1,
    limit: 48,
  });
});
