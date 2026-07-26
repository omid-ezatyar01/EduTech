import assert from "node:assert/strict";
import test from "node:test";
import { isAuthExpiredResponse as isStudentSessionExpired } from "../../frontend/services/portal.js";
import { isAuthExpiredResponse as isTeacherSessionExpired } from "../../teacher/services/portal.js";
import { isAuthExpiredResponse as isAdminSessionExpired } from "../../admin/services/portal.js";

const portalChecks = [
  ["student", isStudentSessionExpired],
  ["teacher", isTeacherSessionExpired],
  ["admin", isAdminSessionExpired],
];

for (const [portal, isExpired] of portalChecks) {
  test(`${portal} keeps its login during temporary restart failures`, () => {
    assert.equal(
      isExpired(
        503,
        "Authentication service is temporarily unavailable. Please retry.",
        "AUTH_SERVICE_UNAVAILABLE",
      ),
      false,
    );
    assert.equal(isExpired(401, "Temporary upstream response", ""), false);
  });

  test(`${portal} clears its login only for terminal token failures`, () => {
    assert.equal(isExpired(401, "Not authorized, token expired", "AUTH_TOKEN_EXPIRED"), true);
    assert.equal(isExpired(401, "Not authorized, token failed", "AUTH_TOKEN_INVALID"), true);
    assert.equal(isExpired(403, "This action is not allowed", ""), false);
  });
}

