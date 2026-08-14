import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import { createTeacherByAdmin } from "../src/controllers/adminController.js";

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

test("admin-created teachers receive unique one-time temporary passwords", async (t) => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const createdPayloads = [];

  t.after(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  });

  User.findOne = async () => null;
  User.create = async (payload) => {
    createdPayloads.push(payload);
    return {
      ...payload,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  const responses = [];
  for (const email of ["first@example.com", "second@example.com"]) {
    const response = createResponse();
    await createTeacherByAdmin({ body: { email } }, response);
    responses.push(response);
  }

  for (const [index, response] of responses.entries()) {
    assert.equal(response.statusCode, 201);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.match(response.body.temporaryPassword, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(createdPayloads[index].password, response.body.temporaryPassword);
    assert.equal(response.body.teacher.password, undefined);
  }

  assert.notEqual(responses[0].body.temporaryPassword, responses[1].body.temporaryPassword);
  assert.notEqual(responses[0].body.temporaryPassword, "123456");
  assert.notEqual(responses[1].body.temporaryPassword, "123456");
});
