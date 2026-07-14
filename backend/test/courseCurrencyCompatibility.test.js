import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Course from "../src/models/Course.js";
import {
  createCourseByAdminSchema,
  updateCourseByTeacherSchema,
} from "../src/validators/course.validators.js";

const createBaseCourse = (currency = "USD") => ({
  title: "Legacy course currency compatibility",
  description:
    "This is a long enough description for validating legacy course currency compatibility in the model and schema layer without requiring a database connection.",
  category: new mongoose.Types.ObjectId().toString(),
  teacher: new mongoose.Types.ObjectId().toString(),
  level: "beginner",
  language: "English",
  price: 25,
  currency,
  isFree: false,
  startDate: new Date("2026-07-20T00:00:00.000Z"),
  schedule: [
    { day: "monday", startTime: "09:30", endTime: "11:00" },
    { day: "wednesday", startTime: "09:30", endTime: "11:00" },
  ],
  requirements: ["Basic laptop skills"],
  whatYouWillLearn: ["Handle course pricing safely"],
  targetAudience: ["Students needing compatibility fixes"],
  curriculumTopics: ["Legacy data compatibility"],
  totalSessions: 8,
});

test("Course schema supports legacy AFN and IRR currency values", () => {
  const enumValues = Course.schema.path("currency").enumValues;

  assert.deepEqual(enumValues, ["USD", "AFN", "IRR"]);
});

test("course create validator accepts AFN for legacy/admin compatibility", () => {
  const { error, value } = createCourseByAdminSchema.validate(createBaseCourse("AFN"));

  assert.equal(error, undefined);
  assert.equal(value.currency, "AFN");
});

test("course update validator accepts IRR for legacy/teacher compatibility", () => {
  const { error, value } = updateCourseByTeacherSchema.validate({ currency: "IRR" });

  assert.equal(error, undefined);
  assert.equal(value.currency, "IRR");
});
