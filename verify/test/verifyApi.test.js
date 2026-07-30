import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVerifyUrl,
  mapVerifiedCertificate,
  normalizeCertificateCode,
} from "../src/services/verifyApi.js";

test("normalizes certificate IDs before verification", () => {
  assert.equal(normalizeCertificateCode("  ed-2026-abc123  "), "ED-2026-ABC123");
});

test("builds one deterministic URL without duplicated API prefixes", () => {
  assert.equal(
    buildVerifyUrl(
      "https://api.example.test/api/v1/",
      "/api/v1/certificates/verify/",
      "ED-2026-ABC123",
    ),
    "https://api.example.test/api/v1/certificates/verify/ED-2026-ABC123",
  );
  assert.equal(
    buildVerifyUrl(
      "https://api.example.test/api",
      "/api/v1/certificates/verify",
      "ED-2026-ABC123",
    ),
    "https://api.example.test/api/v1/certificates/verify/ED-2026-ABC123",
  );
});

test("accepts only explicitly valid backend certificate payloads", () => {
  assert.deepEqual(
    mapVerifiedCertificate(
      {
        certificateId: "ED-2026-ABC123",
        isValid: true,
        studentName: "Student",
        courseTitle: "Course",
        teacherName: "Teacher",
        issuedAt: "2026-07-30T00:00:00.000Z",
      },
      "ED-2026-ABC123",
    ),
    {
      certificateId: "ED-2026-ABC123",
      studentName: "Student",
      courseTitle: "Course",
      teacherName: "Teacher",
      issuedAt: "2026-07-30T00:00:00.000Z",
      status: "Verified",
      certificateUrl: "",
    },
  );

  assert.throws(
    () =>
      mapVerifiedCertificate(
        { certificateId: "ED-2026-ABC123", isValid: false },
        "ED-2026-ABC123",
      ),
    (error) => error?.type === "server" && error?.statusCode === 502,
  );
  assert.throws(
    () => mapVerifiedCertificate({}, "ED-2026-ABC123"),
    (error) => error?.type === "server",
  );
});
