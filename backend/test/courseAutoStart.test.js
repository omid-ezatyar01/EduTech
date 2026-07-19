import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureCourseAutoStarted,
  resolveNextCourseStartDate,
  resolveCourseScheduledStartAt,
  shouldAutoStartCourse,
} from "../src/utils/courseAutoStart.js";
import Course from "../src/models/Course.js";

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

test("a missed start on the 1st moves to the 15th", () => {
  const result = resolveNextCourseStartDate("2026-07-01T09:30:00");

  assert.ok(result instanceof Date);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 6);
  assert.equal(result.getDate(), 15);
  assert.equal(result.getHours(), 9);
  assert.equal(result.getMinutes(), 30);
});

test("a missed start on or after the 15th moves to the 1st of the next month", () => {
  const result = resolveNextCourseStartDate("2026-07-19T09:30:00");

  assert.ok(result instanceof Date);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 7);
  assert.equal(result.getDate(), 1);
});

test("the next start date crosses into a new year", () => {
  const result = resolveNextCourseStartDate("2026-12-15T09:30:00");

  assert.ok(result instanceof Date);
  assert.equal(result.getFullYear(), 2027);
  assert.equal(result.getMonth(), 0);
  assert.equal(result.getDate(), 1);
});

test("an overdue course below its minimum is rescheduled instead of started", async () => {
  const originalFindOneAndUpdate = Course.findOneAndUpdate;
  let capturedUpdate = null;
  Course.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update;
    return { _id: "course-1" };
  };

  const course = {
    _id: "course-1",
    status: "published",
    isPublished: true,
    startDate: new Date("2026-07-15T00:00:00"),
    endDate: new Date("2026-08-15T00:00:00"),
    schedule: [{ day: "wednesday", startTime: "09:30", endTime: "11:00" }],
    minimumStudentsToStart: 5,
  };

  try {
    await ensureCourseAutoStarted(course, {
      now: "2026-07-15T09:45:00",
      activeStudentsCount: 0,
    });
  } finally {
    Course.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(course.classStartedAt, undefined);
  assert.equal(course.startDate.getFullYear(), 2026);
  assert.equal(course.startDate.getMonth(), 7);
  assert.equal(course.startDate.getDate(), 1);
  assert.equal(course.startDate.getHours(), 0);
  assert.equal(capturedUpdate.$set.classStartedAt, undefined);
  assert.equal(capturedUpdate.$set.startDate.getDate(), 1);
  assert.equal(
    course.lastAutoRescheduledAt.getTime(),
    new Date("2026-07-15T09:45:00").getTime(),
  );
});

test("an overdue course starts when its real enrollment count reaches the minimum", async () => {
  const originalFindOneAndUpdate = Course.findOneAndUpdate;
  let capturedUpdate = null;
  Course.findOneAndUpdate = async (_filter, update) => {
    capturedUpdate = update;
    return { _id: "course-2" };
  };

  const course = {
    _id: "course-2",
    status: "published",
    isPublished: true,
    startDate: new Date("2026-07-15T00:00:00"),
    schedule: [{ day: "wednesday", startTime: "09:30", endTime: "11:00" }],
    minimumStudentsToStart: 5,
  };

  try {
    await ensureCourseAutoStarted(course, {
      now: "2026-07-15T09:45:00",
      activeStudentsCount: 5,
    });
  } finally {
    Course.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(course.classStartedAt.getTime(), new Date("2026-07-15T09:45:00").getTime());
  assert.equal(capturedUpdate.$set.startDate, undefined);
  assert.equal(
    capturedUpdate.$set.classStartedAt.getTime(),
    new Date("2026-07-15T09:45:00").getTime(),
  );
});
