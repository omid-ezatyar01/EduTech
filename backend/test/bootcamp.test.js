import assert from "node:assert/strict";
import test from "node:test";

import bootcampRoutes from "../src/routes/bootcamp.routes.js";
import {
  createBootcampSchema,
  registerBootcampSchema,
  updateBootcampSchema,
} from "../src/validators/bootcamp.validators.js";

const teacherId = "507f1f77bcf86cd799439011";

test("bootcamp exposes public, student, and protected admin routes", () => {
  const routes = bootcampRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

  assert.ok(routes.some((route) => route.path === "/bootcamps" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/bootcamps/:slug/register" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/student/bootcamp-registrations" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/admin/bootcamps" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/admin/bootcamps/cover" && route.methods.includes("post")));
  assert.ok(routes.some((route) => route.path === "/admin/bootcamps/:id/registrations" && route.methods.includes("get")));
  assert.ok(routes.some((route) => route.path === "/admin/bootcamps/:id" && route.methods.includes("delete")));
});

test("bootcamp validation enforces limits and free registration consent", () => {
  const valid = createBootcampSchema.validate({
    title: { fa: "بوت‌کمپ توسعه وب", en: "Web Development Bootcamp" },
    teacherId,
    minimumStudents: 10,
    maximumStudents: 30,
    status: "registration_open",
  });
  assert.equal(valid.error, undefined);

  assert.ok(createBootcampSchema.validate({
    title: { en: "Invalid limits" },
    teacherId,
    minimumStudents: 31,
    maximumStudents: 30,
  }).error);
  assert.ok(updateBootcampSchema.validate({
    registrationOpensAt: "2026-09-20T10:00:00.000Z",
    registrationClosesAt: "2026-09-19T10:00:00.000Z",
  }).error);

  assert.equal(registerBootcampSchema.validate({
    phone: "+93 700 000 000",
    country: "Afghanistan",
    experienceLevel: "beginner",
    consent: true,
  }).error, undefined);
  assert.ok(registerBootcampSchema.validate({
    phone: "+93 700 000 000",
    country: "Afghanistan",
    consent: false,
  }).error);
});
