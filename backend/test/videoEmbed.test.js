import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVideoLink } from "../src/utils/videoEmbed.js";

test("normalizes supported YouTube links to safe iframe URLs", () => {
  const result = normalizeVideoLink("https://youtu.be/M7lc1UVf-VE?t=4");
  assert.equal(result.platform, "youtube");
  assert.equal(result.embedUrl, "https://www.youtube.com/embed/M7lc1UVf-VE");
});

test("normalizes supported Instagram reel links", () => {
  const result = normalizeVideoLink("https://www.instagram.com/reel/C9x_test-1/");
  assert.equal(result.platform, "instagram");
  assert.equal(result.embedUrl, "https://www.instagram.com/reel/C9x_test-1/embed/");
});

test("rejects links from untrusted websites", () => {
  assert.throws(() => normalizeVideoLink("https://example.com/video/123"));
  assert.throws(() => normalizeVideoLink("javascript:alert(1)"));
});
