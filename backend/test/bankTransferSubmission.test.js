import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBankTransferSubmissionState } from "../src/utils/bankTransferSubmission.js";

test("no previous bank transfer submission allows a fresh submit", () => {
  const result = normalizeBankTransferSubmissionState(null);

  assert.equal(result.hasSubmission, false);
  assert.equal(result.canResubmit, true);
  assert.equal(result.status, "none");
});

test("pending teacher review blocks duplicate resubmission", () => {
  const result = normalizeBankTransferSubmissionState({
    bankTransferReviewStatus: "pending_teacher_review",
    paymentStatus: "pending",
    paymentProofSubmittedAt: "2026-07-14T08:00:00.000Z",
  });

  assert.equal(result.hasSubmission, true);
  assert.equal(result.canResubmit, false);
  assert.equal(result.status, "pending_review");
});

test("approved bank transfer blocks duplicate resubmission", () => {
  const result = normalizeBankTransferSubmissionState({
    bankTransferReviewStatus: "approved_by_teacher",
    paymentStatus: "paid",
  });

  assert.equal(result.hasSubmission, true);
  assert.equal(result.canResubmit, false);
  assert.equal(result.status, "approved");
});

test("rejected bank transfer allows a new submission", () => {
  const result = normalizeBankTransferSubmissionState({
    bankTransferReviewStatus: "rejected_by_teacher",
    paymentStatus: "failed",
  });

  assert.equal(result.hasSubmission, true);
  assert.equal(result.canResubmit, true);
  assert.equal(result.status, "rejected");
});
