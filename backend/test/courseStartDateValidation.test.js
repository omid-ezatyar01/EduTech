import assert from "node:assert/strict";
import test from "node:test";

import { updateCourseByTeacherSchema } from "../src/validators/course.validators.js";

const getDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

const zonedMidnightToUtc = ({ year, month, day }, timeZone) => {
  const desiredUtc = Date.UTC(year, month - 1, day);
  let instant = desiredUtc;

  for (let pass = 0; pass < 3; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const representedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    instant += desiredUtc - representedUtc;
  }

  return new Date(instant);
};

const getNextAllowedDate = (timeZone) => {
  const nowParts = getDateParts(new Date(), timeZone);
  const candidates = [];

  for (let month = 1; month <= 12; month += 1) {
    for (const day of [1, 15]) {
      const key = nowParts.year * 10_000 + month * 100 + day;
      const todayKey = nowParts.year * 10_000 + nowParts.month * 100 + nowParts.day;
      if (key >= todayKey) candidates.push({ month, day });
    }
  }

  return {
    selected: { year: nowParts.year, ...(candidates[0] || { month: 12, day: 15 }) },
    hasFutureCandidate: candidates.length > 0,
  };
};

test("teacher start-date validation uses the course calendar day in every timezone region", () => {
  const timezones = [
    "Pacific/Kiritimati",
    "Pacific/Chatham",
    "Asia/Kathmandu",
    "Asia/Tehran",
    "Europe/London",
    "America/St_Johns",
    "America/Los_Angeles",
    "Pacific/Pago_Pago",
  ];

  timezones.forEach((timezone) => {
    const { selected, hasFutureCandidate } = getNextAllowedDate(timezone);
    const utcInstant = zonedMidnightToUtc(selected, timezone).toISOString();
    const { error } = updateCourseByTeacherSchema.validate({
      startDate: utcInstant,
      timezone,
    });

    assert.doesNotMatch(
      error?.message || "",
      /Course start date can only be the 1st or 15th of a month/,
      timezone,
    );
    if (hasFutureCandidate) assert.equal(error, undefined, timezone);
  });
});
