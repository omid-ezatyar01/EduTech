import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCourseScheduledStartAt,
  shouldAutoStartCourse,
} from "../src/utils/courseAutoStart.js";

test("course scheduled start combines start date with lesson start time", () => {
  const result = resolveCourseScheduledStartAt({
    startDate: "2026-07-20T00:00:00",
    schedule: [
      { day: "monday", startTime: "09:30", endTime: "11:00" },
    ],
  });

  assert.ok(result instanceof Date);
  assert.equal(result.getHours(), 9);
  assert.equal(result.getMinutes(), 30);
});

test("course does not auto-start before the scheduled time even if minimum students are met", () => {
  const result = shouldAutoStartCourse(
    {
      status: "published",
      isPublished: true,
      startDate: "2026-07-20T00:00:00",
      schedule: [{ day: "monday", startTime: "09:30", endTime: "11:00" }],
      minimumStudentsToStart: 5,
      enrolledStudentsCount: 5,
    },
    { now: "2026-07-20T09:29:00" },
  );

  assert.equal(result, false);
});

test("course does not auto-start when scheduled time is reached but minimum students are not met", () => {
  const result = shouldAutoStartCourse(
    {
      status: "published",
      isPublished: true,
      startDate: "2026-07-20T00:00:00",
      schedule: [{ day: "monday", startTime: "09:30", endTime: "11:00" }],
      minimumStudentsToStart: 5,
      enrolledStudentsCount: 4,
    },
    { now: "2026-07-20T09:45:00" },
  );

  assert.equal(result, false);
});

test("course auto-starts only after scheduled time when minimum students are met", () => {
  const result = shouldAutoStartCourse(
    {
      status: "published",
      isPublished: true,
      startDate: "2026-07-20T00:00:00",
      schedule: [{ day: "monday", startTime: "09:30", endTime: "11:00" }],
      minimumStudentsToStart: 5,
      enrolledStudentsCount: 5,
    },
    { now: "2026-07-20T09:45:00" },
  );

  assert.equal(result, true);
});
