import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import mockingoose from "mockingoose";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import { protect } from "../src/middlewares/authMiddleware.js";

const JWT_SECRET = "restart-stable-test-secret-restart-stable-test-secret";

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  mockingoose.resetAll();
});

test("the same signed login remains valid after a simulated process restart", async () => {
  const userId = new mongoose.Types.ObjectId();
  const token = jwt.sign(
    { id: userId, role: "student", tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
  mockingoose(User).toReturn({
    _id: userId,
    role: "student",
    status: "active",
    isEmailVerified: true,
    tokenVersion: 0,
  }, "findOne");

  for (let processBoot = 1; processBoot <= 2; processBoot += 1) {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createResponse();
    let continued = false;
    await protect(req, res, () => {
      continued = true;
    });

    assert.equal(continued, true, `process boot ${processBoot}`);
    assert.equal(res.statusCode, 200);
    assert.equal(String(req.user?._id), String(userId));
  }
});

test("a temporary database/auth service failure is retryable and does not impersonate an invalid token", async () => {
  const userId = new mongoose.Types.ObjectId();
  const token = jwt.sign(
    { id: userId, role: "teacher", tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
  mockingoose(User).toReturn(new Error("database is warming up"), "findOne");

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  await protect(req, res, () => {
    throw new Error("must not continue");
  });

  assert.equal(res.statusCode, 503);
  assert.equal(res.body?.code, "AUTH_SERVICE_UNAVAILABLE");
  assert.equal(res.headers["Retry-After"], "3");
});

test("an actually invalid token returns a terminal machine-readable auth code", async () => {
  const req = { headers: { authorization: "Bearer invalid-token" } };
  const res = createResponse();
  await protect(req, res, () => {
    throw new Error("must not continue");
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.code, "AUTH_TOKEN_INVALID");
});

