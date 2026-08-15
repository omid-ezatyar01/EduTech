import assert from "node:assert/strict";
import test from "node:test";

import { resolvePasswordResetRole } from "../src/controllers/authController.js";
import authRoutes from "../src/routes/authRoutes.routes.js";

test("student password recovery routes are registered", () => {
  const paths = authRoutes.stack.map((layer) => layer.route?.path).filter(Boolean);
  assert.ok(paths.includes("/student/password-reset/request"));
  assert.ok(paths.includes("/student/password-reset/verify"));
  assert.ok(paths.includes("/student/password-reset/reset"));
});

test("password recovery preserves student role isolation", () => {
  assert.equal(resolvePasswordResetRole("student"), "student");
  assert.equal(resolvePasswordResetRole("teacher"), "teacher");
  assert.equal(resolvePasswordResetRole("admin"), "admin");
  assert.equal(resolvePasswordResetRole("support"), "teacher");
});
