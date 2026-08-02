import assert from "node:assert/strict";
import test from "node:test";
import Course from "../src/models/Course.js";
import { updateCourseByTeacherSchema } from "../src/validators/course.validators.js";

test("teacher course updates accept searchable English and Persian keywords", () => {
  const tags = ["JavaScript", "طراحی وب", "فرانت اند"];
  const validation = updateCourseByTeacherSchema.validate({ tags });

  assert.equal(validation.error, undefined);
  assert.deepEqual(validation.value.tags, tags);

  const modelValidationError = Course.schema.path("tags").doValidateSync(tags, {});
  assert.equal(modelValidationError, undefined);
});

test("teacher course keyword validation rejects unsafe limits", () => {
  const tooMany = updateCourseByTeacherSchema.validate({
    tags: Array.from({ length: 11 }, (_, index) => `keyword-${index}`),
  });
  const tooLong = updateCourseByTeacherSchema.validate({ tags: ["x".repeat(31)] });
  const duplicates = updateCourseByTeacherSchema.validate({ tags: ["React", "react"] });

  assert.ok(tooMany.error);
  assert.ok(tooLong.error);
  assert.match(duplicates.error?.message || "", /duplicates/i);
});
