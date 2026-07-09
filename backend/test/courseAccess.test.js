import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCourseAccessWindow,
  resolveCoursePaymentPlan,
} from "../src/utils/courseAccess.js";

test("legacy courses default to monthly payments", () => {
  assert.equal(resolveCoursePaymentPlan({}), "monthly");
});

test("monthly payment grants one month of access", () => {
  const window = resolveCourseAccessWindow({
    course: {
      paymentPlan: "monthly",
      startDate: "2026-07-01T13:30:00.000Z",
      endDate: "2026-10-31T14:30:00.000Z",
    },
    paidAt: "2026-06-28T10:00:00.000Z",
  });

  assert.equal(window.paymentPlan, "monthly");
  assert.equal(window.accessStartsAt.toISOString(), "2026-07-01T13:30:00.000Z");
  assert.equal(window.accessExpiresAt.toISOString(), "2026-08-01T13:30:00.000Z");
});

test("monthly renewal extends existing access but never beyond course end", () => {
  const window = resolveCourseAccessWindow({
    course: {
      paymentPlan: "monthly",
      startDate: "2026-07-01T13:30:00.000Z",
      endDate: "2026-08-20T14:30:00.000Z",
    },
    paidAt: "2026-07-20T10:00:00.000Z",
    previousAccessExpiresAt: "2026-08-01T13:30:00.000Z",
  });

  assert.equal(window.accessStartsAt.toISOString(), "2026-08-01T13:30:00.000Z");
  assert.equal(window.accessExpiresAt.toISOString(), "2026-08-20T14:30:00.000Z");
});

test("whole-period payment grants access through course end", () => {
  const window = resolveCourseAccessWindow({
    course: {
      paymentPlan: "whole_period",
      startDate: "2026-07-01T13:30:00.000Z",
      endDate: "2026-10-31T14:30:00.000Z",
    },
    paidAt: "2026-06-28T10:00:00.000Z",
  });

  assert.equal(window.paymentPlan, "whole_period");
  assert.equal(window.accessStartsAt.toISOString(), "2026-07-01T13:30:00.000Z");
  assert.equal(window.accessExpiresAt.toISOString(), "2026-10-31T14:30:00.000Z");
});
