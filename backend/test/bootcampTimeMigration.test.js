import assert from "node:assert/strict";
import test from "node:test";

import {
  interpretLegacyUtcWallClockAsKabul,
  syncInternalBootcampCourseStartDates,
} from "../src/utils/bootcampTimeMigration.js";

test("legacy bootcamp wall-clock timestamps are corrected to Kabul time", () => {
  const corrected = interpretLegacyUtcWallClockAsKabul("2026-08-26T14:58:00.000Z");

  assert.equal(corrected.toISOString(), "2026-08-26T10:28:00.000Z");
});

test("internal bootcamp course start dates follow their bootcamp schedule", async () => {
  const plannedStartAt = new Date("2026-08-26T10:28:00.000Z");
  const calls = [];
  const bootcamps = {
    find: async function* find() {
      yield { courseId: "course-id", plannedStartAt };
    },
  };
  const courses = {
    updateOne: async (...args) => {
      calls.push(args);
      return { modifiedCount: 1 };
    },
  };

  assert.equal(await syncInternalBootcampCourseStartDates(bootcamps, courses), 1);
  assert.deepEqual(calls[0], [
    {
      _id: "course-id",
      isBootcampInternal: true,
      startDate: { $ne: plannedStartAt },
    },
    { $set: { startDate: plannedStartAt } },
  ]);
});
