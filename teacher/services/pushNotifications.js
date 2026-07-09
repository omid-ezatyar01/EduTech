import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";
import { readLocalStorage, writeLocalStorage } from "./portal";

const PROMPTED_KEY = "edutech_course_push_prompted_teacher";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const fetchVapidPublicKey = async () => {
  const response = await fetch(`${getApiBase()}/push/vapid-public-key`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  if (!data?.data?.enabled || !data?.data?.publicKey) return "";
  return data.data.publicKey;
};

const saveSubscription = async (subscription) => {
  const response = await fetch(`${getApiBase()}/push/subscriptions`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      app: "teacher",
      subscription: subscription.toJSON(),
    }),
  });
  await parseJsonResponse(response);
};

export const enableCoursePushNotifications = async () => {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return false;

  let permission = Notification.permission;
  if (permission === "default") {
    if (readLocalStorage(PROMPTED_KEY) === "true") return false;
    writeLocalStorage(PROMPTED_KEY, "true");
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return false;

  await navigator.serviceWorker.register("/edutech-teacher-push-sw.js");
  const readyRegistration = await navigator.serviceWorker.ready;
  const existingSubscription = await readyRegistration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await saveSubscription(subscription);
  return true;
};
