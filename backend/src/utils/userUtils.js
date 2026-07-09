export const cleanUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar || "",
    role: user.role,
    status: user.status,
    birthDate: user.birthDate || "",
    gender: user.gender || "",
    country: user.country || "",
    city: user.city || "",
    address: user.address || "",
    postalCode: user.postalCode || "",
    preferredLanguage: user.preferredLanguage || "",
    timezone: user.timezone || "",
    emergencyContactName: user.emergencyContactName || "",
    emergencyContactPhone: user.emergencyContactPhone || "",
    bio: user.bio || "",
    contractStartDate: user.contractStartDate || null,
    contractValidUntil: user.contractValidUntil || null,
    socialLinks: {
      linkedin: user?.socialLinks?.linkedin || "",
      youtube: user?.socialLinks?.youtube || "",
      instagram: user?.socialLinks?.instagram || "",
      facebook: user?.socialLinks?.facebook || "",
      whatsapp: user?.socialLinks?.whatsapp || "",
      twitter: user?.socialLinks?.twitter || "",
      github: user?.socialLinks?.github || "",
    },
    teacherApplication: {
      status: user?.teacherApplication?.status || "draft",
      submittedAt: user?.teacherApplication?.submittedAt || null,
      reviewedAt: user?.teacherApplication?.reviewedAt || null,
      reviewedBy: user?.teacherApplication?.reviewedBy || null,
      reviewNote: user?.teacherApplication?.reviewNote || "",
      professionalTitle: user?.teacherApplication?.professionalTitle || "",
      yearsExperience: Number(user?.teacherApplication?.yearsExperience || 0),
      education: user?.teacherApplication?.education || "",
      expertiseAreas: Array.isArray(user?.teacherApplication?.expertiseAreas)
        ? user.teacherApplication.expertiseAreas
        : [],
      teachingLevels: Array.isArray(user?.teacherApplication?.teachingLevels)
        ? user.teacherApplication.teachingLevels
        : [],
      certifications: Array.isArray(user?.teacherApplication?.certifications)
        ? user.teacherApplication.certifications
        : [],
      languages: Array.isArray(user?.teacherApplication?.languages)
        ? user.teacherApplication.languages
        : [],
      skillRatings: Array.isArray(user?.teacherApplication?.skillRatings)
        ? user.teacherApplication.skillRatings.map((item) => ({
            name: String(item?.name || "").trim(),
            percentage: Number(item?.percentage || 0),
          }))
        : [],
      portfolioUrl: user?.teacherApplication?.portfolioUrl || "",
      cvUrl: user?.teacherApplication?.cvUrl || "",
      certificatesFileUrl: user?.teacherApplication?.certificatesFileUrl || "",
      introVideoUrl: user?.teacherApplication?.introVideoUrl || "",
      nationalId: user?.teacherApplication?.nationalId || "",
      availableHoursPerWeek: Number(user?.teacherApplication?.availableHoursPerWeek || 0),
      expectedMonthlySalaryAfn: Number(user?.teacherApplication?.expectedMonthlySalaryAfn || 0),
      motivation: user?.teacherApplication?.motivation || "",
    },
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
