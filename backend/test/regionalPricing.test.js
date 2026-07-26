import test from "node:test";
import assert from "node:assert/strict";
import {
  getPricingRegionForCountry,
  normalizeRegionalPrices,
  resolveCourseRegionalPrice,
  validateRegionalPrices,
} from "../src/utils/courseRegionalPricing.js";
import {
  createCourseByTeacherSchema,
  updateCourseByTeacherSchema,
} from "../src/validators/course.validators.js";

const validPrices = {
  afghanistan: {
    currency: "AFN",
    regularPrice: 1000,
    discountedPrice: 800,
    isFree: false,
    useInternationalPrice: false,
  },
  iran: {
    currency: "TOMAN",
    regularPrice: 0,
    discountedPrice: null,
    isFree: false,
    useInternationalPrice: true,
  },
  international: {
    currency: "USD",
    regularPrice: 15,
    discountedPrice: 12,
    isFree: false,
  },
};

test("regional pricing resolves custom, fallback, discounted, and free prices", () => {
  const course = { pricingType: "regional", prices: validPrices };

  assert.deepEqual(
    resolveCourseRegionalPrice(course, "afghanistan"),
    {
      pricingType: "regional",
      region: "afghanistan",
      requestedRegion: "afghanistan",
      currency: "AFN",
      regularPrice: 1000,
      discountedPrice: 800,
      finalPrice: 800,
      isFree: false,
      usesInternationalPrice: false,
    },
  );

  const iran = resolveCourseRegionalPrice(course, "iran");
  assert.equal(iran.region, "international");
  assert.equal(iran.currency, "USD");
  assert.equal(iran.finalPrice, 12);
  assert.equal(iran.usesInternationalPrice, true);

  const freeCourse = {
    ...course,
    prices: {
      ...validPrices,
      afghanistan: {
        ...validPrices.afghanistan,
        isFree: true,
      },
    },
  };
  assert.equal(resolveCourseRegionalPrice(freeCourse, "AF").isFree, true);
});

test("missing custom regional price falls back to International", () => {
  const prices = normalizeRegionalPrices({
    ...validPrices,
    afghanistan: {
      currency: "AFN",
      regularPrice: 0,
      isFree: false,
      useInternationalPrice: false,
    },
  });
  const price = resolveCourseRegionalPrice(
    { pricingType: "regional", prices },
    "afghanistan",
  );
  assert.equal(price.region, "international");
  assert.equal(price.finalPrice, 12);
});

test("regional validation requires International and rejects invalid discounts", () => {
  const missingInternational = validateRegionalPrices({
    ...validPrices,
    international: {
      currency: "USD",
      regularPrice: 0,
      discountedPrice: null,
      isFree: false,
    },
  });
  assert.equal(missingInternational.valid, false);
  assert.match(
    missingInternational.errors["international.regularPrice"],
    /required/i,
  );

  const invalidDiscount = validateRegionalPrices({
    ...validPrices,
    afghanistan: {
      ...validPrices.afghanistan,
      discountedPrice: 1200,
    },
  });
  assert.equal(invalidDiscount.valid, false);
  assert.match(
    invalidDiscount.errors["afghanistan.discountedPrice"],
    /lower/i,
  );
});

test("country values map to the expected pricing region", () => {
  assert.equal(getPricingRegionForCountry("AF"), "afghanistan");
  assert.equal(getPricingRegionForCountry("Iran"), "iran");
  assert.equal(getPricingRegionForCountry("Germany"), "international");
});

test("teacher update schema accepts regional prices and preserves single-price updates", () => {
  const regional = updateCourseByTeacherSchema.validate({
    pricingType: "regional",
    prices: validPrices,
    price: 15,
    currency: "USD",
    isFree: false,
  });
  assert.equal(regional.error, undefined);

  const single = updateCourseByTeacherSchema.validate({
    pricingType: "single",
    price: 25,
    currency: "USD",
    isFree: false,
  });
  assert.equal(single.error, undefined);

  assert.ok(createCourseByTeacherSchema);
});
