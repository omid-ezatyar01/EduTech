import Joi from "joi";
import PushSubscription from "../models/PushSubscription.js";
import ApiResponse from "../utils/ApiResponse.js";
import { getWebPushPublicKey, isWebPushConfigured } from "../services/webPush.service.js";

const subscriptionSchema = Joi.object({
  app: Joi.string().valid("student", "teacher", "admin", "support").required(),
  subscription: Joi.object({
    endpoint: Joi.string().uri().required(),
    expirationTime: Joi.any().allow(null),
    keys: Joi.object({
      p256dh: Joi.string().required(),
      auth: Joi.string().required(),
    }).required(),
  }).required(),
});

const unsubscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
});

export const getPushVapidPublicKey = (req, res) => {
  return res.json(
    new ApiResponse({
      message: "Web push public key fetched successfully",
      data: {
        publicKey: getWebPushPublicKey(),
        enabled: isWebPushConfigured(),
      },
    }),
  );
};

export const savePushSubscription = async (req, res) => {
  const { error, value } = subscriptionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  if (!["student", "teacher", "admin", "support"].includes(req.user.role)) {
    return res.status(403).json({ message: "Push notifications are not available for this account" });
  }

  if (value.app !== req.user.role) {
    return res.status(400).json({ message: "Push app does not match the logged-in user role" });
  }

  const row = await PushSubscription.findOneAndUpdate(
    { endpoint: value.subscription.endpoint },
    {
      $set: {
        userId: req.user._id,
        role: req.user.role,
        app: value.app,
        endpoint: value.subscription.endpoint,
        keys: {
          p256dh: value.subscription.keys.p256dh,
          auth: value.subscription.keys.auth,
        },
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        lastSubscribedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return res.json(
    new ApiResponse({
      message: "Push subscription saved successfully",
      data: { id: String(row._id) },
    }),
  );
};

export const deletePushSubscription = async (req, res) => {
  const { error, value } = unsubscribeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  await PushSubscription.deleteOne({
    endpoint: value.endpoint,
    userId: req.user._id,
  });

  return res.json(
    new ApiResponse({
      message: "Push subscription removed successfully",
      data: { endpoint: value.endpoint },
    }),
  );
};
