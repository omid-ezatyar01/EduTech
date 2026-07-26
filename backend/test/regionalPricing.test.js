import test from "node:test";
import assert from "node:assert/strict";
import {
  convertRegionalPriceToUsdCents,
  getPricingRegionForCountry,
  normalizeRegionalPrices,
  resolveCourseRegionalPrice,
  resolveRegionalDisplaySnapshot,
  resolveStudentPricingRegion,
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
      regularPriceUsd: null,
      discountedPriceUsd: null,
      finalPriceUsd: null,
      usdExchangeRate: null,
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

test("saved student country overrides a conflicting submitted checkout region", () => {
  assert.equal(
    resolveStudentPricingRegion({
      profileCountry: "Afghanistan",
      detectedRegion: "iran",
    }),
    "afghanistan",
  );
  assert.equal(
    resolveStudentPricingRegion({
      profileCountry: "ایران",
      detectedRegion: "afghanistan",
    }),
    "iran",
  );
  assert.equal(
    resolveStudentPricingRegion({
      profileCountry: "Germany",
      detectedRegion: "iran",
    }),
    "international",
  );
});

test("automatic detected region is used only when profile country is empty", () => {
  assert.equal(
    resolveStudentPricingRegion({
      profileCountry: "",
      detectedRegion: "IR",
    }),
    "iran",
  );
});

test("checkout keeps the teacher-saved USD base when exchange rates later change", async () => {
  const course = {
    pricingType: "regional",
    prices: {
      ...validPrices,
      iran: {
        currency: "TOMAN",
        regularPrice: 700000,
        discountedPrice: 560000,
        regularPriceUsd: 14,
        discountedPriceUsd: 11.2,
        usdExchangeRate: 50000,
        isFree: false,
        useInternationalPrice: false,
      },
    },
  };

  const resolved = resolveCourseRegionalPrice(course, "iran");
  assert.equal(resolved.finalPrice, 560000);
  assert.equal(resolved.finalPriceUsd, 11.2);
  assert.equal(await convertRegionalPriceToUsdCents(resolved), 1120);
});

test("payment snapshot preserves the exact local amount and effective rate", async () => {
  const snapshot = await resolveRegionalDisplaySnapshot({
    resolvedPrice: {
      currency: "TOMAN",
      finalPrice: 700000,
      finalPriceUsd: 14,
      usdExchangeRate: 50000,
    },
    requestedRegion: "iran",
    baseAmountUsdCents: 1400,
  });

  assert.equal(snapshot.amount, 700000);
  assert.equal(snapshot.currency, "TOMAN");
  assert.equal(snapshot.exchangeRate, 50000);
  assert.equal(snapshot.exchangeRateSource, "teacher_regional_price_snapshot");
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
