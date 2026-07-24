import assert from "node:assert/strict";
import test from "node:test";

import { deriveSessionStatus } from "../src/controllers/liveSessionController.js";

const baseSession = {
  status: "scheduled",
  startAt: "2026-07-24T10:00:00.000Z",
  endAt: "2026-07-24T11:00:00.000Z",
};

test("a scheduled session becomes ready shortly before its start time", () => {
  assert.equal(
    deriveSessionStatus(baseSession, new Date("2026-07-24T09:50:00.000Z")),
    "ready",
  );
});

test("a session never becomes live without an explicit teacher action", () => {
  assert.equal(
    deriveSessionStatus(baseSession, new Date("2026-07-24T10:30:00.000Z")),
    "ready",
  );
});

test("an unstarted session becomes missed after its scheduled end", () => {
  assert.equal(
    deriveSessionStatus(baseSession, new Date("2026-07-24T11:01:00.000Z")),
    "missed",
  );
});

test("explicit live and completed states remain authoritative", () => {
  assert.equal(
    deriveSessionStatus(
      { ...baseSession, status: "live" },
      new Date("2026-07-24T11:30:00.000Z"),
    ),
    "live",
  );
  assert.equal(
    deriveSessionStatus(
      { ...baseSession, status: "completed" },
      new Date("2026-07-24T10:30:00.000Z"),
    ),
    "completed",
  );
});
