export const expireStalePendingPaymentAttempts = async (
  attemptsCollection,
  now = new Date(),
) => {
  if (!attemptsCollection?.updateMany) {
    throw new TypeError("A payment attempts collection is required");
  }

  return attemptsCollection.updateMany(
    {
      status: "PENDING",
      expiresAt: { $lt: now },
      paidAt: null,
      verifiedAt: null,
    },
    {
      $set: {
        status: "EXPIRED",
        updatedAt: now,
      },
    },
  );
};
