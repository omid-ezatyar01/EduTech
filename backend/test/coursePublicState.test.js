import assert from "node:assert/strict";
import test from "node:test";

import { getCoursePublicState } from "../src/utils/coursePublicState.js";

const publishedCourse = {
  _id: "course-1",
  status: "published",
  isPublished: true,
  lifecycleStatus: "enrollment_open",
  startDate: "2026-08-15T12:00:00.000Z",
  maxStudents: 30,
  enrolledStudentsCount: 10,
};

test("public state hides internal minimum-not-reached terminology", () => {
  const state = getCoursePublicState({
    course: { ...publishedCourse, lifecycleStatus: "minimum_not_reached" },
    currentDate: "2026-08-15T13:00:00.000Z",
  });

  assert.equal(state.key, "postponed");
  assert.equal(state.label.en, "Start date being finalized");
});

test("public state reports almost-full and full capacity", () => {
  assert.equal(
    getCoursePublicState({
      course: { ...publishedCourse, enrolledStudentsCount: 25 },
      currentDate: "2026-08-01T12:00:00.000Z",
    }).key,
    "almost_full",
  );
  assert.equal(
    getCoursePublicState({
      course: { ...publishedCourse, enrolledStudentsCount: 30 },
      currentDate: "2026-08-01T12:00:00.000Z",
    }).key,
    "full",
  );
});

test("payment requirement has priority over a live session", () => {
  const state = getCoursePublicState({
    course: { ...publishedCourse, lifecycleStatus: "in_progress", classStartedAt: new Date() },
    enrollment: {
      enrollmentStatus: "active",
      accessStatus: "blocked",
      paymentId: { paymentStatus: "pending" },
    },
    currentSession: { status: "live" },
  });

  assert.equal(state.key, "payment_required");
  assert.equal(state.primaryAction.key, "complete_payment");
});

test("an active enrolled student receives the course workspace action", () => {
  const state = getCoursePublicState({
    course: { ...publishedCourse, lifecycleStatus: "in_progress", classStartedAt: new Date() },
    enrollment: { enrollmentStatus: "active", accessStatus: "allowed" },
  });

  assert.equal(state.key, "in_progress");
  assert.equal(state.userState.key, "enrolled_active");
  assert.equal(state.primaryAction.url, "/student/course/course-1");
});
