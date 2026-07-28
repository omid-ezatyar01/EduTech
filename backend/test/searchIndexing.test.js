import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import app from "../src/app.js";

test("API root explicitly opts out of search indexing", async () => {
  const response = await request(app).get("/").expect(200);

  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
  assert.equal(response.body.message, "EduTech API is running");
});

test("unknown API routes also opt out of search indexing", async () => {
  const response = await request(app).get("/not-a-route").expect(404);

  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
});
