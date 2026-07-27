import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { resolveApiRateLimitIdentity } from "../src/middlewares/apiRateLimitIdentity.js";

const secret = "rate-limit-test-secret-with-more-than-32-characters";

const request = ({ ip, token = "" }) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
  ip,
  socket: { remoteAddress: ip },
});

test("valid authenticated requests are limited by account instead of shared IP", () => {
  const firstToken = jwt.sign({ id: "student-1" }, secret, { expiresIn: "1h" });
  const secondToken = jwt.sign({ id: "student-1" }, secret, { expiresIn: "1h" });

  const first = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: firstToken }),
    secret,
  );
  const second = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: secondToken }),
    secret,
  );

  assert.deepEqual(first, {
    authenticated: true,
    key: "account:student-1",
  });
  assert.deepEqual(second, first);
});

test("different authenticated accounts behind one IP receive separate buckets", () => {
  const student = jwt.sign({ id: "student-1" }, secret, { expiresIn: "1h" });
  const teacher = jwt.sign({ id: "teacher-1" }, secret, { expiresIn: "1h" });

  const studentIdentity = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: student }),
    secret,
  );
  const teacherIdentity = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: teacher }),
    secret,
  );

  assert.notEqual(studentIdentity.key, teacherIdentity.key);
});

test("invalid tokens cannot bypass the public IP limit", () => {
  const first = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: "invalid-one" }),
    secret,
  );
  const second = resolveApiRateLimitIdentity(
    request({ ip: "203.0.113.10", token: "invalid-two" }),
    secret,
  );

  assert.equal(first.authenticated, false);
  assert.equal(second.authenticated, false);
  assert.equal(first.key, second.key);
  assert.match(first.key, /^ip:/);
});
