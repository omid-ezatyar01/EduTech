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
import { createCheckout, getUsdToAfnQuote } from "../src/controllers/payment.controller.js";
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

test("direct BSC verification confirms a valid payment through the BscScan API", async () => {
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

test("direct BSC verification rejects mismatched amounts through the BscScan API", async () => {
  process.env.BSCSCAN_API_KEY = "test-bscscan-key";

  const txHash = `0x${"b".repeat(64)}`;
  const fromAddress = "0x2222222222222222222222222222222222222222";
  const recipientAddress = process.env.BSC_RECIPIENT_ADDRESS;
  const tokenAddress = process.env.BSC_USDT_CONTRACT_ADDRESS;
  const transferValue = 1500000000000000000n;
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
      (body) => body.currency === "AFN" && body.amount === 1050,
    )
    .reply(200, {
      data: {
        session_id: "hesab-regional-afghanistan",
        payment_url: "https://checkout.hesab.test/regional-afghanistan",
      },
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
