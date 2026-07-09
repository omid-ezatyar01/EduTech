import Course from "../models/Course.js";
import Payment from "../models/Payment.js";
import { getTeacherDeductionPercentage } from "./platformSettings.js";

export const roundMoney = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

const teacherCourseFilter = (teacherId) => ({
  $or: [{ teacher: teacherId }, { teacherId }, { createdBy: teacherId }],
});

export const calculateTeacherEarnings = async (teacherId) => {
  const commissionRate = await getTeacherDeductionPercentage();
  const courses = await Course.find(teacherCourseFilter(teacherId))
    .select("title")
    .lean();
  const courseIds = courses.map((course) => course._id);

  if (!courseIds.length) {
    return {
      commissionRate,
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
      paymentsCount: 0,
      courseWise: [],
    };
  }

  const paidPayments = await Payment.find({
    courseId: { $in: courseIds },
    $or: [{ status: "paid" }, { paymentStatus: "paid" }],
  })
    .populate("studentId", "_id")
    .populate("courseId", "title")
    .sort({ paidAt: -1, updatedAt: -1, createdAt: -1 })
    .lean();

  let totalRevenue = 0;
  let platformCommission = 0;
  const courseWiseMap = new Map();

  for (const payment of paidPayments) {
    if (!payment?.studentId?._id) continue;
    const amount = Number(payment.amount) || 0;
    const commissionAmount = (amount * commissionRate) / 100;

    totalRevenue += amount;
    platformCommission += commissionAmount;

    const courseKey = String(payment.courseId?._id || payment.courseId);
    const existing = courseWiseMap.get(courseKey) || {
      courseId: payment.courseId?._id || payment.courseId,
      courseTitle: payment.courseId?.title || "Unknown Course",
      salesCount: 0,
      totalRevenue: 0,
      platformCommission: 0,
      teacherEarnings: 0,
    };

    existing.salesCount += 1;
    existing.totalRevenue += amount;
    existing.platformCommission += commissionAmount;
    courseWiseMap.set(courseKey, existing);
  }

  const roundedTotalRevenue = roundMoney(totalRevenue);
  const roundedPlatformCommission = roundMoney(platformCommission);

  return {
    commissionRate,
    totalRevenue: roundedTotalRevenue,
    platformCommission: roundedPlatformCommission,
    teacherEarnings: roundMoney(roundedTotalRevenue - roundedPlatformCommission),
    paymentsCount: Array.from(courseWiseMap.values()).reduce(
      (sum, row) => sum + Number(row.salesCount || 0),
      0,
    ),
    courseWise: Array.from(courseWiseMap.values())
      .map((row) => {
        const rowTotalRevenue = roundMoney(row.totalRevenue);
        const rowPlatformCommission = roundMoney(row.platformCommission);

        return {
          ...row,
          totalRevenue: rowTotalRevenue,
          platformCommission: rowPlatformCommission,
          teacherEarnings: roundMoney(rowTotalRevenue - rowPlatformCommission),
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
};
