import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import mockingoose from "mockingoose";
import Coupon from "../src/models/Coupon.js";
import CouponRedemption from "../src/models/CouponRedemption.js";
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../src/validators/coupon.validators.js";
import {
  calculateCouponDiscountUsdCents,
  normalizeCouponCode,
  resolveCouponForCheckout,
} from "../src/services/coupon.service.js";

test("coupon codes normalize consistently and reject unsafe input", () => {
  assert.equal(normalizeCouponCode("  summer_26 "), "SUMMER_26");
  const valid = validateCouponSchema.validate({
    code: "summer-26",
    courseId: new mongoose.Types.ObjectId().toString(),
    pricingRegion: "afghanistan",
  });
  assert.equal(valid.error, undefined);
  assert.equal(valid.value.code, "SUMMER-26");

  const invalid = validateCouponSchema.validate({
    code: "bad code!",
    courseId: new mongoose.Types.ObjectId().toString(),
  });
  assert.ok(invalid.error);
});

test("coupon discount math uses integer USD cents", () => {
  assert.equal(
    calculateCouponDiscountUsdCents(
      { type: "percent", discountValue: 12.5 },
      1999,
    ),
    250,
  );
  assert.equal(
    calculateCouponDiscountUsdCents(
      { type: "fixed", discountValue: 3.25 },
      1999,
    ),
    325,
  );
});

test("coupon creation validates percentage and date boundaries", () => {
  const base = {
    code: "WELCOME10",
    title: "Welcome",
    type: "percent",
    discountValue: 10,
    startsAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
  };
  assert.equal(createCouponSchema.validate(base).error, undefined);
  assert.ok(
    createCouponSchema.validate({ ...base, discountValue: 100 }).error,
  );
  assert.ok(
    createCouponSchema.validate({
      ...base,
      expiresAt: "2026-07-01T00:00:00.000Z",
    }).error,
  );
});

test("partial coupon updates do not inject create defaults", () => {
  const result = updateCouponSchema.validate({ status: "inactive" });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, { status: "inactive" });
});

test("coupon model protects percentage limits during partial admin updates", async () => {
  const coupon = new Coupon({
    code: "MODEL10",
    title: "Model validation",
    type: "percent",
    discountValue: 95,
    createdBy: new mongoose.Types.ObjectId(),
  });
  await assert.rejects(coupon.validate(), /cannot exceed 90/i);
});

test("checkout coupon resolution enforces targeting and returns auditable cents", async () => {
  mockingoose.resetAll();
  const courseId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  mockingoose(Coupon).toReturn({
    _id: new mongoose.Types.ObjectId(),
    code: "COURSE25",
    title: "Course discount",
    type: "percent",
    discountValue: 25,
    status: "active",
    usageCount: 0,
    usageLimit: 10,
    perUserLimit: 1,
    minimumPurchaseUsdCents: 1000,
    courseIds: [courseId],
  }, "findOne");
  mockingoose(CouponRedemption).toReturn(0, "countDocuments");

  const result = await resolveCouponForCheckout({
    code: "course25",
    userId,
    courseId,
    baseAmountUsdCents: 2000,
  });
  assert.equal(result.couponCode, "COURSE25");
  assert.equal(result.originalBaseAmountUsdCents, 2000);
  assert.equal(result.discountAmountUsdCents, 500);
  assert.equal(result.finalBaseAmountUsdCents, 1500);
});

test("checkout coupon resolution rejects expired campaigns", async () => {
  mockingoose.resetAll();
  mockingoose(Coupon).toReturn({
    _id: new mongoose.Types.ObjectId(),
    code: "OLD10",
    title: "Expired",
    type: "percent",
    discountValue: 10,
    status: "active",
    expiresAt: new Date("2025-01-01T00:00:00.000Z"),
  }, "findOne");

  await assert.rejects(
    resolveCouponForCheckout({
      code: "OLD10",
      userId: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      baseAmountUsdCents: 2000,
      now: new Date("2026-01-01T00:00:00.000Z"),
    }),
    (error) => error.code === "COUPON_EXPIRED",
  );
});
