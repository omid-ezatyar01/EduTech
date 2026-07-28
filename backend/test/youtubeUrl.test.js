import test from "node:test";
import assert from "node:assert/strict";
import {
  getYouTubeVideoId,
  normalizeYouTubeUrl,
} from "../src/utils/youtubeUrl.js";

test("accepts common YouTube profile video link formats", () => {
  const id = "M7lc1UVf-VE";
  const links = [
    `https://www.youtube.com/watch?v=${id}&feature=share`,
    `https://youtu.be/${id}?si=example`,
    `youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=shared`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ];

  links.forEach((link) => {
    assert.equal(getYouTubeVideoId(link), id);
    assert.equal(
      normalizeYouTubeUrl(link),
      `https://www.youtube.com/watch?v=${id}`,
    );
  });
});

test("extracts a YouTube link copied with surrounding share text", () => {
  assert.equal(
    normalizeYouTubeUrl("Watch this: https://youtu.be/M7lc1UVf-VE."),
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  );
});

test("rejects channels, malformed ids, and non-YouTube hosts", () => {
  assert.equal(normalizeYouTubeUrl("https://youtube.com/@edutech"), "");
  assert.equal(normalizeYouTubeUrl("https://youtube.com/watch?v=x"), "");
  assert.equal(normalizeYouTubeUrl("https://example.com/watch?v=M7lc1UVf-VE"), "");
});
