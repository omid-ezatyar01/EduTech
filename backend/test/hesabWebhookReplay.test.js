import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import mongoose from "mongoose";
import mockingoose from "mockingoose";

import HesabWebhookReceipt from "../src/models/HesabWebhookReceipt.js";
import {
  claimHesabWebhookDelivery,
  completeHesabWebhookDelivery,
} from "../src/services/hesabWebhookReplay.service.js";

let storedReceipt;

beforeEach(() => {
  mockingoose.resetAll();
  storedReceipt = null;

  mockingoose(HesabWebhookReceipt).toReturn((query) => {
    const filter = query.getQuery();
    const update = query.getUpdate();

    if (filter.credentialHash) {
      if (!storedReceipt) {
        storedReceipt = {
          _id: new mongoose.Types.ObjectId(),
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
          deliveryCount: 1,
        };
      } else {
        storedReceipt = {
          ...storedReceipt,
          ...(update.$set || {}),
          deliveryCount: Number(storedReceipt.deliveryCount || 0) + 1,
        };
      }
      return storedReceipt;
    }

    if (
      storedReceipt &&
      String(filter._id || "") === String(storedReceipt._id) &&
      filter.payloadHash === storedReceipt.payloadHash
    ) {
      storedReceipt = {
        ...storedReceipt,
        ...(update.$set || {}),
        attemptCount: Number(storedReceipt.attemptCount || 0) + 1,
      };
      return storedReceipt;
    }
    return null;
  }, "findOneAndUpdate");

  mockingoose(HesabWebhookReceipt).toReturn(() => storedReceipt, "findOne");
  mockingoose(HesabWebhookReceipt).toReturn((query) => {
    const filter = query.getQuery();
    const update = query.getUpdate();
    if (
      !storedReceipt ||
      String(filter._id || "") !== String(storedReceipt._id) ||
      filter.claimToken !== storedReceipt.claimToken
    ) {
      return { acknowledged: true, modifiedCount: 0 };
    }
    storedReceipt = {
      ...storedReceipt,
      ...(update.$set || {}),
      claimToken: undefined,
      leaseExpiresAt: undefined,
    };
    return { acknowledged: true, modifiedCount: 1 };
  }, "updateOne");
});

test("Hesab webhook receipt makes an exact processed replay idempotent", async () => {
  const payload = {
    signature: "signed-credential",
    timestamp: "1707719607",
    user_id: "attempt-1",
    amount: 1050,
  };

  const first = await claimHesabWebhookDelivery({
    signature: payload.signature,
    timestamp: payload.timestamp,
    payload,
  });
  assert.equal(first.state, "CLAIMED");

  await completeHesabWebhookDelivery({
    receiptId: first.receipt._id,
    claimToken: first.claimToken,
    paymentAttemptId: new mongoose.Types.ObjectId(),
  });

  const replay = await claimHesabWebhookDelivery({
    signature: payload.signature,
    timestamp: payload.timestamp,
    payload: { amount: 1050, user_id: "attempt-1", ...payload },
  });
  assert.equal(replay.state, "PROCESSED");
});

test("Hesab webhook receipt rejects changed payload under the same credential", async () => {
  const credential = {
    signature: "bound-signature",
    timestamp: "1707719608",
  };
  const first = await claimHesabWebhookDelivery({
    ...credential,
    payload: { ...credential, user_id: "attempt-1", amount: 1050 },
  });
  assert.equal(first.state, "CLAIMED");

  const alteredReplay = await claimHesabWebhookDelivery({
    ...credential,
    payload: { ...credential, user_id: "attempt-1", amount: 1 },
  });
  assert.equal(alteredReplay.state, "PAYLOAD_MISMATCH");
});

test("Hesab webhook receipt reports a concurrent exact delivery as in progress", async () => {
  const payload = {
    signature: "concurrent-signature",
    timestamp: "1707719609",
    user_id: "attempt-2",
    amount: 700,
  };
  const first = await claimHesabWebhookDelivery({
    signature: payload.signature,
    timestamp: payload.timestamp,
    payload,
  });
  const concurrent = await claimHesabWebhookDelivery({
    signature: payload.signature,
    timestamp: payload.timestamp,
    payload,
  });

  assert.equal(first.state, "CLAIMED");
  assert.equal(concurrent.state, "IN_PROGRESS");
});
