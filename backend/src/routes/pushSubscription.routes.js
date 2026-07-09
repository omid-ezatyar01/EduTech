import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  deletePushSubscription,
  getPushVapidPublicKey,
  savePushSubscription,
} from "../controllers/pushSubscriptionController.js";

const router = express.Router();

router.get("/push/vapid-public-key", getPushVapidPublicKey);
router.post("/push/subscriptions", protect, savePushSubscription);
router.delete("/push/subscriptions", protect, deletePushSubscription);

export default router;
