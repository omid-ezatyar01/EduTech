import assert from "node:assert/strict";
import test from "node:test";
import { deriveStudentMetrics } from "../src/controllers/teacherPortalController.js";

const buildMetrics = (overrides = {}) =>
  deriveStudentMetrics({
    enrollmentStatus: "active",
    attendance: 0,
    hasAttendanceData: false,
    assignmentTotal: 0,
    submittedAssignments: 0,
    ...overrides,
  });

test("a newly enrolled active student starts with zero progress", () => {
  const metrics = buildMetrics();

  assert.equal(metrics.progress, 0);
  assert.equal(metrics.attendance, 0);
});

test("active student progress uses only recorded activity", () => {
  const metrics = buildMetrics({
    attendance: 75,
    hasAttendanceData: true,
    assignmentTotal: 4,
    submittedAssignments: 1,
  });

  assert.equal(metrics.progress, 50);
  assert.equal(metrics.assignments, "1 / 4");
});

test("inactive enrollments stay at zero and completed enrollments stay at 100", () => {
  const activity = {
    attendance: 80,
    hasAttendanceData: true,
    assignmentTotal: 2,
    submittedAssignments: 1,
  };

  assert.equal(buildMetrics({ ...activity, enrollmentStatus: "pending" }).progress, 0);
  assert.equal(buildMetrics({ ...activity, enrollmentStatus: "cancelled" }).progress, 0);
  assert.equal(buildMetrics({ ...activity, enrollmentStatus: "completed" }).progress, 100);
});
