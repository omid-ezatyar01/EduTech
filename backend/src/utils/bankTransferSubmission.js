export const normalizeBankTransferSubmissionState = (payment = null) => {
  if (!payment) {
    return {
      hasSubmission: false,
      canResubmit: true,
      status: "none",
      reviewStatus: "not_applicable",
      paymentStatus: "none",
      message: "",
      submittedAt: null,
    };
  }

  const reviewStatus = String(payment.bankTransferReviewStatus || "not_applicable").trim();
  const paymentStatus = String(payment.paymentStatus || payment.status || "").trim();
  const submittedAt = payment.paymentProofSubmittedAt || payment.updatedAt || payment.createdAt || null;

  if (reviewStatus === "rejected_by_teacher" || paymentStatus === "failed") {
    return {
      hasSubmission: true,
      canResubmit: true,
      status: "rejected",
      reviewStatus,
      paymentStatus,
      message: "Your previous bank transfer proof was rejected. You can submit a new one.",
      submittedAt,
    };
  }

  if (reviewStatus === "approved_by_teacher" || paymentStatus === "paid") {
    return {
      hasSubmission: true,
      canResubmit: false,
      status: "approved",
      reviewStatus,
      paymentStatus,
      message: "Your bank transfer payment has already been approved.",
      submittedAt,
    };
  }

  return {
    hasSubmission: true,
    canResubmit: false,
    status: "pending_review",
    reviewStatus,
    paymentStatus,
    message: "Your previous bank transfer proof is still waiting for teacher review.",
    submittedAt,
  };
};
