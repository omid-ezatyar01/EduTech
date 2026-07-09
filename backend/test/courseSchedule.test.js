import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCourseSchedule,
  getUniqueTeachingDays,
} from "../src/utils/courseSchedule.js";

const schedule = [
  { day: "monday", startTime: "18:00", endTime: "19:00" },
  { day: "wednesday", startTime: "18:00", endTime: "19:00" },
];

test("counts unique teaching days", () => {
  assert.equal(getUniqueTeachingDays([...schedule, schedule[0]]).size, 2);
});

test("places a ninth session in a partial fifth week", () => {
  const result = deriveCourseSchedule({
    startDate: new Date(2026, 5, 1, 18, 0, 0),
    schedule,
    totalSessions: 9,
  });

  assert.equal(result.durationWeeks, 5);
  assert.equal(result.endDate.getFullYear(), 2026);
  assert.equal(result.endDate.getMonth(), 5);
  assert.equal(result.endDate.getDate(), 29);
  assert.equal(result.endDate.getHours(), 19);
});

test("rejects invalid session totals", () => {
  assert.equal(
    deriveCourseSchedule({
      startDate: new Date(2026, 5, 1, 18, 0, 0),
      schedule,
      totalSessions: 0,
    }),
    null,
  );
});
