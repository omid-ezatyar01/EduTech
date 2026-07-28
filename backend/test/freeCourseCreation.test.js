import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Course from "../src/models/Course.js";

test("free courses discard paid pricing and certificate state before validation", async () => {
  const originalExists = Course.exists;
  Course.exists = async () => null;

  const ownerId = new mongoose.Types.ObjectId();
  const course = new Course({
    title: "A genuinely free course",
    description:
      "This description is intentionally long enough to satisfy the course model while verifying that free courses cannot retain stale paid pricing or certificate requirements.",
    category: new mongoose.Types.ObjectId(),
    createdBy: ownerId,
    teacher: ownerId,
    teacherId: ownerId,
    isFree: true,
    pricingType: "single",
    price: 75,
    discountPrice: 60,
    teacherDiscountPercentage: 20,
    prices: {
      international: {
        currency: "USD",
        regularPrice: 75,
        discountedPrice: 60,
      },
    },
    certificate: {
      enabled: true,
      minimumAttendance: 80,
      minimumPassingGrade: 70,
      assignmentsRequired: true,
      finalProjectRequired: true,
      fullPaymentRequired: true,
    },
  });

  try {
    await course.validate();
  } finally {
    Course.exists = originalExists;
  }

  assert.equal(course.pricingType, "single");
  assert.equal(course.prices, undefined);
  assert.equal(course.price, 0);
  assert.equal(course.discountPrice, 0);
  assert.equal(course.teacherDiscountPercentage, 0);
  assert.deepEqual(course.certificate.toObject(), {
    enabled: false,
    minimumAttendance: 0,
    minimumPassingGrade: 0,
    assignmentsRequired: false,
    finalProjectRequired: false,
    fullPaymentRequired: false,
  });
});
