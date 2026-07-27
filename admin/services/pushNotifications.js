import {
  buildAuthHeaders,
  getApiBase,
  parseJsonResponse,
} from "./http.js";
import { readLocalStorage, writeLocalStorage } from "./portal.js";

const PROMPTED_KEY = "edutech_push_prompted_admin";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0)),
  );
};

const fetchVapidPublicKey = async () => {
  const response = await fetch(`${getApiBase()}/push/vapid-public-key`, {
    cache: "no-store",
  });
  const payload = await parseJsonResponse(response);
  if (!payload?.data?.enabled || !payload?.data?.publicKey) return "";
  return payload.data.publicKey;
};

const saveSubscription = async (subscription) => {
  const response = await fetch(`${getApiBase()}/push/subscriptions`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      app: "admin",
      subscription: subscription.toJSON(),
    }),
  });
  await parseJsonResponse(response);
};

export const enableAdminPushNotifications = async ({ promptIfNeeded = true } = {}) => {
  if (typeof window === "undefined") return false;
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    if (!promptIfNeeded) return false;
    if (readLocalStorage(PROMPTED_KEY) === "true") return false;
    writeLocalStorage(PROMPTED_KEY, "true");
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return false;

  await navigator.serviceWorker.register("/edutech-admin-push-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const existingSubscription =
    await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await saveSubscription(subscription);
  return true;
};
