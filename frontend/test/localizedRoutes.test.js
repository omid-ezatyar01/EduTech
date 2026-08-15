import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalizedSiteUrl,
  getLanguageFromPathname,
  getLocalizedBasename,
  localizePath,
  stripLanguagePrefix,
} from "../src/utils/localizedRoutes.js";

test("detects supported language prefixes without matching similar paths", () => {
  assert.equal(getLanguageFromPathname("/en/courses"), "en");
  assert.equal(getLanguageFromPathname("/fa"), "fa");
  assert.equal(getLanguageFromPathname("/english"), null);
});

test("provides a router basename for localized and legacy URLs", () => {
  assert.equal(getLocalizedBasename("/en/teachers"), "/en");
  assert.equal(getLocalizedBasename("/fa/teachers"), "/fa");
  assert.equal(getLocalizedBasename("/teachers"), "/");
});

test("converts app paths into stable localized paths", () => {
  assert.equal(stripLanguagePrefix("/en/course/ielts"), "/course/ielts");
  assert.equal(localizePath("/course/ielts", "fa"), "/fa/course/ielts");
  assert.equal(localizePath("/fa/course/ielts", "en"), "/en/course/ielts");
  assert.equal(localizePath("/", "fa"), "/fa/");
  assert.equal(localizePath("/", "en"), "/en/");
});

test("builds localized absolute URLs for structured data", () => {
  assert.equal(
    buildLocalizedSiteUrl("/teachers", "en"),
    "https://edutech.study/en/teachers",
  );
});
