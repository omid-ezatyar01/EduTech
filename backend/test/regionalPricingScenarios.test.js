import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRegionalDisplaySnapshot,
  convertRegionalPriceToUsdCents,
  resolveCourseRegionalPrice,
  resolveStudentPricingRegion,
  validateRegionalPrices,
} from "../src/utils/courseRegionalPricing.js";
import { summarizeTeacherIncomeRows } from "../src/utils/teacherIncomeLedger.js";

const usdFallbackCourse = {
  _id: "course-regional-real-world",
  pricingType: "regional",
  prices: {
    afghanistan: {
      currency: "AFN",
      regularPrice: 0,
      discountedPrice: null,
      isFree: false,
      useInternationalPrice: true,
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
      regularPrice: 20,
      discountedPrice: 15,
      regularPriceUsd: 20,
      discountedPriceUsd: 15,
      usdExchangeRate: 1,
      isFree: false,
    },
  },
};

const resolveFallback = (region) =>
  resolveCourseRegionalPrice(usdFallbackCourse, region);

test("real scenario: one USD base produces current AFN, Toman, and USD displays", async () => {
  const afghanistan = resolveFallback("afghanistan");
  const iran = resolveFallback("iran");
  const international = resolveFallback("international");

  assert.equal(await convertRegionalPriceToUsdCents(afghanistan), 1500);
  assert.equal(await convertRegionalPriceToUsdCents(iran), 1500);
  assert.equal(await convertRegionalPriceToUsdCents(international), 1500);

  const afAt70 = buildRegionalDisplaySnapshot({
    resolvedPrice: afghanistan,
    requestedRegion: "afghanistan",
    baseAmountUsdCents: 1500,
    rate: 70,
    rateRetrievedAt: "2026-07-25T07:30:00.000Z",
  });
  const afAt72 = buildRegionalDisplaySnapshot({
    resolvedPrice: afghanistan,
    requestedRegion: "afghanistan",
    baseAmountUsdCents: 1500,
    rate: 72,
    rateRetrievedAt: "2026-07-26T07:30:00.000Z",
  });
  const iranAt500000Rial = buildRegionalDisplaySnapshot({
    resolvedPrice: iran,
    requestedRegion: "iran",
    baseAmountUsdCents: 1500,
    rate: 500000,
    rateRetrievedAt: "2026-07-25T07:30:00.000Z",
  });
  const iranAt550000Rial = buildRegionalDisplaySnapshot({
    resolvedPrice: iran,
    requestedRegion: "iran",
    baseAmountUsdCents: 1500,
    rate: 550000,
    rateRetrievedAt: "2026-07-26T07:30:00.000Z",
  });
  const global = buildRegionalDisplaySnapshot({
    resolvedPrice: international,
    requestedRegion: "international",
    baseAmountUsdCents: 1500,
  });

  assert.deepEqual(
    [afAt70.amount, afAt70.currency, afAt70.exchangeRate],
    [1050, "AFN", 70],
  );
  assert.deepEqual(
    [afAt72.amount, afAt72.currency, afAt72.exchangeRate],
    [1080, "AFN", 72],
  );
  assert.deepEqual(
    [iranAt500000Rial.amount, iranAt500000Rial.currency, iranAt500000Rial.exchangeRate],
    [750000, "TOMAN", 50000],
  );
  assert.deepEqual(
    [iranAt550000Rial.amount, iranAt550000Rial.exchangeRate],
    [825000, 55000],
  );
  assert.deepEqual(
    [global.amount, global.currency, global.exchangeRate],
    [15, "USD", 1],
  );
});

test("real scenario: fixed teacher overrides do not drift when the market rate changes", async () => {
  const fixedCourse = {
    ...usdFallbackCourse,
    prices: {
      ...usdFallbackCourse.prices,
      afghanistan: {
        currency: "AFN",
        regularPrice: 1200,
        discountedPrice: 1000,
        regularPriceUsd: 17.14,
        discountedPriceUsd: 14.29,
        usdExchangeRate: 70,
        isFree: false,
        useInternationalPrice: false,
      },
      iran: {
        currency: "TOMAN",
        regularPrice: 800000,
        discountedPrice: 700000,
        regularPriceUsd: 16,
        discountedPriceUsd: 14,
        usdExchangeRate: 50000,
        isFree: false,
        useInternationalPrice: false,
      },
    },
  };
  const afghanistan = resolveCourseRegionalPrice(fixedCourse, "afghanistan");
  const iran = resolveCourseRegionalPrice(fixedCourse, "iran");

  assert.equal(await convertRegionalPriceToUsdCents(afghanistan), 1429);
  assert.equal(await convertRegionalPriceToUsdCents(iran), 1400);

  const afAfterRateChange = buildRegionalDisplaySnapshot({
    resolvedPrice: afghanistan,
    requestedRegion: "afghanistan",
    baseAmountUsdCents: 1429,
    rate: 90,
  });
  const iranAfterRateChange = buildRegionalDisplaySnapshot({
    resolvedPrice: iran,
    requestedRegion: "iran",
    baseAmountUsdCents: 1400,
    rate: 700000,
  });

  assert.equal(afAfterRateChange.amount, 1000);
  assert.equal(afAfterRateChange.exchangeRateSource, "teacher_regional_price_snapshot");
  assert.equal(iranAfterRateChange.amount, 700000);
  assert.equal(iranAfterRateChange.exchangeRate, 50000);
});

test("real scenario: free regions and disabled fallback rows ignore hidden field errors", () => {
  const result = validateRegionalPrices({
    ...usdFallbackCourse.prices,
    afghanistan: {
      ...usdFallbackCourse.prices.afghanistan,
      regularPrice: -100,
      discountedPrice: -200,
    },
    iran: {
      currency: "TOMAN",
      regularPrice: -100,
      discountedPrice: -200,
      isFree: true,
      useInternationalPrice: false,
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("real scenario: active negative prices are rejected instead of silently normalized", () => {
  const negativeRegular = validateRegionalPrices({
    ...usdFallbackCourse.prices,
    international: {
      ...usdFallbackCourse.prices.international,
      regularPrice: -20,
      discountedPrice: null,
    },
  });
  const negativeDiscount = validateRegionalPrices({
    ...usdFallbackCourse.prices,
    international: {
      ...usdFallbackCourse.prices.international,
      discountedPrice: -5,
    },
  });

  assert.equal(negativeRegular.valid, false);
  assert.match(negativeRegular.errors["international.regularPrice"], /negative/i);
  assert.equal(negativeDiscount.valid, false);
  assert.match(negativeDiscount.errors["international.discountedPrice"], /negative/i);
});

test("real scenario: saved profile country wins over VPN or network detection", () => {
  const cases = [
    ["Afghanistan", "iran", "afghanistan"],
    ["Iran", "afghanistan", "iran"],
    ["Germany", "iran", "international"],
    ["", "afghanistan", "afghanistan"],
    ["", "IR", "iran"],
    ["", "unknown", "international"],
  ];

  for (const [profileCountry, detectedRegion, expected] of cases) {
    assert.equal(
      resolveStudentPricingRegion({ profileCountry, detectedRegion }),
      expected,
      `${profileCountry || "no profile"} / ${detectedRegion}`,
    );
  }
});

test("real scenario: payment-time rate snapshots reconcile across all regions and methods", () => {
  const methods = [
    ["hesabpay", "HesabPay (Visa / MasterCard)", false],
    ["nowpayments_crypto", "Crypto Gateway", false],
    ["usdt_bsc_direct", "Crypto (USDT BSC)", false],
    ["bank_transfer", "Bank Transfer", true],
  ];
  const regions = [
    ["afghanistan", "Afghanistan", 1050, "AFN", 70],
    ["iran", "Iran", 750000, "TOMAN", 50000],
    ["international", "International", 15, "USD", 1],
  ];
  const paymentDetails = [];

  for (const [methodCode, methodLabel, isExternalCollection] of methods) {
    for (const [pricingRegion, regionLabel, sourceAmount, sourceCurrency, sourceRate] of regions) {
      paymentDetails.push({
        paymentId: `${methodCode}-${pricingRegion}`,
        paymentMethod: methodLabel,
        paymentMethodCode: methodCode,
        pricingRegion,
        regionLabel,
        sourcePriceAmount: sourceAmount,
        sourcePriceCurrency: sourceCurrency,
        sourceExchangeRate: sourceRate,
        sourceExchangeRateSource:
          pricingRegion === "international" ? "usd_base" : "system_daily_rate",
        sourceRateRetrievedAt: "2026-07-25T07:30:00.000Z",
        gatewayAmount: methodCode === "hesabpay" ? 1050 : 15,
        gatewayCurrency: methodCode === "hesabpay" ? "AFN" : "USDT",
        baseRevenue: 15,
        platformCommission: 2.25,
        commissionRate: 15,
        teacherEarnings: 12.75,
        teacherPayoutAmount: isExternalCollection ? 0 : 12.75,
        directToTeacherAmount: isExternalCollection ? 15 : 0,
        platformDeductionDue: isExternalCollection ? 2.25 : 0,
        isExternalCollection,
        paidAt: "2026-07-26T08:00:00.000Z",
      });
    }
  }

  const summary = summarizeTeacherIncomeRows({
    rows: [{
      teacherId: "teacher-real-world",
      teacherName: "Regional Teacher",
      courseId: usdFallbackCourse._id,
      courseTitle: "Regional Pricing Masterclass",
      monthKey: "2026-07",
      status: "unpaid",
      salesCount: 12,
      totalRevenue: 180,
      platformCommission: 27,
      teacherEarnings: 153,
      teacherPayoutDue: 114.75,
      directToTeacherAmount: 45,
      platformDeductionDue: 6.75,
      externalCollectedRevenue: 45,
      paymentDetails,
    }],
    defaultCommissionRate: 15,
  });

  assert.equal(summary.paymentsCount, 12);
  assert.equal(summary.totalRevenue, 180);
  assert.equal(summary.teacherEarnings, 153);
  assert.equal(summary.reconciliation.isBalanced, true);
  assert.equal(summary.reconciliation.difference, 0);
  assert.equal(summary.paymentMethodBreakdown.length, 4);
  assert.equal(summary.regionBreakdown.length, 3);
  assert.deepEqual(
    summary.regionBreakdown.map((item) => [item.regionKey, item.paymentsCount, item.totalRevenue]),
    [
      ["afghanistan", 4, 60],
      ["iran", 4, 60],
      ["international", 4, 60],
    ],
  );
  assert.equal(summary.moneyFlow.platformCount, 9);
  assert.equal(summary.moneyFlow.directCount, 3);
  assert.equal(summary.moneyFlow.platformRevenue, 135);
  assert.equal(summary.moneyFlow.directAmount, 45);
  assert.equal(summary.moneyFlow.deductionDue, 6.75);
  assert.ok(
    summary.recentPayments.some(
      (item) =>
        item.pricingRegion === "iran" &&
        item.sourcePriceCurrency === "TOMAN" &&
        item.sourceExchangeRate === 50000,
    ),
  );
});

test("real scenario: two Afghan students keep distinct rate snapshots while USD revenue stays exact", () => {
  const paymentDetails = [
    {
      paymentId: "af-rate-70",
      paymentMethod: "HesabPay (Visa / MasterCard)",
      paymentMethodCode: "hesabpay",
      pricingRegion: "afghanistan",
      regionLabel: "Afghanistan",
      sourcePriceAmount: 1050,
      sourcePriceCurrency: "AFN",
      sourceExchangeRate: 70,
      baseRevenue: 15,
      platformCommission: 2.25,
      commissionRate: 15,
      teacherEarnings: 12.75,
      teacherPayoutAmount: 12.75,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
      isExternalCollection: false,
      paidAt: "2026-07-25T08:00:00.000Z",
    },
    {
      paymentId: "af-rate-72",
      paymentMethod: "HesabPay (Visa / MasterCard)",
      paymentMethodCode: "hesabpay",
      pricingRegion: "afghanistan",
      regionLabel: "Afghanistan",
      sourcePriceAmount: 1080,
      sourcePriceCurrency: "AFN",
      sourceExchangeRate: 72,
      baseRevenue: 15,
      platformCommission: 2.25,
      commissionRate: 15,
      teacherEarnings: 12.75,
      teacherPayoutAmount: 12.75,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
      isExternalCollection: false,
      paidAt: "2026-07-26T08:00:00.000Z",
    },
  ];
  const summary = summarizeTeacherIncomeRows({
    rows: [{
      teacherId: "teacher-real-world",
      courseId: usdFallbackCourse._id,
      courseTitle: "Regional Pricing Masterclass",
      monthKey: "2026-07",
      status: "unpaid",
      salesCount: 2,
      totalRevenue: 30,
      platformCommission: 4.5,
      teacherEarnings: 25.5,
      teacherPayoutDue: 25.5,
      directToTeacherAmount: 0,
      platformDeductionDue: 0,
      externalCollectedRevenue: 0,
      paymentDetails,
    }],
    defaultCommissionRate: 15,
  });

  assert.equal(summary.totalRevenue, 30);
  assert.equal(summary.regionBreakdown[0].totalRevenue, 30);
  assert.deepEqual(
    summary.recentPayments.map((item) => [
      item.sourcePriceAmount,
      item.sourceExchangeRate,
    ]),
    [[1080, 72], [1050, 70]],
  );
  assert.equal(summary.reconciliation.isBalanced, true);
});
