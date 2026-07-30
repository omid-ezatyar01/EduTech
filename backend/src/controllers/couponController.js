import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import Course from "../models/Course.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { normalizeCouponCode } from "../services/coupon.service.js";

const mapCoupon = (coupon, now = new Date()) => {
  const row = typeof coupon?.toObject === "function" ? coupon.toObject() : coupon;
  let computedStatus = row?.status || "inactive";
  if (computedStatus === "active") {
    if (row?.startsAt && new Date(row.startsAt) > now) computedStatus = "scheduled";
    else if (row?.expiresAt && new Date(row.expiresAt) <= now) computedStatus = "expired";
    else if (row?.usageLimit && Number(row.usageCount || 0) >= Number(row.usageLimit)) {
      computedStatus = "used_up";
    }
  }
  return {
    ...row,
    status: computedStatus,
    minimumPurchaseUsd: Number(row?.minimumPurchaseUsdCents || 0) / 100,
    usage: Number(row?.usageCount || 0),
    limit: row?.usageLimit ?? null,
  };
};

const toStoragePayload = (body, userId) => {
  const payload = {
    ...body,
    updatedBy: userId,
  };
  if (body.code !== undefined) payload.code = normalizeCouponCode(body.code);
  if (body.minimumPurchaseUsd !== undefined) {
    payload.minimumPurchaseUsdCents = Math.round(
      Number(body.minimumPurchaseUsd || 0) * 100,
    );
  }
  delete payload.minimumPurchaseUsd;
  return payload;
};

const ensureCouponCoursesExist = async (courseIds = []) => {
  if (!courseIds.length) return;
  const count = await Course.countDocuments({ _id: { $in: courseIds } });
  if (count !== courseIds.length) {
    throw new ApiError(400, "One or more selected courses do not exist");
  }
};

export const getAdminCoupons = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const now = new Date();
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) {
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { code: { $regex: escaped, $options: "i" } },
      { title: { $regex: escaped, $options: "i" } },
    ];
  }
  if (req.query.status === "active") {
    filter.status = "active";
    filter.$and = [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      {
        $expr: {
          $or: [
            { $eq: ["$usageLimit", null] },
            { $lt: ["$usageCount", "$usageLimit"] },
          ],
        },
      },
    ];
  } else if (req.query.status === "inactive") filter.status = "inactive";
  else if (req.query.status === "scheduled") {
    filter.status = "active";
    filter.startsAt = { $gt: now };
  }
  else if (req.query.status === "expired") {
    filter.status = "active";
    filter.expiresAt = { $lte: now };
  }
  else if (req.query.status === "used_up") {
    filter.status = "active";
    filter.usageLimit = { $ne: null };
    filter.$expr = { $gte: ["$usageCount", "$usageLimit"] };
  }

  const activeFilter = {
    status: "active",
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      {
        $expr: {
          $or: [
            { $eq: ["$usageLimit", null] },
            { $lt: ["$usageCount", "$usageLimit"] },
          ],
        },
      },
    ],
  };
  const [rows, total, totalCoupons, activeCoupons, percentCoupons, usageRows] = await Promise.all([
    Coupon.find(filter)
      .populate("courseIds", "title")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Coupon.countDocuments(filter),
    Coupon.countDocuments(),
    Coupon.countDocuments(activeFilter),
    Coupon.countDocuments({ type: "percent" }),
    Coupon.aggregate([
      { $group: { _id: null, total: { $sum: "$usageCount" } } },
    ]),
  ]);

  return res.json(
    new ApiResponse({
      message: "Coupons fetched successfully",
      data: {
        coupons: rows.map((row) => mapCoupon(row, now)),
        summary: {
          total: totalCoupons,
          active: activeCoupons,
          percent: percentCoupons,
          usage: Number(usageRows?.[0]?.total || 0),
        },
      },
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    }),
  );
});

export const createAdminCoupon = asyncHandler(async (req, res) => {
  const payload = toStoragePayload(req.validated?.body || req.body, req.user._id);
  await ensureCouponCoursesExist(payload.courseIds || []);
  const duplicate = await Coupon.exists({ code: payload.code });
  if (duplicate) throw new ApiError(409, "Coupon code already exists");
  payload.createdBy = req.user._id;
  let coupon;
  try {
    coupon = await Coupon.create(payload);
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "Coupon code already exists");
    }
    if (error?.name === "ValidationError") {
      throw new ApiError(400, error.message);
    }
    throw error;
  }
  await coupon.populate("courseIds", "title");
  return res.status(201).json(
    new ApiResponse({
      message: "Coupon created successfully",
      data: { coupon: mapCoupon(coupon) },
    }),
  );
});

export const updateAdminCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found");
  const payload = toStoragePayload(req.validated?.body || req.body, req.user._id);
  if (payload.courseIds) await ensureCouponCoursesExist(payload.courseIds);
  if (payload.code && payload.code !== coupon.code) {
    const duplicate = await Coupon.exists({ code: payload.code, _id: { $ne: coupon._id } });
    if (duplicate) throw new ApiError(409, "Coupon code already exists");
  }
  Object.assign(coupon, payload);
  try {
    await coupon.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "Coupon code already exists");
    }
    if (
      error?.name === "ValidationError" ||
      /coupon expiry|percentage coupons/i.test(String(error?.message || ""))
    ) {
      throw new ApiError(400, error.message);
    }
    throw error;
  }
  await coupon.populate("courseIds", "title");
  return res.json(
    new ApiResponse({
      message: "Coupon updated successfully",
      data: { coupon: mapCoupon(coupon) },
    }),
  );
});

export const deactivateAdminCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    { $set: { status: "inactive", updatedBy: req.user._id } },
    { returnDocument: "after" },
  );
  if (!coupon) throw new ApiError(404, "Coupon not found");
  return res.json(
    new ApiResponse({
      message: "Coupon deactivated successfully",
      data: { coupon: mapCoupon(coupon) },
    }),
  );
});

export const getAdminCouponUsage = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) throw new ApiError(404, "Coupon not found");
  const redemptions = await CouponRedemption.find({ couponId: coupon._id })
    .populate("userId", "name email")
    .populate("courseId", "title")
    .sort({ redeemedAt: -1 })
    .limit(100)
    .lean();
  return res.json(
    new ApiResponse({
      message: "Coupon usage fetched successfully",
      data: { coupon: mapCoupon(coupon), redemptions },
    }),
  );
});

export const getCouponCourseOptions = asyncHandler(async (_req, res) => {
  const courses = await Course.find({
    status: { $in: ["published", "approved", "active"] },
    isPublished: { $ne: false },
  })
    .select("title")
    .sort({ title: 1 })
    .limit(500)
    .lean();
  return res.json(
    new ApiResponse({
      message: "Coupon course options fetched successfully",
      data: { courses },
    }),
  );
});
