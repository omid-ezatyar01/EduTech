import test from "node:test";
import assert from "node:assert/strict";
import CourseRating from "../src/models/CourseRating.js";

test("new course ratings are published immediately by default", () => {
  const rating = new CourseRating({
    studentId: "507f1f77bcf86cd799439011",
    courseId: "507f1f77bcf86cd799439012",
    teacherId: "507f1f77bcf86cd799439013",
    courseRating: 5,
    comment: "Excellent course",
  });

  assert.equal(rating.moderationStatus, "published");
});
