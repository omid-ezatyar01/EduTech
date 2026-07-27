import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { summarizeTeacherIncomeRows } from "../src/utils/teacherIncomeLedger.js";

const payment = (overrides = {}) => ({
  paymentId: overrides.paymentId || crypto.randomUUID(),
  paymentMethod: "Crypto (USDT BSC)",
  paymentMethodCode: "usdt_bsc_direct",
  pricingRegion: "iran",
  regionLabel: "Iran",
  sourcePriceAmount: 420000,
  sourcePriceCurrency: "TOMAN",
  gatewayAmount: 100,
  gatewayCurrency: "USDT",
  baseRevenue: 100,
  platformCommission: 15,
  commissionRate: 15,
  teacherEarnings: 85,
  teacherPayoutAmount: 85,
  directToTeacherAmount: 0,
  platformDeductionDue: 0,
  isExternalCollection: false,
  paidAt: "2026-07-10T00:00:00.000Z",
  ...overrides,
});

const row = (overrides = {}) => ({
  teacherId: "teacher-1",
  teacherName: "Teacher One",
  courseId: overrides.courseId || "course-1",
  courseTitle: overrides.courseTitle || "Regional Course",
  monthKey: "2026-07",
  status: "unpaid",
  salesCount: 1,
  totalRevenue: 100,
  platformCommission: 15,
  teacherEarnings: 85,
  teacherPayoutDue: 85,
  directToTeacherAmount: 0,
  platformDeductionDue: 0,
  externalCollectedRevenue: 0,
  paymentDetails: [payment()],
  ...overrides,
});

test("income report reconciles platform payouts and direct bank collections", () => {
  const rows = [
    row(),
    row({
      courseId: "course-2",
      courseTitle: "Direct Course",
      status: "paid",
      totalRevenue: 50,
      platformCommission: 7.5,
      teacherEarnings: 42.5,
      teacherPayoutDue: 0,
      directToTeacherAmount: 50,
      platformDeductionDue: 7.5,
      externalCollectedRevenue: 50,
      paymentDetails: [
        payment({
          paymentId: "direct-payment",
          paymentMethod: "Bank Transfer",
          paymentMethodCode: "bank_transfer",
          gatewayAmount: 2100000,
          gatewayCurrency: "IRR",
          baseRevenue: 50,
          platformCommission: 7.5,
          teacherEarnings: 42.5,
          teacherPayoutAmount: 0,
          directToTeacherAmount: 50,
          platformDeductionDue: 7.5,
          isExternalCollection: true,
        }),
      ],
    }),
    row({
      courseId: "course-3",
      courseTitle: "Settled Course",
      status: "paid",
      totalRevenue: 20,
      platformCommission: 3,
      teacherEarnings: 17,
      teacherPayoutDue: 17,
      paymentDetails: [
        payment({
          paymentId: "settled-payment",
          pricingRegion: "international",
          regionLabel: "International",
          sourcePriceAmount: 20,
          sourcePriceCurrency: "USD",
          gatewayAmount: 20,
          baseRevenue: 20,
          platformCommission: 3,
          teacherEarnings: 17,
          teacherPayoutAmount: 17,
        }),
      ],
    }),
  ];

  const summary = summarizeTeacherIncomeRows({
    rows,
    defaultCommissionRate: 15,
  });

  assert.equal(summary.totalRevenue, 170);
  assert.equal(summary.platformCommission, 25.5);
  assert.equal(summary.teacherEarnings, 144.5);
  assert.equal(summary.teacherPayoutTotal, 102);
  assert.equal(summary.teacherPayoutDue, 85);
  assert.equal(summary.settledTeacherPayout, 17);
  assert.equal(summary.directToTeacherAmount, 50);
  assert.equal(summary.platformDeductionDue, 7.5);
  assert.equal(summary.reconciliation.expectedTeacherEarnings, 144.5);
  assert.equal(summary.reconciliation.difference, 0);
  assert.equal(summary.reconciliation.isBalanced, true);
  assert.equal(summary.paymentsCount, 3);
  assert.equal(summary.settledPaymentsCount, 2);
  assert.equal(summary.outstandingPaymentsCount, 1);
});

test("income breakdown uses pricing region independently from gateway currency", () => {
  const summary = summarizeTeacherIncomeRows({
    rows: [row()],
    defaultCommissionRate: 15,
  });

  assert.equal(summary.regionBreakdown.length, 1);
  assert.equal(summary.regionBreakdown[0].regionKey, "iran");
  assert.equal(summary.regionBreakdown[0].gatewayCurrency, "TOMAN");
  assert.equal(summary.recentPayments[0].gatewayCurrency, "USDT");
  assert.equal(summary.recentPayments[0].sourcePriceCurrency, "TOMAN");
});

test("income summary honors payment-time commission snapshots", () => {
  const summary = summarizeTeacherIncomeRows({
    rows: [
      row({
        totalRevenue: 100,
        platformCommission: 10,
        teacherEarnings: 90,
        teacherPayoutDue: 90,
        paymentDetails: [
          payment({
            commissionRate: 10,
            platformCommission: 10,
            teacherEarnings: 90,
            teacherPayoutAmount: 90,
          }),
        ],
      }),
    ],
    defaultCommissionRate: 15,
  });

  assert.equal(summary.commissionRate, 10);
  assert.deepEqual(summary.commissionRatesUsed, [10]);
  assert.equal(summary.currentCommissionRate, 15);
});

test("IRR gateway amounts never replace USD ledger totals in income reports", () => {
  const summary = summarizeTeacherIncomeRows({
    rows: [
      row({
        totalRevenue: 10,
        platformCommission: 1.5,
        teacherEarnings: 8.5,
        teacherPayoutDue: 8.5,
        paymentDetails: [
          payment({
            sourcePriceAmount: 1_900_000,
            sourcePriceCurrency: "IRR",
            gatewayAmount: 1_900_000,
            gatewayCurrency: "IRR",
            baseRevenue: 10,
            platformCommission: 1.5,
            teacherEarnings: 8.5,
            teacherPayoutAmount: 8.5,
          }),
        ],
      }),
    ],
    defaultCommissionRate: 15,
  });

  assert.equal(summary.totalRevenue, 10);
  assert.equal(summary.platformCommission, 1.5);
  assert.equal(summary.teacherEarnings, 8.5);
  assert.equal(summary.teacherPayoutTotal, 8.5);
  assert.equal(summary.recentPayments[0].gatewayAmount, 1_900_000);
  assert.equal(summary.recentPayments[0].gatewayCurrency, "IRR");
});
