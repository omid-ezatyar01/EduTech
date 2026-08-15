import assert from "node:assert/strict";
import test from "node:test";

import { isGoogleOnlyStudentAuth } from "../src/config/authMode.js";

test("student authentication defaults to Google-only", () => {
  assert.equal(isGoogleOnlyStudentAuth(undefined), true);
  assert.equal(isGoogleOnlyStudentAuth("true"), true);
  assert.equal(isGoogleOnlyStudentAuth("1"), true);
});

test("email and password forms can be restored explicitly", () => {
  assert.equal(isGoogleOnlyStudentAuth("false"), false);
  assert.equal(isGoogleOnlyStudentAuth("0"), false);
});
