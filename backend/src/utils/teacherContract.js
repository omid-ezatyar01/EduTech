export const isTeacherContractExpired = (user) => {
  if (!user || user.role !== "teacher") return false;
  if (user.contractExpiryOverride) return false;
  if (!user.contractValidUntil) return false;

  const validUntil = new Date(user.contractValidUntil);
  if (Number.isNaN(validUntil.getTime())) return false;

  return validUntil.getTime() < Date.now();
};

export const blockTeacherIfContractExpired = async (user) => {
  if (!isTeacherContractExpired(user)) {
    return false;
  }

  if (user.status !== "blocked") {
    user.status = "blocked";
    await user.save();
  }

  return true;
};
