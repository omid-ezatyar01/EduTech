import assert from "node:assert/strict";
import test from "node:test";

import { resolveHeroMediaLink } from "../services/heroMediaService.js";

test("hero advertisement links accept internal paths and http(s) URLs", () => {
  assert.equal(resolveHeroMediaLink(" /packages/web-development "), "/packages/web-development");
  assert.equal(resolveHeroMediaLink("https://edutech.study/packages"), "https://edutech.study/packages");
  assert.equal(resolveHeroMediaLink("http://example.com/offer"), "http://example.com/offer");
});

test("hero advertisement links reject unsafe or malformed destinations", () => {
  assert.equal(resolveHeroMediaLink("javascript:alert(1)"), "");
  assert.equal(resolveHeroMediaLink("//unsafe.example"), "");
  assert.equal(resolveHeroMediaLink("not a URL"), "");
  assert.equal(resolveHeroMediaLink(""), "");
});
