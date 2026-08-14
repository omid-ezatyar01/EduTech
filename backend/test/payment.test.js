import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach } from "node:test";
import nock from "nock";
import mockingoose from "mockingoose";
import mongoose from "mongoose";
import { Interface } from "ethers";

import Payment from "../src/models/Payment.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Order from "../src/models/Order.js";
import PaymentAttempt from "../src/models/PaymentAttempt.js";
import HesabWebhookReceipt from "../src/models/HesabWebhookReceipt.js";
import User from "../src/models/User.js";
import {
  createCheckout,
  getStudentPaymentStatus,
  getUsdToAfnQuote,
  hesabPayWebhook,
  verifyDirectCryptoPayment,
} from "../src/controllers/payment.controller.js";
import {
  __resetBscUsdtServiceCacheForTests,
  createUniqueUsdtBscAmount,
  verifyDirectBscUsdtPayment,
} from "../src/services/bscUsdt.service.js";
import { __resetExchangeRateCacheForTests } from "../src/services/exchangeRate.service.js";
import { completePayment } from "../src/services/paymentCompletion.service.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
process.env.HESABPAY_API_KEY = "test-hesab-key";
process.env.HESABPAY_BASE_URL = "https://api.hesab.test";
process.env.EXCHANGE_RATE_PROVIDER = "currencyfreaks";
process.env.CURRENCYFREAKS_API_KEY = "test-currencyfreaks-key";
process.env.CURRENCYFREAKS_BASE_URL = "https://api.currencyfreaks.test/v2.0";
process.env.CURRENCYFREAKS_TIMEOUT_MS = "2000";
process.env.CURRENCYFREAKS_CACHE_TTL_MS = "1000";
process.env.IRAN_MARKET_RATE_PROVIDER = "navasan";
process.env.NAVASAN_API_KEY = "test-navasan-key";
process.env.NAVASAN_BASE_URL = "https://api.navasan.test";
process.env.NAVASAN_USD_FIELD = "usd_sell";
process.env.NAVASAN_RATE_UNIT = "toman";
process.env.IRAN_MARKET_MIN_USD_TO_TOMAN_RATE = "50000";
process.env.HESABPAY_EXCHANGE_RATE_API_URL = "https://rates.test/v1/latest/USD";
process.env.HESABPAY_EXCHANGE_RATE_TIMEOUT_MS = "2000";
process.env.HESABPAY_EXCHANGE_RATE_CACHE_TTL_MS = "1000";
process.env.HESABPAY_EXCHANGE_RATE_EMERGENCY_FALLBACK_RATE = "70";
process.env.NOWPAYMENTS_API_KEY = "test-nowpayments-key";
process.env.NOWPAYMENTS_IPN_SECRET = "test-nowpayments-secret";
process.env.NOWPAYMENTS_BASE_URL = "https://api.nowpayments.test";
process.env.NOWPAYMENTS_PAY_CURRENCY = "usdtbsc";
process.env.BSC_RPC_URL = "https://bsc.example/rpc";
process.env.BSCSCAN_API_KEY = "";
process.env.BSCSCAN_API_BASE_URL = "https://api.etherscan.test/v2/api";
process.env.BSCSCAN_TIMEOUT_MS = "3000";
process.env.BSC_RECIPIENT_ADDRESS = "0x057b1d7e10296d247d1b7c75eb4ae3aaf3daeea7";
process.env.BSC_USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
process.env.BSC_PAYMENT_EXPIRY_MINUTES = "20";
process.env.APP_NAME = "EduTech";

before(async () => {
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => fn(),
    endSession: () => {},
  });
});

beforeEach(() => {
  mockingoose.resetAll();
  nock.cleanAll();
  __resetExchangeRateCacheForTests();
  __resetBscUsdtServiceCacheForTests();
  process.env.BSCSCAN_API_KEY = "";
  mockingoose(HesabWebhookReceipt).toReturn((query) => {
    const update = query.getUpdate();
    return {
      _id: new mongoose.Types.ObjectId(),
      ...(update?.$setOnInsert || {}),
      ...(update?.$set || {}),
      deliveryCount: 1,
    };
  }, "findOneAndUpdate");
  mockingoose(HesabWebhookReceipt).toReturn({
    acknowledged: true,
    modifiedCount: 1,
  }, "updateOne");
  mockingoose(PaymentAttempt).toReturn({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1,
  }, "updateOne");
  mockingoose(PaymentAttempt).toReturn((query) => ({
    _id: query.getQuery()?._id || new mongoose.Types.ObjectId(),
  }), "findOneAndUpdate");
});

afterEach(() => {
  nock.cleanAll();
});

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const fakeStudent = {
  _id: new mongoose.Types.ObjectId(),
  email: "student@example.com",
  role: "student",
};

const fakeTeacher = {
  _id: new mongoose.Types.ObjectId(),
  email: "teacher@example.com",
  role: "teacher",
};

const fakeCourse = {
  _id: new mongoose.Types.ObjectId(),
  title: "Backend Payments 101",
  description: "A".repeat(140),
  status: "published",
  isPublished: true,
  classEndedAt: null,
  classCancelledAt: null,
  price: 15,
  currency: "USDT",
  isFree: false,
  teacher: fakeTeacher._id,
  createdBy: fakeTeacher._id,
};

const makeReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: fakeStudent,
  ...overrides,
});

const mockCourseCheckoutFlow = () => {
  mockingoose(Course).toReturn(fakeCourse, "findById");
  mockingoose(Course).toReturn(fakeCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(null, "findOne");
  mockingoose(Order).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    baseAmountUsdCents: 1500,
    status: "PENDING",
  }], "create");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");
};

const mockValidBscScanTransfer = ({ txHash, blockTimestamp }) => {
  process.env.BSCSCAN_API_KEY = "test-bscscan-key";

  const fromAddress = "0x1111111111111111111111111111111111111111";
  const recipientAddress = process.env.BSC_RECIPIENT_ADDRESS;
  const tokenAddress = process.env.BSC_USDT_CONTRACT_ADDRESS;
  const transferValue = 1605851000000000000n;
  const transferEvent = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  const encodedTransfer = transferEvent.encodeEventLog(
    transferEvent.getEvent("Transfer"),
    [fromAddress, recipientAddress, transferValue],
  );
  const timestampHex = `0x${Math.floor(blockTimestamp.getTime() / 1000).toString(16)}`;

  nock("https://api.etherscan.test")
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_call")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x12" })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionReceipt")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        status: "0x1",
        blockNumber: "0x64",
        transactionHash: txHash,
        logs: [{
          address: tokenAddress,
          topics: encodedTransfer.topics,
          data: encodedTransfer.data,
        }],
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionByHash")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        hash: txHash,
        to: tokenAddress,
        chainId: "0x38",
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_blockNumber")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x65" })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getBlockByNumber")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: { timestamp: timestampHex },
    });
};

const makePendingDirectBscAttempt = ({ createdAt, expiresAt } = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  orderId: new mongoose.Types.ObjectId(),
  userId: fakeStudent._id,
  courseId: fakeCourse._id,
  paymentReference: `PAY-bsc-${new mongoose.Types.ObjectId()}`,
  provider: "BSC_DIRECT",
  method: "USDT_BSC_DIRECT",
  baseAmountUsdCents: 161,
  amount: "1.605851",
  currency: "USDT",
  network: "BNB_CHAIN",
  recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
  tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
  status: "PENDING",
  expiresAt,
  createdAt,
  verificationAttempts: 0,
});

test("USD 15 creates the correct AFN quote using a mocked rate", async () => {
  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query(
      (query) =>
        query.apikey === "test-currencyfreaks-key" &&
        query.symbols === "AFN",
    )
    .reply(200, { rates: { AFN: 70 } });

  const res = mockRes();
  await getUsdToAfnQuote({ query: { amount: 15 } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.amountUsd, 15);
  assert.equal(res.body.amountAfn, 1050);
  assert.equal(res.body.currencyTo, "AFN");
});

test("frontend-submitted prices are ignored", async () => {
  mockCourseCheckoutFlow();
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    paymentReference: "PAY-bsc-15",
    amount: "15.000654",
    currency: "USDT",
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    network: "BNB_CHAIN",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
    providerUrl: process.env.BSC_RECIPIENT_ADDRESS,
  }], "create");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
      price: 1,
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.basePrice.amount, "15.00");
  assert.equal(res.body.provider, "BSC_DIRECT");
  assert.match(res.body.charge.amount, /^15\.\d{6}$/);
  assert.notEqual(res.body.charge.amount, "15.000000");
});

test("direct BSC checkout returns a USDT/BSC payment quote for prices under 12 USD", async () => {
  const lowPriceCourse = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    price: 11,
  };
  mockingoose(Course).toReturn(lowPriceCourse, "findById");
  mockingoose(Course).toReturn(lowPriceCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(null, "findOne");
  mockingoose(Order).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: lowPriceCourse._id,
    baseAmountUsdCents: 1100,
    status: "PENDING",
  }], "create");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    paymentReference: "PAY-bsc",
    amount: "11.000654",
    currency: "USDT",
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    network: "BNB_CHAIN",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
    providerUrl: process.env.BSC_RECIPIENT_ADDRESS,
  }], "create");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: lowPriceCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, "BSC_DIRECT");
  assert.equal(res.body.charge.currency, "USDT");
  assert.equal(res.body.charge.network, "BNB_CHAIN");
  assert.match(res.body.charge.amount, /^11\.\d{6}$/);
  assert.equal(String(res.body.payAddress).toLowerCase(), String(process.env.BSC_RECIPIENT_ADDRESS).toLowerCase());
});

test("USD 1 creates a payable direct USDT/BSC quote", async () => {
  const quote = createUniqueUsdtBscAmount(100);
  assert.equal(quote.baseAmount, "1.000000");
  assert.match(quote.totalAmount, /^1\.\d{6}$/);
  assert.notEqual(quote.totalAmount, "1.000000");
});

test("USDT 1.5 course keeps its decimal base price in direct BSC checkout", async () => {
  const decimalCourse = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    price: 1.5,
  };
  mockingoose(Course).toReturn(decimalCourse, "findById");
  mockingoose(Course).toReturn(decimalCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(null, "findOne");
  mockingoose(Order).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: decimalCourse._id,
    baseAmountUsdCents: 150,
    status: "PENDING",
  }], "create");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    paymentReference: "PAY-bsc-decimal",
    amount: "1.500654",
    currency: "USDT",
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    network: "BNB_CHAIN",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
    providerUrl: process.env.BSC_RECIPIENT_ADDRESS,
  }], "create");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: decimalCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.basePrice.amount, "1.50");
  assert.match(res.body.charge.amount, /^1\.5\d{5}$/);
});

test("12 USD and above uses the direct BSC flow", async () => {
  const boundaryCourse = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    price: 12,
  };
  mockingoose(Course).toReturn(boundaryCourse, "findById");
  mockingoose(Course).toReturn(boundaryCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(null, "findOne");
  mockingoose(Order).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: boundaryCourse._id,
    baseAmountUsdCents: 1200,
    status: "PENDING",
  }], "create");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([{
    _id: new mongoose.Types.ObjectId(),
    paymentReference: "PAY-bsc-12",
    amount: "12.000654",
    currency: "USDT",
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    network: "BNB_CHAIN",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    providerUrl: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
  }], "create");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: boundaryCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, "BSC_DIRECT");
  assert.equal(res.body.charge.currency, "USDT");
  assert.equal(res.body.charge.network, "BNB_CHAIN");
  assert.match(res.body.charge.amount, /^12\.\d{6}$/);
  assert.notEqual(res.body.charge.amount, "12.000000");
  assert.equal(
    String(res.body.payAddress).toLowerCase(),
    String(process.env.BSC_RECIPIENT_ADDRESS).toLowerCase(),
  );
});

test("direct BSC verification rejects a transaction hash replay regardless of letter case", async () => {
  const attempt = makePendingDirectBscAttempt({
    createdAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const submittedHash = `0x${"aA".repeat(32)}`;
  const legacyUppercaseHash = `0x${"AA".repeat(32)}`;
  let replayQuery = null;

  mockingoose(PaymentAttempt).toReturn((query) => {
    const filter = query.getQuery();
    if (filter.transactionSignature) {
      replayQuery = filter;
      return filter.transactionSignature.test(legacyUppercaseHash)
        ? {
            ...attempt,
            _id: new mongoose.Types.ObjectId(),
            transactionSignature: legacyUppercaseHash,
            status: "SUCCEEDED",
          }
        : null;
    }
    return attempt;
  }, "findOne");

  const res = mockRes();
  await verifyDirectCryptoPayment(makeReq({
    params: { paymentAttemptId: attempt._id },
    body: { txHash: submittedHash },
  }), res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "TX_HASH_ALREADY_USED");
  assert.ok(replayQuery?.transactionSignature instanceof RegExp);
  assert.equal(replayQuery.transactionSignature.flags.includes("i"), true);
  assert.equal(replayQuery.transactionSignature.test(submittedHash.toLowerCase()), true);
  assert.equal(replayQuery.transactionSignature.test(legacyUppercaseHash), true);
});

for (const temporalCase of [
  {
    name: "older than the payment request",
    responseCode: "TX_OLDER_THAN_PAYMENT_REQUEST",
    getTimes: (now) => ({
      createdAt: new Date(now - 60 * 60 * 1000),
      expiresAt: new Date(now + 60 * 60 * 1000),
      blockTimestamp: new Date(now - 2 * 60 * 60 * 1000),
    }),
  },
  {
    name: "mined after payment expiry",
    responseCode: "TX_MINED_AFTER_PAYMENT_EXPIRY",
    getTimes: (now) => ({
      createdAt: new Date(now - 60 * 60 * 1000),
      expiresAt: new Date(now + 60 * 60 * 1000),
      blockTimestamp: new Date(now + 2 * 60 * 60 * 1000),
    }),
  },
]) {
  test(`direct BSC verification releases the hash reserved for a transaction ${temporalCase.name}`, async () => {
    const times = temporalCase.getTimes(Date.now());
    const attempt = makePendingDirectBscAttempt(times);
    const submittedHash = `0x${"bB".repeat(32)}`;
    const canonicalHash = submittedHash.toLowerCase();
    let reservationFilter = null;
    let reservationUpdate = null;
    let releaseFilter = null;
    let releaseUpdate = null;
    let reservedHash;

    mockingoose(PaymentAttempt).toReturn((query) => {
      const filter = query.getQuery();
      return filter.transactionSignature ? null : attempt;
    }, "findOne");
    mockingoose(PaymentAttempt).toReturn((query) => {
      reservationFilter = query.getQuery();
      reservationUpdate = query.getUpdate();
      reservedHash = reservationUpdate.$set.transactionSignature;
      return {
        ...attempt,
        transactionSignature: reservedHash,
      };
    }, "findOneAndUpdate");
    mockingoose(PaymentAttempt).toReturn((query) => {
      releaseFilter = query.getQuery();
      releaseUpdate = query.getUpdate();
      if (releaseFilter.transactionSignature.test(reservedHash)) {
        reservedHash = undefined;
      }
      return { acknowledged: true, modifiedCount: 1 };
    }, "updateOne");
    mockValidBscScanTransfer({
      txHash: canonicalHash,
      blockTimestamp: times.blockTimestamp,
    });

    const res = mockRes();
    await verifyDirectCryptoPayment(makeReq({
      params: { paymentAttemptId: attempt._id },
      body: { txHash: submittedHash },
    }), res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, temporalCase.responseCode);
    assert.equal(reservationUpdate?.$set?.transactionSignature, canonicalHash);
    assert.equal(
      reservationFilter?.$or?.some(
        (clause) =>
          clause.transactionSignature instanceof RegExp &&
          clause.transactionSignature.test(submittedHash),
      ),
      true,
    );
    assert.equal(String(releaseFilter?._id), String(attempt._id));
    assert.deepEqual(releaseFilter?.status, { $in: ["PENDING", "EXPIRED"] });
    assert.ok(releaseFilter?.transactionSignature instanceof RegExp);
    assert.equal(releaseFilter.transactionSignature.test(submittedHash), true);
    assert.deepEqual(releaseUpdate, { $unset: { transactionSignature: 1 } });
    assert.equal(reservedHash, undefined);
    assert.equal(nock.isDone(), true);
  });
}

test("direct BSC verification accepts a valid token transfer routed through a contract", async () => {
  process.env.BSCSCAN_API_KEY = "test-bscscan-key";

  const txHash = `0x${"a".repeat(64)}`;
  const fromAddress = "0x1111111111111111111111111111111111111111";
  const recipientAddress = process.env.BSC_RECIPIENT_ADDRESS;
  const tokenAddress = process.env.BSC_USDT_CONTRACT_ADDRESS;
  const transferValue = 1605851000000000000n;
  const transferEvent = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  const encodedTransfer = transferEvent.encodeEventLog(
    transferEvent.getEvent("Transfer"),
    [fromAddress, recipientAddress, transferValue],
  );

  nock("https://api.etherscan.test")
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_call")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x12" })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionReceipt")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        status: "0x1",
        blockNumber: "0x64",
        transactionHash: txHash,
        logs: [{
          address: tokenAddress,
          topics: encodedTransfer.topics,
          data: encodedTransfer.data,
        }],
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionByHash")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        hash: txHash,
        to: "0x3333333333333333333333333333333333333333",
        chainId: "0x38",
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getBlockByNumber")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        timestamp: "0x685e5000",
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_blockNumber")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x65" });

  const result = await verifyDirectBscUsdtPayment({
    txHash,
    expectedRecipientAddress: recipientAddress,
    expectedTokenAddress: tokenAddress,
    expectedAmount: "1.605851",
  });

  assert.equal(result.transactionHash, txHash);
  assert.equal(result.confirmations, 2);
  assert.equal(String(result.senderAddress).toLowerCase(), fromAddress.toLowerCase());
  assert.equal(String(result.recipientAddress).toLowerCase(), recipientAddress.toLowerCase());
  assert.equal(result.blockTimestamp?.toISOString(), "2025-06-27T08:02:08.000Z");
});

test("direct BSC verification rejects an overpayment that does not match the unique quote", async () => {
  process.env.BSCSCAN_API_KEY = "test-bscscan-key";

  const txHash = `0x${"b".repeat(64)}`;
  const fromAddress = "0x2222222222222222222222222222222222222222";
  const recipientAddress = process.env.BSC_RECIPIENT_ADDRESS;
  const tokenAddress = process.env.BSC_USDT_CONTRACT_ADDRESS;
  const transferValue = 1700000000000000000n;
  const transferEvent = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  const encodedTransfer = transferEvent.encodeEventLog(
    transferEvent.getEvent("Transfer"),
    [fromAddress, recipientAddress, transferValue],
  );

  nock("https://api.etherscan.test")
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_call")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x12" })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionReceipt")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        status: "0x1",
        blockNumber: "0x64",
        transactionHash: txHash,
        logs: [{
          address: tokenAddress,
          topics: encodedTransfer.topics,
          data: encodedTransfer.data,
        }],
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getTransactionByHash")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        hash: txHash,
        to: tokenAddress,
        chainId: "0x38",
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_getBlockByNumber")
    .reply(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        timestamp: "0x685e5000",
      },
    })
    .get("/v2/api")
    .query((query) => query.module === "proxy" && query.action === "eth_blockNumber")
    .reply(200, { jsonrpc: "2.0", id: 1, result: "0x65" });

  await assert.rejects(
    () => verifyDirectBscUsdtPayment({
      txHash,
      expectedRecipientAddress: recipientAddress,
      expectedTokenAddress: tokenAddress,
      expectedAmount: "1.605851",
    }),
    (error) => error?.code === "INCORRECT_AMOUNT",
  );
});

test("HesabPay quote uses AFN and never USDT", async () => {
  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query(
      (query) =>
        query.apikey === "test-currencyfreaks-key" &&
        query.symbols === "AFN",
    )
    .reply(200, { rates: { AFN: 70 } });

  const res = mockRes();
  await getUsdToAfnQuote({ query: { amount: 15 } }, res);

  assert.equal(res.body.amountAfn, 1050);
  assert.equal(res.body.currencyTo, "AFN");
  assert.notEqual(res.body.currencyTo, "USDT");
});

test("Afghanistan regional fallback stores the exact AFN amount sent to HesabPay", async () => {
  const regionalCourse = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    currency: "USD",
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
  let storedPayment = null;
  let hesabCreateBody = null;

  mockingoose(Course).toReturn(regionalCourse, "findById");
  mockingoose(Course).toReturn(regionalCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(Payment).toReturn((document) => {
    storedPayment = document.toObject();
    return document;
  }, "save");

  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query(
      (query) =>
        query.apikey === "test-currencyfreaks-key" &&
        query.symbols === "AFN",
    )
    .reply(200, { rates: { AFN: 70 } });
  nock("https://api.hesab.test")
    .post(
      "/api/v1/payment/create-session",
      (body) => {
        hesabCreateBody = body;
        return body.currency === "AFN" && body.amount === 1050;
      },
    )
    .reply(200, {
      status_code: 10,
      success: true,
      session_id: "hesab-regional-afghanistan",
      payment_url: "https://developers.hesab.com/pay/regional-afghanistan/en",
    });

  const res = mockRes();
  await createCheckout(makeReq({
    user: {
      ...fakeStudent,
      country: "Afghanistan",
    },
    body: {
      courseId: regionalCourse._id,
      paymentMethod: "HESABPAY_HOSTED",
      pricingRegion: "iran",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.basePrice.amount, "15.00");
  assert.equal(Number(res.body.charge.amount), 1050);
  assert.equal(res.body.charge.currency, "AFN");
  assert.equal(storedPayment?.pricingRegion, "afghanistan");
  assert.equal(storedPayment?.sourcePriceAmount, 1050);
  assert.equal(storedPayment?.sourcePriceCurrency, "AFN");
  assert.equal(storedPayment?.sourceExchangeRate, 70);
  assert.equal(storedPayment?.amount, 1050);
  assert.equal(storedPayment?.gatewayCurrency, "AFN");
  assert.equal(hesabCreateBody?.user_id, String(res.body.paymentAttemptId));
  assert.equal(hesabCreateBody?.items?.[0]?.id, res.body.paymentReference);
  const successUrl = new URL(hesabCreateBody.redirect_success_url);
  const failureUrl = new URL(hesabCreateBody.redirect_failure_url);
  for (const redirectUrl of [successUrl, failureUrl]) {
    assert.equal(
      redirectUrl.searchParams.get("paymentAttemptId"),
      String(res.body.paymentAttemptId),
    );
    assert.equal(redirectUrl.searchParams.get("ref"), res.body.paymentReference);
    assert.equal(redirectUrl.searchParams.get("orderId"), String(res.body.orderId));
  }
  assert.equal(successUrl.pathname, "/payment/success");
  assert.equal(failureUrl.pathname, "/payment/failure");
  assert.equal(res.body.resumed, false);
});

test("HesabPay checkout never reopens or replaces an issued pending hosted session", async () => {
  const orderId = new mongoose.Types.ObjectId();
  const oldAttemptId = new mongoose.Types.ObjectId();
  const oldAttempt = {
    _id: oldAttemptId,
    orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference: "PAY-old-hesab-session",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    exchangeRate: "70",
    providerUrl: "https://developers.hesab.com/pay/OLD/en",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
  mockingoose(Course).toReturn(fakeCourse, "findById");
  mockingoose(Course).toReturn(fakeCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    baseAmountUsdCents: 1500,
    originalBaseAmountUsdCents: 1500,
    pricingRegion: "international",
    sourcePriceAmount: 15,
    sourcePriceCurrency: "USD",
    sourceExchangeRate: 1,
    platformCommissionRate: 0,
    status: "PENDING",
  }, "findOne");
  mockingoose(PaymentAttempt).toReturn(oldAttempt, "findOne");

  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query(
      (query) =>
        query.apikey === "test-currencyfreaks-key" &&
        query.symbols === "AFN",
    )
    .reply(200, { rates: { AFN: 70 } });
  const providerSessionRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      status_code: 10,
      success: true,
      url: "https://developers.hesab.com/pay/NEW/en",
    });

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "HESABPAY_HOSTED",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.paymentAttemptId), String(oldAttemptId));
  assert.equal(res.body.paymentReference, oldAttempt.paymentReference);
  assert.equal(res.body.resumed, true);
  assert.equal(res.body.paymentUrl, null);
  assert.match(res.body.statusUrl || "", new RegExp(String(oldAttemptId)));
  assert.equal(providerSessionRequest.isDone(), false);
});

test("an explicit restart creates a fresh HesabPay session after expiry", async () => {
  const expiredAttemptId = new mongoose.Types.ObjectId();
  const expiredAttempt = {
    _id: expiredAttemptId,
    orderId: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference: "PAY-expired-hesab-restart",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    providerUrl: "https://developers.hesab.com/pay/EXPIRED/en",
    issuanceState: "ISSUED",
    status: "EXPIRED",
    expiresAt: new Date(Date.now() - 60_000),
  };

  mockCourseCheckoutFlow();
  mockingoose(PaymentAttempt).toReturn([expiredAttempt], "find");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");

  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query(
      (query) =>
        query.apikey === "test-currencyfreaks-key" &&
        query.symbols === "AFN",
    )
    .reply(200, { rates: { AFN: 70 } });
  const providerSessionRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      status_code: 10,
      success: true,
      session_id: "hesab-restarted-session",
      payment_url: "https://developers.hesab.com/pay/RESTARTED/en",
    });

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "HESABPAY_HOSTED",
      restartExpired: true,
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resumed, false);
  assert.notEqual(String(res.body.paymentAttemptId), String(expiredAttemptId));
  assert.equal(
    res.body.paymentUrl,
    "https://developers.hesab.com/pay/RESTARTED/en",
  );
  assert.equal(providerSessionRequest.isDone(), true);
});

test("an issued expired direct payment remains recoverable instead of creating another charge", async () => {
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: attemptId,
    orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference: "PAY-expired-direct-recovery",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    baseAmountUsdCents: 1500,
    amount: "15.000123",
    currency: "USDT",
    network: "BNB_CHAIN",
    providerUrl: "ethereum:0x057b1d7e10296d247d1b7c75eb4ae3aaf3daeea7",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
    rawCreateSessionResponse: { qrPayload: "ethereum:public-payment-qr", secret: "hidden" },
    status: "EXPIRED",
    expiresAt: new Date(Date.now() - 60_000),
  };
  mockingoose(Course).toReturn(fakeCourse, "findById");
  mockingoose(Course).toReturn(fakeCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([attempt], "find");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.paymentAttemptId), String(attemptId));
  assert.equal(res.body.resumed, true);
  assert.equal(res.body.status, "EXPIRED");
  assert.equal(res.body.paymentUrl, null);
  assert.equal(res.body.payment.qrPayload, "ethereum:public-payment-qr");
  assert.equal(res.body.payment.rawCreateSessionResponse, undefined);
  assert.equal(res.body.payment.providerUrl, undefined);
});

test("an explicit restart creates a fresh direct BSC quote after expiry", async () => {
  const expiredAttemptId = new mongoose.Types.ObjectId();
  const expiredAttempt = {
    _id: expiredAttemptId,
    orderId: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference: "PAY-expired-direct-restart",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    baseAmountUsdCents: 1500,
    amount: "15.000123",
    currency: "USDT",
    network: "BNB_CHAIN",
    providerUrl: "ethereum:expired-direct-request",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    tokenMint: process.env.BSC_USDT_CONTRACT_ADDRESS,
    status: "EXPIRED",
    expiresAt: new Date(Date.now() - 60_000),
  };

  mockCourseCheckoutFlow();
  mockingoose(PaymentAttempt).toReturn([expiredAttempt], "find");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");

  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "USDT_BSC_DIRECT",
      restartExpired: true,
    },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, "BSC_DIRECT");
  assert.notEqual(String(res.body.paymentAttemptId), String(expiredAttemptId));
  assert.match(res.body.charge.amount, /^15\.\d{6}$/);
});

test("an issued payment blocks a second payment method for the same course", async () => {
  const activeAttempt = {
    _id: new mongoose.Types.ObjectId(),
    orderId: new mongoose.Types.ObjectId(),
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference: "PAY-active-direct-cross-method",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    baseAmountUsdCents: 1500,
    amount: "15.000456",
    currency: "USDT",
    network: "BNB_CHAIN",
    recipientAddress: process.env.BSC_RECIPIENT_ADDRESS,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
  };
  mockingoose(Course).toReturn(fakeCourse, "findById");
  mockingoose(Course).toReturn(fakeCourse, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([activeAttempt], "find");

  const providerRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      success: true,
      status_code: 10,
      url: "https://developers.hesab.com/pay/should-not-exist/en",
    });
  const res = mockRes();
  await createCheckout(makeReq({
    body: {
      courseId: fakeCourse._id,
      paymentMethod: "HESABPAY_HOSTED",
    },
  }), res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "ACTIVE_PAYMENT_EXISTS");
  assert.equal(String(res.body.paymentAttemptId), String(activeAttempt._id));
  assert.equal(res.body.activePayment.providerUrl, undefined);
  assert.equal(providerRequest.isDone(), false);
});

test("an orphaned Hesab attempt is expired and replaced with one valid provider session", async () => {
  const course = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    currency: "USD",
    price: 15,
  };
  const orderId = new mongoose.Types.ObjectId();
  const orphanId = new mongoose.Types.ObjectId();
  let orphanWasExpired = false;
  const orphanAttempt = {
    _id: orphanId,
    orderId,
    userId: fakeStudent._id,
    courseId: course._id,
    paymentReference: "PAY-orphan-hesab",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 10 * 60_000),
    save: async function save() { return this; },
  };
  const order = {
    _id: orderId,
    userId: fakeStudent._id,
    courseId: course._id,
    baseAmountUsdCents: 1500,
    originalBaseAmountUsdCents: 1500,
    pricingRegion: "international",
    sourcePriceAmount: 15,
    sourcePriceCurrency: "USD",
    sourceExchangeRate: 1,
    platformCommissionRate: 0,
    status: "PENDING",
  };
  mockingoose(Course).toReturn(course, "findById");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn([orphanAttempt], "find");
  mockingoose(PaymentAttempt).toReturn(null, "findOne");
  mockingoose(PaymentAttempt).toReturn((document) => {
    if (String(document._id) === String(orphanId) && document.status === "EXPIRED") {
      orphanWasExpired = true;
    }
    return document;
  }, "save");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");

  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query((query) => query.apikey === "test-currencyfreaks-key" && query.symbols === "AFN")
    .reply(200, { rates: { AFN: 70 } });
  const providerRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      success: true,
      status_code: 10,
      session_id: "fresh-after-orphan",
      url: "https://developers.hesab.com/pay/fresh-after-orphan/en",
    });

  const res = mockRes();
  await createCheckout(makeReq({
    body: { courseId: course._id, paymentMethod: "HESABPAY_HOSTED" },
  }), res);

  assert.equal(orphanWasExpired, true);
  assert.equal(res.statusCode, 200);
  assert.notEqual(String(res.body.paymentAttemptId), String(orphanId));
  assert.equal(res.body.resumed, false);
  assert.equal(providerRequest.isDone(), true);
});

test("an ambiguous Hesab provider error is held for review instead of unlocking a retry", async () => {
  const course = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    currency: "USD",
    price: 15,
  };
  let ambiguousAttemptSaved = false;
  mockCourseCheckoutFlow();
  mockingoose(Course).toReturn(course, "findById");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(PaymentAttempt).toReturn((document) => {
    if (
      document.status === "MANUAL_REVIEW" &&
      document.issuanceState === "AMBIGUOUS"
    ) {
      ambiguousAttemptSaved = true;
    }
    return document;
  }, "save");
  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query((query) => query.apikey === "test-currencyfreaks-key" && query.symbols === "AFN")
    .reply(200, { rates: { AFN: 70 } });
  nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(503, { message: "Provider result unavailable" });

  const res = mockRes();
  await createCheckout(makeReq({
    body: { courseId: course._id, paymentMethod: "HESABPAY_HOSTED" },
  }), res);

  assert.equal(res.statusCode, 502);
  assert.equal(ambiguousAttemptSaved, true);
  assert.match(res.body.message, /HesabPay error/i);
});

test("the active-attempt uniqueness race permits only one Hesab provider session call", async () => {
  const course = {
    ...fakeCourse,
    _id: new mongoose.Types.ObjectId(),
    currency: "USD",
    price: 15,
  };
  const orderId = new mongoose.Types.ObjectId();
  const order = {
    _id: orderId,
    userId: fakeStudent._id,
    courseId: course._id,
    baseAmountUsdCents: 1500,
    originalBaseAmountUsdCents: 1500,
    pricingRegion: "international",
    sourcePriceAmount: 15,
    sourcePriceCurrency: "USD",
    sourceExchangeRate: 1,
    platformCommissionRate: 0,
    status: "PENDING",
  };
  mockingoose(Course).toReturn(course, "findById");
  mockingoose(Course).toReturn(course, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Order).toReturn(order, "findOne");
  mockingoose(PaymentAttempt).toReturn([], "find");
  mockingoose(Payment).toReturn([{ _id: new mongoose.Types.ObjectId() }], "create");

  let winningAttempt = null;
  mockingoose(PaymentAttempt).toReturn((query) => {
    const filter = query.getQuery();
    return filter.method ? null : winningAttempt;
  }, "findOne");
  mockingoose(PaymentAttempt).toReturn((document) => document, "save");

  const originalCreate = PaymentAttempt.create;
  let createCalls = 0;
  let releaseFirstCreate;
  const secondCreateReached = new Promise((resolve) => {
    releaseFirstCreate = resolve;
  });
  PaymentAttempt.create = async (rows) => {
    createCalls += 1;
    if (createCalls === 1) {
      winningAttempt = new PaymentAttempt(rows[0]);
      await secondCreateReached;
      return [winningAttempt];
    }
    releaseFirstCreate();
    const duplicateError = new Error("duplicate active attempt");
    duplicateError.code = 11000;
    duplicateError.keyPattern = { orderId: 1 };
    throw duplicateError;
  };

  nock("https://api.currencyfreaks.test")
    .get("/v2.0/rates/latest")
    .query((query) => query.apikey === "test-currencyfreaks-key" && query.symbols === "AFN")
    .times(2)
    .reply(200, { rates: { AFN: 70 } });
  const providerRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .once()
    .reply(200, {
      success: true,
      status_code: 10,
      session_id: "single-concurrent-session",
      url: "https://developers.hesab.com/pay/single-concurrent-session/en",
    });

  try {
    const firstRes = mockRes();
    const secondRes = mockRes();
    await Promise.all([
      createCheckout(makeReq({
        body: { courseId: course._id, paymentMethod: "HESABPAY_HOSTED" },
      }), firstRes),
      createCheckout(makeReq({
        body: { courseId: course._id, paymentMethod: "HESABPAY_HOSTED" },
      }), secondRes),
    ]);

    assert.equal(createCalls, 2);
    assert.equal(providerRequest.isDone(), true);
    assert.equal([firstRes.statusCode, secondRes.statusCode].filter((code) => code === 200).length, 2);
    assert.equal([firstRes.body.resumed, secondRes.body.resumed].includes(true), true);
  } finally {
    PaymentAttempt.create = originalCreate;
  }
});

test("checkout reconciles a succeeded partial payment instead of issuing a second session", async () => {
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();
  const paidAt = new Date("2026-08-14T08:00:00.000Z");
  const succeededAttempt = {
    _id: attemptId,
    orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    legacyPaymentId: paymentId,
    paymentReference: "PAY-checkout-succeeded-recovery",
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    status: "SUCCEEDED",
    paidAt,
    verifiedAt: paidAt,
    save: async function save() { return this; },
  };
  const paidOrder = {
    _id: orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    status: "PAID",
    baseAmountUsdCents: 1500,
    paidAt,
  };
  let enrollment = null;
  let enrollmentUpserts = 0;

  mockingoose(Course).toReturn(fakeCourse, "findById");
  mockingoose(Course).toReturn(fakeCourse, "findOne");
  mockingoose(Enrollment).toReturn(() => enrollment, "findOne");
  mockingoose(Enrollment).toReturn(() => {
    enrollmentUpserts += 1;
    enrollment = {
      _id: enrollmentId,
      studentId: fakeStudent._id,
      courseId: fakeCourse._id,
      paymentId,
      enrollmentStatus: "active",
      accessStatus: "allowed",
    };
    return enrollment;
  }, "findOneAndUpdate");
  mockingoose(PaymentAttempt).toReturn([succeededAttempt], "find");
  mockingoose(PaymentAttempt).toReturn(succeededAttempt, "findOne");
  mockingoose(Order).toReturn(paidOrder, "findOne");
  mockingoose(Payment).toReturn({ _id: paymentId }, "findOne");
  mockingoose(Payment).toReturn({ acknowledged: true, modifiedCount: 1 }, "updateOne");
  mockingoose(User).toReturn(null, "findOne");

  const providerRequest = nock("https://api.hesab.test")
    .post("/api/v1/payment/create-session")
    .reply(200, {
      success: true,
      status_code: 10,
      url: "https://developers.hesab.com/pay/must-not-be-created/en",
    });
  const res = mockRes();
  await createCheckout(makeReq({
    body: { courseId: fakeCourse._id, paymentMethod: "HESABPAY_HOSTED" },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(enrollmentUpserts, 1);
  assert.equal(res.body.status, "SUCCEEDED");
  assert.equal(String(res.body.paymentAttemptId), String(attemptId));
  assert.equal(providerRequest.isDone(), false);
});

test("HesabPay webhook rejects malformed payloads instead of acknowledging them", async () => {
  const res = mockRes();
  await hesabPayWebhook({ body: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /signature|timestamp/i);
});

test("HesabPay webhook returns a retryable error when signature verification is unavailable", async () => {
  nock("https://api.hesab.test")
    .post("/api/v1/hesab/webhooks/verify-signature")
    .reply(503, { message: "Temporarily unavailable" });

  const res = mockRes();
  await hesabPayWebhook({
    body: {
      signature: "retry-signature",
      timestamp: "1707719607",
    },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /processing error/i);
});

test("HesabPay webhook resolves official user_id before validating the amount", async () => {
  const attemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentReference = "PAY-hesab-user-id";
  let attemptLookup = null;

  mockingoose(PaymentAttempt).toReturn((query) => {
    attemptLookup = query.getQuery();
    return {
      _id: attemptId,
      orderId,
      userId: fakeStudent._id,
      courseId: fakeCourse._id,
      paymentReference,
      provider: "HESABPAY",
      method: "HESABPAY_HOSTED",
      baseAmountUsdCents: 1500,
      amount: "1050",
      currency: "AFN",
      status: "PENDING",
    };
  }, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    baseAmountUsdCents: 1500,
    status: "PENDING",
  }, "findOne");
  nock("https://api.hesab.test")
    .post("/api/v1/hesab/webhooks/verify-signature", {
      signature: "verified-signature",
      timestamp: "1707719607",
    })
    .reply(200, { success: true });

  const res = mockRes();
  await hesabPayWebhook({
    body: {
      status_code: 10,
      success: true,
      user_id: String(attemptId),
      amount: 999,
      signature: "verified-signature",
      timestamp: "1707719607",
      transaction_id: "hesab-transaction-1",
      items: [{ id: paymentReference, name: fakeCourse.title, price: 1050 }],
    },
  }, res);

  assert.equal(String(attemptLookup?._id), String(attemptId));
  assert.equal(attemptLookup?.method, "HESABPAY_HOSTED");
  assert.equal(res.statusCode, 422);
  assert.match(res.body.message, /amount mismatch/i);
});

test("HesabPay webhook rejects an unmatched user_id without falling back to the item id", async () => {
  const unmatchedAttemptId = new mongoose.Types.ObjectId();
  const paymentReference = "PAY-item-must-not-override-user-id";
  const attemptLookups = [];

  mockingoose(PaymentAttempt).toReturn((query) => {
    const filter = query.getQuery();
    attemptLookups.push(filter);
    if (filter.paymentReference === paymentReference) {
      return {
        _id: new mongoose.Types.ObjectId(),
        orderId: new mongoose.Types.ObjectId(),
        userId: fakeStudent._id,
        courseId: fakeCourse._id,
        paymentReference,
        provider: "HESABPAY",
        method: "HESABPAY_HOSTED",
        baseAmountUsdCents: 1500,
        amount: "1050",
        currency: "AFN",
        status: "PENDING",
      };
    }
    return null;
  }, "findOne");
  nock("https://api.hesab.test")
    .post("/api/v1/hesab/webhooks/verify-signature")
    .reply(200, { success: true });

  const res = mockRes();
  await hesabPayWebhook({
    body: {
      status_code: 10,
      success: true,
      user_id: String(unmatchedAttemptId),
      amount: 1050,
      signature: "verified-unmatched-user-id",
      timestamp: "1707719607",
      transaction_id: "hesab-transaction-unmatched-user-id",
      items: [{ id: paymentReference, name: fakeCourse.title, price: 1050 }],
    },
  }, res);

  assert.equal(attemptLookups.length, 1);
  assert.equal(String(attemptLookups[0]?._id), String(unmatchedAttemptId));
  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /not found/i);
});

test("HesabPay webhook keeps item-id lookup for sessions created before user_id support", async () => {
  const attemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentReference = "PAY-legacy-item-id";
  let attemptLookup = null;

  mockingoose(PaymentAttempt).toReturn((query) => {
    attemptLookup = query.getQuery();
    return {
      _id: attemptId,
      orderId,
      userId: fakeStudent._id,
      courseId: fakeCourse._id,
      paymentReference,
      provider: "HESABPAY",
      method: "HESABPAY_HOSTED",
      baseAmountUsdCents: 1500,
      amount: "1050",
      currency: "AFN",
      status: "PENDING",
    };
  }, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    baseAmountUsdCents: 1500,
    status: "PENDING",
  }, "findOne");
  nock("https://api.hesab.test")
    .post("/api/v1/hesab/webhooks/verify-signature")
    .reply(200, { success: true });

  const res = mockRes();
  await hesabPayWebhook({
    body: {
      status_code: 10,
      success: true,
      amount: 999,
      signature: "legacy-signature",
      timestamp: "1707719607",
      items: [{ id: paymentReference, name: fakeCourse.title, price: 1050 }],
    },
  }, res);

  assert.equal(attemptLookup?.paymentReference, paymentReference);
  assert.equal(attemptLookup?.method, "HESABPAY_HOSTED");
  assert.equal(res.statusCode, 422);
});

test("HesabPay webhook rejects a supplied non-AFN currency", async () => {
  const attemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentReference = "PAY-hesab-currency-binding";
  mockingoose(PaymentAttempt).toReturn({
    _id: attemptId,
    orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    paymentReference,
    provider: "HESABPAY",
    method: "HESABPAY_HOSTED",
    baseAmountUsdCents: 1500,
    amount: "1050",
    currency: "AFN",
    status: "PENDING",
  }, "findOne");
  mockingoose(Order).toReturn({
    _id: orderId,
    userId: fakeStudent._id,
    courseId: fakeCourse._id,
    baseAmountUsdCents: 1500,
    status: "PENDING",
  }, "findOne");
  nock("https://api.hesab.test")
    .post("/api/v1/hesab/webhooks/verify-signature")
    .reply(200, { success: true });

  const res = mockRes();
  await hesabPayWebhook({
    body: {
      status_code: 10,
      success: true,
      user_id: String(attemptId),
      amount: 1050,
      currency: "USD",
      signature: "currency-binding-signature",
      timestamp: "1707719610",
      items: [{ id: paymentReference, currency: "USD" }],
    },
  }, res);

  assert.equal(res.statusCode, 422);
  assert.match(res.body.message, /currency mismatch/i);
});

test("student can recover the latest payment status from a user-owned orderId", async () => {
  const orderId = new mongoose.Types.ObjectId();
  const attemptId = new mongoose.Types.ObjectId();
  const statusLookups = [];

  mockingoose(PaymentAttempt).toReturn((query) => {
    const statusLookup = query.getQuery();
    statusLookups.push(statusLookup);
    if (statusLookup.status === "SUCCEEDED") return null;
    return {
      _id: attemptId,
      orderId,
      userId: fakeStudent._id,
      courseId: fakeCourse._id,
      paymentReference: "PAY-order-recovery",
      provider: "HESABPAY",
      method: "HESABPAY_HOSTED",
      baseAmountUsdCents: 1500,
      amount: "1050",
      currency: "AFN",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    };
  }, "findOne");

  const res = mockRes();
  await getStudentPaymentStatus(makeReq({
    params: { orderId: String(orderId) },
  }), res);

  assert.equal(statusLookups[0]?.status, "SUCCEEDED");
  assert.equal(String(statusLookups[1]?.orderId), String(orderId));
  assert.equal(String(statusLookups[1]?.userId), String(fakeStudent._id));
  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.paymentAttemptId), String(attemptId));
  assert.equal(res.body.status, "PENDING");
});

test("repeated completion is idempotent and second crypto payment becomes duplicate", async () => {
  const orderId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const attemptId1 = new mongoose.Types.ObjectId();
  const attemptId2 = new mongoose.Types.ObjectId();

  const attempt1 = {
    _id: attemptId1,
    orderId,
    userId: fakeStudent._id,
    courseId,
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    amount: "15.000000",
    currency: "USDT",
    network: "BNB_CHAIN",
    paymentReference: "PAY-1",
    save: async function save() { return this; },
  };

  const attempt2 = {
    _id: attemptId2,
    orderId,
    userId: fakeStudent._id,
    courseId,
    status: "PENDING",
    provider: "BSC_DIRECT",
    method: "USDT_BSC_DIRECT",
    amount: "15.000000",
    currency: "USDT",
    network: "BNB_CHAIN",
    paymentReference: "PAY-2",
    save: async function save() { return this; },
  };

  mockingoose(PaymentAttempt).toReturn(attempt1, "findById");
  mockingoose(PaymentAttempt).toReturn(attempt1, "findOne");
  mockingoose(Order).toReturn({ _id: orderId, userId: fakeStudent._id, courseId, status: "PENDING", baseAmountUsdCents: 1500 }, "findById");
  mockingoose(Order).toReturn({ _id: orderId, userId: fakeStudent._id, courseId, status: "PENDING", baseAmountUsdCents: 1500 }, "findOne");
  mockingoose(Order).toReturn({ _id: orderId, userId: fakeStudent._id, courseId, status: "PAID", baseAmountUsdCents: 1500 }, "findOneAndUpdate");
  mockingoose(Course).toReturn({ _id: courseId }, "findById");
  mockingoose(Course).toReturn({ _id: courseId }, "findOne");
  mockingoose(Enrollment).toReturn(null, "findOne");
  mockingoose(Enrollment).toReturn({ _id: new mongoose.Types.ObjectId(), enrollmentStatus: "active", accessStatus: "allowed" }, "findOneAndUpdate");
  mockingoose(Payment).toReturn({ _id: new mongoose.Types.ObjectId() }, "findById");
  mockingoose(Payment).toReturn({ _id: new mongoose.Types.ObjectId() }, "findOne");
  mockingoose(Payment).toReturn({ _id: new mongoose.Types.ObjectId() }, "create");

  const first = await completePayment({ paymentAttemptId: attemptId1 });
  assert.equal(first.order.status, "PAID");

  mockingoose(PaymentAttempt).toReturn(attempt2, "findById");
  mockingoose(PaymentAttempt).toReturn(attempt2, "findOne");
  mockingoose(Order).toReturn({ _id: orderId, userId: fakeStudent._id, courseId, status: "PAID", baseAmountUsdCents: 1500 }, "findById");
  mockingoose(Order).toReturn({ _id: orderId, userId: fakeStudent._id, courseId, status: "PAID", baseAmountUsdCents: 1500 }, "findOne");
  mockingoose(Order).toReturn(null, "findOneAndUpdate");

  const second = await completePayment({ paymentAttemptId: attemptId2 });
  assert.equal(second.duplicate, true);
});
