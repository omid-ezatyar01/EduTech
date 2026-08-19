import assert from "node:assert/strict";
import test from "node:test";

import {
  dateTimeInputInZoneToIso,
  formatDateTimeInputInZone,
} from "../src/utils/timezone.js";

test("bootcamp datetime-local values are saved and restored as Kabul time", () => {
  const input = "2026-08-24T06:06";
  const iso = dateTimeInputInZoneToIso(input, "Asia/Kabul");

  assert.equal(iso, "2026-08-24T01:36:00.000Z");
  assert.equal(formatDateTimeInputInZone(iso, "Asia/Kabul"), input);
});
