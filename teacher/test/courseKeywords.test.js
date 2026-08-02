import assert from "node:assert/strict";
import test from "node:test";
import {
  getCourseKeywordsError,
  parseCourseKeywords,
} from "../src/utils/courseKeywords.js";

test("course keywords accept English and Persian separators and remove duplicates", () => {
  assert.deepEqual(
    parseCourseKeywords("JavaScript, react، آموزش وب\nREACT؛ فرانت اند"),
    ["JavaScript", "react", "آموزش وب", "فرانت اند"],
  );
});

test("course keywords enforce API-compatible item and length limits", () => {
  assert.equal(getCourseKeywordsError("python, programming", "en"), "");
  assert.match(
    getCourseKeywordsError(Array.from({ length: 11 }, (_, index) => `tag${index}`).join(","), "en"),
    /no more than 10/i,
  );
  assert.match(getCourseKeywordsError("x".repeat(31), "en"), /30 characters/i);
});
